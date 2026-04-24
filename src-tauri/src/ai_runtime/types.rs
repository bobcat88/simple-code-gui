use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Message {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum TaskType {
    Reasoning,
    Coding,
    Fast,
    Creative,
    Vision,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum AgentRole {
    Planner,
    Builder,
    Reviewer,
    Researcher,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum RoutingPolicy {
    Direct { provider: String, model: String },
    Tiered { task: TaskType, allow_fallback: bool },
    CheapFirst,
    QualityFirst,
    LatencyFirst,
    Agent { role: AgentRole },
    Auto,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RetryConfig {
    pub max_retries: u32,
    pub initial_delay_ms: u64,
    pub max_delay_ms: u64,
    pub backoff_factor: f32,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_retries: 3,
            initial_delay_ms: 1000,
            max_delay_ms: 10000,
            backoff_factor: 2.0,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CompletionRequest {
    pub messages: Vec<Message>,
    pub model: Option<String>,
    pub policy: Option<RoutingPolicy>,
    pub retry: Option<RetryConfig>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub stream: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CompletionResponse {
    pub id: String,
    pub model: String,
    pub content: String,
    pub usage: Option<Usage>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct Usage {
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub saved_tokens: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, PartialOrd)]
pub enum ModelTier {
    Tier1, // Frontier
    Tier2, // Balanced
    Tier3, // Lightweight
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub tier: ModelTier,
    pub context_window: u32,
    pub pricing_input_1m: f64,
    pub pricing_output_1m: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProviderConfig {
    pub id: String,
    pub name: String,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub models: Vec<ModelInfo>,
}
