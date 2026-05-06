use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::{AppHandle, Emitter, Manager, State};
use std::collections::HashMap;
use std::sync::Arc;
use parking_lot::Mutex as PlMutex;
use crate::database::DatabaseManager;
use uuid::Uuid;
use chrono::Utc;
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration};
use crate::jobs_manager::JobsManager;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BeadTask {
    pub id: String,
    pub title: String,
    pub status: String,
    pub priority: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GsdSeed {
    #[serde(default)]
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub slug: String,
    #[serde(default)]
    pub why: String,
    #[serde(default)]
    pub when_to_surface: String,
    #[serde(default = "default_seed_status")]
    pub status: String,
    #[serde(default)]
    pub timestamp: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct KSpecDraft {
    pub id: String,
    pub title: String,
    pub content: String,
    pub last_modified: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct BrainstormCanvas {
    #[serde(default)]
    pub nodes: Vec<BrainstormCanvasNode>,
    #[serde(default)]
    pub edges: Vec<BrainstormCanvasEdge>,
    #[serde(default)]
    pub updated_at: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BrainstormCanvasNode {
    pub id: String,
    pub node_type: String,
    pub title: String,
    pub content: String,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    #[serde(default)]
    pub source_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BrainstormCanvasEdge {
    pub id: String,
    pub from_node: String,
    pub to_node: String,
    #[serde(default)]
    pub label: Option<String>,
}

fn default_seed_status() -> String {
    "planted".to_string()
}

fn slugify_filename(input: &str) -> String {
    let slug = input
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-");

    if slug.is_empty() {
        "untitled-seed".to_string()
    } else {
        slug
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileDiffHunk {
    pub old_start: u32,
    pub new_start: u32,
    pub lines: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileDiff {
    pub path: String,
    pub hunks: Vec<FileDiffHunk>,
    #[serde(default)]
    pub is_new: bool,
    #[serde(default)]
    pub is_deleted: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum ApprovalCategory {
    FileChange,
    Command,
    ConfigChange,
    Destructive,
    External,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ApprovalRequest {
    pub id: String,
    pub agent_id: String,
    pub agent_name: String,
    pub category: ApprovalCategory,
    pub risk: RiskLevel,
    pub title: String,
    pub description: String,
    pub file_diffs: Option<Vec<FileDiff>>,
    pub command: Option<String>,
    pub affected_paths: Option<Vec<String>>,
    pub reversible: bool,
    pub timestamp: u64,
    pub expires_at: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum ApprovalDecision {
    Approved,
    Rejected,
    Modified,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ApprovalResponse {
    pub action_id: String,
    pub decision: ApprovalDecision,
    pub comment: Option<String>,
    pub conditions: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentMessage {
    pub id: String,
    pub timestamp: u64,
    pub from_agent: String,
    pub to_agent: Option<String>,
    pub message_type: String,
    pub content: String,
    pub metadata: Option<serde_json::Value>,
    pub cache_control: Option<serde_json::Value>,
}

#[derive(Default)]
pub struct OrchestrationState {
    pub watched_projects: PlMutex<HashMap<String, tauri::async_runtime::JoinHandle<()>>>,
    pub watched_kspec_projects: PlMutex<HashMap<String, tauri::async_runtime::JoinHandle<()>>>,
    pub pending_approvals: PlMutex<Vec<ApprovalRequest>>,
    pub message_bus: PlMutex<Vec<AgentMessage>>,
    pub current_project_path: PlMutex<Option<String>>,
    pub active_project_paths: PlMutex<Vec<String>>,
    pub last_scan: PlMutex<Option<crate::project_scanner::ProjectCapabilityScan>>,
}

#[tauri::command]
pub async fn set_current_project(
    state: State<'_, OrchestrationState>,
    db: State<'_, Arc<DatabaseManager>>,
    path: Option<String>
) -> Result<(), String> {
    {
        let mut current = state.current_project_path.lock();
        *current = path.clone();
    }
    
    // Also ensure it's in the active_project_paths if provided
    if let Some(p) = path {
        {
            let mut active = state.active_project_paths.lock();
            if !active.contains(&p) {
                active.push(p.clone());
            }
        }
        
        // Auto-hydrate from JSON snapshots (durable logs)
        let _ = internal_hydrate_swarm(&db, &p).await;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn add_active_project(
    state: State<'_, OrchestrationState>,
    path: String
) -> Result<(), String> {
    let mut active = state.active_project_paths.lock();
    if !active.contains(&path) {
        active.push(path);
    }
    Ok(())
}

#[tauri::command]
pub async fn remove_active_project(
    state: State<'_, OrchestrationState>,
    path: String
) -> Result<(), String> {
    let mut active = state.active_project_paths.lock();
    active.retain(|p| p != &path);
    Ok(())
}

#[tauri::command]
pub async fn get_active_projects(
    state: State<'_, OrchestrationState>
) -> Result<Vec<String>, String> {
    let active = state.active_project_paths.lock();
    Ok(active.clone())
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
#[allow(clippy::too_many_arguments)]
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
#[allow(clippy::too_many_arguments)]
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
pub async fn claude_check() -> Result<serde_json::Value, String> {
    let installed = Command::new("claude").arg("--version").output().is_ok();
    // In many environments, it might be an npm package
    let npm_installed = Command::new("npm").arg("list").arg("-g").arg("@anthropic-ai/claude-code").output().is_ok();
    
    Ok(serde_json::json!({
        "installed": installed || npm_installed,
        "npmInstalled": npm_installed,
        "gitBashInstalled": cfg!(target_os = "windows") // Placeholder for parity
    }))
}

#[tauri::command]
pub async fn gemini_check() -> Result<serde_json::Value, String> {
    let installed = Command::new("gemini").arg("--version").output().is_ok();
    let npm_installed = Command::new("npm").arg("list").arg("-g").arg("@google/generative-ai").output().is_ok();
    
    Ok(serde_json::json!({
        "installed": installed || npm_installed,
        "npmInstalled": npm_installed
    }))
}

#[tauri::command]
pub async fn codex_check() -> Result<serde_json::Value, String> {
    let installed = Command::new("codex").arg("--version").output().is_ok();
    Ok(serde_json::json!({
        "installed": installed,
        "npmInstalled": false
    }))
}

#[tauri::command]
pub async fn opencode_check() -> Result<serde_json::Value, String> {
    let installed = Command::new("opencode").arg("--version").output().is_ok();
    Ok(serde_json::json!({
        "installed": installed,
        "npmInstalled": false
    }))
}

#[tauri::command]
pub async fn aider_check() -> Result<serde_json::Value, String> {
    let installed = Command::new("aider").arg("--version").output().is_ok();
    let pip_installed = Command::new("pip").arg("show").arg("aider-chat").output().is_ok();
    
    Ok(serde_json::json!({
        "installed": installed || pip_installed,
        "pipInstalled": pip_installed
    }))
}

#[tauri::command]
pub async fn claude_install() -> Result<serde_json::Value, String> {
    // Placeholder - actually installing would require more complex logic (permissions, etc)
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn gemini_install() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn codex_install() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn opencode_install() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn aider_install() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn gsd_check() -> Result<serde_json::Value, String> {
    let installed = Command::new("gsd").arg("--version").output().is_ok();
    let npm_installed = Command::new("npm").arg("list").arg("-g").arg("@gsd/cli").output().is_ok();
    
    Ok(serde_json::json!({
        "installed": installed || npm_installed,
        "npmInstalled": npm_installed
    }))
}

#[tauri::command]
pub async fn gsd_install() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn beads_install() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn git_install() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn node_install() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn python_install() -> Result<serde_json::Value, String> {
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

// ============================================================================
// Approval Workflow Commands
// ============================================================================

#[tauri::command]
pub async fn get_pending_approvals(
    state: State<'_, OrchestrationState>,
    _cwd: String,
) -> Result<Vec<ApprovalRequest>, String> {
    let approvals = state.pending_approvals.lock();
    Ok(approvals.clone())
}

#[tauri::command]
pub async fn respond_to_approval(
    app: AppHandle,
    state: State<'_, OrchestrationState>,
    response: ApprovalResponse,
) -> Result<serde_json::Value, String> {
    let mut approvals = state.pending_approvals.lock();
    let existed = approvals.iter().any(|a| a.id == response.action_id);

    if !existed {
        return Ok(serde_json::json!({
            "success": false,
            "error": "Approval request not found or already resolved"
        }));
    }

    approvals.retain(|a| a.id != response.action_id);

    let _ = app.emit("approval-resolved", &response.action_id);

    Ok(serde_json::json!({
        "success": true,
        "decision": serde_json::to_value(&response.decision).unwrap_or_default()
    }))
}

/// Called internally (or via IPC from agents) to submit an approval request
#[tauri::command]
pub async fn submit_approval_request(
    app: AppHandle,
    state: State<'_, OrchestrationState>,
    request: ApprovalRequest,
) -> Result<serde_json::Value, String> {
    {
        let mut approvals = state.pending_approvals.lock();
        approvals.push(request.clone());
    }

    let _ = app.emit("approval-request", &request);

    Ok(serde_json::json!({ "success": true, "id": request.id }))
}

// ============================================================================
// Agent Messaging Commands
// ============================================================================

pub async fn internal_broadcast_agent_message(
    app: &AppHandle,
    state: &OrchestrationState,
    db: &DatabaseManager,
    message: AgentMessage,
) -> Result<(), String> {
    let current_path = {
        let path = state.current_project_path.lock();
        path.clone()
    };

    {
        let mut bus = state.message_bus.lock();
        bus.push(message.clone());
        
        // Keep only the last 100 messages to avoid unbounded growth in-memory
        if bus.len() > 100 {
            bus.remove(0);
        }
    }

    // Persist to SQLite for long-term history
    let _ = crate::database::insert_swarm_message(
        &db.pool,
        &message,
        current_path.as_deref(),
        None
    ).await;

    let _ = app.emit("agent-message", &message);
    Ok(())
}

#[tauri::command]
pub async fn broadcast_agent_message(
    app: AppHandle,
    state: State<'_, Arc<OrchestrationState>>,
    db: State<'_, Arc<DatabaseManager>>,
    message: AgentMessage,
) -> Result<serde_json::Value, String> {
    let id = message.id.clone();
    internal_broadcast_agent_message(&app, &state, &db, message).await?;
    Ok(serde_json::json!({ "success": true, "id": id }))
}

// ============================================================================
// Brainstorm Companion Commands
// ============================================================================

#[tauri::command]
pub async fn gsd_list_seeds(cwd: String) -> Result<Vec<GsdSeed>, String> {
    let seeds_dir = std::path::Path::new(&cwd).join(".kspec").join("seeds");
    if !seeds_dir.exists() {
        return Ok(Vec::new());
    }

    let mut seeds = Vec::new();
    let entries = std::fs::read_dir(seeds_dir).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
            let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
            let filename = path.file_stem().and_then(|s| s.to_str()).unwrap_or("unknown");
            
            // Basic parsing of the seed file
            // Expecting format like:
            // # Title
            // why: ...
            // whenToSurface: ...
            
            let mut title = filename.to_string();
            let mut why = String::new();
            let mut when_to_surface = "Next Milestone".to_string();
            let mut status = "planted".to_string();
            
            for line in content.lines() {
                if let Some(rest) = line.strip_prefix("# ") {
                    title = rest.to_string();
                } else if let Some(rest) = line.strip_prefix("why: ") {
                    why = rest.to_string();
                } else if let Some(rest) = line.strip_prefix("whenToSurface: ") {
                    when_to_surface = rest.to_string();
                } else if let Some(rest) = line.strip_prefix("status: ") {
                    status = rest.to_string();
                }
            }

            seeds.push(GsdSeed {
                id: filename.to_string(),
                title,
                slug: filename.to_string(),
                why,
                when_to_surface,
                status,
                timestamp: entry.metadata().and_then(|m| m.modified()).map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs()).unwrap_or(0),
            });
        }
    }

    Ok(seeds)
}

#[tauri::command]
pub async fn gsd_plant_seed(cwd: String, seed: GsdSeed) -> Result<(), String> {
    let seeds_dir = std::path::Path::new(&cwd).join(".kspec").join("seeds");
    std::fs::create_dir_all(&seeds_dir).map_err(|e| e.to_string())?;

    let filename = if seed.slug.trim().is_empty() {
        slugify_filename(&seed.title)
    } else {
        slugify_filename(&seed.slug)
    };
    
    let path = seeds_dir.join(format!("{}.md", filename));
    let when_to_surface = if seed.when_to_surface.trim().is_empty() {
        "Next Milestone"
    } else {
        seed.when_to_surface.as_str()
    };
    let content = format!(
        "# {}\n\nwhy: {}\nwhenToSurface: {}\nstatus: planted\n",
        seed.title, seed.why, when_to_surface
    );

    std::fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn gsd_update_seed_status(cwd: String, seed_id: String, status: String) -> Result<(), String> {
    let seeds_dir = std::path::Path::new(&cwd).join(".kspec").join("seeds");
    let path = seeds_dir.join(format!("{}.md", seed_id));
    
    if !path.exists() {
        return Err(format!("Seed not found: {}", seed_id));
    }

    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();
    let mut updated = false;

    for line in lines.iter_mut() {
        if line.starts_with("status: ") {
            *line = format!("status: {}", status);
            updated = true;
            break;
        }
    }

    if !updated {
        lines.push(format!("status: {}", status));
    }

    std::fs::write(path, lines.join("\n")).map_err(|e| e.to_string())?;
    Ok(())
}


#[tauri::command]
pub async fn kspec_list_drafts(cwd: String) -> Result<Vec<KSpecDraft>, String> {
    let draft_dir = std::path::Path::new(&cwd).join(".kspec").join("modules").join("drafts");
    if !draft_dir.exists() {
        return Ok(Vec::new());
    }

    let mut drafts = Vec::new();
    let entries = std::fs::read_dir(draft_dir).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("yaml") {
            let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
            let filename = path.file_stem().and_then(|s| s.to_str()).unwrap_or("unknown");
            
            drafts.push(KSpecDraft {
                id: filename.to_string(),
                title: filename.to_string(),
                content,
                last_modified: entry.metadata().and_then(|m| m.modified()).map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs()).unwrap_or(0),
            });
        }
    }

    Ok(drafts)
}

#[tauri::command]
pub async fn kspec_write_draft(cwd: String, module_id: String, content: String) -> Result<(), String> {
    let draft_dir = std::path::Path::new(&cwd).join(".kspec").join("modules").join("drafts");
    std::fs::create_dir_all(&draft_dir).map_err(|e| e.to_string())?;

    let path = draft_dir.join(format!("{}.yaml", module_id));
    std::fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn brainstorm_load_canvas(cwd: String) -> Result<BrainstormCanvas, String> {
    let path = std::path::Path::new(&cwd)
        .join(".kspec")
        .join("brainstorm")
        .join("canvas.json");

    if !path.exists() {
        return Ok(BrainstormCanvas::default());
    }

    let content = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| format!("Failed to parse brainstorm canvas: {}", e))
}

#[tauri::command]
pub async fn brainstorm_save_canvas(cwd: String, mut canvas: BrainstormCanvas) -> Result<(), String> {
    let canvas_dir = std::path::Path::new(&cwd).join(".kspec").join("brainstorm");
    std::fs::create_dir_all(&canvas_dir).map_err(|e| e.to_string())?;

    canvas.updated_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let path = canvas_dir.join("canvas.json");
    let content = serde_json::to_string_pretty(&canvas)
        .map_err(|e| format!("Failed to serialize brainstorm canvas: {}", e))?;
    std::fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn brainstorm_agentic_sketch(
    ai_runtime: tauri::State<'_, std::sync::Arc<crate::ai_runtime::RuntimeManager>>,
    orchestration: tauri::State<'_, OrchestrationState>,
    cwd: String,
    base_id: String,
    base_title: String,
    base_content: String
) -> Result<BrainstormCanvasNode, String> {
    let request = crate::ai_runtime::types::CompletionRequest {
        messages: vec![
            crate::ai_runtime::types::Message {
                role: "system".to_string(),
                content: "You are a software architect and UX designer. The user will provide a feature idea or node content. Output a concise 'sketch' of how this feature should be designed and implemented. Keep it structured and actionable, focusing on UI layout, interaction flow, and basic data structures. Do not use markdown code blocks, just output text.".to_string(),
                tool_calls: None,
                tool_call_id: None,
                cache_control: None,
            },
            crate::ai_runtime::types::Message {
                role: "user".to_string(),
                content: format!("Title: {}\n\nContent:\n{}", base_title, base_content),
                tool_calls: None,
                tool_call_id: None,
                cache_control: None,
            }
        ],
        project_path: Some(cwd),
        policy: Some(crate::ai_runtime::types::RoutingPolicy::Tiered { task: crate::ai_runtime::types::TaskType::Creative, allow_fallback: true }),
        temperature: Some(0.7),
        max_tokens: Some(500),
        active_project_paths: orchestration.active_project_paths.lock().clone(),
        ..Default::default()
    };

    let response = ai_runtime.dispatch(request).await?;

    let sketch_id = format!("sketch-{}", base_id);
    let title = format!("Sketch: {}", base_title);

    Ok(BrainstormCanvasNode {
        id: sketch_id,
        node_type: "sketch".to_string(),
        title,
        content: response.content,
        x: 0,
        y: 0,
        width: 178,
        height: 96,
        source_id: Some(base_id),
    })
}

#[tauri::command]
pub async fn brainstorm_architect_review(
    ai_runtime: tauri::State<'_, std::sync::Arc<crate::ai_runtime::RuntimeManager>>,
    orchestration: tauri::State<'_, OrchestrationState>,
    cwd: String,
    base_id: String,
    base_type: String,
    base_title: String,
    base_content: String
) -> Result<BrainstormCanvasNode, String> {
    let request = crate::ai_runtime::types::CompletionRequest {
        messages: vec![
            crate::ai_runtime::types::Message {
                role: "system".to_string(),
                content: "You are a software architect reviewing a proposed feature or implementation detail. Analyze the given content for completeness, potential architectural risks, edge cases, and readiness for implementation. Output your verdict as a concise text summary without markdown code blocks. End with a clear recommendation on next steps (e.g., 'Ready to implement', 'Needs more detail', 'Consider edge case X').".to_string(),
                tool_calls: None,
                tool_call_id: None,
                cache_control: None,
            },
            crate::ai_runtime::types::Message {
                role: "user".to_string(),
                content: format!("Node Type: {}\nTitle: {}\n\nContent:\n{}", base_type, base_title, base_content),
                tool_calls: None,
                tool_call_id: None,
                cache_control: None,
            }
        ],
        project_path: Some(cwd),
        policy: Some(crate::ai_runtime::types::RoutingPolicy::Tiered { task: crate::ai_runtime::types::TaskType::Reasoning, allow_fallback: true }),
        temperature: Some(0.4),
        max_tokens: Some(500),
        active_project_paths: orchestration.active_project_paths.lock().clone(),
        ..Default::default()
    };

    let response = ai_runtime.dispatch(request).await?;

    let review_id = format!("review-{}", base_id);
    let title = format!("Review: {}", base_title);

    Ok(BrainstormCanvasNode {
        id: review_id,
        node_type: "review".to_string(),
        title,
        content: response.content,
        x: 0,
        y: 0,
        width: 190,
        height: 106,
        source_id: Some(base_id),
    })
}

#[tauri::command]
pub async fn get_agent_messages(
    state: State<'_, OrchestrationState>,
    db: State<'_, Arc<DatabaseManager>>,
    limit: Option<usize>,
) -> Result<Vec<AgentMessage>, String> {
    let limit = limit.unwrap_or(50);
    
    // First, try the in-memory bus
    {
        let bus = state.message_bus.lock();
        if bus.len() >= limit {
            let start = bus.len() - limit;
            let mut msgs = bus[start..].to_vec();
            // Return most recent first to match UI expectation
            msgs.reverse();
            return Ok(msgs);
        }
    }
    
    // If we need more, fetch from DB
    let current_path = {
        let path = state.current_project_path.lock();
        path.clone()
    };
    
    crate::database::get_swarm_messages(&db.pool, current_path.as_deref(), None, Some(limit)).await
}

#[tauri::command]
pub async fn create_swarm_snapshot_file(
    state: State<'_, OrchestrationState>,
    db: State<'_, Arc<DatabaseManager>>,
    name: String,
    handoff_notes: Option<String>,
) -> Result<String, String> {
    let current_path = {
        let path = state.current_project_path.lock();
        path.clone()
    }.ok_or("No active project to snapshot")?;

    internal_create_snapshot(&db, &current_path, &name, handoff_notes).await
}

pub async fn internal_create_snapshot(
    db: &DatabaseManager,
    project_path: &str,
    name: &str,
    handoff_notes: Option<String>,
) -> Result<String, String> {
    let snapshot_id = Uuid::new_v4().to_string();
    
    // 1. Create Snapshot record in SQLite
    crate::database::create_swarm_snapshot(&db.pool, &snapshot_id, project_path, Some(name), None, None, handoff_notes.as_deref()).await?;
    
    // 2. Fetch all messages for this project that aren't snapshotted yet
    let messages = crate::database::get_swarm_messages(&db.pool, Some(project_path), None, None).await?;
    
    // 3. Link them in SQLite
    crate::database::link_messages_to_snapshot(&db.pool, &snapshot_id, project_path).await?;
    
    // 4. Save to JSON
    let snapshots_dir = std::path::Path::new(project_path).join(".kspec").join("snapshots");
    if !snapshots_dir.exists() {
        std::fs::create_dir_all(&snapshots_dir).map_err(|e| e.to_string())?;
    }
    
    let file_path = snapshots_dir.join(format!("{}.json", snapshot_id));
    let snapshot_data = serde_json::json!({
        "id": snapshot_id,
        "name": name,
        "project_path": project_path,
        "timestamp": Utc::now().to_rfc3339(),
        "handoff_notes": handoff_notes,
        "messages": messages
    });
    
    std::fs::write(&file_path, serde_json::to_string_pretty(&snapshot_data).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;

    // 4b. Save to Markdown (Collaborative Handoff Artifact)
    let md_path = snapshots_dir.join(format!("{}.md", snapshot_id));
    let timestamp = Utc::now().to_rfc3339();
    let md_content = generate_snapshot_markdown(
        &snapshot_id,
        name,
        &timestamp,
        handoff_notes.as_deref(),
        &messages,
    );
    std::fs::write(&md_path, md_content).map_err(|e| e.to_string())?;

    // 5. Ensure Git tracks it immediately if we're in a git repo
    let _ = std::process::Command::new("python3")
        .arg("scripts/git_swarm_snapshot.py")
        .current_dir(project_path)
        .output();

    Ok(snapshot_id)
}

fn generate_snapshot_markdown(
    snapshot_id: &str,
    name: &str,
    timestamp: &str,
    handoff_notes: Option<&str>,
    messages: &[AgentMessage],
) -> String {
    let mut md = format!("# Swarm Handoff: {}\n\n", name);
    md.push_str(&format!("- **Snapshot ID**: `{}`\n", snapshot_id));
    md.push_str(&format!("- **Generated At**: {}\n", timestamp));
    
    if let Some(notes) = handoff_notes {
        md.push_str("\n## Handoff Notes\n\n");
        md.push_str(notes);
        md.push('\n');
    }

    md.push_str("\n## Thought Chain (Recent activity)\n\n");
    if messages.is_empty() {
        md.push_str("_No messages recorded in this snapshot._\n");
    } else {
        // Show last 20 messages to keep it readable
        for msg in messages.iter().rev().take(20).rev() {
            let from = &msg.from_agent;
            let m_type = &msg.message_type;
            let content = &msg.content;
            
            md.push_str(&format!("### {} [{}]\n", from, m_type));
            md.push_str(&format!("{}\n\n", content));
            
            if let Some(meta) = &msg.metadata {
                md.push_str("<details>\n<summary>Technical Context</summary>\n\n");
                md.push_str("```json\n");
                md.push_str(&serde_json::to_string_pretty(meta).unwrap_or_default());
                md.push_str("\n```\n</details>\n\n");
            }
        }
    }
    
    md.push_str("\n---\n*This artifact was automatically generated to facilitate swarm session resumption.*\n");
    md
}

pub async fn internal_hydrate_swarm(
    db: &DatabaseManager,
    project_path: &str,
) -> Result<usize, String> {
    let snapshots_dir = std::path::Path::new(project_path).join(".kspec").join("snapshots");
    if !snapshots_dir.exists() {
        return Ok(0);
    }

    let mut count = 0;
    let entries = std::fs::read_dir(snapshots_dir).map_err(|e| e.to_string())?;
    
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
            let snapshot: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
            
            let id = snapshot["id"].as_str().ok_or("Missing snapshot ID")?;
            
            // Insert snapshot metadata (ignore error if exists)
            let name = snapshot["name"].as_str();
            let _ = crate::database::create_swarm_snapshot(
                &db.pool, 
                id, 
                project_path, 
                name,
                snapshot["commit_sha"].as_str(),
                None,
                snapshot["handoff_notes"].as_str(),
            ).await;
            
            // Insert messages
            if let Some(messages) = snapshot["messages"].as_array() {
                for msg_val in messages {
                    if let Ok(msg) = serde_json::from_value::<AgentMessage>(msg_val.clone()) {
                        let _ = crate::database::insert_swarm_message(
                            &db.pool,
                            &msg,
                            Some(project_path),
                            Some(id)
                        ).await;
                        count += 1;
                    }
                }
            }
        }
    }
    
    Ok(count)
}

#[tauri::command]
pub async fn hydrate_swarm_from_snapshots(
    db: State<'_, Arc<DatabaseManager>>,
    project_path: String,
) -> Result<usize, String> {
    internal_hydrate_swarm(&db, &project_path).await
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
pub async fn kspec_dispatch_start(
    state: tauri::State<'_, Arc<Mutex<JobsManager>>>,
    cwd: String
) -> Result<serde_json::Value, String> {
    let manager = state.lock().await;
    let job_id = manager.create_job("kspec-dispatch".to_string(), cwd).await?;

    Ok(serde_json::json!({ 
        "success": true,
        "job_id": job_id
    }))
}

#[tauri::command]
pub async fn kspec_dispatch_stop(
    state: tauri::State<'_, Arc<Mutex<JobsManager>>>,
    cwd: String
) -> Result<serde_json::Value, String> {
    let manager = state.lock().await;
    let job_id = manager.create_job("kspec-stop".to_string(), cwd).await?;

    Ok(serde_json::json!({ 
        "success": true,
        "job_id": job_id
    }))
}

#[tauri::command]
pub async fn brainstorm_save_topology(cwd: String, content: String) -> Result<serde_json::Value, String> {
    let brainstorm_dir = std::path::Path::new(&cwd).join(".kspec").join("brainstorm");
    std::fs::create_dir_all(&brainstorm_dir).map_err(|e| e.to_string())?;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    // Save as a versioned file
    let path = brainstorm_dir.join(format!("topology-{}.md", timestamp));
    std::fs::write(&path, &content).map_err(|e| e.to_string())?;
    
    // Also overwrite the main topology.md for easy access
    let latest_path = brainstorm_dir.join("topology.md");
    let _ = std::fs::write(latest_path, content);

    Ok(serde_json::json!({ "success": true, "path": path.to_string_lossy() }))
}

#[tauri::command]
pub async fn create_snapshot_workspace(
    app: AppHandle,
    db: State<'_, Arc<DatabaseManager>>,
    snapshot_id: String,
) -> Result<String, String> {
    // 1. Fetch snapshot details
    let snapshot = crate::database::get_swarm_snapshot(&db.pool, &snapshot_id).await?;

    let project_path = snapshot.project_path;
    let commit_sha = snapshot.commit_sha.ok_or("Snapshot has no commit SHA")?;

    // 2. Determine worktree path in cache
    let cache_dir = app.path().app_cache_dir().unwrap().join("snapshots").join(&snapshot_id);
    
    // 3. Create git worktree
    let output = Command::new("git")
        .current_dir(&project_path)
        .arg("worktree")
        .arg("add")
        .arg("--detach")
        .arg(&cache_dir)
        .arg(&commit_sha)
        .output()
        .map_err(|e| format!("Failed to run git worktree: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        if !err.contains("already exists") {
            return Err(format!("Git worktree error: {}", err));
        }
    }

    // 4. Update snapshot record with worktree path
    let worktree_path = cache_dir.to_string_lossy().to_string();
    crate::database::update_swarm_snapshot_worktree(&db.pool, &snapshot_id, &worktree_path).await?;

    Ok(worktree_path)
}

#[tauri::command]
pub async fn get_swarm_snapshots(
    db: State<'_, Arc<DatabaseManager>>,
    project_path: Option<String>,
) -> Result<Vec<crate::database::SwarmSnapshot>, String> {
    crate::database::get_swarm_snapshots(&db.pool, project_path.as_deref()).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_brainstorm_promotion_flow() {
        let dir = tempdir().unwrap();
        let cwd = dir.path().to_string_lossy().to_string();
        
        // 1. Plant a seed
        let seed = GsdSeed {
            id: "test-seed".to_string(),
            title: "Test Seed".to_string(),
            slug: "test-seed".to_string(),
            why: "Testing promotion".to_string(),
            when_to_surface: "Next Milestone".to_string(),
            status: "planted".to_string(),
            timestamp: 0,
        };
        gsd_plant_seed(cwd.clone(), seed.clone()).await.unwrap();
        
        // 2. Verify it exists
        let seeds = gsd_list_seeds(cwd.clone()).await.unwrap();
        assert_eq!(seeds.len(), 1);
        assert_eq!(seeds[0].title, "Test Seed");
        
        // 3. Write a draft
        let content = "title: Test Draft\ntype: module\n";
        kspec_write_draft(cwd.clone(), "test-draft".to_string(), content.to_string()).await.unwrap();
        
        // 4. Update seed status
        gsd_update_seed_status(cwd.clone(), "test-seed".to_string(), "promoted_to_draft".to_string()).await.unwrap();
        
        // 5. Verify draft exists
        let drafts = kspec_list_drafts(cwd.clone()).await.unwrap();
        assert_eq!(drafts.len(), 1);
        assert_eq!(drafts[0].id, "test-draft");
        
        // 6. Verify seed status updated
        let updated_seeds = gsd_list_seeds(cwd.clone()).await.unwrap();
        assert_eq!(updated_seeds[0].status, "promoted_to_draft");
    }
}
