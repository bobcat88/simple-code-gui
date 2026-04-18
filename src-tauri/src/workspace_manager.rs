use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: String,
    pub category_id: Option<String>,
    pub last_accessed: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProjectCategory {
    pub id: String,
    pub name: String,
    pub color: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct Workspace {
    pub projects: Vec<Project>,
    pub categories: Vec<ProjectCategory>,
}

pub struct WorkspaceManager {
    path: PathBuf,
    workspace: Mutex<Workspace>,
}

impl WorkspaceManager {
    pub fn new(app: &AppHandle) -> Self {
        let path = app.path().app_config_dir().unwrap().join("workspace.json");
        
        // Ensure directory exists
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).ok();
        }

        let workspace = if path.exists() {
            let content = fs::read_to_string(&path).unwrap_or_default();
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            Workspace::default()
        };

        Self {
            path,
            workspace: Mutex::new(workspace),
        }
    }

    pub fn get(&self) -> Workspace {
        self.workspace.lock().unwrap().clone()
    }

    pub fn save(&self, new_workspace: Workspace) -> Result<(), String> {
        let content = serde_json::to_string_pretty(&new_workspace)
            .map_err(|e| e.to_string())?;
        fs::write(&self.path, content).map_err(|e| e.to_string())?;
        *self.workspace.lock().unwrap() = new_workspace;
        Ok(())
    }
}
