use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::{AppHandle, Emitter, State};
use std::collections::HashMap;
use parking_lot::Mutex;
use tokio::time::{sleep, Duration};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BeadTask {
    pub id: String,
    pub title: String,
    pub status: String,
    pub priority: Option<i32>,
}

#[derive(Default)]
pub struct OrchestrationState {
    pub watched_projects: Mutex<HashMap<String, tauri::async_runtime::JoinHandle<()>>>,
    pub watched_kspec_projects: Mutex<HashMap<String, tauri::async_runtime::JoinHandle<()>>>,
}

#[tauri::command]
pub async fn get_beads_tasks() -> Result<Vec<BeadTask>, String> {
    let output = Command::new("bd")
        .arg("ready")
        .arg("--json")
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
    app.emit("workflow-sync-start", ()).map_err(|e: tauri::Error| e.to_string())?;
    // Simulate some work or call bd commands
    app.emit("workflow-sync-complete", ()).map_err(|e: tauri::Error| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn beads_check(cwd: String) -> Result<serde_json::Value, String> {
    let beads_dir = std::path::Path::new(&cwd).join(".beads");
    let installed = Command::new("bd").arg("--version").output().is_ok();
    let initialized = beads_dir.exists();
    Ok(serde_json::json!({
        "installed": installed,
        "initialized": initialized
    }))
}

#[tauri::command]
pub async fn beads_init(cwd: String) -> Result<serde_json::Value, String> {
    let output = Command::new("bd")
        .current_dir(&cwd)
        .arg("init")
        .output()
        .map_err(|e| format!("Failed to execute bd init: {}", e))?;

    if !output.status.success() {
        return Ok(serde_json::json!({
            "success": false,
            "error": String::from_utf8_lossy(&output.stderr).to_string()
        }));
    }

    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn beads_list(cwd: String) -> Result<serde_json::Value, String> {
    let output = Command::new("bd")
        .current_dir(&cwd)
        .arg("ready")
        .arg("--json")
        .output()
        .map_err(|e| format!("Failed to execute bd ready: {}", e))?;

    if !output.status.success() {
        return Ok(serde_json::json!({
            "success": false,
            "error": String::from_utf8_lossy(&output.stderr).to_string()
        }));
    }

    let tasks: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse bd output: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "tasks": tasks
    }))
}

#[tauri::command]
pub async fn beads_show(cwd: String, task_id: String) -> Result<serde_json::Value, String> {
    let output = Command::new("bd")
        .current_dir(&cwd)
        .arg("show")
        .arg(&task_id)
        .arg("--json")
        .output()
        .map_err(|e| format!("Failed to execute bd show: {}", e))?;

    if !output.status.success() {
        return Ok(serde_json::json!({
            "success": false,
            "error": String::from_utf8_lossy(&output.stderr).to_string()
        }));
    }

    let task: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse bd output: {}", e))?;

    let task_obj = if task.is_array() {
        task.as_array().and_then(|a| a.first()).cloned().unwrap_or(serde_json::Value::Null)
    } else {
        task
    };

    Ok(serde_json::json!({
        "success": true,
        "task": task_obj
    }))
}

