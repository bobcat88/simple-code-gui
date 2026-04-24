use serde::{Deserialize, Serialize};
mod activity_manager;
mod agent_manager;
mod ai_runtime;
mod database;
mod diagnostic_manager;
mod extension_manager;
mod gsd_engine;
mod health_manager;
mod jobs_manager;
mod mcp_bridge;
mod orchestration;
mod platform;
mod pty_manager;
mod nexus_context;
mod rtk_manager;
mod session_manager;
mod settings_manager;
mod voice_manager;
mod workspace_manager;

use database::{
    insert_token_transaction, query_token_history, DatabaseManager, TokenHistoryFilters,
    TokenHistoryResponse, TokenTransactionInput,
};
use mcp_bridge::{
    get_registered_mcp_servers, mcp_call_tool, mcp_list_resources, mcp_list_tools, mcp_load_config,
    mcp_read_resource, register_mcp_server, McpManager,
};
use orchestration::{
    beads_check, beads_complete, beads_create, beads_delete, beads_init, beads_list, beads_show,
    beads_start, beads_unwatch, beads_update, beads_watch, get_beads_tasks, get_pending_approvals,
    kspec_check, kspec_complete, kspec_create, kspec_delete, kspec_dispatch_start,
    kspec_dispatch_status, kspec_dispatch_stop, kspec_ensure_daemon, kspec_init, kspec_list,
    kspec_show, kspec_start, kspec_unwatch, kspec_update, kspec_watch, respond_to_approval,
    submit_approval_request, sync_workflow, OrchestrationState,
};
use pty_manager::PtyManager;
use settings_manager::{AppSettings, SettingsManager};
use std::sync::Arc;
use std::thread;
use tokio::sync::Mutex;
use voice_manager::{
    voice_check_tts, voice_get_installed, voice_install_piper, voice_install_voice, voice_speak,
    voice_stop, VoiceManager,
};
use workspace_manager::{Workspace, WorkspaceManager};
mod project_intelligence;
mod project_scanner;

use project_intelligence::scan_project_intelligence;
use project_scanner::{project_apply_proposal, project_generate_proposal, project_scan};
use std::str::FromStr;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;
use nexus_context::nexus_prune_context;
use rtk_manager::{rtk_check, rtk_get_history, rtk_get_stats};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

#[tauri::command]
async fn spawn_session(
    state: State<'_, Arc<PtyManager>>,
    app: AppHandle,
    cwd: String,
    backend: String,
    session_id: Option<String>,
    slug: Option<String>,
    rows: u16,
    cols: u16,
) -> Result<String, String> {
    println!("[spawn_session] project: {}, backend: {}", cwd, backend);

    // Validate CWD
    let path = std::path::Path::new(&cwd);
    if !path.exists() {
        let err = format!("Project path does not exist: {}", cwd);
        println!("[spawn_session] Error: {}", err);
        return Err(err);
    }
    if !path.is_dir() {
        let err = format!("Project path is not a directory: {}", cwd);
        println!("[spawn_session] Error: {}", err);
        return Err(err);
    }

    let mut args = Vec::new();
    let mut cmd_name = backend.clone();

    if backend == "claude" {
        cmd_name = "claude".to_string();
        args.push("code".to_string());
        if let Some(sid) = session_id {
            args.push("-s".to_string());
            args.push(sid);
        } else if let Some(sl) = slug {
            args.push("--slug".to_string());
            args.push(sl);
        }
    } else if backend == "aider" {
        cmd_name = "aider".to_string();
        // Aider specific args if needed
    }

    state.spawn(app, cwd, cmd_name, args, rows, cols)
}

#[tauri::command]
async fn write_to_pty(
    state: State<'_, Arc<PtyManager>>,
    id: String,
    data: String,
) -> Result<(), String> {
    state.write(&id, &data)
}

#[tauri::command]
async fn resize_pty(
    state: State<'_, Arc<PtyManager>>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    state.resize(&id, cols, rows)
}

