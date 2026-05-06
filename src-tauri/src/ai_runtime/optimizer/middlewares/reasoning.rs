use async_trait::async_trait;
use crate::ai_runtime::types::CompletionRequest;
use super::super::context::OptimizationContext;
use super::super::middleware::OptimizationMiddleware;

pub struct ReasoningMiddleware;

#[async_trait]
impl OptimizationMiddleware for ReasoningMiddleware {
    fn name(&self) -> &str {
        "reasoning"
    }

    async fn apply(
        &self, 
        request: &mut CompletionRequest, 
        context: &OptimizationContext,
        _embedding_service: Option<&dyn crate::ai_runtime::optimizer::context::EmbeddingService>
    ) -> Result<(), String> {
        if context.provider.is_none() {
            return Ok(());
        }

        let Some(optimization) = &request.optimization else {
            return Ok(());
        };

        if optimization.reasoning.is_none() {
            return Ok(());
        };

        // Apply CoD to all internal reasoning or coding tasks to save tokens
        let is_internal_reasoning = (context.task == Some(crate::ai_runtime::types::TaskType::Reasoning) 
            || context.task == Some(crate::ai_runtime::types::TaskType::Coding)) 
            && !context.human_facing;

        if is_internal_reasoning {
            Self::inject_cod(request);
        }
        
        Ok(())
    }
}

impl ReasoningMiddleware {
    fn inject_cod(request: &mut CompletionRequest) {
        const COD_INSTR: &str = "\n\nThink step by step, but keep each reasoning step to 5 words or fewer (Chain of Draft).";
        if let Some(msg) = request.messages.get_mut(0) {
            if msg.role == "system" && !msg.content.contains("Chain of Draft") {
                msg.content.push_str(COD_INSTR);
            }
        }
    }
}
