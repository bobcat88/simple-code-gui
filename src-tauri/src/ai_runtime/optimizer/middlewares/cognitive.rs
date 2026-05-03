use async_trait::async_trait;
use crate::ai_runtime::types::CompletionRequest;
use super::super::context::OptimizationContext;
use super::super::middleware::OptimizationMiddleware;
use std::fs;
use std::path::Path;
use serde_json::Value;

pub struct CognitiveMiddleware;

impl CognitiveMiddleware {
    fn extract_keywords(&self, text: &str) -> Vec<String> {
        text.split_whitespace()
            .map(|s| s.to_lowercase().chars().filter(|c| c.is_alphanumeric()).collect::<String>())
            .filter(|s| s.len() > 3) // Ignore short words
            .collect()
    }

    fn score_message(&self, content: &str, from_agent: &str, keywords: &[String], current_agent_id: Option<&str>) -> i32 {
        let mut score = 0;
        let lower_content = content.to_lowercase();
        
        // Match keywords
        for kw in keywords {
            if lower_content.contains(kw) {
                score += 2;
            }
        }

        // Match agent_id
        if let Some(agent_id) = current_agent_id {
            if from_agent == agent_id {
                score += 5;
            }
        }

        score
    }
}

#[async_trait]
impl OptimizationMiddleware for CognitiveMiddleware {
    fn name(&self) -> &str {
        "cognitive"
    }

    async fn apply(&self, request: &mut CompletionRequest, _context: &OptimizationContext) -> Result<(), String> {
        let Some(project_path) = &request.project_path else {
            return Ok(());
        };

        let snapshots_dir = Path::new(project_path).join(".kspec").join("snapshots");
        if !snapshots_dir.exists() {
            return Ok(());
        }

        // 1. Collect keywords from current request
        let mut keywords = Vec::new();
        for msg in &request.messages {
            if msg.role == "user" {
                keywords.extend(self.extract_keywords(&msg.content));
            }
        }
        keywords.sort();
        keywords.dedup();

        // 2. Find the latest snapshot
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

        // 3. Load and score messages from snapshot
        if let Some(path) = latest_file {
            if let Ok(content) = fs::read_to_string(path) {
                if let Ok(json) = serde_json::from_str::<Value>(&content) {
                    if let Some(messages) = json.get("messages").and_then(|m| m.as_array()) {
                        let mut scored_msgs: Vec<(i32, String)> = messages.iter()
                            .filter_map(|m| {
                                let agent = m.get("from_agent")?.as_str()?;
                                let content = m.get("content")?.as_str()?;
                                let score = self.score_message(content, agent, &keywords, request.agent_id.as_deref());
                                
                                if score > 0 {
                                    Some((score, format!("[{}]: {}", agent, content)))
                                } else {
                                    None
                                }
                            })
                            .collect();

                        // Sort by score descending
                        scored_msgs.sort_by(|a, b| b.0.cmp(&a.0));

                        // Take top 5 relevant messages
                        let context_msgs: Vec<String> = scored_msgs.into_iter().take(5).map(|m| m.1).collect();

                        if !context_msgs.is_empty() {
                            let cognitive_context = format!(
                                "\n[COGNITIVE_SNAPSHOT_CONTEXT]\nRelevant swarm thoughts from previous session:\n{}\n",
                                context_msgs.join("\n")
                            );

                            // Inject into system prompt
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
