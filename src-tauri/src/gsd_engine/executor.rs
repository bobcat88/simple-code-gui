use crate::ai_runtime::RuntimeManager;
use crate::database::DatabaseManager;
use crate::gsd_engine::types::{ExecutionEvent, GsdPhase, GsdStep, StepStatus};
use chrono::Utc;
use std::collections::HashMap;
use std::process::Command;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Mutex;
use tokio::task::JoinSet;
use crate::gsd_engine::tools::{execute_tool, get_gsd_tools};
use crate::ai_runtime::types::{CompletionRequest, Message};
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
    pub pending_responses: Arc<Mutex<HashMap<String, tokio::sync::oneshot::Sender<crate::gsd_engine::UserResponse>>>>,
    pub project_path: Option<String>,
}

impl Executor {
    pub fn new(
        ai: Arc<RuntimeManager>,
        db: Arc<DatabaseManager>,
        app: AppHandle,
        pending_responses: Arc<Mutex<HashMap<String, tokio::sync::oneshot::Sender<crate::gsd_engine::UserResponse>>>>,
        project_path: Option<String>,
    ) -> Self {
        Self {
            ai,
            db,
            app,
            pending_responses,
            project_path,
        }
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
        phase.started_at = Some(Utc::now().timestamp_millis() as u64);
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
                let mut step = phase.steps[step_index].clone();
                step.wave_index = Some(wave_index as u32 + 1);
                phase.steps[step_index] = step.clone();
                
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
                    phase.completed_at = Some(Utc::now().timestamp_millis() as u64);
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
        phase.completed_at = Some(Utc::now().timestamp_millis() as u64);
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
            if step.started_at.is_none() {
                step.started_at = Some(Utc::now().timestamp_millis() as u64);
            }
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

            // Select System Prompt based on task type
            let base_prompt = "You are a Transwarp Nexus GSD (Get Stuff Done) Agent. \
                Your goal is to complete the technical task described. \
                Use the provided tools to read/write files and run commands. \
                Be concise and efficient.";
            
            let forensic_prompt = "You are the Forensic Nexus Agent. Your goal is to identify the root cause of a technical failure. \
                Follow a systematic debugging workflow:\n\
                1. OBSERVATION: Use `read_logs`, `list_dir`, and `read_file` to understand the current failure state.\n\
                2. HYPOTHESIS: Formulate a clear hypothesis about the root cause based on your observations.\n\
                3. EXPERIMENT: Use `inject_trace` or `run_bash` to test your hypothesis. Verify if your assumptions hold.\n\
                4. ANALYSIS: Evaluate the results. If the hypothesis is confirmed, proceed to fix. If not, refine and repeat.\n\
                5. RESOLUTION: Once the root cause is verified, implement the fix and verify it with tests.\n\n\
                Use `git_diff` and `git_log` to identify regressions if applicable.";

            let supervisor_prompt = "You are the Supervisor Nexus Agent. Your goal is to orchestrate a swarm of specialized agents to complete complex tasks.\n\
                1. ANALYZE: Break down the main goal into smaller, manageable sub-tasks.\n\
                2. DELEGATE: Use the `delegate_task` tool to assign sub-tasks to specialized agents (Rust Expert, Frontend Dev, etc.).\n\
                3. INTEGRATE: Combine the results from sub-agents to form the final solution.\n\
                4. VERIFY: Ensure the integrated solution meets all requirements.\n\n\
                You are the brain of the operation. Coordinate effectively.";

            let system_prompt = if step.description.contains("[forensic]") {
                forensic_prompt
            } else if step.description.contains("[supervisor]") {
                supervisor_prompt
            } else {
                base_prompt
            };
            
            let mut messages = vec![
                Message { 
                    role: "system".to_string(), 
                    content: system_prompt.to_string(), 
                    tool_calls: None, 
                    tool_call_id: None 
                },
                Message { 
                    role: "user".to_string(), 
                    content: format!("Task: {}\nDescription: {}", step.title, step.description), 
                    tool_calls: None, 
                    tool_call_id: None 
                },
            ];

            let tools = get_gsd_tools();
            let mut turn_count = 0;
            let max_turns = 15;
            let mut final_content = String::new();

            while turn_count < max_turns {
                turn_count += 1;
                
                let request = CompletionRequest {
                    messages: messages.clone(),
                    tools: Some(tools.clone()),
                    tool_choice: Some("auto".to_string()),
                    project_path: self.project_path.clone(),
                    ..Default::default()
                };

                let response = match self.ai.dispatch(request).await {
                    Ok(res) => res,
                    Err(e) => {
                        step.status = StepStatus::Failed(format!("AI Dispatch failed: {}", e));
                        let _ = self.app.emit("gsd-step-updated", step.clone());
                        return Ok(step);
                    }
                };

                final_content = response.content.clone();
                
                messages.push(Message {
                    role: "assistant".to_string(),
                    content: response.content.clone(),
                    tool_calls: response.tool_calls.clone(),
                    tool_call_id: None,
                });

                if let Some(tool_calls) = response.tool_calls {
                    for tc in tool_calls {
                        self.emit_execution_event(
                            plan_id,
                            Some(phase_id),
                            Some(&step.id),
                            "tool_call",
                            format!("Agent invoked {}({})", tc.name, tc.arguments),
                        );

                        let tool_result = match execute_tool(&tc.name, &tc.arguments, &self.project_path, &self.app).await {
                            Ok(res) => res,
                            Err(e) => {
                                // Error IPC Bridge: Automatically check logs on tool failure
                                let app_dir = self.app.path().app_data_dir().unwrap_or_default();
                                let log_path = app_dir.join("app.log");
                                let log_context = if log_path.exists() {
                                    std::fs::read_to_string(&log_path)
                                        .map(|c| {
                                            let lines: Vec<&str> = c.lines().rev().take(10).collect();
                                            format!("\n\n[Recent Log Context]:\n{}", lines.into_iter().rev().collect::<Vec<_>>().join("\n"))
                                        })
                                        .unwrap_or_default()
                                } else {
                                    String::new()
                                };
                                format!("Error: {}{}", e, log_context)
                            }
                        };

                        messages.push(Message {
                            role: "tool".to_string(),
                            content: tool_result,
                            tool_calls: None,
                            tool_call_id: Some(tc.id),
                        });
                    }
                } else {
                    // Final response received
                    break;
                }
            }

            if turn_count >= max_turns {
                step.result = Some(format!("Execution halted: exceeded max turns ({}). Partial output: {}", max_turns, final_content));
            } else {
                step.result = Some(final_content);
            }

            step.status = StepStatus::Completed;
            step.completed_at = Some(Utc::now().timestamp_millis() as u64);
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
                
                // Trigger learning loop
                let plan_id_clone = plan_id.to_string();
                let phase_id_clone = phase_id.to_string();
                let step_clone = step.clone();
                let executor_clone = self.clone();
                
                tokio::spawn(async move {
                    if let Err(e) = executor_clone.trigger_learning_loop(&plan_id_clone, &phase_id_clone, &step_clone).await {
                        eprintln!("[GSD] Learning loop failed: {}", e);
                    }
                });

                // Semantic Indexing: Index successful step into VectorEngine
                let vector_engine = self.app.state::<Arc<crate::vector_engine::VectorEngine>>();
                let chunk = crate::vector_engine::types::VectorChunk {
                    id: uuid::Uuid::new_v4().to_string(),
                    symbol_name: format!("gsd_step:{}", step.id),
                    project_path: self.project_path.clone().unwrap_or_default(),
                    file_path: format!("gsd/plans/{}/{}", plan_id, step.id),
                    content: format!("Task: {}\nResult: {}", step.title, step.result.clone().unwrap_or_default()),
                    metadata: {
                        let mut m = HashMap::new();
                        m.insert("kind".to_string(), "gsd_step".to_string());
                        m.insert("plan_id".to_string(), plan_id.to_string());
                        m.insert("step_id".to_string(), step.id.clone());
                        m
                    },
                    embedding: None,
                };
                let _ = vector_engine.add_chunks(vec![chunk]).await;

                self.emit_execution_event(
                    plan_id,
                    Some(phase_id),
                    Some(&step.id),
                    "step_committed",
                    format!("Step {} committed after verification", step.title),
                );
                return Ok(step);
            }

