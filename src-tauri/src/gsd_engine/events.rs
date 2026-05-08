use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SwarmEvent {
    ReasoningStepCaptured {
        task_id: String,
        agent_id: String,
        step_id: String,
    },
    ArchitecturalAmbiguityDetected {
        task_id: String,
        description: String,
        competing_paths: Vec<String>,
    },
    ConsensusRoundInitiated {
        round_id: String,
        issue: String,
    },
    ConsensusResolved {
        round_id: String,
        winner_id: String,
    },
    PersonaMutationSuggested {
        persona_id: String,
        mutation_type: String,
        mutation_value: String,
    },
    CognitiveHandoffTriggered {
        task_id: String,
        source_agent: String,
        target_agent: String,
    },
}

pub struct SwarmEventBus {
    pub sender: broadcast::Sender<SwarmEvent>,
}

impl SwarmEventBus {
    pub fn new() -> Self {
        let (sender, _) = broadcast::channel(100);
        Self { sender }
    }

    pub fn emit(&self, event: SwarmEvent) {
        let _ = self.sender.send(event);
    }

    pub fn subscribe(&self) -> broadcast::Receiver<SwarmEvent> {
        self.sender.subscribe()
    }
}
