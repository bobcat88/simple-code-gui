use serde::{Deserialize, Serialize};
use tauri::Emitter;
use std::sync::Arc;
use crate::database::DatabaseManager;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Agent {
    pub id: String,
    pub name: String,
    pub role: String,
    pub status: String,
    pub model: Option<String>,
    pub provider: Option<String>,
    pub burn_rate: Option<f64>,
    pub quality_score: Option<f64>,
    pub error_rate: Option<f64>,
    pub queue_size: Option<i32>,
    pub active_task: Option<String>,
    pub evolution_confidence: Option<f64>,
    pub evolution_status: Option<String>,
    pub last_active: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentTask {
    pub id: String,
    pub agent_id: String,
    pub title: String,
    pub description: Option<String>,
    pub priority: i32,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentTrace {
    pub id: String,
    pub agent_id: String,
    pub task_id: Option<String>,
    pub step_name: String,
    pub details: Option<String>,
    pub status: String,
    pub duration_ms: Option<i64>,
    pub timestamp: String,
}

pub struct AgentManager {
    db: Arc<DatabaseManager>,
}

impl AgentManager {
    pub fn new(db: Arc<DatabaseManager>) -> Self {
        Self { db }
    }

    pub async fn register(&self, app: &tauri::AppHandle, agent: Agent) -> Result<(), String> {
        sqlx::query(
            "INSERT OR REPLACE INTO agents (id, name, role, status, model, provider, burn_rate, quality_score, error_rate, queue_size, active_task, evolution_confidence, evolution_status, last_active) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)"
        )
        .bind(&agent.id)
        .bind(&agent.name)
        .bind(&agent.role)
        .bind(&agent.status)
        .bind(&agent.model)
        .bind(&agent.provider)
        .bind(agent.burn_rate.unwrap_or(0.0))
        .bind(agent.quality_score.unwrap_or(0.0))
        .bind(agent.error_rate.unwrap_or(0.0))
        .bind(agent.queue_size.unwrap_or(0))
        .bind(&agent.active_task)
        .bind(agent.evolution_confidence.unwrap_or(0.0))
        .bind(agent.evolution_status.as_deref().unwrap_or("stable"))
        .execute(&self.db.pool)
        .await
        .map_err(|e| e.to_string())?;

        let _ = app.emit("agent-registered", &agent);

        Ok(())
    }

    pub async fn list(&self) -> Result<Vec<Agent>, String> {
        let rows = sqlx::query_as::<_, (String, String, String, String, Option<String>, Option<String>, f64, f64, f64, i32, Option<String>, f64, String, String)>(
            "SELECT id, name, role, status, model, provider, burn_rate, quality_score, error_rate, queue_size, active_task, evolution_confidence, evolution_status, last_active FROM agents ORDER BY last_active DESC"
        )
        .fetch_all(&self.db.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(rows.into_iter().map(|r| Agent {
            id: r.0,
            name: r.1,
            role: r.2,
            status: r.3,
            model: r.4,
            provider: r.5,
            burn_rate: Some(r.6),
            quality_score: Some(r.7),
            error_rate: Some(r.8),
            queue_size: Some(r.9),
            active_task: r.10,
            evolution_confidence: Some(r.11),
            evolution_status: Some(r.12),
            last_active: Some(r.13),
        }).collect())
    }

    pub async fn update_status(&self, app: &tauri::AppHandle, id: String, status: String) -> Result<(), String> {
        sqlx::query("UPDATE agents SET status = ?, last_active = CURRENT_TIMESTAMP WHERE id = ?")
            .bind(&status)
            .bind(&id)
            .execute(&self.db.pool)
            .await
            .map_err(|e| e.to_string())?;

        let _ = app.emit("agent-status-changed", serde_json::json!({
            "id": id,
            "status": status
        }));

        Ok(())
    }

    pub async fn update_metrics(
        &self,
        app: &tauri::AppHandle,
        id: String,
        burn_rate: f64,
        quality_score: f64,
        error_rate: f64,
        queue_size: i32,
        active_task: Option<String>,
        evolution_confidence: f64,
        evolution_status: String,
    ) -> Result<(), String> {
        sqlx::query("UPDATE agents SET burn_rate = ?, quality_score = ?, error_rate = ?, queue_size = ?, active_task = ?, evolution_confidence = ?, evolution_status = ?, last_active = CURRENT_TIMESTAMP WHERE id = ?")
            .bind(burn_rate)
            .bind(quality_score)
            .bind(error_rate)
            .bind(queue_size)
            .bind(&active_task)
            .bind(evolution_confidence)
            .bind(&evolution_status)
            .bind(&id)
            .execute(&self.db.pool)
            .await
            .map_err(|e| e.to_string())?;

        let _ = app.emit("agent-metrics-changed", serde_json::json!({
            "id": id,
            "burn_rate": burn_rate,
            "quality_score": quality_score,
            "error_rate": error_rate,
            "queue_size": queue_size,
            "active_task": active_task,
            "evolution_confidence": evolution_confidence,
            "evolution_status": evolution_status
        }));

        Ok(())
    }

    pub async fn refresh_burn_rates(&self, app: &tauri::AppHandle) -> Result<(), String> {
        // Reset all burn rates to 0 first so agents without recent activity show 0
        sqlx::query("UPDATE agents SET burn_rate = 0.0")
            .execute(&self.db.pool)
            .await
            .map_err(|e| e.to_string())?;

        // Calculate burn rate as total cost in the last 60 minutes
        let rows = sqlx::query_as::<_, (String, f64)>(
            "SELECT 
                agent_id, 
                SUM(cost_estimate) 
             FROM token_transactions 
             WHERE agent_id IS NOT NULL 
               AND timestamp >= datetime('now', '-1 hour')
             GROUP BY agent_id"
        )
        .fetch_all(&self.db.pool)
        .await
        .map_err(|e| e.to_string())?;

        for (agent_id, burn_rate) in rows {
            sqlx::query("UPDATE agents SET burn_rate = ? WHERE id = ?")
                .bind(burn_rate)
                .bind(&agent_id)
                .execute(&self.db.pool)
                .await
                .map_err(|e| e.to_string())?;

            let _ = app.emit("agent-metrics-changed", serde_json::json!({
                "id": agent_id,
                "burn_rate": burn_rate
            }));
        }

        Ok(())
    }

    pub async fn cancel_task(&self, app: &tauri::AppHandle, id: String) -> Result<(), String> {
        sqlx::query("UPDATE agents SET active_task = NULL, status = 'idle', queue_size = MAX(0, queue_size - 1), last_active = CURRENT_TIMESTAMP WHERE id = ?")
            .bind(&id)
            .execute(&self.db.pool)
            .await
            .map_err(|e| e.to_string())?;

        let _ = app.emit("agent-metrics-changed", serde_json::json!({
            "id": id,
            "status": "idle",
            "active_task": null,
            "queue_size": 0
        }));

        Ok(())
    }

    pub async fn list_tasks(&self, agent_id: String) -> Result<Vec<AgentTask>, String> {
        let rows = sqlx::query_as::<_, (String, String, String, Option<String>, i32, String, String, String)>(
            "SELECT id, agent_id, title, description, priority, status, created_at, updated_at FROM agent_tasks WHERE agent_id = ? ORDER BY priority DESC, created_at ASC"
        )
        .bind(agent_id)
        .fetch_all(&self.db.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(rows.into_iter().map(|r| AgentTask {
            id: r.0,
            agent_id: r.1,
            title: r.2,
            description: r.3,
            priority: r.4,
            status: r.5,
            created_at: r.6,
            updated_at: r.7,
        }).collect())
    }

    pub async fn update_task_priority(&self, app: &tauri::AppHandle, task_id: String, priority: i32) -> Result<(), String> {
        sqlx::query("UPDATE agent_tasks SET priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            .bind(priority)
            .bind(&task_id)
            .execute(&self.db.pool)
            .await
            .map_err(|e| e.to_string())?;

        let _ = app.emit("agent-task-updated", serde_json::json!({
            "id": task_id,
            "priority": priority
        }));

        Ok(())
    }

    pub async fn list_traces(&self, agent_id: String) -> Result<Vec<AgentTrace>, String> {
        let rows = sqlx::query_as::<_, (String, String, Option<String>, String, Option<String>, String, Option<i64>, String)>(
            "SELECT id, agent_id, task_id, step_name, details, status, duration_ms, timestamp FROM agent_traces WHERE agent_id = ? ORDER BY timestamp DESC LIMIT 50"
        )
        .bind(agent_id)
        .fetch_all(&self.db.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(rows.into_iter().map(|r| AgentTrace {
            id: r.0,
            agent_id: r.1,
            task_id: r.2,
            step_name: r.3,
            details: r.4,
            status: r.5,
            duration_ms: r.6,
            timestamp: r.7,
        }).collect())
    }

    pub async fn add_trace(
        &self, 
        app: &tauri::AppHandle, 
        agent_id: String, 
        task_id: Option<String>, 
        step_name: String, 
        details: Option<String>, 
        status: String, 
        duration_ms: Option<i64>
    ) -> Result<(), String> {
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO agent_traces (id, agent_id, task_id, step_name, details, status, duration_ms) 
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&id)
        .bind(&agent_id)
        .bind(&task_id)
        .bind(&step_name)
        .bind(&details)
        .bind(&status)
        .bind(duration_ms)
        .execute(&self.db.pool)
        .await
        .map_err(|e| e.to_string())?;

        let _ = app.emit("agent-trace-added", serde_json::json!({
            "agent_id": agent_id,
            "trace": {
                "id": id,
                "task_id": task_id,
                "step_name": step_name,
                "details": details,
                "status": status,
                "duration_ms": duration_ms
            }
        }));

        Ok(())
    }
}

// Tauri Commands
#[tauri::command]
pub async fn agent_register(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<AgentManager>>,
    agent: Agent,
) -> Result<(), String> {
    state.register(&app, agent).await
}

#[tauri::command]
pub async fn agent_list(
    state: tauri::State<'_, Arc<AgentManager>>,
) -> Result<Vec<Agent>, String> {
    state.list().await
}

#[tauri::command]
pub async fn agent_update_status(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<AgentManager>>,
    id: String,
    status: String,
) -> Result<(), String> {
    state.update_status(&app, id, status).await
}

#[tauri::command]
pub async fn agent_update_metrics(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<AgentManager>>,
    id: String,
    burn_rate: f64,
    quality_score: f64,
    error_rate: f64,
    queue_size: i32,
    active_task: Option<String>,
    evolution_confidence: f64,
    evolution_status: String,
) -> Result<(), String> {
    state.update_metrics(&app, id, burn_rate, quality_score, error_rate, queue_size, active_task, evolution_confidence, evolution_status).await
}

#[tauri::command]
pub async fn agent_refresh_burn_rates(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<AgentManager>>,
) -> Result<(), String> {
    state.refresh_burn_rates(&app).await
}

#[tauri::command]
pub async fn agent_cancel_task(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<AgentManager>>,
    id: String,
) -> Result<(), String> {
    state.cancel_task(&app, id).await
}

#[tauri::command]
pub async fn agent_list_tasks(
    state: tauri::State<'_, Arc<AgentManager>>,
    agent_id: String,
) -> Result<Vec<AgentTask>, String> {
    state.list_tasks(agent_id).await
}

#[tauri::command]
pub async fn agent_update_task_priority(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<AgentManager>>,
    task_id: String,
    priority: i32,
) -> Result<(), String> {
    state.update_task_priority(&app, task_id, priority).await
}

#[tauri::command]
pub async fn agent_list_traces(
    state: tauri::State<'_, Arc<AgentManager>>,
    agent_id: String,
) -> Result<Vec<AgentTrace>, String> {
    state.list_traces(agent_id).await
}

#[tauri::command]
pub async fn agent_add_trace(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<AgentManager>>,
    agent_id: String,
    task_id: Option<String>,
    step_name: String,
    details: Option<String>,
    status: String,
    duration_ms: Option<i64>,
) -> Result<(), String> {
    state.add_trace(&app, agent_id, task_id, step_name, details, status, duration_ms).await
}
