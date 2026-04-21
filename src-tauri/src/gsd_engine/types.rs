use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StepStatus {
    Pending,
    InProgress,
    Completed,
    Failed(String),
    Skipped,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GsdStep {
    pub id: String,
    pub title: String,
    pub description: String,
    pub status: StepStatus,
    pub result: Option<String>,
    pub attempts: u32,
    pub max_retries: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GsdPhase {
    pub id: String,
    pub title: String,
    pub steps: Vec<GsdStep>,
    pub status: StepStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GsdPlan {
    pub id: String,
    pub task_id: String,
    pub phases: Vec<GsdPhase>,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionEvent {
    pub plan_id: String,
    pub phase_id: Option<String>,
    pub step_id: Option<String>,
    pub event_type: String,
    pub message: String,
    pub timestamp: u64,
}
