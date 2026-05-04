use async_trait::async_trait;
use crate::ai_runtime::types::CompletionRequest;
use super::super::context::OptimizationContext;
use super::super::middleware::OptimizationMiddleware;

pub struct CavemanMiddleware;

#[async_trait]
impl OptimizationMiddleware for CavemanMiddleware {
    fn name(&self) -> &str {
        "caveman"
    }

    async fn apply(
        &self, 
        request: &mut CompletionRequest, 
        context: &OptimizationContext,
        _embedding_service: Option<&dyn crate::ai_runtime::optimizer::context::EmbeddingService>
    ) -> Result<(), String> {
        // Only apply Caveman to internal agent-to-agent communication
        if context.human_facing {
            return Ok(());
        }

        const CAVEMAN_INSTR: &str = "\n\nCRITICAL: Respond in Caveman mode. Terse. Technical substance exact. Drop articles (the/a/an), filler (just/really), pleasantries. Fragments OK.";
        
        if let Some(msg) = request.messages.get_mut(0) {
            if msg.role == "system" {
                if !msg.content.contains("Caveman mode") {
                    msg.content.push_str(CAVEMAN_INSTR);
                }
            } else {
                // If no system prompt, we should have one from SystemPromptMiddleware 
                // but let's be safe and check if we should insert one if the first isn't system
                // Actually, SystemPromptMiddleware runs before this in the pipeline (usually).
            }
        }
        
        Ok(())
    }
}
