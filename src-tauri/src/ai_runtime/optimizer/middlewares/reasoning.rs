use async_trait::async_trait;
use crate::ai_runtime::types::{CompletionRequest, ProviderKind};
use super::super::context::OptimizationContext;
use super::super::middleware::OptimizationMiddleware;

pub struct ReasoningMiddleware;

#[async_trait]
impl OptimizationMiddleware for ReasoningMiddleware {
    fn name(&self) -> &str {
        "reasoning"
    }

    async fn apply(&self, request: &mut CompletionRequest, context: &OptimizationContext) -> Result<(), String> {
        let Some(provider) = &context.provider else {
            return Ok(());
        };
        
        let Some(optimization) = &request.optimization else {
            return Ok(());
        };
        
        let Some(reasoning) = &optimization.reasoning else {
            return Ok(());
        };

        match provider {
            ProviderKind::Anthropic => {
                // Extended thinking support for Claude 3.7+
                // This is typically handled via a thinking block in the request
                // For now we map our reasoning effort to the provider's expectations
            }
            ProviderKind::DeepSeekFlash | ProviderKind::DeepSeekPro => {
                // DeepSeek CoD / Thinking injection
                // If it's a reasoning task and not human-facing, we can use CoD
                if context.task == Some(crate::ai_runtime::types::TaskType::Reasoning) && !context.human_facing {
                    Self::inject_cod(request);
                }
            }
            ProviderKind::Ollama | ProviderKind::OpenAICompatible => {
                // Models that don't support native reasoning effort often benefit from CoD
                if context.task == Some(crate::ai_runtime::types::TaskType::Reasoning) {
                    Self::inject_cod(request);
                }
            }
            _ => {}
        }
        
        Ok(())
    }
}

impl ReasoningMiddleware {
    fn inject_cod(request: &mut CompletionRequest) {
        const COD_INSTR: &str = "\n\nThink step by step, but keep each reasoning step to 5 words or fewer (Chain of Draft).";
        if let Some(msg) = request.messages.get_mut(0) {
            if msg.role == "system" {
                if !msg.content.contains("Chain of Draft") {
                    msg.content.push_str(COD_INSTR);
                }
            }
        }
    }
}
