use std::sync::Arc;
use crate::database::DatabaseManager;
use crate::agent_manager::AgentManager;
use tauri::Emitter;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiscoveryResult {
    pub model_id: String,
    pub provider_name: String,
    pub new_quality_score: f64,
    pub confidence: f64,
}

pub struct LearningManager {
    db: Arc<DatabaseManager>,
    agents: Arc<AgentManager>,
}

impl LearningManager {
    pub fn new(db: Arc<DatabaseManager>, agents: Arc<AgentManager>) -> Self {
        Self { db, agents }
    }

    /// Autonomous Loop: Analyzes performance history to update model weights
    pub async fn run_evolution_cycle(&self, app: &tauri::AppHandle) -> Result<Vec<DiscoveryResult>, String> {
        let mut discoveries = Vec::new();

        // 1. Fetch performance by model/provider
        let rows = sqlx::query_as::<_, (String, String, f64, i64, i32)>(
            "SELECT 
                COALESCE(agent_id, 'unassigned'),
                backend as provider,
                SUM(cost_estimate) as total_cost,
                SUM(input_tokens + output_tokens) as total_tokens,
                COUNT(*) as tx_count
             FROM token_transactions 
             WHERE timestamp >= datetime('now', '-24 hours')
             GROUP BY agent_id, backend"
        )
        .fetch_all(&self.db.pool)
        .await
        .map_err(|e| e.to_string())?;

        for (agent_id, provider, total_cost, total_tokens, tx_count) in rows {
            if agent_id == "unassigned" { continue; }

            // Heuristic Learning Logic:
            // High usage (tx_count) implies reliability.
            // Low cost/token ratio implies efficiency.
            // We'll evolve the quality score based on these.
            
            let efficiency = if total_tokens > 0 {
                (total_tokens as f64 / total_cost).min(100000.0) / 100000.0
            } else {
                0.5
            };

            let discovered_quality = 0.7 + (efficiency * 0.15) + ((tx_count as f64 / 50.0).min(0.15));
            
            let confidence = (tx_count as f64 / 10.0).min(1.0);
            let evolution_status = if confidence > 0.8 { "optimized" } else { "learning" };

            // Update Agent Metrics (The "Learning" part)
            let _ = self.agents.update_metrics(
                app,
                agent_id.clone(),
                total_cost / 24.0, // Hourly burn rate average
                discovered_quality,
                0.01, // Error rate would come from health logs
                0,
                None,
                confidence,
                evolution_status.to_string()
            ).await;

            discoveries.push(DiscoveryResult {
                model_id: agent_id, // For now agent_id corresponds to the model specialized for that role
                provider_name: provider,
                new_quality_score: discovered_quality,
                confidence: (tx_count as f64 / 10.0).min(1.0),
            });
        }

        // Emit evolution event
        let _ = app.emit("ai-evolution-completed", &discoveries);

        Ok(discoveries)
    }
}

// Tauri Commands
#[tauri::command]
pub async fn ai_trigger_evolution(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<LearningManager>>,
) -> Result<Vec<DiscoveryResult>, String> {
    state.run_evolution_cycle(&app).await
}
