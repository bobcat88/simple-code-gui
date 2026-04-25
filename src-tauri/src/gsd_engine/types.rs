use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StepStatus {
    Pending,
    InProgress,
    Completed,
    Failed(String),
    Skipped,
    WaitingForUser(String),
    AutoFixing(String),
    AwaitingFixApproval(String, String), // message, proposed_fix
    Conflict(String, String, String), // message, r1_content, r2_content
    AwaitingDelegationApproval(String, String), // task, role
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GsdStep {
    pub id: String,
    pub title: String,
    pub description: String,
    pub status: StepStatus,
    pub result: Option<String>,
    pub attempts: u32,
    pub max_retries: u32,
    pub wave_index: Option<u32>,
    pub started_at: Option<u64>,
    pub completed_at: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GsdPhase {
    pub id: String,
    pub title: String,
    pub steps: Vec<GsdStep>,
    pub status: StepStatus,
    pub started_at: Option<u64>,
    pub completed_at: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GsdPlan {
    pub id: String,
    pub title: String,
    pub task_id: String,
    pub phases: Vec<GsdPhase>,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum InsightSeverity {
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum InsightType {
    Technical,
    Architectural,
    Optimization,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NeuralInsight {
    pub id: String,
    pub severity: InsightSeverity,
    pub insight_type: InsightType,
    pub message: String,
    pub details: Option<String>,
    pub action_label: Option<String>,
    pub action_command: Option<String>,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolInfo {
    pub name: String,
    pub description: String,
    pub category: String,
    pub usage_count: u32,
    pub success_rate: f32,
    pub parameters_schema: String, // JSON schema string
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionEvent {
    pub plan_id: String,
    pub phase_id: Option<String>,
    pub step_id: Option<String>,
    pub event_type: String,
    pub message: String,
    pub timestamp: u64,
}
