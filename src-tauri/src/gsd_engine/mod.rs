use std::collections::HashMap;
use std::sync::Arc;

use crate::ai_runtime::RuntimeManager;
use crate::database::DatabaseManager;
use crate::gsd_engine::types::{GsdPhase, GsdPlan, GsdStep, StepStatus};
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex;

pub mod executor;
pub mod types;

pub struct GsdEngine {
    pub active_plans: Arc<Mutex<HashMap<String, GsdPlan>>>,
    pub pending_responses: Arc<Mutex<HashMap<String, tokio::sync::oneshot::Sender<UserResponse>>>>,
    pub db: Arc<DatabaseManager>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum UserResponse {
    Approve,
    Retry,
    Abort,
}

impl GsdEngine {
    pub fn new(db: Arc<DatabaseManager>) -> Self {
        Self {
            active_plans: Arc::new(Mutex::new(HashMap::new())),
            pending_responses: Arc::new(Mutex::new(HashMap::new())),
            db,
        }
    }
}

#[tauri::command]
pub async fn gsd_create_plan(
    state: State<'_, Arc<GsdEngine>>,
    task_id: String,
    _title: String,
) -> Result<GsdPlan, String> {
    let mut plans = state.active_plans.lock().await;
    let plan_id = uuid::Uuid::new_v4().to_string();

    let plan = GsdPlan {
        id: plan_id.clone(),
        task_id,
        phases: Vec::new(),
        metadata: HashMap::from([
            ("execution_mode".to_string(), "full".to_string()),
            ("wave_size".to_string(), "2".to_string()),
            ("verifier_retries".to_string(), "3".to_string()),
        ]),
    };

    plans.insert(plan_id.clone(), plan.clone());
    Ok(plan)
}

#[tauri::command]
pub async fn gsd_add_phase(
    state: State<'_, Arc<GsdEngine>>,
    plan_id: String,
    title: String,
) -> Result<GsdPhase, String> {
    let mut plans = state.active_plans.lock().await;
    let plan = plans
        .get_mut(&plan_id)
        .ok_or_else(|| "Plan not found".to_string())?;

    let phase_id = uuid::Uuid::new_v4().to_string();
    let phase = GsdPhase {
        id: phase_id,
        title,
        steps: Vec::new(),
        status: StepStatus::Pending,
    };

    plan.phases.push(phase.clone());
    Ok(phase)
}

#[tauri::command]
pub async fn gsd_add_step(
    state: State<'_, Arc<GsdEngine>>,
    plan_id: String,
    phase_id: String,
    title: String,
    description: String,
) -> Result<GsdStep, String> {
    let mut plans = state.active_plans.lock().await;
    let plan = plans
        .get_mut(&plan_id)
        .ok_or_else(|| "Plan not found".to_string())?;
    let phase = plan
        .phases
        .iter_mut()
        .find(|p| p.id == phase_id)
        .ok_or_else(|| "Phase not found".to_string())?;

    let step_id = uuid::Uuid::new_v4().to_string();
    let step = GsdStep {
        id: step_id,
        title,
        description,
        status: StepStatus::Pending,
        result: None,
        attempts: 0,
        max_retries: 3,
        wave_index: None,
    };

    phase.steps.push(step.clone());
    Ok(step)
}

#[tauri::command]
pub async fn gsd_execute_plan(
    app: AppHandle,
    state: State<'_, Arc<GsdEngine>>,
    ai_runtime: State<'_, Arc<RuntimeManager>>,
    plan_id: String,
) -> Result<(), String> {
    let mut plan = {
        let plans = state.active_plans.lock().await;
        plans
            .get(&plan_id)
            .cloned()
            .ok_or_else(|| "Plan not found".to_string())?
    };

    let engine = state.inner().clone();
    let ai = ai_runtime.inner().clone();
    let app_handle = app.clone();

    tauri::async_runtime::spawn(async move {
        let executor = executor::Executor::new(ai, engine.db.clone(), app_handle.clone(), engine.pending_responses.clone());
        let max_phase_step_count = plan
            .phases
            .iter()
            .map(|phase| phase.steps.len())
            .max()
            .unwrap_or(0);
        let runtime = executor::resolve_runtime_config(&plan.metadata, max_phase_step_count);
        let _ = app_handle.emit("gsd-execution-started", &plan_id);

        for phase_index in 0..plan.phases.len() {
            let phase_result = {
                let phase = &mut plan.phases[phase_index];
                executor.execute_phase(&plan_id, phase, runtime).await
            };

            if let Err(e) = phase_result {
                let phase = &mut plan.phases[phase_index];
                phase.status = StepStatus::Failed(format!("Phase {} failed: {}", phase.id, e));
                let _ = app_handle.emit("gsd-phase-updated", phase.clone());

                let mut plans = engine.active_plans.lock().await;
                plans.insert(plan_id.clone(), plan.clone());
                let _ = app_handle.emit("gsd-execution-failed", &plan_id);
                return;
            }

            let mut plans = engine.active_plans.lock().await;
            plans.insert(plan_id.clone(), plan.clone());
        }

        let _ = app_handle.emit("gsd-execution-completed", &plan_id);

        // Update state
        let mut plans = engine.active_plans.lock().await;
        plans.insert(plan_id, plan);
    });

    Ok(())
}

#[tauri::command]
pub async fn gsd_respond_to_checkpoint(
    state: State<'_, Arc<GsdEngine>>,
    step_id: String,
    response: UserResponse,
) -> Result<(), String> {
    let mut pending = state.pending_responses.lock().await;
    if let Some(sender) = pending.remove(&step_id) {
        let _ = sender.send(response);
        Ok(())
    } else {
        Err("No pending checkpoint for this step".to_string())
    }
}
