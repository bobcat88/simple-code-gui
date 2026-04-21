use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::{AppHandle, Manager, State, Emitter};
use crate::ai_runtime::RuntimeManager;
use crate::database::DatabaseManager;
use crate::gsd_engine::types::{GsdPlan, GsdPhase, GsdStep, StepStatus, ExecutionEvent};
use chrono::Utc;
use std::collections::HashMap;

pub mod types;
pub mod executor;

pub struct GsdEngine {
    pub active_plans: Arc<Mutex<HashMap<String, GsdPlan>>>,
    pub db: Arc<DatabaseManager>,
}

impl GsdEngine {
    pub fn new(db: Arc<DatabaseManager>) -> Self {
        Self {
            active_plans: Arc::new(Mutex::new(HashMap::new())),
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
        metadata: HashMap::new(),
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
    let plan = plans.get_mut(&plan_id).ok_or_else(|| "Plan not found".to_string())?;
    
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
    let plan = plans.get_mut(&plan_id).ok_or_else(|| "Plan not found".to_string())?;
    let phase = plan.phases.iter_mut().find(|p| p.id == phase_id)
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
        plans.get(&plan_id).cloned().ok_or_else(|| "Plan not found".to_string())?
    };
    
    let engine = state.inner().clone();
    let ai = ai_runtime.inner().clone();
    let app_handle = app.clone();
    
    tauri::async_runtime::spawn(async move {
        let executor = executor::Executor::new(ai, engine.db.clone(), app_handle.clone());
        let _ = app_handle.emit("gsd-execution-started", &plan_id);
        
        for phase in &mut plan.phases {
            phase.status = StepStatus::InProgress;
            let _ = app_handle.emit("gsd-phase-updated", phase.clone());
            
            for step in &mut phase.steps {
                if let Err(e) = executor.execute_step(&plan_id, &phase.id, step).await {
                    step.status = StepStatus::Failed(e.clone());
                    let _ = app_handle.emit("gsd-step-updated", step.clone());
                    phase.status = StepStatus::Failed(format!("Step {} failed: {}", step.id, e));
                    let _ = app_handle.emit("gsd-phase-updated", phase.clone());
                    let _ = app_handle.emit("gsd-execution-failed", &plan_id);
                    return;
                }
            }
            
            phase.status = StepStatus::Completed;
            let _ = app_handle.emit("gsd-phase-updated", phase.clone());
        }
        
        let _ = app_handle.emit("gsd-execution-completed", &plan_id);
        
        // Update state
        let mut plans = engine.active_plans.lock().await;
        plans.insert(plan_id, plan);
    });
    
    Ok(())
}
