use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Manager, Emitter};
use crate::database::DatabaseManager;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ActivityEvent {
    pub id: Option<i64>,
    pub event_type: String, // info, success, warning, error
    pub source: String,     // git, system, ai, jobs
    pub message: String,
    pub metadata: Option<String>,
    pub timestamp: Option<String>,
}

pub struct ActivityManager {
    db: Arc<DatabaseManager>,
}

impl ActivityManager {
    pub fn new(db: Arc<DatabaseManager>) -> Self {
        Self { db }
    }

    pub async fn log(&self, app: &AppHandle, event: ActivityEvent) -> Result<i64, String> {
        let res = sqlx::query(
            "INSERT INTO activity_log (event_type, source, message, metadata) VALUES (?, ?, ?, ?)"
        )
        .bind(&event.event_type)
        .bind(&event.source)
        .bind(&event.message)
        .bind(&event.metadata)
        .execute(&self.db.pool)
        .await
        .map_err(|e| e.to_string())?;

        let id = res.last_insert_rowid();
        
        let full_event = ActivityEvent {
            id: Some(id),
            timestamp: Some(chrono::Utc::now().to_rfc3339()),
            ..event
        };

        let _ = app.emit("activity-event", full_event);

        Ok(id)
    }

    pub async fn get_recent(&self, limit: u32) -> Result<Vec<ActivityEvent>, String> {
        let rows = sqlx::query_as::<_, (i64, String, String, String, Option<String>, String)>(
            "SELECT id, event_type, source, message, metadata, timestamp FROM activity_log ORDER BY timestamp DESC LIMIT ?"
        )
        .bind(limit)
        .fetch_all(&self.db.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(rows.into_iter().map(|r| ActivityEvent {
            id: Some(r.0),
            event_type: r.1,
            source: r.2,
            message: r.3,
            metadata: r.4,
            timestamp: Some(r.5),
        }).collect())
    }
}

// Tauri Commands
#[tauri::command]
pub async fn activity_get_recent(
    state: tauri::State<'_, Arc<ActivityManager>>,
    limit: u32,
) -> Result<Vec<ActivityEvent>, String> {
    state.get_recent(limit).await
}

#[tauri::command]
pub async fn activity_log_info(
    app: AppHandle,
    state: tauri::State<'_, Arc<ActivityManager>>,
    source: String,
    message: String,
    metadata: Option<String>,
) -> Result<i64, String> {
    state.log(&app, ActivityEvent {
        id: None,
        event_type: "info".to_string(),
        source,
        message,
        metadata,
        timestamp: None,
    }).await
}
