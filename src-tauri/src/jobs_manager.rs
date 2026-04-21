use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};
use tauri::{AppHandle, Manager, Emitter};
use crate::database::DatabaseManager;
use crate::activity_manager::{ActivityManager, ActivityEvent};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum JobStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BackgroundJob {
    pub id: String,
    pub job_type: String,
    pub payload: String,
    pub status: JobStatus,
    pub progress: f32,
    pub result: Option<String>,
    pub error: Option<String>,
}

pub struct JobsManager {
    db: Arc<DatabaseManager>,
    activity: Arc<ActivityManager>,
    sender: mpsc::Sender<String>, // Channel to notify worker of new jobs
}

impl JobsManager {
    pub fn new(app: AppHandle, db: Arc<DatabaseManager>, activity: Arc<ActivityManager>) -> Self {
        let (tx, mut rx) = mpsc::channel::<String>(100);
        let db_clone = db.clone();
        let activity_clone = activity.clone();
        let app_handle = app.clone();

        // Worker Loop
        tokio::spawn(async move {
            while let Some(job_id) = rx.recv().await {
                Self::process_job(&app_handle, &db_clone, &activity_clone, job_id).await;
            }
        });

        Self {
            db,
            activity,
            sender: tx,
        }
    }

    async fn process_job(app: &AppHandle, db: &Arc<DatabaseManager>, activity: &Arc<ActivityManager>, job_id: String) {
        // Update status to Running
        let _ = sqlx::query("UPDATE background_jobs SET status = 'Running', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            .bind(&job_id)
            .execute(&db.pool)
            .await;

        let _ = app.emit("job-status-changed", job_id.clone());
        let _ = activity.log(app, ActivityEvent {
            id: None,
            event_type: "info".to_string(),
            source: "jobs".to_string(),
            message: format!("Job {} started", job_id),
            metadata: Some(job_id.clone()),
            timestamp: None,
        }).await;

        // Simulated Job Processing (replace with real job logic)
        // For now, we'll just wait and update progress
        for i in 1..=10 {
            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
            let progress = i as f32 / 10.0;
            let _ = sqlx::query("UPDATE background_jobs SET progress = ? WHERE id = ?")
                .bind(progress)
                .bind(&job_id)
                .execute(&db.pool)
                .await;
            
            let _ = app.emit("job-progress", (job_id.clone(), progress));
        }

        // Update status to Completed
        let _ = sqlx::query("UPDATE background_jobs SET status = 'Completed', progress = 1.0, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            .bind(&job_id)
            .execute(&db.pool)
            .await;

        let _ = app.emit("job-status-changed", job_id.clone());
        let _ = activity.log(app, ActivityEvent {
            id: None,
            event_type: "success".to_string(),
            source: "jobs".to_string(),
            message: format!("Job {} completed", job_id),
            metadata: Some(job_id.clone()),
            timestamp: None,
        }).await;
    }

    pub async fn create_job(&self, job_type: String, payload: String) -> Result<String, String> {
        let id = Uuid::new_v4().to_string();
        
        sqlx::query("INSERT INTO background_jobs (id, job_type, payload, status) VALUES (?, ?, ?, 'Pending')")
            .bind(&id)
            .bind(&job_type)
            .bind(&payload)
            .execute(&self.db.pool)
            .await
            .map_err(|e| e.to_string())?;

        let _ = self.sender.send(id.clone()).await;

        Ok(id)
    }

    pub async fn get_job(&self, id: String) -> Result<Option<BackgroundJob>, String> {
        let row = sqlx::query_as::<_, (String, String, String, String, f32, Option<String>, Option<String>)>(
            "SELECT id, job_type, payload, status, progress, result, error FROM background_jobs WHERE id = ?"
        )
        .bind(id)
        .fetch_optional(&self.db.pool)
        .await
        .map_err(|e| e.to_string())?;

        if let Some(r) = row {
            Ok(Some(BackgroundJob {
                id: r.0,
                job_type: r.1,
                payload: r.2,
                status: match r.3.as_str() {
                    "Pending" => JobStatus::Pending,
                    "Running" => JobStatus::Running,
                    "Completed" => JobStatus::Completed,
                    "Failed" => JobStatus::Failed,
                    "Cancelled" => JobStatus::Cancelled,
                    _ => JobStatus::Pending,
                },
                progress: r.4,
                result: r.5,
                error: r.6,
            }))
        } else {
            Ok(None)
        }
    }

    pub async fn list_jobs(&self) -> Result<Vec<BackgroundJob>, String> {
        let rows = sqlx::query_as::<_, (String, String, String, String, f32, Option<String>, Option<String>)>(
            "SELECT id, job_type, payload, status, progress, result, error FROM background_jobs ORDER BY created_at DESC LIMIT 50"
        )
        .fetch_all(&self.db.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(rows.into_iter().map(|r| BackgroundJob {
            id: r.0,
            job_type: r.1,
            payload: r.2,
            status: match r.3.as_str() {
                "Pending" => JobStatus::Pending,
                "Running" => JobStatus::Running,
                "Completed" => JobStatus::Completed,
                "Failed" => JobStatus::Failed,
                "Cancelled" => JobStatus::Cancelled,
                _ => JobStatus::Pending,
            },
            progress: r.4,
            result: r.5,
            error: r.6,
        }).collect())
    }
}

// Tauri Commands
#[tauri::command]
pub async fn jobs_create(
    state: tauri::State<'_, Arc<Mutex<JobsManager>>>,
    job_type: String,
    payload: String,
) -> Result<String, String> {
    let manager = state.lock().await;
    manager.create_job(job_type, payload).await
}

#[tauri::command]
pub async fn jobs_get(
    state: tauri::State<'_, Arc<Mutex<JobsManager>>>,
    id: String,
) -> Result<Option<BackgroundJob>, String> {
    let manager = state.lock().await;
    manager.get_job(id).await
}

#[tauri::command]
pub async fn jobs_list(
    state: tauri::State<'_, Arc<Mutex<JobsManager>>>,
) -> Result<Vec<BackgroundJob>, String> {
    let manager = state.lock().await;
    manager.list_jobs().await
}
