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
    pub event_bus: Arc<crate::gsd_engine::events::SwarmEventBus>,
    pub active_rounds: Mutex<Vec<ConsensusRound>>,
}

impl ConsensusEngine {
    pub fn new(governance: Arc<Mutex<GovernanceEngine>>, event_bus: Arc<crate::gsd_engine::events::SwarmEventBus>) -> Self {
        Self {
            governance,
            event_bus,
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
        
        // Phase 55: Emit Swarm Event
        self.event_bus.emit(crate::gsd_engine::events::SwarmEvent::ConsensusRoundInitiated {
            round_id: round_id.clone(),
            issue: issue.clone(),
        });
        
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

    pub async fn resolve_round(&self, round_id: &str) -> Result<String, String> {
        let mut rounds = self.active_rounds.lock().await;
        let round = rounds.iter_mut().find(|r| r.id == round_id)
            .ok_or_else(|| format!("Round {} not found", round_id))?;
        
        if round.status == "RESOLVED" {
            return round.winner_id.clone().ok_or_else(|| "Round resolved but no winner found".to_string());
        }

        // Calculate scores per proposal
        let mut scores: std::collections::HashMap<String, i32> = std::collections::HashMap::new();
        for vote in &round.votes {
            *scores.entry(vote.proposal_id.clone()).or_insert(0) += vote.score;
        }

        // Find winner
        let winner = scores.into_iter()
            .max_by_key(|&(_, score)| score)
            .map(|(id, _)| id)
            .ok_or_else(|| "No winner could be determined".to_string())?;

        round.winner_id = Some(winner.clone());
        round.status = "RESOLVED".to_string();

        // Phase 55: Emit Swarm Event
        self.event_bus.emit(crate::gsd_engine::events::SwarmEvent::ConsensusResolved {
            round_id: round_id.to_string(),
            winner_id: winner.clone(),
        });

        Ok(winner)
    }

    pub async fn get_rounds(&self) -> Vec<ConsensusRound> {
        self.active_rounds.lock().await.clone()
    }
}
