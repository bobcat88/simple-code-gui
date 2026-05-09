use async_trait::async_trait;
use crate::ai_runtime::types::CompletionRequest;
use super::super::context::OptimizationContext;
use super::super::middleware::OptimizationMiddleware;

pub struct KnowledgePruningMiddleware;

#[async_trait]
impl OptimizationMiddleware for KnowledgePruningMiddleware {
    fn name(&self) -> &str {
        "knowledge_pruning"
    }

    async fn apply(
        &self, 
        request: &mut CompletionRequest, 
        _context: &OptimizationContext,
        _embedding_service: Option<&dyn crate::ai_runtime::optimizer::context::EmbeddingService>
    ) -> Result<(), String> {
        // Phase 56: Knowledge Pruning Optimization
        // Remove duplicate or overly verbose [COLLECTIVE MEMORY] sections
        for msg in &mut request.messages {
            if msg.role == "system" && msg.content.contains("[COLLECTIVE MEMORY]") {
                let parts: Vec<&str> = msg.content.split("[COLLECTIVE MEMORY]").collect();
                if parts.len() > 2 {
                    // Only keep the most recent injection
                    let base = parts[0].to_string();
                    let latest = parts.last().unwrap_or(&"").to_string();
                    msg.content = format!("{}[COLLECTIVE MEMORY]{}", base, latest);
                }
            }
        }
        
        Ok(())
    }
}
