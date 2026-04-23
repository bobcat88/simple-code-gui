use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::fs;
use std::path::PathBuf;
use crate::database::DatabaseManager;

use tauri::AppHandle;
use tauri::Manager;
use zip::write::FileOptions;
use std::io::Write;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiagnosticResult {
    pub bundle_path: String,
    pub created_at: String,
}

pub struct DiagnosticManager {
    db: Arc<DatabaseManager>,
}

impl DiagnosticManager {
    pub fn new(db: Arc<DatabaseManager>) -> Self {
        Self { db }
    }

    pub async fn generate_bundle(&self, app: AppHandle) -> Result<DiagnosticResult, String> {
        let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
        let diagnostics_dir = app_dir.join("diagnostics");
        if !diagnostics_dir.exists() {
            fs::create_dir_all(&diagnostics_dir).map_err(|e| e.to_string())?;
        }

        let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
        let bundle_name = format!("diagnostic_bundle_{}.zip", timestamp);
        let bundle_path = diagnostics_dir.join(&bundle_name);

        let file = fs::File::create(&bundle_path).map_err(|e| e.to_string())?;
        let mut zip = zip::ZipWriter::new(file);
        let options: FileOptions<'_, ()> = FileOptions::default()
            .compression_method(zip::CompressionMethod::Stored)
            .unix_permissions(0o755);

        // 1. System Info
        zip.start_file("system_info.txt", options).map_err(|e| e.to_string())?;
        let sys_info = self.gather_system_info();
        zip.write_all(sys_info.as_bytes()).map_err(|e| e.to_string())?;

        // 2. Settings & Workspace
        let settings_path = app_dir.join("settings.json");
        if settings_path.exists() {
            zip.start_file("settings.json", options).map_err(|e| e.to_string())?;
            let content = fs::read_to_string(settings_path).map_err(|e| e.to_string())?;
            zip.write_all(content.as_bytes()).map_err(|e| e.to_string())?;
        }

        let workspace_path = app_dir.join("workspace.json");
        if workspace_path.exists() {
            zip.start_file("workspace.json", options).map_err(|e| e.to_string())?;
            let content = fs::read_to_string(workspace_path).map_err(|e| e.to_string())?;
            zip.write_all(content.as_bytes()).map_err(|e| e.to_string())?;
        }

        // 3. Database Export (Summary)
        zip.start_file("database_summary.txt", options).map_err(|e| e.to_string())?;
        let db_summary = self.gather_db_summary().await?;
        zip.write_all(db_summary.as_bytes()).map_err(|e| e.to_string())?;

        // 4. Logs
        let log_path = app_dir.join("app.log");
        if log_path.exists() {
            zip.start_file("app.log", options).map_err(|e| e.to_string())?;
            let content = fs::read_to_string(log_path).map_err(|e| e.to_string())?;
            zip.write_all(content.as_bytes()).map_err(|e| e.to_string())?;
        }

        let crash_log = PathBuf::from("crash.log");
        if crash_log.exists() {
            zip.start_file("crash.log", options).map_err(|e| e.to_string())?;
            let content = fs::read_to_string(crash_log).map_err(|e| e.to_string())?;
            zip.write_all(content.as_bytes()).map_err(|e| e.to_string())?;
        }

        zip.finish().map_err(|e| e.to_string())?;

        Ok(DiagnosticResult {
            bundle_path: bundle_path.to_string_lossy().to_string(),
            created_at: chrono::Local::now().to_rfc3339(),
        })
    }

    fn gather_system_info(&self) -> String {
        use sysinfo::{System, SystemExt, CpuExt};
        let mut sys = System::new_all();
        sys.refresh_all();

        format!(
            "OS: {} v{}\nHost Name: {}\nCPU: {}\nTotal Memory: {} KB\nUsed Memory: {} KB\n",
            sys.name().unwrap_or_default(),
            sys.os_version().unwrap_or_default(),
            sys.host_name().unwrap_or_default(),
            sys.global_cpu_info().brand(),
            sys.total_memory(),
            sys.used_memory()
        )
    }

    async fn gather_db_summary(&self) -> Result<String, String> {
        let mut summary = String::from("Database Summary\n================\n\n");

        // Health Logs
        summary.push_str("Recent Health Checks:\n");
        let rows: Vec<(String, String, Option<String>, String)> = sqlx::query_as(
            "SELECT check_type, status, details, created_at FROM health_logs ORDER BY created_at DESC LIMIT 20"
        )
        .fetch_all(&self.db.pool)
        .await
        .map_err(|e| e.to_string())?;

        for row in rows {
            summary.push_str(&format!("[{}] {}: {} ({:?})\n", row.3, row.0, row.1, row.2));
        }

        // Activity Feed
        summary.push_str("\nRecent Activity:\n");
        let activity: Vec<(String, String, String)> = sqlx::query_as(
            "SELECT source, message, created_at FROM activity_feed ORDER BY created_at DESC LIMIT 20"
        )
        .fetch_all(&self.db.pool)
        .await
        .map_err(|e| e.to_string())?;

        for act in activity {
            summary.push_str(&format!("[{}] {}: {}\n", act.2, act.0, act.1));
        }

        Ok(summary)
    }
}

#[tauri::command]
pub async fn diagnostics_generate_bundle(
    app: AppHandle,
    state: tauri::State<'_, Arc<DiagnosticManager>>,
) -> Result<DiagnosticResult, String> {
    state.generate_bundle(app).await
}
