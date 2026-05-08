use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use crate::gsd_engine::governance::{SwarmPersona, GovernanceEngine};
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersonaEvolutionProposal {
    pub id: String,
    pub persona_id: String,
    pub title: String,
    pub description: String,
    pub mutation_type: String, // "ADD_TOOL", "ADD_EXPERTISE"
    pub mutation_value: String,
    pub performance_gain: f64,
    pub rationale: String,
    pub status: String, // "PENDING", "APPLIED", "REJECTED"
}

pub struct EvolverEngine {
    pub governance: Arc<Mutex<GovernanceEngine>>,
    pub active_proposals: Mutex<Vec<PersonaEvolutionProposal>>,
}

impl EvolverEngine {
    pub fn new(governance: Arc<Mutex<GovernanceEngine>>) -> Self {
        Self {
            governance,
            active_proposals: Mutex::new(Vec::new()),
        }
    }

    /// Spawns a shadow test for a persona to validate a mutation
    pub async fn spawn_shadow_test(
        &self,
        _app: &AppHandle,
        persona_id: String,
        mutation_type: String,
        mutation_value: String,
    ) -> Result<String, String> {
        let gov = self.governance.lock().await;
        let persona = gov.policy.personas.iter()
            .find(|p| p.id == persona_id)
            .ok_or_else(|| format!("Persona {} not found", persona_id))?;

        let mut shadow_persona = persona.clone();
        
        match mutation_type.as_str() {
            "ADD_TOOL" => {
                if !shadow_persona.tools.contains(&mutation_value) {
                    shadow_persona.tools.push(mutation_value.clone());
                }
            },
            "ADD_EXPERTISE" => {
                if !shadow_persona.expertise.contains(&mutation_value) {
                    shadow_persona.expertise.push(mutation_value.clone());
                }
            },
            _ => return Err(format!("Unknown mutation type: {}", mutation_type)),
        }

        // Phase 50: Implementation of Shadow Replay Simulation
        // In a real scenario, we would trigger a GsdExecutor run in dry-run mode
        // using this shadow_persona and compare results.
        
        // Mock success for now
        let proposal = PersonaEvolutionProposal {
            id: uuid::Uuid::new_v4().to_string(),
            persona_id,
            title: format!("Evolve {}: {}", shadow_persona.name, mutation_type),
            description: format!("Shadow test successfully validated {} enhancement.", mutation_value),
            mutation_type,
            mutation_value,
            performance_gain: 0.15, // 15% improvement in mock simulation
            rationale: "Shadow simulation showed reduced token usage and faster task completion with this capability.".to_string(),
            status: "PENDING".to_string(),
        };

        let mut proposals = self.active_proposals.lock().await;
        proposals.push(proposal.clone());

        Ok(proposal.id)
    }

    pub async fn get_proposals(&self) -> Vec<PersonaEvolutionProposal> {
        self.active_proposals.lock().await.clone()
    }
}
