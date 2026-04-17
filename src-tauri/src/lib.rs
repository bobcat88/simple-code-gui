mod pty_manager;
mod platform;

use pty_manager::PtyManager;
use tauri::{AppHandle, State};

#[tauri::command]
async fn spawn_session(
    state: State<'_, PtyManager>,
    app: AppHandle,
    cwd: String,
    backend: String,
    args: Vec<String>,
) -> Result<String, String> {
    state.spawn(app, cwd, backend, args)
}

#[tauri::command]
async fn write_to_pty(state: State<'_, PtyManager>, id: String, data: String) -> Result<(), String> {
    state.write(&id, &data)
}

#[tauri::command]
async fn resize_pty(state: State<'_, PtyManager>, id: String, cols: u16, rows: u16) -> Result<(), String> {
    state.resize(&id, cols, rows)
}

#[tauri::command]
async fn kill_session(state: State<'_, PtyManager>, id: String) -> Result<(), String> {
    state.kill(&id);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(PtyManager::new())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            spawn_session,
            write_to_pty,
            resize_pty,
            kill_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
