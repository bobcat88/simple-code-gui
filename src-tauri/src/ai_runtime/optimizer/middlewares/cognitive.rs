use async_trait::async_trait;
use crate::ai_runtime::types::CompletionRequest;
use super::super::context::OptimizationContext;
use super::super::middleware::OptimizationMiddleware;
use std::fs;
use std::path::Path;
use serde_json::Value;

pub struct CognitiveMiddleware;

#[async_trait]
impl OptimizationMiddleware for CognitiveMiddleware {
    fn name(&self) -> &str {
        "cognitive"
    }

    async fn apply(&self, request: &mut CompletionRequest, _context: &OptimizationContext) -> Result<(), String> {
        // Cognitive Middleware: Injects swarm thought chains and cross-session context.
        
        let Some(project_path) = &request.project_path else {
            return Ok(());
        };

        let snapshots_dir = Path::new(project_path).join(".kspec").join("snapshots");
        if !snapshots_dir.exists() {
            return Ok(());
        }

        // 1. Find the latest snapshot
        let mut latest_file = None;
        let mut latest_time = 0;

        if let Ok(entries) = fs::read_dir(snapshots_dir) {
            for entry in entries.flatten() {
                if let Ok(metadata) = entry.metadata() {
                    if let Ok(modified) = metadata.modified() {
                        let time = modified.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs();
                        if time > latest_time {
                            latest_time = time;
                            latest_file = Some(entry.path());
                        }
                    }
                }
            }
        }

        // 2. Load and inject context
        if let Some(path) = latest_file {
            if let Ok(content) = fs::read_to_string(path) {
                if let Ok(json) = serde_json::from_str::<Value>(&content) {
                    if let Some(messages) = json.get("messages").and_then(|m| m.as_array()) {
                        // Extract last 3 messages as cognitive context
                        let context_msgs: Vec<String> = messages.iter().rev().take(3)
                            .filter_map(|m| {
                                let agent = m.get("from_agent")?.as_str()?;
                                let content = m.get("content")?.as_str()?;
                                Some(format!("[{}]: {}", agent, content))
                            })
                            .collect();

                        if !context_msgs.is_empty() {
                            let cognitive_context = format!(
                                "\n[COGNITIVE_SNAPSHOT_CONTEXT]\nLatest swarm thoughts:\n{}\n",
                                context_msgs.join("\n")
                            );

                            // Inject into system prompt (first message usually)
                            if let Some(system_msg) = request.messages.iter_mut().find(|m| m.role == "system") {
                                system_msg.content.push_str(&cognitive_context);
                            }
                        }
                    }
                }
            }
        }
        
        Ok(())
    }
}
