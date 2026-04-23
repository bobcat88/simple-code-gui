use crate::database::DatabaseManager;
use crate::extension_manager::InstalledExtension;
use serde::{Deserialize, Serialize};
use std::panic;
use std::sync::Arc;
use sysinfo::{CpuExt, System, SystemExt};
use tauri::AppHandle;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ServiceStatus {
    pub id: String,
    pub name: String,
    pub status: String,
    pub detail: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HealthStatus {
    pub cpu_usage: f32,
    pub memory_usage: u64,
    pub total_memory: u64,
    pub threads: usize,
    pub status: String,
    pub services: Vec<ServiceStatus>,
    pub installed_extensions: Vec<InstalledExtension>,
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

    pub fn setup_panic_hook(_app_handle: AppHandle) {
        panic::set_hook(Box::new(move |panic_info| {
            let message = if let Some(s) = panic_info.payload().downcast_ref::<&str>() {
                s.to_string()
            } else if let Some(s) = panic_info.payload().downcast_ref::<String>() {
                s.clone()
            } else {
                "Unknown panic payload".to_string()
            };

            let location = panic_info
                .location()
                .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
                .unwrap_or_else(|| "Unknown location".to_string());

            eprintln!("CRITICAL PANIC: {} at {}", message, location);

            // We can't easily log to DB here because we're panicking and DB is likely in use or locked
            // But we can try to write to a crash file
            let crash_report = format!(
                "Crash Report\nTime: {}\nMessage: {}\nLocation: {}\n",
                chrono::Local::now(),
                message,
                location
            );
            let _ = std::fs::write("crash.log", crash_report);
        }));
    }

    pub async fn get_status(&self) -> HealthStatus {
        let (cpu_usage, memory_usage, total_memory, threads) = {
            let mut sys = self.system.lock().unwrap();
            sys.refresh_all();

            (
                sys.global_cpu_info().cpu_usage(),
                sys.used_memory(),
                sys.total_memory(),
                sys.processes().len(),
            )
        };

        let mut services = Vec::new();

        services.push(check_database_service(&self.db).await);

        let installed_extensions = match crate::extension_manager::extensions_get_installed().await
        {
            Ok(installed) => {
                let total = installed.len();
                let mcp_count = installed
                    .iter()
                    .filter(|extension| extension.extension.r#type == "mcp")
                    .count();
                let enabled_count = installed
                    .iter()
                    .filter(|extension| extension.enabled)
                    .count();
                let plugin_count = total.saturating_sub(mcp_count);

                services.push(ServiceStatus {
                    id: "extensions".to_string(),
                    name: "Extension Store".to_string(),
                    status: "Healthy".to_string(),
                    detail: format!(
                        "{} installed extensions, {} enabled, {} MCP, {} plugin",
                        total, enabled_count, mcp_count, plugin_count
                    ),
                });

                installed
            }
            Err(error) => {
                services.push(ServiceStatus {
                    id: "extensions".to_string(),
                    name: "Extension Store".to_string(),
                    status: "Error".to_string(),
                    detail: format!("Failed to load installed extensions: {}", error),
                });

                Vec::new()
            }
        };

        services.push(check_mcp_config_service(&installed_extensions));

        let status = aggregate_status(&services);

        HealthStatus {
            cpu_usage,
            memory_usage,
            total_memory,
            threads,
            status,
            services,
            installed_extensions,
        }
    }

    pub async fn log_check(
        &self,
        check_type: &str,
        status: &str,
        details: Option<&str>,
    ) -> Result<(), String> {
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
    state
        .log_check(&check_type, &status, details.as_deref())
        .await
}

async fn check_database_service(db: &Arc<DatabaseManager>) -> ServiceStatus {
    match sqlx::query_scalar::<_, i64>("SELECT 1")
        .fetch_one(&db.pool)
        .await
    {
        Ok(_) => ServiceStatus {
            id: "database".to_string(),
            name: "Database".to_string(),
            status: "Healthy".to_string(),
            detail: "Connection ready".to_string(),
        },
        Err(error) => ServiceStatus {
            id: "database".to_string(),
            name: "Database".to_string(),
            status: "Error".to_string(),
            detail: format!("Database check failed: {}", error),
        },
    }
}

fn mcp_config_path() -> std::path::PathBuf {
    dirs::home_dir()
        .unwrap()
        .join(".claude")
        .join("mcp_config.json")
}

fn check_mcp_config_service(installed_extensions: &[InstalledExtension]) -> ServiceStatus {
    let installed_mcp_count = installed_extensions
        .iter()
        .filter(|extension| extension.extension.r#type == "mcp")
        .count();

    let path = mcp_config_path();
    if !path.exists() {
        return if installed_mcp_count > 0 {
            ServiceStatus {
                id: "mcp_config".to_string(),
                name: "MCP Config".to_string(),
                status: "Warning".to_string(),
                detail: format!(
                    "No mcp_config.json found for {} installed MCP",
                    installed_mcp_count
                ),
            }
        } else {
            ServiceStatus {
                id: "mcp_config".to_string(),
                name: "MCP Config".to_string(),
                status: "Healthy".to_string(),
                detail: "No MCP servers configured".to_string(),
            }
        };
    }

    let content = match std::fs::read_to_string(&path) {
        Ok(content) => content,
        Err(error) => {
            return ServiceStatus {
                id: "mcp_config".to_string(),
                name: "MCP Config".to_string(),
                status: "Error".to_string(),
                detail: format!("Failed to read mcp_config.json: {}", error),
            }
        }
    };

    let config = match serde_json::from_str::<serde_json::Value>(&content) {
        Ok(config) => config,
        Err(error) => {
            return ServiceStatus {
                id: "mcp_config".to_string(),
                name: "MCP Config".to_string(),
                status: "Error".to_string(),
                detail: format!("Failed to parse mcp_config.json: {}", error),
            }
        }
    };

    let configured_servers = config
        .get("mcpServers")
        .and_then(|servers| servers.as_object())
        .map(|servers| servers.len())
        .unwrap_or(0);

    let status = if installed_mcp_count == 0 {
        "Healthy".to_string()
    } else if configured_servers < installed_mcp_count {
        "Warning".to_string()
    } else {
        "Healthy".to_string()
    };

    let detail = if installed_mcp_count == 0 {
        "MCP config loaded, no MCP extensions installed".to_string()
    } else {
        format!(
            "{} MCP servers configured for {} installed MCP",
            configured_servers, installed_mcp_count
        )
    };

    ServiceStatus {
        id: "mcp_config".to_string(),
        name: "MCP Config".to_string(),
        status,
        detail,
    }
}

fn aggregate_status(services: &[ServiceStatus]) -> String {
    if services
        .iter()
        .any(|service| service.status.eq_ignore_ascii_case("error"))
    {
        return "Error".to_string();
    }

    if services
        .iter()
        .any(|service| service.status.eq_ignore_ascii_case("warning"))
    {
        return "Warning".to_string();
    }

    "Healthy".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::extension_manager::{Extension, InstalledExtension};

    fn sample_extension(extension_type: &str, enabled: bool) -> InstalledExtension {
        InstalledExtension {
            extension: Extension {
                id: format!("{}-id", extension_type),
                name: format!("{} name", extension_type),
                description: "desc".to_string(),
                r#type: extension_type.to_string(),
                repo: None,
                npm: None,
                commands: None,
                tags: None,
                config_schema: None,
                version: None,
            },
            installed_at: 1,
            enabled,
            scope: "global".to_string(),
            project_path: None,
            config: None,
            version: None,
        }
    }

    #[test]
    fn aggregate_status_prefers_errors_over_warnings() {
        let services = vec![
            ServiceStatus {
                id: "database".to_string(),
                name: "Database".to_string(),
                status: "Healthy".to_string(),
                detail: "ok".to_string(),
            },
            ServiceStatus {
                id: "mcp_config".to_string(),
                name: "MCP Config".to_string(),
                status: "Warning".to_string(),
                detail: "warn".to_string(),
            },
            ServiceStatus {
                id: "extensions".to_string(),
                name: "Extension Store".to_string(),
                status: "Error".to_string(),
                detail: "fail".to_string(),
            },
        ];

        assert_eq!(aggregate_status(&services), "Error");
    }

    #[test]
    fn aggregate_status_reports_warning_when_no_errors_are_present() {
        let services = vec![
            ServiceStatus {
                id: "database".to_string(),
                name: "Database".to_string(),
                status: "Healthy".to_string(),
                detail: "ok".to_string(),
            },
            ServiceStatus {
                id: "mcp_config".to_string(),
                name: "MCP Config".to_string(),
                status: "Warning".to_string(),
                detail: "warn".to_string(),
            },
        ];

        assert_eq!(aggregate_status(&services), "Warning");
    }

    #[test]
    fn mcp_config_service_warns_when_mcp_extensions_exist_without_config() {
        let service = check_mcp_config_service(&[sample_extension("mcp", true)]);

        assert_eq!(service.status, "Warning");
        assert!(service.detail.contains("installed MCP"));
    }
}
