mod pty_manager;
mod platform;
mod settings_manager;
mod voice_manager;
mod orchestration;
mod mcp_bridge;
mod workspace_manager;
mod session_manager;

use pty_manager::PtyManager;
use std::sync::Arc;
use std::thread;
use settings_manager::{SettingsManager, AppSettings};
use workspace_manager::{WorkspaceManager, Workspace};
use voice_manager::{VoiceManager, voice_speak, voice_stop};
use orchestration::{get_beads_tasks, sync_workflow, OrchestrationState};
use mcp_bridge::{register_mcp_server, get_registered_mcp_servers, McpManager};
use tauri::{AppHandle, State, Manager, Emitter};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tauri::tray::{TrayIconBuilder, TrayIconEvent, TrayIcon};
use tauri::menu::{Menu, MenuItem};
use std::str::FromStr;

#[tauri::command]
async fn spawn_session(
    state: State<'_, Arc<PtyManager>>,
    app: AppHandle,
    cwd: String,
    backend: String,
    session_id: Option<String>,
    slug: Option<String>,
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

    state.spawn(app, cwd, cmd_name, args)
}

#[tauri::command]
async fn write_to_pty(state: State<'_, Arc<PtyManager>>, id: String, data: String) -> Result<(), String> {
    state.write(&id, &data)
}

#[tauri::command]
async fn resize_pty(state: State<'_, Arc<PtyManager>>, id: String, cols: u16, rows: u16) -> Result<(), String> {
    state.resize(&id, cols, rows)
}

#[tauri::command]
async fn kill_session(state: State<'_, Arc<PtyManager>>, id: String) -> Result<(), String> {
    state.kill(&id);
    Ok(())
}

// Settings Commands
#[tauri::command]
async fn get_settings(state: State<'_, SettingsManager>) -> Result<AppSettings, String> {
    Ok(state.get())
}

#[tauri::command]
async fn save_settings(
    app: AppHandle,
    state: State<'_, SettingsManager>, 
    settings: AppSettings
) -> Result<(), String> {
    state.save(settings.clone())?;
    let _ = app.emit("settings-changed", settings);
    Ok(())
}

// Workspace Commands
#[tauri::command]
async fn get_workspace(state: State<'_, WorkspaceManager>) -> Result<Workspace, String> {
    Ok(state.get())
}

#[tauri::command]
async fn save_workspace(state: State<'_, WorkspaceManager>, workspace: Workspace) -> Result<(), String> {
    state.save(workspace)
}

#[tauri::command]
async fn discover_sessions(project_path: String, backend: Option<String>) -> Result<Vec<session_manager::Session>, String> {
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
            app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, event| {
                if event.state() == ShortcutState::Pressed {
                    let window = handle.get_webview_window("main").unwrap();
                    if window.is_visible().unwrap_or(false) {
                        window.hide().unwrap();
                    } else {
                        window.show().unwrap();
                        window.set_focus().unwrap();
                    }
                }
            }).unwrap();

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

            // Initialize Managers
            let pty_manager = PtyManager::new();
            let pty_manager_arc = Arc::new(pty_manager);
            app.manage(Arc::clone(&pty_manager_arc));
            app.manage(SettingsManager::new(app.handle()));
            app.manage(WorkspaceManager::new(app.handle()));
            app.manage(VoiceManager::new());
            app.manage(OrchestrationState::default());
            app.manage(McpManager::new());

            // PTY Watchdog
            let handle = app.handle().clone();
            let pty_manager_watchdog = Arc::clone(&pty_manager_arc);
            thread::spawn(move || {
                loop {
                    thread::sleep(std::time::Duration::from_secs(5));
                    let dead_ids = pty_manager_watchdog.check_health();
                    for id in dead_ids {
                        let _ = handle.emit(&format!("pty-dead-{}", id), ());
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            spawn_session,
            write_to_pty,
            resize_pty,
            kill_session,
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
            register_mcp_server,
            get_registered_mcp_servers,
            discover_sessions,
            select_directory
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