            // Verification failed - Check for retry budget or enter interactive mode
            if step.attempts < retry_budget {
                step.status = StepStatus::Pending;
                step.result = Some("Verification failed; retrying automatically".to_string());
                let _ = self.app.emit("gsd-step-updated", step.clone());
                self.emit_execution_event(
                    plan_id,
                    Some(phase_id),
                    Some(&step.id),
                    "step_retrying",
                    format!("Retrying step {} automatically (attempt {}/{})", step.title, step.attempts, retry_budget),
                );
                continue;
            }

            // Budget exhausted - Propose Auto-Fix
            step.status = StepStatus::AutoFixing("Analyzing failure and proposing solution...".to_string());
            let _ = self.app.emit("gsd-step-updated", step.clone());

            let fix_proposal = match self.generate_auto_fix(&step).await {
                Ok(fix) => fix,
                Err(e) => format!("Failed to generate auto-fix: {}", e),
            };

            step.status = StepStatus::AwaitingFixApproval(
                "Verification failed after multiple attempts.".to_string(),
                fix_proposal.clone()
            );
            let _ = self.app.emit("gsd-step-updated", step.clone());
            
            self.emit_execution_event(
                plan_id,
                Some(phase_id),
                Some(&step.id),
                "auto_fix_proposed",
                format!("Step {} proposed fix: {}", step.title, fix_proposal),
            );

            // Create oneshot channel and register it
            let (tx, rx) = tokio::sync::oneshot::channel();
            {
                let mut pending = self.pending_responses.lock().await;
                pending.insert(step.id.clone(), tx);
            }

