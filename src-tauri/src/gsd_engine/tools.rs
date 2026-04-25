use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::Path;
use std::process::Command;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct Tool {
    pub name: String,
    pub description: String,
    pub parameters: Value,
}

pub async fn execute_tool(name: &str, arguments: &str, project_path: &Option<String>, app: &AppHandle) -> Result<String, String> {
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
            run_command(&mut cmd, project_path)
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
        "git_diff" => {
            let base = args["base"].as_str().unwrap_or("HEAD");
            let target = args["target"].as_str();
            let mut cmd = Command::new("git");
            cmd.arg("diff").arg(base);
            if let Some(t) = target {
                cmd.arg(t);
            }
            run_command(&mut cmd, project_path)
        }
        "git_log" => {
            let limit = args["limit"].as_u64().unwrap_or(10);
            let mut cmd = Command::new("git");
            cmd.arg("log").arg("-n").arg(limit.to_string()).arg("--oneline");
            run_command(&mut cmd, project_path)
        }
        "git_blame" => {
            let path = args["path"].as_str().ok_or("Missing path argument")?;
            let mut cmd = Command::new("git");
            cmd.arg("blame").arg(path);
            run_command(&mut cmd, project_path)
        }
        "grep_search" => {
            let query = args["query"].as_str().ok_or("Missing query argument")?;
            let path = args["path"].as_str().unwrap_or(".");
            let mut cmd = Command::new("grep");
            cmd.arg("-r").arg("-n").arg(query).arg(path);
            run_command(&mut cmd, project_path)
        }
        "inject_trace" => {
            let path = args["path"].as_str().ok_or("Missing path argument")?;
            let line = args["line"].as_u64().ok_or("Missing line argument")? as usize;
            let content = args["content"].as_str().ok_or("Missing content argument")?;
            let full_path = resolve_path(path, project_path)?;
            
            let file_content = std::fs::read_to_string(&full_path).map_err(|e| e.to_string())?;
            let mut lines: Vec<String> = file_content.lines().map(|s| s.to_string()).collect();
            
            if line > lines.len() {
                lines.push(content.to_string());
            } else {
                lines.insert(line - 1, content.to_string());
            }
            
            std::fs::write(full_path, lines.join("\n")).map_err(|e| e.to_string())?;
            Ok("Trace point injected successfully".to_string())
        }
        "read_logs" => {
            let source = args["source"].as_str().unwrap_or("app");
            let limit = args["limit"].as_u64().unwrap_or(50) as usize;
            
            let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
            
            match source {
                "app" => {
                    let log_path = app_dir.join("app.log");
                    if !log_path.exists() {
                        return Ok("App log file not found".to_string());
                    }
                    read_last_lines(&log_path, limit)
                }
                "crash" => {
                    let crash_path = app_dir.join("crash.log");
                    if !crash_path.exists() {
                        return Ok("Crash log file not found".to_string());
                    }
                    read_last_lines(&crash_path, limit)
                }
                _ => Err(format!("Unknown log source: {}", source)),
            }
        }
        "check_health" => {
            let component = args["component"].as_str();
            match component {
                Some("ai_runtime") => {
                    let ai = app.state::<Arc<crate::ai_runtime::RuntimeManager>>();
                    let status = ai.get_health().await;
                    Ok(serde_json::to_string(&status).unwrap_or_default())
                }
                _ => {
                    let health = app.state::<Arc<crate::health_manager::HealthManager>>();
                    let status = health.get_status().await;
                    Ok(serde_json::to_string(&status).unwrap_or_default())
                }
            }
        }
        "delegate_task" => {
            let task = args["task"].as_str().ok_or("Missing task argument")?;
            let role = args["role"].as_str().ok_or("Missing role argument")?;
            
            let ai = app.state::<Arc<crate::ai_runtime::RuntimeManager>>();
            
            let system_prompt = match role {
                "rust_expert" => "You are a Rust Expert Agent. You specialize in safe, efficient, and idiomatic Rust code.",
                "frontend_dev" => "You are a Frontend Developer Agent. You specialize in modern web technologies, React, and CSS.",
                "qa_specialist" => "You are a QA Specialist Agent. Your goal is to find bugs, verify functionality, and ensure code quality.",
                "researcher" => "You are a Research Agent. Your goal is to gather information and provide detailed reports on technical topics.",
                _ => "You are a specialized GSD Agent. Complete the task as requested.",
            };

            let request = crate::ai_runtime::types::CompletionRequest {
                messages: vec![
                    crate::ai_runtime::types::Message {
                        role: "system".to_string(),
                        content: system_prompt.to_string(),
                        tool_calls: None,
                        tool_call_id: None,
                    },
                    crate::ai_runtime::types::Message {
                        role: "user".to_string(),
                        content: task.to_string(),
                        tool_calls: None,
                        tool_call_id: None,
                    },
                ],
                // Sub-agents can use tools too!
                tools: Some(get_gsd_tools()), 
                tool_choice: Some("auto".to_string()),
                project_path: project_path.clone(),
                ..Default::default()
            };

            // Recursive dispatch
            let response = ai.dispatch(request).await.map_err(|e| e.to_string())?;
            
            Ok(response.content)
        }
        "vector_query" => {
            let query = args["query"].as_str().ok_or("Missing query argument")?;
            let limit = args["limit"].as_u64().unwrap_or(5) as usize;
            
            let vector_engine = app.state::<Arc<crate::vector_engine::VectorEngine>>();
            let results = vector_engine.search(query.to_string(), limit).await?;
            
            let formatted = results.iter().map(|r| {
                format!("[Score: {:.2}] File: {} (Symbol: {})\nContent: {}\n", 
                    r.score, r.chunk.file_path, r.chunk.symbol_name, r.chunk.content)
            }).collect::<Vec<_>>().join("\n---\n");
            
            Ok(if formatted.is_empty() { "No relevant context found in vector memory.".to_string() } else { formatted })
        }
        "broadcast_message" => {
            let content = args["content"].as_str().ok_or("Missing content argument")?;
            let message_type = args["message_type"].as_str().unwrap_or("finding");
            
            let id = uuid::Uuid::new_v4().to_string();
            let timestamp = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
                
            let message = crate::orchestration::AgentMessage {
                id: id.clone(),
                agent_id: "gsd_agent".to_string(), // In a real swarm, this would be dynamic
                agent_name: "GSD Agent".to_string(),
                content: content.to_string(),
                timestamp,
                message_type: message_type.to_string(),
            };
            
            let state = app.state::<Arc<crate::orchestration::OrchestrationState>>();
            {
                let mut bus = state.message_bus.lock();
                bus.push(message.clone());
                if bus.len() > 100 {
                    bus.remove(0);
                }
            }
            
            let _ = app.emit("agent-message", &message);
            
            Ok(format!("Message broadcast successfully with ID: {}", id))
        }
        "request_peer_review" => {
            let content = args["content"].as_str().ok_or("Missing content argument")?;
            let criteria = args["criteria"].as_str().ok_or("Missing criteria argument")?;
            
            let ai = app.state::<Arc<crate::ai_runtime::RuntimeManager>>();
            
            // Spawn two reviewers
            let reviewer_prompt = format!(
                "You are a Peer Review Agent. Review the following content based on these criteria:\n\nCriteria: {}\n\nContent to Review:\n{}\n\nOutput your verdict as: [VERDICT: APPROVE] or [VERDICT: REJECT] followed by your detailed reasoning.",
                criteria, content
            );
            
            let req1 = crate::ai_runtime::types::CompletionRequest {
                messages: vec![crate::ai_runtime::types::Message {
                    role: "user".to_string(),
                    content: reviewer_prompt.clone(),
                    tool_calls: None,
                    tool_call_id: None,
                }],
                ..Default::default()
            };
            
            let req2 = crate::ai_runtime::types::CompletionRequest {
                messages: vec![crate::ai_runtime::types::Message {
                    role: "user".to_string(),
                    content: reviewer_prompt,
                    tool_calls: None,
                    tool_call_id: None,
                }],
                ..Default::default()
            };
            
            let (res1, res2) = tokio::join!(
                ai.dispatch(req1),
                ai.dispatch(req2)
            );
            
            let r1 = res1.map_err(|e| e.to_string())?;
            let r2 = res2.map_err(|e| e.to_string())?;
            
            let approved1 = r1.content.contains("[VERDICT: APPROVE]");
            let approved2 = r2.content.contains("[VERDICT: APPROVE]");
            
            let result = if approved1 && approved2 {
                format!("Consensus reached: APPROVED.\n\nReviewer 1:\n{}\n\nReviewer 2:\n{}", r1.content, r2.content)
            } else if !approved1 && !approved2 {
                format!("Consensus reached: REJECTED.\n\nReviewer 1:\n{}\n\nReviewer 2:\n{}", r1.content, r2.content)
            } else {
                format!("Conflict detected: One reviewer approved, one rejected. Manual resolution required.\n\nReviewer 1:\n{}\n\nReviewer 2:\n{}", r1.content, r2.content)
            };
            
            Ok(result)
        }
        _ => Err(format!("Unknown tool: {}", name)),
    }
}

