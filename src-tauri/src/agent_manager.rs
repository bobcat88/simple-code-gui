use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::database::DatabaseManager;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Agent {
    pub id: String,
    pub name: String,
    pub role: String,
    pub status: String,
    pub last_active: Option<String>,
}

pub struct AgentManager {
    db: Arc<DatabaseManager>,
}

impl AgentManager {
    pub fn new(db: Arc<DatabaseManager>) -> Self {
        Self { db }
    }

    pub async fn register(&self, agent: Agent) -> Result<(), String> {
        sqlx::query(
            "INSERT OR REPLACE INTO agents (id, name, role, status, last_active) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)"
        )
        .bind(&agent.id)
        .bind(&agent.name)
        .bind(&agent.role)
        .bind(&agent.status)
        .execute(&self.db.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub async fn list(&self) -> Result<Vec<Agent>, String> {
        let rows = sqlx::query_as::<_, (String, String, String, String, String)>(
            "SELECT id, name, role, status, last_active FROM agents ORDER BY last_active DESC"
        )
        .fetch_all(&self.db.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(rows.into_iter().map(|r| Agent {
            id: r.0,
            name: r.1,
            role: r.2,
            status: r.3,
            last_active: Some(r.4),
        }).collect())
    }

    pub async fn update_status(&self, id: String, status: String) -> Result<(), String> {
        sqlx::query("UPDATE agents SET status = ?, last_active = CURRENT_TIMESTAMP WHERE id = ?")
            .bind(status)
            .bind(id)
            .execute(&self.db.pool)
            .await
            .map_err(|e| e.to_string())?;

        Ok(())
    }
}

// Tauri Commands
#[tauri::command]
pub async fn agent_register(
    state: tauri::State<'_, Arc<AgentManager>>,
    agent: Agent,
) -> Result<(), String> {
    state.register(agent).await
}

#[tauri::command]
pub async fn agent_list(
    state: tauri::State<'_, Arc<AgentManager>>,
) -> Result<Vec<Agent>, String> {
    state.list().await
}

#[tauri::command]
pub async fn agent_update_status(
    state: tauri::State<'_, Arc<AgentManager>>,
    id: String,
    status: String,
) -> Result<(), String> {
    state.update_status(id, status).await
}