#[tauri::command]
async fn kill_session(state: State<'_, Arc<PtyManager>>, id: String) -> Result<(), String> {
    state.kill(&id);
    Ok(())
}

#[tauri::command]
async fn set_pty_backend(
    state: State<'_, Arc<PtyManager>>,
    app: AppHandle,
    id: String,
    backend: String,
) -> Result<(), String> {
    state.set_backend(app, &id, backend)
}

// Settings Commands
#[tauri::command]
async fn get_settings(state: State<'_, Arc<SettingsManager>>) -> Result<AppSettings, String> {
    Ok(state.get().await)
}

#[tauri::command]
async fn voice_save_settings(
    app: AppHandle,
    state: State<'_, Arc<SettingsManager>>,
    settings: AppSettings,
) -> Result<(), String> {
    state.save(settings.clone()).await?;
    let _ = app.emit("settings-changed", settings);
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TokenStats {
    pub total_input: i64,
    pub total_output: i64,
    pub total_saved: i64,
    pub total_cost: f64,
}

#[tauri::command]
async fn log_token_event(
    db: State<'_, Arc<DatabaseManager>>,
    transaction: TokenTransactionInput,
    saved_tokens: Option<i64>,
) -> Result<(), String> {
    insert_token_transaction(&db.pool, &transaction).await?;

    sqlx::query(
        "INSERT INTO token_events (project_id, task_id, model, input_tokens, output_tokens, saved_tokens, cost_est)
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(Some(transaction.project_path))
    .bind(Some(transaction.session_id))
    .bind(transaction.backend)
    .bind(transaction.input_tokens)
    .bind(transaction.output_tokens)
    .bind(saved_tokens.unwrap_or(0))
    .bind(transaction.cost_estimate)
    .execute(&db.pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn get_token_stats(
    db: State<'_, Arc<DatabaseManager>>,
    project_id: Option<String>,
) -> Result<TokenStats, String> {
    let query = if let Some(pid) = project_id {
        sqlx::query_as::<_, (i64, i64, i64, f64)>(
            "SELECT 
                COALESCE(SUM(input_tokens), 0), 
                COALESCE(SUM(output_tokens), 0), 
                COALESCE(SUM(saved_tokens), 0), 
                COALESCE(SUM(cost_est), 0.0) 
             FROM token_events WHERE project_id = ?",
        )
        .bind(pid)
    } else {
        sqlx::query_as::<_, (i64, i64, i64, f64)>(
            "SELECT 
                COALESCE(SUM(input_tokens), 0), 
                COALESCE(SUM(output_tokens), 0), 
                COALESCE(SUM(saved_tokens), 0), 
                COALESCE(SUM(cost_est), 0.0) 
             FROM token_events",
        )
    };

    let (total_input, total_output, total_saved, total_cost) =
        query.fetch_one(&db.pool).await.map_err(|e| e.to_string())?;

    Ok(TokenStats {
        total_input,
        total_output,
        total_saved,
        total_cost,
    })
}

#[tauri::command]
async fn get_token_history(
    db: State<'_, Arc<DatabaseManager>>,
    filters: Option<TokenHistoryFilters>,
) -> Result<TokenHistoryResponse, String> {
    query_token_history(&db.pool, filters.unwrap_or_default()).await
}

#[tauri::command]
async fn save_settings(
    app: AppHandle,
    state: State<'_, Arc<SettingsManager>>,
    ai_runtime: State<'_, Arc<ai_runtime::RuntimeManager>>,
    settings: AppSettings,
) -> Result<(), String> {
    state.save(settings.clone()).await?;
    let _ = ai_runtime.sync_settings().await;
    let _ = app.emit("settings-changed", settings);
    Ok(())
}

// Workspace Commands
#[tauri::command]
async fn get_workspace(state: State<'_, Arc<WorkspaceManager>>) -> Result<Workspace, String> {
    Ok(state.get().await)
}

#[tauri::command]
async fn save_workspace(
    state: State<'_, Arc<WorkspaceManager>>,
    workspace: Workspace,
) -> Result<(), String> {
    state.save(workspace).await
}

#[tauri::command]
async fn discover_sessions(
    project_path: String,
    backend: Option<String>,
) -> Result<Vec<session_manager::Session>, String> {
    session_manager::discover_sessions(&project_path, backend.as_deref())
}

#[tauri::command]
async fn select_directory(app: AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = std::sync::mpsc::channel();

    app.dialog().file().pick_folder(move |path| {
        let path_str = path.map(|p| p.to_string());
        tx.send(path_str).unwrap();
    });

    rx.recv().map_err(|e| e.to_string())
}

#[tauri::command]
async fn select_file(app: AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = std::sync::mpsc::channel();

    app.dialog().file().pick_file(move |path| {
        let path_str = path.map(|p| p.to_string());
        tx.send(path_str).unwrap();
    });

    rx.recv().map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_dirs(path: String) -> Result<Vec<String>, String> {
    let mut dirs = Vec::new();
    let read_dir = std::fs::read_dir(path).map_err(|e| e.to_string())?;

    for entry in read_dir {
        let entry = entry.map_err(|e| e.to_string())?;
        if entry.path().is_dir() {
            if let Some(name) = entry.file_name().to_str() {
                dirs.push(name.to_string());
            }
        }
    }

    Ok(dirs)
}

// Window Controls
#[tauri::command]
async fn window_minimize(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
async fn window_maximize(window: tauri::Window) -> Result<(), String> {
    if window.is_maximized().unwrap_or(false) {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
async fn window_close(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
async fn window_is_maximized(window: tauri::Window) -> Result<bool, String> {
    Ok(window.is_maximized().unwrap_or(false))
}

#[tauri::command]
async fn claude_md_read(project_path: String) -> Result<serde_json::Value, String> {
    let path = std::path::Path::new(&project_path).join(".claude").join("CLAUDE.md");
    if !path.exists() {
        return Ok(serde_json::json!({ "success": true, "exists": false }));
    }

    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true, "exists": true, "content": content }))
}

#[tauri::command]
async fn claude_md_save(project_path: String, content: String) -> Result<serde_json::Value, String> {
    let claude_dir = std::path::Path::new(&project_path).join(".claude");
    if !claude_dir.exists() {
        std::fs::create_dir_all(&claude_dir).map_err(|e| e.to_string())?;
    }

    let path = claude_dir.join("CLAUDE.md");
    std::fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
fn report_ready() {
    println!("WEBVIEW_READY");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let handle = app.handle().clone();

            // Register Global Shortcut: Alt+Space
            let shortcut = Shortcut::from_str("Alt+Space").unwrap();
            app.global_shortcut()
                .on_shortcut(shortcut, move |_app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        let window = handle.get_webview_window("main").unwrap();
                        if window.is_visible().unwrap_or(false) {
                            window.hide().unwrap();
                        } else {
                            window.show().unwrap();
                            window.set_focus().unwrap();
                        }
                    }
                })
                .unwrap();

            // System Tray
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show/Hide", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app: &AppHandle, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        let window = app.get_webview_window("main").unwrap();
                        if window.is_visible().unwrap_or(false) {
                            window.hide().unwrap();
                        } else {
                            window.show().unwrap();
                            window.set_focus().unwrap();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray: &TrayIcon, event| {
                    if let TrayIconEvent::Click { .. } = event {
                        let app = tray.app_handle();
                        let window = app.get_webview_window("main").unwrap();
                        if window.is_visible().unwrap_or(false) {
                            window.hide().unwrap();
                        } else {
                            window.show().unwrap();
                            window.set_focus().unwrap();
                        }
                    }
                })
                .build(app)?;

            // Initialize Database and Managers
            let app_handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                let db_manager = DatabaseManager::new(&app_handle)
                    .await
                    .expect("Failed to initialize database");
                let db_arc = Arc::new(db_manager);

                let settings_manager = Arc::new(SettingsManager::new(&app_handle, Arc::clone(&db_arc)).await);
                let workspace_manager =
                    Arc::new(WorkspaceManager::new(&app_handle, Arc::clone(&db_arc)).await);

                // Initialize AI Runtime
                let ai_runtime = Arc::new(ai_runtime::RuntimeManager::new());
                ai_runtime.set_settings_manager(Arc::clone(&settings_manager)).await;
                ai_runtime.set_database_manager(Arc::clone(&db_arc)).await;

                // Initialize Activity Manager
                let activity_manager =
                    Arc::new(activity_manager::ActivityManager::new(Arc::clone(&db_arc)));

                // Initialize Agent Manager
                let agent_manager = Arc::new(agent_manager::AgentManager::new(Arc::clone(&db_arc)));
                ai_runtime.set_agent_manager(Arc::clone(&agent_manager)).await;
                ai_runtime.set_activity_manager(Arc::clone(&activity_manager)).await;

                let _ = ai_runtime.sync_settings().await;

                // Register providers from env if database/settings don't have them
                if let Ok(key) = std::env::var("ANTHROPIC_API_KEY") {
                    ai_runtime
                        .register_provider(Arc::new(
                            ai_runtime::providers::claude::ClaudeProvider::new(key),
                        ))
                        .await;
                }
                if let Ok(key) = std::env::var("GOOGLE_API_KEY") {
                    ai_runtime
                        .register_provider(Arc::new(
                            ai_runtime::providers::gemini::GeminiProvider::new(key),
                        ))
                        .await;
                }
                if let Ok(key) = std::env::var("OPENAI_API_KEY") {
                    let base_url = std::env::var("OPENAI_BASE_URL").ok();
                    ai_runtime
                        .register_provider(Arc::new(
                            ai_runtime::providers::openai::OpenAIProvider::new(key, base_url),
                        ))
                        .await;
                }
                // Ollama is usually local
                ai_runtime
                    .register_provider(Arc::new(
                        ai_runtime::providers::ollama::OllamaProvider::new(None),
                    ))
                    .await;

                // Initialize GSD Engine
                let gsd_engine = Arc::new(gsd_engine::GsdEngine::new(Arc::clone(&db_arc)));


                // Initialize Jobs Manager
                let jobs_manager = Arc::new(Mutex::new(jobs_manager::JobsManager::new(
                    app_handle.clone(),
                    Arc::clone(&db_arc),
                    Arc::clone(&activity_manager),
                )));

                // Initialize Orchestration State
                let orchestration_state = Arc::new(OrchestrationState::default());
                ai_runtime.set_orchestration_state(Arc::clone(&orchestration_state)).await;

                // Initialize Health Manager
                let health_manager =
                    Arc::new(health_manager::HealthManager::new(
                        Arc::clone(&db_arc), 
                        Arc::clone(&ai_runtime),
                        Arc::clone(&orchestration_state)
                    ));
                health_manager::HealthManager::setup_panic_hook(app_handle.clone());

                // Initialize Diagnostic Manager
                let diagnostic_manager = Arc::new(diagnostic_manager::DiagnosticManager::new(
                    Arc::clone(&db_arc),
                ));

                app_handle.manage(db_arc);
                app_handle.manage(settings_manager);
                app_handle.manage(workspace_manager);
                app_handle.manage(ai_runtime);
                app_handle.manage(gsd_engine);
                app_handle.manage(jobs_manager);
                app_handle.manage(activity_manager);
                app_handle.manage(agent_manager);
                app_handle.manage(health_manager);
                app_handle.manage(diagnostic_manager);
                app_handle.manage(orchestration_state);
            });

            let pty_manager = PtyManager::new();
            let pty_manager_arc = Arc::new(pty_manager);
            app.manage(Arc::clone(&pty_manager_arc));
            app.manage(VoiceManager::new());
            app.manage(McpManager::new());

            // PTY Watchdog
            let handle = app.handle().clone();
            let pty_manager_watchdog = Arc::clone(&pty_manager_arc);
            thread::spawn(move || loop {
                thread::sleep(std::time::Duration::from_secs(5));
                let dead_ids = pty_manager_watchdog.check_health();
                for id in dead_ids {
                    let _ = handle.emit(&format!("pty-dead-{}", id), ());
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            spawn_session,
            write_to_pty,
            resize_pty,
            kill_session,
            set_pty_backend,
            get_settings,
            save_settings,
            get_workspace,
            save_workspace,
            window_minimize,
            window_maximize,
            window_close,
            window_is_maximized,
            report_ready,
            voice_speak,
            voice_stop,
            get_beads_tasks,
            sync_workflow,
            beads_check,
            beads_init,
            beads_list,
            beads_show,
            beads_create,
            beads_start,
            beads_complete,
            beads_delete,
            beads_update,
            beads_watch,
            beads_unwatch,
            kspec_check,
            kspec_init,
            kspec_list,
            kspec_show,
            kspec_create,
            kspec_start,
            kspec_complete,
            kspec_delete,
            kspec_update,
            kspec_watch,
            kspec_unwatch,
            kspec_ensure_daemon,
            kspec_dispatch_status,
            kspec_dispatch_start,
            kspec_dispatch_stop,
            get_pending_approvals,
            respond_to_approval,
            submit_approval_request,
            register_mcp_server,
            get_registered_mcp_servers,
            discover_sessions,
            select_directory,
            select_file,
            list_dirs,
            extension_manager::extensions_fetch_registry,
            extension_manager::extensions_get_installed,
            extension_manager::extensions_get_custom_urls,
            extension_manager::extensions_install_skill,
            extension_manager::extensions_install_mcp,
            extension_manager::extensions_remove,
            extension_manager::extensions_enable_for_project,
            extension_manager::extensions_disable_for_project,
            extension_manager::extensions_fetch_from_url,
            extension_manager::extensions_add_custom_url,
            extension_manager::extensions_remove_custom_url,
            extension_manager::extensions_set_config,
            extension_manager::extensions_check_updates,
            mcp_list_tools,
            mcp_call_tool,
            mcp_list_resources,
            mcp_read_resource,
            mcp_load_config,
            voice_save_settings,
            log_token_event,
            get_token_stats,
            get_token_history,
            project_scan,
            project_scanner::project_scan_async,
            project_generate_proposal,
            project_apply_proposal,
            voice_check_tts,
            voice_install_piper,
            voice_install_voice,
            voice_get_installed,
            scan_project_intelligence,
            ai_runtime::ai_completion,
            ai_runtime::ai_list_models,
            ai_runtime::ai_list_providers,
            ai_runtime::ai_save_key,
            ai_runtime::ai_get_health_status,
            ai_runtime::ai_dispatch,
            gsd_engine::gsd_create_plan,
            gsd_engine::gsd_add_phase,
            gsd_engine::gsd_add_step,
            gsd_engine::gsd_execute_plan,
            rtk_manager::rtk_check,
            rtk_manager::rtk_get_stats,
            rtk_manager::rtk_get_history,
            nexus_prune_context,
            jobs_manager::jobs_create,
            jobs_manager::jobs_get,
            jobs_manager::jobs_list,
            activity_manager::activity_get_recent,
            activity_manager::activity_log_info,
            agent_manager::agent_register,
            agent_manager::agent_list,
            agent_manager::agent_update_status,
            agent_manager::agent_update_metrics,
            agent_manager::agent_refresh_burn_rates,
            agent_manager::agent_cancel_task,
            health_manager::health_get_status,
            health_manager::health_log_check,
            diagnostic_manager::diagnostics_generate_bundle,
            claude_md_read,
            claude_md_save,
            orchestration::set_current_project,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
