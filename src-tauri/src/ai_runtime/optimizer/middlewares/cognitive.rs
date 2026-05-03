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
    fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
        if a.len() != b.len() || a.is_empty() {
            return 0.0;
        }
        let dot_product: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
        let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
        let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
        if norm_a == 0.0 || norm_b == 0.0 {
            0.0
        } else {
            dot_product / (norm_a * norm_b)
        }
    }
}

#[async_trait]
impl OptimizationMiddleware for CognitiveMiddleware {
    fn name(&self) -> &str {
        "cognitive"
    }

    async fn apply(
        &self, 
        request: &mut CompletionRequest, 
        _context: &OptimizationContext,
        embedding_service: Option<&dyn crate::ai_runtime::optimizer::context::EmbeddingService>
    ) -> Result<(), String> {
        let Some(project_path) = &request.project_path else {
            return Ok(());
        };

        let snapshots_dir = Path::new(project_path).join(".kspec").join("snapshots");
        if !snapshots_dir.exists() {
            return Ok(());
        }

        // 1. Collect keywords from current request
        let mut user_content = String::new();
        let mut keywords = Vec::new();
        for msg in &request.messages {
            if msg.role == "user" {
                user_content.push_str(&msg.content);
                user_content.push(' ');
                keywords.extend(self.extract_keywords(&msg.content));
            }
        }
        keywords.sort();
        keywords.dedup();

        if user_content.is_empty() {
            return Ok(());
        }

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
        let Some(path) = latest_file else {
            return Ok(());
        };

        let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
        let json: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        let Some(messages) = json.get("messages").and_then(|m| m.as_array()) else {
            return Ok(());
        };

        let mut candidate_msgs: Vec<(i32, String, String)> = messages.iter()
            .filter_map(|m| {
                let agent = m.get("from_agent")?.as_str()?;
                let content = m.get("content")?.as_str()?;
                let score = self.score_message(content, agent, &keywords, request.agent_id.as_deref());
                
                if score > 0 {
                    Some((score, agent.to_string(), content.to_string()))
                } else {
                    None
                }
            })
            .collect();

        // Sort by keyword score descending
        candidate_msgs.sort_by(|a, b| b.0.cmp(&a.0));

        // Hybrid Reranking: If we have an embedding service, rerank the top candidates
        let final_context_msgs = if let Some(service) = embedding_service {
            // Take top 15 keyword matches for reranking
            let top_candidates = candidate_msgs.into_iter().take(15).collect::<Vec<_>>();
            if top_candidates.is_empty() {
                Vec::new()
            } else {
                // Embed user query and candidates
                let mut texts_to_embed = vec![user_content];
                for (_, _, content) in &top_candidates {
                    texts_to_embed.push(content.clone());
                }

                if let Ok(embeddings) = service.embed(texts_to_embed).await {
                    let user_embedding = &embeddings[0];
                    let mut reranked: Vec<(f32, String)> = Vec::new();

                    for (i, (kw_score, agent, content)) in top_candidates.into_iter().enumerate() {
                        let doc_embedding = &embeddings[i + 1];
                        let semantic_score = Self::cosine_similarity(user_embedding, doc_embedding);
                        
                        // Hybrid score: 30% keyword, 70% semantic
                        let hybrid_score = (semantic_score * 0.7) + ((kw_score as f32 / 10.0).min(1.0) * 0.3);
                        reranked.push((hybrid_score, format!("[{}]: {}", agent, content)));
                    }

                    reranked.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
                    reranked.into_iter().take(5).map(|m| m.1).collect()
                } else {
                    // Fallback to keyword-only if embedding fails
                    top_candidates.into_iter().take(5).map(|m| format!("[{}]: {}", m.1, m.2)).collect()
                }
            }
        } else {
            candidate_msgs.into_iter().take(5).map(|m| format!("[{}]: {}", m.1, m.2)).collect()
        };

        if !final_context_msgs.is_empty() {
            let cognitive_context = format!(
                "\n[COGNITIVE_SNAPSHOT_CONTEXT]\nRelevant swarm thoughts from previous session (Hybrid Semantic Memory):\n{}\n",
                final_context_msgs.join("\n")
            );

            // Inject into system prompt
            if let Some(system_msg) = request.messages.iter_mut().find(|m| m.role == "system") {
                system_msg.content.push_str(&cognitive_context);
            }
        }
        
        Ok(())
    }
}
