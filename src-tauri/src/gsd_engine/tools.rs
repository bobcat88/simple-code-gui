use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::Path;
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    pub name: String,
    pub description: String,
    pub parameters: Value,
}

pub async fn execute_tool(name: &str, arguments: &str, project_path: &Option<String>) -> Result<String, String> {
    let args: Value = serde_json::from_str(arguments).map_err(|e| e.to_string())?;

    match name {
        "read_file" => {
            let path = args["path"].as_str().ok_or("Missing path argument")?;
            let full_path = resolve_path(path, project_path)?;
            std::fs::read_to_string(full_path).map_err(|e| e.to_string())
        }
        "write_file" => {
            let path = args["path"].as_str().ok_or("Missing path argument")?;
            let content = args["content"].as_str().ok_or("Missing content argument")?;
            let full_path = resolve_path(path, project_path)?;
            
            if let Some(parent) = Path::new(&full_path).parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            
            std::fs::write(full_path, content).map_err(|e| e.to_string())?;
            Ok("File written successfully".to_string())
        }
        "run_bash" => {
            let command = args["command"].as_str().ok_or("Missing command argument")?;
            let mut cmd = Command::new("bash");
            cmd.arg("-c").arg(command);
            
            if let Some(path) = project_path {
                cmd.current_dir(path);
            }

            let output = cmd.output().map_err(|e| e.to_string())?;
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();

            if output.status.success() {
                Ok(stdout)
            } else {
                Err(format!("Command failed with exit code {}: {}", output.status.code().unwrap_or(-1), stderr))
            }
        }
        "list_dir" => {
            let path = args["path"].as_str().unwrap_or(".");
            let full_path = resolve_path(path, project_path)?;
            
            let entries = std::fs::read_dir(full_path).map_err(|e| e.to_string())?;
            let mut result = Vec::new();
            for entry in entries {
                let entry = entry.map_err(|e| e.to_string())?;
                let file_name = entry.file_name().to_string_lossy().to_string();
                let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
                result.push(json!({ "name": file_name, "type": if is_dir { "dir" } else { "file" } }));
            }
            Ok(serde_json::to_string(&result).unwrap_or_default())
        }
        _ => Err(format!("Unknown tool: {}", name)),
    }
}

fn resolve_path(path: &str, project_path: &Option<String>) -> Result<String, String> {
    if Path::new(path).is_absolute() {
        return Ok(path.to_string());
    }

    if let Some(base) = project_path {
        Ok(Path::new(base).join(path).to_string_lossy().to_string())
    } else {
        Err("Cannot resolve relative path without project context".to_string())
    }
}

pub fn get_gsd_tools() -> Vec<crate::ai_runtime::types::ToolDefinition> {
    vec![
        crate::ai_runtime::types::ToolDefinition {
            name: "read_file".to_string(),
            description: "Read the content of a file".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "The path to the file" }
                },
                "required": ["path"]
            }),
        },
        crate::ai_runtime::types::ToolDefinition {
            name: "write_file".to_string(),
            description: "Write content to a file, creating directories if needed".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "The path to the file" },
                    "content": { "type": "string", "description": "The content to write" }
                },
                "required": ["path", "content"]
            }),
        },
        crate::ai_runtime::types::ToolDefinition {
            name: "run_bash".to_string(),
            description: "Run a bash command in the project directory".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "command": { "type": "string", "description": "The bash command to execute" }
                },
                "required": ["command"]
            }),
        },
        crate::ai_runtime::types::ToolDefinition {
            name: "list_dir".to_string(),
            description: "List the contents of a directory".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "The path to the directory (defaults to .)" }
                }
            }),
        },
    ]
}
