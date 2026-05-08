use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use crate::gsd_engine::governance::GovernanceEngine;
use crate::gsd_engine::knowledge::SwarmMemory;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CognitiveNode {
    pub id: String,
    pub name: String,
    pub node_type: String, // "agent", "memory", "task", "cluster"
    pub val: f64,
    pub color: String,
    pub children: Option<Vec<CognitiveNode>>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CognitiveLink {
    pub source: String,
    pub target: String,
    pub link_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CognitiveTopology {
    pub nodes: Vec<CognitiveNode>,
    pub links: Vec<CognitiveLink>,
}

pub struct CognitiveMapEngine {
    pub governance: Arc<Mutex<GovernanceEngine>>,
    pub knowledge: Arc<Mutex<Option<Arc<SwarmMemory>>>>,
}

impl CognitiveMapEngine {
    pub fn new(
        governance: Arc<Mutex<GovernanceEngine>>,
        knowledge: Arc<Mutex<Option<Arc<SwarmMemory>>>>,
    ) -> Self {
        Self { governance, knowledge }
    }

    pub async fn generate_topology(&self) -> Result<CognitiveTopology, String> {
        let gov = self.governance.lock().await;
        let mem_mutex = self.knowledge.lock().await;
        
        let mut nodes = Vec::new();
        let mut links = Vec::new();

        // 1. Map Agent Personas
        for persona in &gov.policy.personas {
            nodes.push(CognitiveNode {
                id: persona.id.clone(),
                name: persona.name.clone(),
                node_type: "agent".to_string(),
                val: 20.0,
                color: "#ccff00".to_string(), // toxic green
                children: None,
                metadata: Some(serde_json::json!({
                    "role": persona.role,
                    "expertise": persona.expertise,
                })),
            });
        }

        // 2. Map Memory Clusters (Stub for Phase 51)
        if let Some(mem) = &*mem_mutex {
             let patterns = mem.query("*", None, Some(50)).map_err(|e| e.to_string())?;
             for (i, p) in patterns.into_iter().enumerate() {
                 let mem_id = format!("mem-{}", i);
                 nodes.push(CognitiveNode {
                     id: mem_id.clone(),
                     name: p.context,
                     node_type: "memory".to_string(),
                     val: 8.0,
                     color: "#a855f7".to_string(), // purple
                     children: None,
                     metadata: None,
                 });

                 // Mock link to a random agent
                 if !gov.policy.personas.is_empty() {
                     let persona = &gov.policy.personas[i % gov.policy.personas.len()];
                     links.push(CognitiveLink {
                         source: persona.id.clone(),
                         target: mem_id,
                         link_type: "knowledge_association".to_string(),
                     });
                 }
             }
        }

        Ok(CognitiveTopology { nodes, links })
    }

    pub async fn update_link(
        &self,
        source_id: String,
        target_id: String,
        link_type: String,
    ) -> Result<(), String> {
        // Phase 55: In a real implementation, this would persist the link
        // to a dedicated links table in SwarmMemory (SQLite) or update Borg.
        println!("[CognitiveMap] User manual re-wire: {} -> {} ({})", source_id, target_id, link_type);
        Ok(())
    }
}