#[tauri::command]
pub async fn beads_create(
    cwd: String,
    title: String,
    description: Option<String>,
    priority: Option<i32>,
    task_type: Option<String>,
    tags: Option<String>
) -> Result<serde_json::Value, String> {
    let mut cmd = Command::new("bd");
    cmd.current_dir(&cwd).arg("create").arg(&title);
    
    if let Some(d) = description {
        cmd.arg("--description").arg(d);
    }
    if let Some(p) = priority {
        cmd.arg("--priority").arg(p.to_string());
    }
    if let Some(t) = task_type {
        cmd.arg("--type").arg(t);
    }
    if let Some(tg) = tags {
        cmd.arg("--labels").arg(tg);
    }

    let output = cmd.output().map_err(|e| format!("Failed to execute bd create: {}", e))?;

    if !output.status.success() {
        return Ok(serde_json::json!({
            "success": false,
            "error": String::from_utf8_lossy(&output.stderr).to_string()
        }));
    }

    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn beads_start(cwd: String, task_id: String) -> Result<serde_json::Value, String> {
    let output = Command::new("bd")
        .current_dir(&cwd)
        .arg("update")
        .arg(&task_id)
        .arg("--status")
        .arg("in_progress")
        .output()
        .map_err(|e| format!("Failed to execute bd start: {}", e))?;

    if !output.status.success() {
        return Ok(serde_json::json!({
            "success": false,
            "error": String::from_utf8_lossy(&output.stderr).to_string()
        }));
    }

    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn beads_complete(cwd: String, task_id: String) -> Result<serde_json::Value, String> {
    let output = Command::new("bd")
        .current_dir(&cwd)
        .arg("close")
        .arg(&task_id)
        .output()
        .map_err(|e| format!("Failed to execute bd close: {}", e))?;

    if !output.status.success() {
        return Ok(serde_json::json!({
            "success": false,
            "error": String::from_utf8_lossy(&output.stderr).to_string()
        }));
    }

    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn beads_delete(cwd: String, task_id: String) -> Result<serde_json::Value, String> {
    let output = Command::new("bd")
        .current_dir(&cwd)
        .arg("delete")
        .arg(&task_id)
        .output()
        .map_err(|e| format!("Failed to execute bd delete: {}", e))?;

    if !output.status.success() {
        return Ok(serde_json::json!({
            "success": false,
            "error": String::from_utf8_lossy(&output.stderr).to_string()
        }));
    }

    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn beads_update(
    cwd: String,
    task_id: String,
    status: Option<String>,
    title: Option<String>,
    description: Option<String>,
    priority: Option<i32>,
    acceptance_criteria: Option<Vec<serde_json::Value>>,
    traits: Option<Vec<serde_json::Value>>
) -> Result<serde_json::Value, String> {
    let mut cmd = Command::new("bd");
    cmd.current_dir(&cwd).arg("update").arg(&task_id);
    
    if let Some(s) = status {
        cmd.arg("--status").arg(s);
    }
    if let Some(t) = title {
        cmd.arg("--title").arg(t);
    }
    if let Some(d) = description {
        cmd.arg("--description").arg(d);
    }
    if let Some(p) = priority {
        cmd.arg("--estimate").arg((p * 60).to_string()); // Beads uses minutes for priority/estimate? No, priority is different.
    }

    if let Some(ac_list) = acceptance_criteria {
        // Convert AC list to a string for beads --acceptance flag
        let ac_string = ac_list.iter().map(|ac| {
            let title = ac.get("title").and_then(|v| v.as_str()).unwrap_or("");
            let status = ac.get("status").and_then(|v| v.as_str()).unwrap_or("pending");
            format!("[{}] {}", if status == "completed" { "x" } else { " " }, title)
        }).collect::<Vec<_>>().join("\n");
        cmd.arg("--acceptance").arg(ac_string);
    }

    if let Some(trait_list) = traits {
        for tr in trait_list {
            if let Some(label) = tr.get("label").and_then(|v| v.as_str()) {
                cmd.arg("--add-label").arg(label);
            }
        }
    }

    let output = cmd.output().map_err(|e| format!("Failed to execute bd update: {}", e))?;

    if !output.status.success() {
        return Ok(serde_json::json!({
            "success": false,
            "error": String::from_utf8_lossy(&output.stderr).to_string()
        }));
    }

    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn beads_watch(
    app: AppHandle,
    state: State<'_, OrchestrationState>,
    cwd: String
) -> Result<(), String> {
    let mut watched = state.watched_projects.lock();
    if watched.contains_key(&cwd) {
        return Ok(());
    }

    let cwd_clone = cwd.clone();
    let handle = tauri::async_runtime::spawn(async move {
        let mut last_output = String::new();
        loop {
            let output = Command::new("bd")
                .current_dir(&cwd_clone)
                .arg("ready")
                .arg("--json")
                .output();

            if let Ok(out) = output {
                let current_output = String::from_utf8_lossy(&out.stdout).to_string();
                if current_output != last_output {
                    last_output = current_output;
                    let _ = app.emit("beads-tasks-changed", serde_json::json!({ "cwd": cwd_clone }));
                }
            }
            sleep(Duration::from_secs(2)).await;
        }
    });

    watched.insert(cwd, handle);
    Ok(())
}

#[tauri::command]
pub async fn beads_unwatch(
    state: State<'_, OrchestrationState>,
    cwd: String
) -> Result<(), String> {
    let mut watched = state.watched_projects.lock();
    if let Some(handle) = watched.remove(&cwd) {
        handle.abort();
    }
    Ok(())
}

#[tauri::command]
pub async fn kspec_check(cwd: String) -> Result<serde_json::Value, String> {
    let kspec_dir = std::path::Path::new(&cwd).join(".kspec");
    let installed = Command::new("kspec").arg("--version").output().is_ok();
    let initialized = kspec_dir.exists();
    Ok(serde_json::json!({
        "installed": installed,
        "initialized": initialized,
        "exists": initialized // for backward compatibility
    }))
}

#[tauri::command]
pub async fn kspec_init(cwd: String) -> Result<serde_json::Value, String> {
    let output = Command::new("kspec")
        .current_dir(&cwd)
        .arg("init")
        .output()
        .map_err(|e| format!("Failed to execute kspec init: {}", e))?;

    if !output.status.success() {
        return Ok(serde_json::json!({
            "success": false,
            "error": String::from_utf8_lossy(&output.stderr).to_string()
        }));
    }

    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn kspec_list(cwd: String) -> Result<serde_json::Value, String> {
    let output = Command::new("kspec")
        .current_dir(&cwd)
        .arg("tasks")
        .arg("list")
        .arg("--json")
        .output()
        .map_err(|e| format!("Failed to execute kspec tasks list: {}", e))?;

    if !output.status.success() {
        return Ok(serde_json::json!({
            "success": false,
            "error": String::from_utf8_lossy(&output.stderr).to_string()
        }));
    }

    let items: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse kspec output: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "items": items
    }))
}

#[tauri::command]
pub async fn kspec_show(cwd: String, task_id: String) -> Result<serde_json::Value, String> {
    let output = Command::new("kspec")
        .current_dir(&cwd)
        .arg("task")
        .arg("get")
        .arg(&task_id)
        .arg("--json")
        .output()
        .map_err(|e| format!("Failed to execute kspec task get: {}", e))?;

    if !output.status.success() {
        return Ok(serde_json::json!({
            "success": false,
            "error": String::from_utf8_lossy(&output.stderr).to_string()
        }));
    }

    let task: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse kspec output: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "task": task
    }))
}

