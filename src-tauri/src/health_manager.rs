use crate::database::DatabaseManager;
use crate::extension_manager::InstalledExtension;
use serde::{Deserialize, Serialize};
use std::panic;
use std::sync::Arc;
use sysinfo::{CpuExt, System, SystemExt};
use tauri::AppHandle;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiagnosticItem {
    pub level: String,     // info, warning, error
    pub message: String,
    pub suggestion: Option<String>,
    pub code: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ServiceStatus {
    pub id: String,
    pub name: String,
    pub status: String,
    pub detail: String,
    pub diagnostics: Vec<DiagnosticItem>,
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
    ai_runtime: Arc<crate::ai_runtime::RuntimeManager>,
    orchestration: Arc<crate::orchestration::OrchestrationState>,
    system: std::sync::Mutex<System>,
}

impl HealthManager {
    pub fn new(
        db: Arc<DatabaseManager>, 
        ai_runtime: Arc<crate::ai_runtime::RuntimeManager>,
        orchestration: Arc<crate::orchestration::OrchestrationState>,
    ) -> Self {
        let mut system = System::new_all();
        system.refresh_all();
        Self {
            db,
            ai_runtime,
            orchestration,
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
        services.push(check_project_capability_service(&self.orchestration).await);

        let mut extension_diagnostics = Vec::new();
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

                if total == 0 {
                    extension_diagnostics.push(DiagnosticItem {
                        level: "info".to_string(),
                        message: "No extensions installed".to_string(),
                        suggestion: Some("Visit the Extension Store to add capabilities".to_string()),
                        code: Some("EXT_EMPTY".to_string()),
                    });
                } else if enabled_count < total {
                    extension_diagnostics.push(DiagnosticItem {
                        level: "info".to_string(),
                        message: format!("{} extensions are currently disabled", total - enabled_count),
                        suggestion: Some("Enable extensions in the settings to use their features".to_string()),
                        code: Some("EXT_DISABLED".to_string()),
                    });
                }

                services.push(ServiceStatus {
                    id: "extensions".to_string(),
                    name: "Extension Store".to_string(),
                    status: "Healthy".to_string(),
                    detail: format!(
                        "{} installed extensions, {} enabled, {} MCP, {} plugin",
                        total, enabled_count, mcp_count, plugin_count
                    ),
                    diagnostics: extension_diagnostics,
                });

                installed
            }
            Err(error) => {
                services.push(ServiceStatus {
                    id: "extensions".to_string(),
                    name: "Extension Store".to_string(),
                    status: "Error".to_string(),
                    detail: format!("Failed to load installed extensions: {}", error),
                    diagnostics: vec![DiagnosticItem {
                        level: "error".to_string(),
                        message: format!("Registry failure: {}", error),
                        suggestion: Some("Check if the extension directory is accessible and not corrupted".to_string()),
                        code: Some("EXT_LOAD_FAIL".to_string()),
                    }],
                });

                Vec::new()
            }
        };

        services.push(check_mcp_config_service(&installed_extensions));

        // Check AI Runtime Health
        let ai_health = self.ai_runtime.get_health().await;
        let total_providers = ai_health.len();
        let healthy_providers = ai_health.values().filter(|h| **h).count();
        let degraded_providers = total_providers - healthy_providers;
        
        let ai_status = if total_providers == 0 {
            "Warning".to_string()
        } else if healthy_providers == total_providers {
            "Healthy".to_string()
        } else if healthy_providers > 0 {
            "Warning".to_string()
        } else {
            "Error".to_string()
        };

        let mut ai_diagnostics = Vec::new();
        if total_providers == 0 {
            ai_diagnostics.push(DiagnosticItem {
                level: "warning".to_string(),
                message: "No AI providers configured".to_string(),
                suggestion: Some("Add an OpenAI, Anthropic, or Local provider in settings".to_string()),
                code: Some("AI_NO_PROVIDERS".to_string()),
            });
        } else if degraded_providers > 0 {
            for (provider, healthy) in ai_health.iter() {
                if !*healthy {
                    ai_diagnostics.push(DiagnosticItem {
                        level: "error".to_string(),
                        message: format!("Provider '{}' is unreachable", provider),
                        suggestion: Some(format!("Verify API key and network connectivity for {}", provider)),
                        code: Some("AI_PROVIDER_DOWN".to_string()),
                    });
                }
            }
        }

        services.push(ServiceStatus {
            id: "ai_runtime".to_string(),
            name: "AI Orchestration".to_string(),
            status: ai_status,
            detail: format!(
                "{} providers active ({} healthy, {} degraded)",
                total_providers, healthy_providers, degraded_providers
            ),
            diagnostics: ai_diagnostics,
        });

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
            diagnostics: Vec::new(),
        },
        Err(error) => ServiceStatus {
            id: "database".to_string(),
            name: "Database".to_string(),
            status: "Error".to_string(),
            detail: format!("Database check failed: {}", error),
            diagnostics: vec![DiagnosticItem {
                level: "error".to_string(),
                message: format!("SQLite connection error: {}", error),
                suggestion: Some("Ensure the app data directory is writable and the disk is not full".to_string()),
                code: Some("DB_CONN_FAIL".to_string()),
            }],
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
                diagnostics: vec![DiagnosticItem {
                    level: "warning".to_string(),
                    message: "MCP configuration file missing".to_string(),
                    suggestion: Some("Initialize Claude Desktop or create mcp_config.json manually".to_string()),
                    code: Some("MCP_CONFIG_NOT_FOUND".to_string()),
                }],
            }
        } else {
            ServiceStatus {
                id: "mcp_config".to_string(),
                name: "MCP Config".to_string(),
                status: "Healthy".to_string(),
                detail: "No MCP servers configured".to_string(),
                diagnostics: Vec::new(),
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
                diagnostics: vec![DiagnosticItem {
                    level: "error".to_string(),
                    message: format!("IO error reading MCP config: {}", error),
                    suggestion: Some("Check file permissions for mcp_config.json".to_string()),
                    code: Some("MCP_CONFIG_READ_ERR".to_string()),
                }],
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
                diagnostics: vec![DiagnosticItem {
                    level: "error".to_string(),
                    message: format!("Syntax error in MCP config: {}", error),
                    suggestion: Some("Ensure mcp_config.json is valid JSON".to_string()),
                    code: Some("MCP_CONFIG_PARSE_ERR".to_string()),
                }],
            }
        }
    };

    let configured_servers = config
        .get("mcpServers")
        .and_then(|servers| servers.as_object())
        .map(|servers| servers.len())
        .unwrap_or(0);

    let mut diagnostics = Vec::new();
    let status = if installed_mcp_count == 0 {
        "Healthy".to_string()
    } else if configured_servers < installed_mcp_count {
        diagnostics.push(DiagnosticItem {
            level: "warning".to_string(),
            message: format!("{} extensions are not registered in mcp_config.json", installed_mcp_count - configured_servers),
            suggestion: Some("Run 'Register with Claude' for the missing extensions".to_string()),
            code: Some("MCP_CONFIG_MISSING".to_string()),
        });
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
        diagnostics,
    }
}

