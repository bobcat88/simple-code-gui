use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::database::DatabaseManager;
use sysinfo::{System, SystemExt, ProcessExt, CpuExt};
use std::panic;
use tauri::AppHandle;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HealthStatus {
    pub cpu_usage: f32,
    pub memory_usage: u64,
    pub total_memory: u64,
    pub threads: usize,
    pub status: String,
}

pub struct HealthManager {
    db: Arc<DatabaseManager>,
    system: std::sync::Mutex<System>,
}

impl HealthManager {
    pub fn new(db: Arc<DatabaseManager>) -> Self {
        let mut system = System::new_all();
        system.refresh_all();
        Self {
            db,
            system: std::sync::Mutex::new(system),
        }
    }

    pub fn setup_panic_hook(app_handle: AppHandle) {
        panic::set_hook(Box::new(move |panic_info| {
            let message = if let Some(s) = panic_info.payload().downcast_ref::<&str>() {
                s.to_string()
            } else if let Some(s) = panic_info.payload().downcast_ref::<String>() {
                s.clone()
            } else {
                "Unknown panic payload".to_string()
            };

            let location = panic_info.location().map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column())).unwrap_or_else(|| "Unknown location".to_string());

            eprintln!("CRITICAL PANIC: {} at {}", message, location);
            
            // We can't easily log to DB here because we're panicking and DB is likely in use or locked
            // But we can try to write to a crash file
            let crash_report = format!("Crash Report\nTime: {}\nMessage: {}\nLocation: {}\n", chrono::Local::now(), message, location);
            let _ = std::fs::write("crash.log", crash_report);
        }));
    }

    pub async fn get_status(&self) -> HealthStatus {
        let mut sys = self.system.lock().unwrap();
        sys.refresh_all();

        let cpu_usage = sys.global_cpu_info().cpu_usage();
        let memory_usage = sys.used_memory();
        let total_memory = sys.total_memory();
        let threads = std::thread::panicking() as usize; // This is not correct for thread count, just a placeholder

        HealthStatus {
            cpu_usage,
            memory_usage,
            total_memory,
            threads, // Placeholder
            status: "Healthy".to_string(),
        }
    }

    pub async fn log_check(&self, check_type: &str, status: &str, details: Option<&str>) -> Result<(), String> {
        sqlx::query("INSERT INTO health_logs (check_type, status, details) VALUES (?, ?, ?)")
            .bind(check_type)
            .bind(status)
            .bind(details)
            .execute(&self.db.pool)
            .await
            .map_err(|e| e.to_string())?;

        Ok(())
    }
}

// Tauri Commands
#[tauri::command]
pub async fn health_get_status(
    state: tauri::State<'_, Arc<HealthManager>>,
) -> Result<HealthStatus, String> {
    Ok(state.get_status().await)
}

#[tauri::command]
pub async fn health_log_check(
    state: tauri::State<'_, Arc<HealthManager>>,
    check_type: String,
    status: String,
    details: Option<String>,
) -> Result<(), String> {
    state.log_check(&check_type, &status, details.as_deref()).await
}