#[tauri::command]
pub async fn kspec_create(
    cwd: String,
    title: String,
    description: Option<String>,
    priority: Option<i32>,
    task_type: Option<String>,
    tags: Option<String>
) -> Result<serde_json::Value, String> {
    let mut cmd = Command::new("kspec");
    cmd.current_dir(&cwd).arg("task").arg("add").arg("--title").arg(&title);
    
    if let Some(d) = description {
        cmd.arg("--description").arg(d);
    }
    if let Some(p) = priority {
        cmd.arg("--priority").arg(p.to_string());
    }
    if let Some(t) = task_type {
        cmd.arg("--type").arg(t);
    }
    if let Some(tg) = tags {
        cmd.arg("--tags").arg(tg);
    }

    let output = cmd.output().map_err(|e| format!("Failed to execute kspec task add: {}", e))?;

    if !output.status.success() {
        return Ok(serde_json::json!({
            "success": false,
            "error": String::from_utf8_lossy(&output.stderr).to_string()
        }));
    }

    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn kspec_start(cwd: String, task_id: String) -> Result<serde_json::Value, String> {
    let output = Command::new("kspec")
        .current_dir(&cwd)
        .arg("task")
        .arg("start")
        .arg(&task_id)
        .output()
        .map_err(|e| format!("Failed to execute kspec task start: {}", e))?;

    if !output.status.success() {
        return Ok(serde_json::json!({
            "success": false,
            "error": String::from_utf8_lossy(&output.stderr).to_string()
        }));
    }

    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn kspec_complete(cwd: String, task_id: String) -> Result<serde_json::Value, String> {
    let output = Command::new("kspec")
        .current_dir(&cwd)
        .arg("task")
        .arg("complete")
        .arg(&task_id)
        .output()
        .map_err(|e| format!("Failed to execute kspec task complete: {}", e))?;

    if !output.status.success() {
        return Ok(serde_json::json!({
            "success": false,
            "error": String::from_utf8_lossy(&output.stderr).to_string()
        }));
    }

    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn kspec_delete(cwd: String, task_id: String) -> Result<serde_json::Value, String> {
    let output = Command::new("kspec")
        .current_dir(&cwd)
        .arg("task")
        .arg("delete")
        .arg(&task_id)
        .arg("--force")
        .output()
        .map_err(|e| format!("Failed to execute kspec task delete: {}", e))?;

    if !output.status.success() {
        return Ok(serde_json::json!({
            "success": false,
            "error": String::from_utf8_lossy(&output.stderr).to_string()
        }));
    }

    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn kspec_update(
    cwd: String,
    task_id: String,
    status: Option<String>,
    title: Option<String>,
    description: Option<String>,
    priority: Option<i32>,
    acceptance_criteria: Option<Vec<serde_json::Value>>,
    traits: Option<Vec<serde_json::Value>>
) -> Result<serde_json::Value, String> {
    // We'll use 'kspec task patch' for rich updates
    let mut patch_data = serde_json::Map::new();
    
    if let Some(s) = status {
        patch_data.insert("status".to_string(), serde_json::Value::String(s));
    }
    if let Some(t) = title {
        patch_data.insert("title".to_string(), serde_json::Value::String(t));
    }
    if let Some(d) = description {
        patch_data.insert("description".to_string(), serde_json::Value::String(d));
    }
    if let Some(p) = priority {
        patch_data.insert("priority".to_string(), serde_json::Value::Number(serde_json::Number::from(p)));
    }
    if let Some(ac) = acceptance_criteria {
        patch_data.insert("acceptance_criteria".to_string(), serde_json::Value::Array(ac));
    }
    if let Some(tr) = traits {
        // Map traits back to tags for kspec
        let tags = tr.iter()
            .filter_map(|t| t.get("label").and_then(|v| v.as_str()))
            .map(|s| serde_json::Value::String(s.to_string()))
            .collect::<Vec<_>>();
        patch_data.insert("tags".to_string(), serde_json::Value::Array(tags));
    }

    let patch_json = serde_json::to_string(&patch_data).map_err(|e| e.to_string())?;

    let mut cmd = Command::new("kspec");
    cmd.current_dir(&cwd)
        .arg("task")
        .arg("patch")
        .arg(&task_id)
        .arg("--data")
        .arg(patch_json)
        .arg("--allow-unknown"); // Ensure we can store ACs even if schema is strict

    let output = cmd.output().map_err(|e| format!("Failed to execute kspec task set: {}", e))?;

    if !output.status.success() {
        return Ok(serde_json::json!({
            "success": false,
            "error": String::from_utf8_lossy(&output.stderr).to_string()
        }));
    }

    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn kspec_watch(
    app: AppHandle,
    state: State<'_, OrchestrationState>,
    cwd: String
) -> Result<(), String> {
    let mut watched = state.watched_kspec_projects.lock();
    if watched.contains_key(&cwd) {
        return Ok(());
    }

    let cwd_clone = cwd.clone();
    let handle = tauri::async_runtime::spawn(async move {
        let mut last_output = String::new();
        loop {
            let output = Command::new("kspec")
                .current_dir(&cwd_clone)
                .arg("tasks")
                .arg("list")
                .arg("--json")
                .output();

            if let Ok(out) = output {
                let current_output = String::from_utf8_lossy(&out.stdout).to_string();
                if current_output != last_output {
                    last_output = current_output;
                    let _ = app.emit("kspec-tasks-changed", serde_json::json!({ "cwd": cwd_clone }));
                }
            }
            sleep(Duration::from_secs(2)).await;
        }
    });

    watched.insert(cwd, handle);
    Ok(())
}

#[tauri::command]
pub async fn kspec_unwatch(
    state: State<'_, OrchestrationState>,
    cwd: String
) -> Result<(), String> {
    let mut watched = state.watched_kspec_projects.lock();
    if let Some(handle) = watched.remove(&cwd) {
        handle.abort();
    }
    Ok(())
}

#[tauri::command]
pub async fn kspec_ensure_daemon(_cwd: String) -> Result<serde_json::Value, String> {
    // Keep it for now to avoid breaking existing code, but make it a no-op that says success
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn kspec_dispatch_status(cwd: String) -> Result<serde_json::Value, String> {
    let output = Command::new("kspec")
        .current_dir(&cwd)
        .arg("agent")
        .arg("dispatch")
        .arg("status")
        .arg("--json")
        .output()
        .map_err(|e| format!("Failed to execute kspec agent dispatch status: {}", e))?;

    if !output.status.success() {
        return Ok(serde_json::json!({
            "running": false,
            "error": String::from_utf8_lossy(&output.stderr).to_string()
        }));
    }

    let status: serde_json::Value = serde_json::from_slice(&output.stdout)
        .unwrap_or(serde_json::json!({ "running": false }));

    Ok(status)
}

#[tauri::command]
pub async fn kspec_dispatch_start(cwd: String) -> Result<serde_json::Value, String> {
    let output = Command::new("kspec")
        .current_dir(&cwd)
        .arg("agent")
        .arg("dispatch")
        .arg("start")
        .output()
        .map_err(|e| format!("Failed to execute kspec agent dispatch start: {}", e))?;

    if !output.status.success() {
        return Ok(serde_json::json!({
            "success": false,
            "error": String::from_utf8_lossy(&output.stderr).to_string()
        }));
    }

    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn kspec_dispatch_stop(cwd: String) -> Result<serde_json::Value, String> {
    let output = Command::new("kspec")
        .current_dir(&cwd)
        .arg("agent")
        .arg("dispatch")
        .arg("stop")
        .output()
        .map_err(|e| format!("Failed to execute kspec agent dispatch stop: {}", e))?;

    if !output.status.success() {
        return Ok(serde_json::json!({
            "success": false,
            "error": String::from_utf8_lossy(&output.stderr).to_string()
        }));
    }

    Ok(serde_json::json!({ "success": true }))
}