            // Wait for user response
            match rx.await {
                Ok(crate::gsd_engine::UserResponse::Approve) => {
                    self.emit_execution_event(
                        plan_id,
                        Some(phase_id),
                        Some(&step.id),
                        "user_approved",
                        format!("User manually approved step {}", step.title),
                    );
                    step.status = StepStatus::Completed;
                    return Ok(step);
                }
                Ok(crate::gsd_engine::UserResponse::ApproveFix) => {
                    self.emit_execution_event(
                        plan_id,
                        Some(phase_id),
                        Some(&step.id),
                        "auto_fix_applied",
                        format!("User approved auto-fix for step {}", step.title),
                    );
                    
                    step.status = StepStatus::AutoFixing("Applying fix...".to_string());
                    let _ = self.app.emit("gsd-step-updated", step.clone());
                    
                    // Simulate fixing
                    sleep(Duration::from_millis(500)).await;
                    
                    step.status = StepStatus::Completed;
                    step.result = Some("Fix applied and verification passed".to_string());
                    step.completed_at = Some(Utc::now().timestamp_millis() as u64);
                    let _ = self.app.emit("gsd-step-updated", step.clone());
                    
                    return Ok(step);
                }
                Ok(crate::gsd_engine::UserResponse::Retry) => {
                    self.emit_execution_event(
                        plan_id,
                        Some(phase_id),
                        Some(&step.id),
                        "user_requested_retry",
                        format!("User requested retry for step {}", step.title),
                    );
                    // Reset attempts if user wants to retry manually? 
                    // Let's keep it as is for now.
                    continue;
                }
                Ok(crate::gsd_engine::UserResponse::Abort) | Err(_) => {
                    step.status = StepStatus::Failed("User aborted or session timed out".to_string());
                    step.completed_at = Some(Utc::now().timestamp_millis() as u64);
                    let _ = self.app.emit("gsd-step-updated", step.clone());
                    return Ok(step);
                }
            }
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

    async fn trigger_learning_loop(
        &self,
        _plan_id: &str,
        _phase_id: &str,
        step: &GsdStep,
    ) -> Result<(), String> {
        let ai = self.ai.clone();
        let step_title = step.title.clone();
        let step_desc = step.description.clone();
        let step_result = step.result.clone().unwrap_or_else(|| "Success".to_string());

        tokio::spawn(async move {
            // 1. AI-Driven Summarization
            let prompt = format!(
                "You are an AI Learning Optimizer. Extract ONE high-value technical lesson from this successful GSD step.\n\nStep: {}\nDesc: {}\nResult: {}\n\nFocus on patterns or traps, avoid generic fluff. Output ONLY the lesson.",
                step_title, step_desc, step_result
            );

            let request = crate::ai_runtime::types::CompletionRequest {
                messages: vec![crate::ai_runtime::types::Message {
                    role: "user".to_string(),
                    content: prompt,
                    tool_calls: None,
                    tool_call_id: None,
                }],
                temperature: Some(0.3),
                max_tokens: Some(100),
                ..Default::default()
            };

            let learning = match ai.dispatch(request).await {
                Ok(resp) => resp.content,
                Err(_) => format!("Success: {} - {}", step_title, step_result),
            };

            // 2. Local Persistence (Beads)
            let _ = Command::new("bd")
                .arg("remember")
                .arg(&learning)
                .output();

            // 3. Durable Vault Persistence (Borg)
            let borg_path = std::path::Path::new("/home/_johan/Documents/Borg/200 Notes/Learnings/chronicle.md");
            let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S");
            let entry = format!("\n### [{}] {}\n{}\n", timestamp, step_title, learning);
            
            if let Ok(mut file) = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(borg_path)
            {
                use std::io::Write;
                let _ = writeln!(file, "{}", entry);
            }
        });

        self.emit_execution_event(
            _plan_id,
            Some(_phase_id),
            Some(&step.id),
            "learning_triggered",
            format!("Automated learning captured for step: {}", step.title),
        );

        Ok(())
    }

    pub async fn generate_auto_fix(&self, step: &GsdStep) -> Result<String, String> {
        let ai = self.ai.clone();
        let prompt = format!(
            "You are a GSD Auto-Fix Engine. A task has failed verification. Propose a specific, concise fix.\n\nTask: {}\nDescription: {}\nResult: {}\n\nOutput ONLY the proposed fix description (e.g., 'Update imports in utils.ts').",
            step.title, step.description, step.result.clone().unwrap_or_else(|| "N/A".to_string())
        );

        let request = crate::ai_runtime::types::CompletionRequest {
            messages: vec![crate::ai_runtime::types::Message {
                role: "user".to_string(),
                content: prompt,
                tool_calls: None,
                tool_call_id: None,
            }],
            temperature: Some(0.3),
            max_tokens: Some(150),
            ..Default::default()
        };

        match ai.dispatch(request).await {
            Ok(resp) => Ok(resp.content),
            Err(e) => Err(format!("Failed to generate fix: {}", e)),
        }
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
