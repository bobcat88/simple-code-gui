use crate::ai_runtime::RuntimeManager;
use crate::database::DatabaseManager;
use crate::gsd_engine::types::{ExecutionEvent, GsdPhase, GsdStep, StepStatus};
use chrono::Utc;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::task::JoinSet;
use tokio::time::{sleep, Duration};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ExecutionMode {
    Quick,
    Full,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct PlanRuntimeConfig {
    pub mode: ExecutionMode,
    pub wave_size: usize,
    pub verifier_retries: u32,
}

pub(crate) fn resolve_runtime_config(
    metadata: &HashMap<String, String>,
    step_count: usize,
) -> PlanRuntimeConfig {
    let mode = match metadata.get("execution_mode").map(|value| value.as_str()) {
        Some("quick") => ExecutionMode::Quick,
        _ => ExecutionMode::Full,
    };

    let default_wave_size = match mode {
        ExecutionMode::Quick => 1,
        ExecutionMode::Full => step_count.clamp(1, 3),
    };

    let wave_size = metadata
        .get("wave_size")
        .and_then(|value| value.parse::<usize>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(default_wave_size);

    let verifier_retries = metadata
        .get("verifier_retries")
        .and_then(|value| value.parse::<u32>().ok())
        .unwrap_or(match mode {
            ExecutionMode::Quick => 1,
            ExecutionMode::Full => 3,
        });

    PlanRuntimeConfig {
        mode,
        wave_size,
        verifier_retries,
    }
}

pub(crate) fn build_wave_batches(step_count: usize, wave_size: usize) -> Vec<Vec<usize>> {
    if step_count == 0 {
        return Vec::new();
    }

    let wave_size = wave_size.max(1);
    (0..step_count)
        .collect::<Vec<_>>()
        .chunks(wave_size)
        .map(|chunk| chunk.to_vec())
        .collect()
}

pub(crate) fn verification_outcome(description: &str, attempts: u32) -> bool {
    if description.contains("[verify:fail]") {
        return false;
    }

    if description.contains("[verify:retry]") {
        return attempts > 1;
    }

    true
}

#[derive(Clone)]
pub struct Executor {
    pub ai: Arc<RuntimeManager>,
    pub db: Arc<DatabaseManager>,
    pub app: AppHandle,
}

impl Executor {
    pub fn new(ai: Arc<RuntimeManager>, db: Arc<DatabaseManager>, app: AppHandle) -> Self {
        Self { ai, db, app }
    }

    fn emit_execution_event(
        &self,
        plan_id: &str,
        phase_id: Option<&str>,
        step_id: Option<&str>,
        event_type: &str,
        message: impl Into<String>,
    ) {
        let payload = ExecutionEvent {
            plan_id: plan_id.to_string(),
            phase_id: phase_id.map(|value| value.to_string()),
            step_id: step_id.map(|value| value.to_string()),
            event_type: event_type.to_string(),
            message: message.into(),
            timestamp: Utc::now().timestamp_millis() as u64,
        };

        let _ = self.app.emit("gsd-execution-event", payload);
    }

    pub async fn execute_phase(
        &self,
        plan_id: &str,
        phase: &mut GsdPhase,
        runtime: PlanRuntimeConfig,
    ) -> Result<(), String> {
        phase.status = StepStatus::InProgress;
        let _ = self.app.emit("gsd-phase-updated", phase.clone());
        self.emit_execution_event(
            plan_id,
            Some(&phase.id),
            None,
            "phase_started",
            format!("Phase {} started", phase.title),
        );

        let wave_batches = build_wave_batches(phase.steps.len(), runtime.wave_size);

        for (wave_index, batch) in wave_batches.iter().enumerate() {
            self.emit_execution_event(
                plan_id,
                Some(&phase.id),
                None,
                "wave_started",
                format!(
                    "Wave {} started with {} step(s)",
                    wave_index + 1,
                    batch.len()
                ),
            );

            let mut join_set = JoinSet::new();

            for step_index in batch.iter().copied() {
                let step = phase.steps[step_index].clone();
                let executor = self.clone();
                let plan_id = plan_id.to_string();
                let phase_id = phase.id.clone();
                let retries = runtime.verifier_retries;

                join_set.spawn(async move {
                    let result = executor
                        .execute_step(&plan_id, &phase_id, step, retries)
                        .await;
                    (step_index, result)
                });
            }

            while let Some(joined) = join_set.join_next().await {
                let (step_index, result) = joined.map_err(|e| e.to_string())?;
                let updated_step = result?;

                if matches!(updated_step.status, StepStatus::Failed(_)) {
                    phase.steps[step_index] = updated_step.clone();
                    phase.status = StepStatus::Failed(format!(
                        "Step {} failed during wave {}",
                        updated_step.id,
                        wave_index + 1
                    ));
                    let _ = self.app.emit("gsd-phase-updated", phase.clone());
                    self.emit_execution_event(
                        plan_id,
                        Some(&phase.id),
                        Some(&updated_step.id),
                        "phase_failed",
                        format!(
                            "Phase {} failed because step {} failed in wave {}",
                            phase.title,
                            updated_step.title,
                            wave_index + 1
                        ),
                    );
                    return Err(format!(
                        "Step {} failed during wave {}",
                        updated_step.id,
                        wave_index + 1
                    ));
                }

                phase.steps[step_index] = updated_step;
            }

            self.emit_execution_event(
                plan_id,
                Some(&phase.id),
                None,
                "wave_completed",
                format!("Wave {} completed", wave_index + 1),
            );
        }

        phase.status = StepStatus::Completed;
        let _ = self.app.emit("gsd-phase-updated", phase.clone());
        self.emit_execution_event(
            plan_id,
            Some(&phase.id),
            None,
            "phase_completed",
            format!("Phase {} completed", phase.title),
        );

        Ok(())
    }

    pub async fn execute_step(
        &self,
        plan_id: &str,
        phase_id: &str,
        mut step: GsdStep,
        verifier_retries: u32,
    ) -> Result<GsdStep, String> {
        let retry_budget = verifier_retries.min(step.max_retries).max(1);

        loop {
            step.status = StepStatus::InProgress;
            step.attempts += 1;
            self.emit_execution_event(
                plan_id,
                Some(phase_id),
                Some(&step.id),
                "step_started",
                format!("Step {} attempt {}", step.title, step.attempts),
            );
            let _ = self.app.emit("gsd-step-updated", step.clone());

            sleep(Duration::from_millis(150)).await;

            step.status = StepStatus::Completed;
            step.result = Some(format!(
                "Step executed successfully on attempt {}",
                step.attempts
            ));
            let _ = self.app.emit("gsd-step-updated", step.clone());

            let verified = self.verify_step(&step).await?;
            self.emit_execution_event(
                plan_id,
                Some(phase_id),
                Some(&step.id),
                "step_verified",
                format!("Step {} verification result: {}", step.title, verified),
            );

            if verified {
                self.atomic_commit(&step).await?;
                self.emit_execution_event(
                    plan_id,
                    Some(phase_id),
                    Some(&step.id),
                    "step_committed",
                    format!("Step {} committed after verification", step.title),
                );
                return Ok(step);
            }

            if step.attempts >= retry_budget {
                step.status = StepStatus::Failed("Verifier loop exhausted".to_string());
                let _ = self.app.emit("gsd-step-updated", step.clone());
                self.emit_execution_event(
                    plan_id,
                    Some(phase_id),
                    Some(&step.id),
                    "step_failed",
                    format!(
                        "Step {} failed verification after {} attempt(s)",
                        step.title, step.attempts
                    ),
                );
                return Ok(step);
            }

            step.status = StepStatus::Pending;
            step.result = Some("Verification failed; retrying".to_string());
            let _ = self.app.emit("gsd-step-updated", step.clone());
            self.emit_execution_event(
                plan_id,
                Some(phase_id),
                Some(&step.id),
                "step_retrying",
                format!("Retrying step {} after verifier rejection", step.title),
            );
        }
    }

    async fn atomic_commit(&self, step: &GsdStep) -> Result<(), String> {
        // Logic to commit changes to git
        // For now just log it
        println!("[GSD] Atomic commit for step: {}", step.title);
        Ok(())
    }

    pub async fn verify_step(&self, step: &GsdStep) -> Result<bool, String> {
        Ok(verification_outcome(&step.description, step.attempts))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn metadata(entries: &[(&str, &str)]) -> HashMap<String, String> {
        entries
            .iter()
            .map(|(key, value)| (key.to_string(), value.to_string()))
            .collect()
    }

    #[test]
    fn builds_default_wave_batches_in_order() {
        assert_eq!(
            build_wave_batches(5, 2),
            vec![vec![0, 1], vec![2, 3], vec![4]]
        );
    }

    #[test]
    fn resolves_quick_mode_runtime_defaults() {
        let config = resolve_runtime_config(
            &metadata(&[("execution_mode", "quick"), ("wave_size", "4")]),
            6,
        );

        assert_eq!(config.mode, ExecutionMode::Quick);
        assert_eq!(config.wave_size, 4);
        assert_eq!(config.verifier_retries, 1);
    }

    #[test]
    fn resolves_full_mode_runtime_defaults() {
        let config = resolve_runtime_config(&metadata(&[]), 5);

        assert_eq!(config.mode, ExecutionMode::Full);
        assert_eq!(config.wave_size, 3);
        assert_eq!(config.verifier_retries, 3);
    }

    #[test]
    fn verification_outcome_retries_then_passes() {
        assert!(!verification_outcome("[verify:retry]", 1));
        assert!(verification_outcome("[verify:retry]", 2));
        assert!(!verification_outcome("[verify:fail]", 3));
        assert!(verification_outcome("plain step", 1));
    }
}