async fn check_project_capability_service(
    orchestration: &crate::orchestration::OrchestrationState,
) -> ServiceStatus {
    let project_path = orchestration.current_project_path.lock();
    if project_path.is_none() {
        return ServiceStatus {
            id: "project_capabilities".to_string(),
            name: "Project Capabilities".to_string(),
            status: "Idle".to_string(),
            detail: "No project currently selected".to_string(),
            diagnostics: Vec::new(),
        };
    }

    let last_scan = orchestration.last_scan.lock();

    if let Some(scan) = last_scan.as_ref() {
        let health = scan.project_health_score;
        let status = if health >= 0.8 {
            "Healthy"
        } else if health >= 0.5 {
            "Warning"
        } else {
            "Error"
        };

        let detail = format!(
            "Health Score: {:.0}%, {} capabilities detected",
            health * 100.0,
            scan.capabilities.len(),
        );

        let mut diagnostics = Vec::new();
        if health < 0.6 {
            diagnostics.push(DiagnosticItem {
                level: "warning".to_string(),
                message: "Low project health detected".to_string(),
                suggestion: Some("Review the Project Intelligence report and fix identified gaps".to_string()),
                code: Some("PROJ_HEALTH_LOW".to_string()),
            });
        }

        if scan.capabilities.is_empty() {
             diagnostics.push(DiagnosticItem {
                level: "info".to_string(),
                message: "No project capabilities detected".to_string(),
                suggestion: Some("Ensure the project has standard configuration files (package.json, etc.)".to_string()),
                code: Some("PROJ_NO_CAPS".to_string()),
            });
        }

        ServiceStatus {
            id: "project_capabilities".to_string(),
            name: "Project Capabilities".to_string(),
            status: status.to_string(),
            detail,
            diagnostics,
        }
    } else {
        ServiceStatus {
            id: "project_capabilities".to_string(),
            name: "Project Capabilities".to_string(),
            status: "Scanning".to_string(),
            detail: "Awaiting initial project scan".to_string(),
            diagnostics: Vec::new(),
        }
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
                diagnostics: Vec::new(),
            },
            ServiceStatus {
                id: "mcp_config".to_string(),
                name: "MCP Config".to_string(),
                status: "Warning".to_string(),
                detail: "warn".to_string(),
                diagnostics: Vec::new(),
            },
            ServiceStatus {
                id: "extensions".to_string(),
                name: "Extension Store".to_string(),
                status: "Error".to_string(),
                detail: "fail".to_string(),
                diagnostics: Vec::new(),
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
                diagnostics: Vec::new(),
            },
            ServiceStatus {
                id: "mcp_config".to_string(),
                name: "MCP Config".to_string(),
                status: "Warning".to_string(),
                detail: "warn".to_string(),
                diagnostics: Vec::new(),
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
