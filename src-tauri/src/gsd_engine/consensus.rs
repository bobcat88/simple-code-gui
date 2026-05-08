use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use crate::gsd_engine::governance::GovernanceEngine;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentVote {
    pub agent_id: String,
    pub agent_name: String,
    pub proposal_id: String,
    pub score: i32,
    pub rationale: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConsensusProposal {
    pub id: String,
    pub title: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConsensusRound {
    pub id: String,
    pub issue_description: String,
    pub competing_proposals: Vec<ConsensusProposal>,
    pub votes: Vec<AgentVote>,
    pub status: String, // "ACTIVE", "RESOLVED"
    pub winner_id: Option<String>,
}

pub struct ConsensusEngine {
    pub governance: Arc<Mutex<GovernanceEngine>>,
    pub active_rounds: Mutex<Vec<ConsensusRound>>,
}

impl ConsensusEngine {
    pub fn new(governance: Arc<Mutex<GovernanceEngine>>) -> Self {
        Self {
            governance,
            active_rounds: Mutex::new(Vec::new()),
        }
    }

    pub async fn initiate_round(
        &self,
        issue: String,
        proposals: Vec<ConsensusProposal>,
    ) -> Result<String, String> {
        let gov = self.governance.lock().await;
        let round_id = uuid::Uuid::new_v4().to_string();
        
        let mut votes = Vec::new();

        // Simulate voting based on agent expertise
        for persona in &gov.policy.personas {
            let (chosen_idx, score, rationale) = match persona.id.as_str() {
                "architect" => (0, 10, "Aligned with core architectural patterns."),
                "auditor" => (0, 8, "Minimal security surface area detected."),
                "refactorer" => (1, 9, "Reduces cognitive load and technical debt."),
                _ => (0, 5, "Seems reasonable based on project context."),
            };

            if let Some(prop) = proposals.get(chosen_idx % proposals.len()) {
                votes.push(AgentVote {
                    agent_id: persona.id.clone(),
                    agent_name: persona.name.clone(),
                    proposal_id: prop.id.clone(),
                    score,
                    rationale: rationale.to_string(),
                });
            }
        }

        let round = ConsensusRound {
            id: round_id.clone(),
            issue_description: issue,
            competing_proposals: proposals,
            votes,
            status: "ACTIVE".to_string(),
            winner_id: None,
        };

        let mut rounds = self.active_rounds.lock().await;
        rounds.push(round);

        Ok(round_id)
    }

    pub async fn get_rounds(&self) -> Vec<ConsensusRound> {
        self.active_rounds.lock().await.clone()
    }
}
