use std::sync::Arc;
use crate::ai_runtime::RuntimeManager;
use crate::database::DatabaseManager;
use crate::gsd_engine::types::{GsdPlan, GsdPhase, GsdStep, StepStatus};
use tauri::{AppHandle, Manager, Emitter};
use tokio::time::{sleep, Duration};

pub struct Executor {
    pub ai: Arc<RuntimeManager>,
    pub db: Arc<DatabaseManager>,
    pub app: AppHandle,
}

impl Executor {
    pub fn new(ai: Arc<RuntimeManager>, db: Arc<DatabaseManager>, app: AppHandle) -> Self {
        Self { ai, db, app }
    }

    pub async fn execute_step(&self, _plan_id: &str, _phase_id: &str, step: &mut GsdStep) -> Result<(), String> {
        step.status = StepStatus::InProgress;
        step.attempts += 1;
        
        let _ = self.app.emit("gsd-step-updated", step.clone());

        // Logic for execution goes here
        // 1. Call AI if needed
        // 2. Perform file operations
        // 3. Verify
        
        // Mocking execution for now
        sleep(Duration::from_secs(1)).await;
        
        step.status = StepStatus::Completed;
        step.result = Some("Step executed successfully".to_string());
        
        let _ = self.app.emit("gsd-step-updated", step.clone());
        
        // Atomic commit logic
        self.atomic_commit(step).await?;
        
        Ok(())
    }

    async fn atomic_commit(&self, step: &GsdStep) -> Result<(), String> {
        // Logic to commit changes to git
        // For now just log it
        println!("[GSD] Atomic commit for step: {}", step.title);
        Ok(())
    }

    pub async fn verify_step(&self, _step: &GsdStep) -> Result<bool, String> {
        // Logic to verify step success (e.g. run tests, check files)
        Ok(true)
    }
}
