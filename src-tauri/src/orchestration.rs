use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BeadTask {
    pub id: String,
    pub title: String,
    pub status: String,
    pub priority: Option<i32>,
}

#[derive(Default)]
pub struct OrchestrationState {
    // Current active task or workflow state
}

#[tauri::command]
pub async fn get_beads_tasks() -> Result<Vec<BeadTask>, String> {
    let output = Command::new("bd")
        .arg("ready")
        .arg("--json") // Assuming bd supports json output
        .output()
        .map_err(|e| format!("Failed to execute bd: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let tasks: Vec<BeadTask> = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse bd output: {}", e))?;

    Ok(tasks)
}

#[tauri::command]
pub async fn sync_workflow(app: AppHandle) -> Result<(), String> {
    // This could run a background check for task changes and emit events
    app.emit("workflow-sync-start", ()).map_err(|e: tauri::Error| e.to_string())?;
    
    // Simulate some work or call bd commands
    
    app.emit("workflow-sync-complete", ()).map_err(|e: tauri::Error| e.to_string())?;
    Ok(())
}
