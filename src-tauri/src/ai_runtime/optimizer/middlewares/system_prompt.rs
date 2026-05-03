use async_trait::async_trait;
use crate::ai_runtime::types::{CompletionRequest, Message};
use super::super::context::OptimizationContext;
use super::super::middleware::OptimizationMiddleware;

pub struct SystemPromptMiddleware;

#[async_trait]
impl OptimizationMiddleware for SystemPromptMiddleware {
    fn name(&self) -> &str {
        "system_prompt"
    }

    async fn apply(
        &self, 
        request: &mut CompletionRequest, 
        _context: &OptimizationContext,
        _embedding_service: Option<&dyn crate::ai_runtime::optimizer::context::EmbeddingService>
    ) -> Result<(), String> {
        let Some(system_prompt) = request
            .optimization
            .as_ref()
            .and_then(|opt| opt.system_prompt.as_ref())
        else {
            return Ok(());
        };
        let Some(content) = system_prompt.content.as_ref() else {
            return Ok(());
        };
        if content.trim().is_empty() {
            return Ok(());
        }
        if request
            .messages
            .iter()
            .any(|msg| msg.role == "system" && msg.content == *content)
        {
            return Ok(());
        }

        request.messages.insert(
            0,
            Message {
                role: "system".to_string(),
                content: content.clone(),
                tool_calls: None,
                tool_call_id: None,
                cache_control: None,
            },
        );
        Ok(())
    }
}
