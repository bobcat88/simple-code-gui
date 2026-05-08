use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThoughtStep {
    pub id: String,
    pub parent_id: Option<String>,
    pub timestamp: u64,
    pub role: String, // "hypothesis", "evidence", "evaluation", "decision"
    pub content: String,
    pub evaluation_score: Option<f64>,
    pub status: String, // "active", "completed", "discarded"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThoughtChain {
    pub agent_id: String,
    pub task_id: String,
    pub steps: Vec<ThoughtStep>,
}

pub struct ReasoningEngine {
    pub active_chains: Mutex<HashMap<String, ThoughtChain>>, // key: task_id or agent_id
}

impl ReasoningEngine {
    pub fn new() -> Self {
        Self {
            active_chains: Mutex::new(HashMap::new()),
        }
    }

    pub async fn record_step(
        &self,
        agent_id: String,
        task_id: String,
        step: ThoughtStep,
    ) -> Result<(), String> {
        let mut chains = self.active_chains.lock().await;
        let chain = chains.entry(task_id.clone()).or_insert(ThoughtChain {
            agent_id,
            task_id,
            steps: Vec::new(),
        });

        // If this step is a decision, mark relevant hypotheses as completed/discarded
        if step.role == "decision" {
            for s in &mut chain.steps {
                if s.status == "active" {
                    s.status = if s.id == step.parent_id.as_deref().unwrap_or("") {
                        "completed".to_string()
                    } else {
                        "discarded".to_string()
                    };
                }
            }
        }

        chain.steps.push(step);
        Ok(())
    }

    pub async fn get_chain(&self, id: &str) -> Option<ThoughtChain> {
        let chains = self.active_chains.lock().await;
        chains.get(id).cloned()
    }
}
