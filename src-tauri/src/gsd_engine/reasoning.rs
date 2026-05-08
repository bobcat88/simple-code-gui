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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CognitiveHandoffArtifact {
    pub task_id: String,
    pub source_agent_id: String,
    pub condensed_thought_chain: Vec<ThoughtStep>,
    pub timestamp: u64,
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

    pub async fn export_handoff(&self, task_id: &str) -> Result<CognitiveHandoffArtifact, String> {
        let chains = self.active_chains.lock().await;
        let chain = chains.get(task_id).ok_or_else(|| format!("Chain for task {} not found", task_id))?;
        
        // Filter for relevant steps (completed hypotheses and decisions)
        let condensed = chain.steps.iter()
            .filter(|s| s.status == "completed" || s.role == "decision")
            .cloned()
            .collect();

        Ok(CognitiveHandoffArtifact {
            task_id: task_id.to_string(),
            source_agent_id: chain.agent_id.clone(),
            condensed_thought_chain: condensed,
            timestamp: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs(),
        })
    }

    pub async fn import_handoff(&self, handoff: CognitiveHandoffArtifact, target_agent_id: String) -> Result<(), String> {
        let mut chains = self.active_chains.lock().await;
        let chain = chains.entry(handoff.task_id.clone()).or_insert(ThoughtChain {
            agent_id: target_agent_id,
            task_id: handoff.task_id,
            steps: Vec::new(),
        });

        // Hydrate with previous steps
        for step in handoff.condensed_thought_chain {
            if !chain.steps.iter().any(|s| s.id == step.id) {
                chain.steps.push(step);
            }
        }

        Ok(())
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