fn read_last_lines(path: &std::path::Path, limit: usize) -> Result<String, String> {
    let content = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    let lines: Vec<&str> = content.lines().collect();
    let start = if lines.len() > limit { lines.len() - limit } else { 0 };
    Ok(lines[start..].join("\n"))
}

fn run_command(cmd: &mut Command, project_path: &Option<String>) -> Result<String, String> {
    if let Some(path) = project_path {
        cmd.current_dir(path);
    }

    let output = cmd.output().map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        Ok(stdout)
    } else {
        if cmd.get_program() == "grep" && output.status.code() == Some(1) {
            return Ok("No matches found".to_string());
        }
        Err(format!("Command failed with exit code {}: {}", output.status.code().unwrap_or(-1), stderr))
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
        crate::ai_runtime::types::ToolDefinition {
            name: "git_diff".to_string(),
            description: "Show changes between commits, commit and working tree, etc".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "base": { "type": "string", "description": "The base commit or reference (defaults to HEAD)" },
                    "target": { "type": "string", "description": "The target commit or reference (optional)" }
                }
            }),
        },
        crate::ai_runtime::types::ToolDefinition {
            name: "git_log".to_string(),
            description: "Show the commit history".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "limit": { "type": "integer", "description": "Number of commits to show (defaults to 10)" }
                }
            }),
        },
        crate::ai_runtime::types::ToolDefinition {
            name: "git_blame".to_string(),
            description: "Show who changed what line in a file".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "The path to the file" }
                },
                "required": ["path"]
            }),
        },
        crate::ai_runtime::types::ToolDefinition {
            name: "grep_search".to_string(),
            description: "Search for a string in the project files".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "query": { "type": "string", "description": "The string to search for" },
                    "path": { "type": "string", "description": "The path to search in (defaults to .)" }
                },
                "required": ["query"]
            }),
        },
        crate::ai_runtime::types::ToolDefinition {
            name: "inject_trace".to_string(),
            description: "Inject a temporary trace/log point at a specific line in a file".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "The path to the file" },
                    "line": { "type": "integer", "description": "The 1-indexed line number to insert before" },
                    "content": { "type": "string", "description": "The log/trace statement to inject" }
                },
                "required": ["path", "line", "content"]
            }),
        },
        crate::ai_runtime::types::ToolDefinition {
            name: "read_logs".to_string(),
            description: "Read the latest lines from application or crash logs".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "source": { "type": "string", "enum": ["app", "crash"], "description": "The log source to read (defaults to app)" },
                    "limit": { "type": "integer", "description": "Max lines to read (defaults to 50)" }
                }
            }),
        },
        crate::ai_runtime::types::ToolDefinition {
            name: "check_health".to_string(),
            description: "Check the health status of application components".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "component": { "type": "string", "enum": ["ai_runtime", "system"], "description": "The component to check (defaults to system)" }
                }
            }),
        },
        crate::ai_runtime::types::ToolDefinition {
            name: "delegate_task".to_string(),
            description: "Delegate a sub-task to a specialized agent swarm. Use this for complex tasks that require specific expertise (Rust, Frontend, QA, etc.).".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "task": { "type": "string", "description": "The specific task for the sub-agent" },
                    "role": { "type": "string", "enum": ["rust_expert", "frontend_dev", "qa_specialist", "researcher"], "description": "The specialization required" }
                },
                "required": ["task", "role"]
            }),
        },
        crate::ai_runtime::types::ToolDefinition {
            name: "vector_query".to_string(),
            description: "Search the shared semantic workspace for relevant context, learnings, or code snippets across the project and previous agent interactions.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "query": { "type": "string", "description": "The semantic search query" },
                    "limit": { "type": "integer", "description": "Max results to return (defaults to 5)" }
                },
                "required": ["query"]
            }),
        },
        crate::ai_runtime::types::ToolDefinition {
            name: "broadcast_message".to_string(),
            description: "Broadcast a message to all other agents in the swarm. Use this to share important findings, request help, or warn about potential issues.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "content": { "type": "string", "description": "The content of the message" },
                    "message_type": { "type": "string", "enum": ["finding", "request", "warning", "alert"], "description": "The type of message (defaults to finding)" }
                },
                "required": ["content"]
            }),
        },
        crate::ai_runtime::types::ToolDefinition {
            name: "request_peer_review".to_string(),
            description: "Request an automated peer review from other agents in the swarm to validate findings or code changes. Returns a consensus report.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "content": { "type": "string", "description": "The content to be reviewed" },
                    "criteria": { "type": "string", "description": "The criteria or instructions for the review" }
                },
                "required": ["content", "criteria"]
            }),
        },
    ]
}
