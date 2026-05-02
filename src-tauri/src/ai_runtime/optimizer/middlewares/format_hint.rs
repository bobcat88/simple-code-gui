use async_trait::async_trait;
use crate::ai_runtime::types::{CompletionRequest, Message, ResponseFormat};
use super::super::context::OptimizationContext;
use super::super::middleware::OptimizationMiddleware;

pub struct FormatHintMiddleware;

#[async_trait]
impl OptimizationMiddleware for FormatHintMiddleware {
    fn name(&self) -> &str {
        "format_hint"
    }

    async fn apply(&self, request: &mut CompletionRequest, context: &OptimizationContext) -> Result<(), String> {
        if context.human_facing || request.tools.is_some() || request.tool_choice.is_some() {
            return Ok(());
        }
        let current_format = request.optimization.as_ref().and_then(|opt| opt.response_format.as_ref());
        
        // If explicit YAML or (not human facing and explicit JSON) -> suggest YAML
        let suggest_yaml = matches!(current_format, Some(ResponseFormat::Yaml)) || 
                          (!context.human_facing && matches!(current_format, Some(ResponseFormat::JsonObject)));

        if !suggest_yaml {
            return Ok(());
        }

        const YAML_HINT: &str =
            "Respond in YAML only. Do not use JSON. Do not wrap the response in markdown.";
        if request
            .messages
            .iter()
            .any(|msg| msg.role == "system" && msg.content.contains(YAML_HINT))
        {
            return Ok(());
        }
        request.messages.insert(
            0,
            Message {
                role: "system".to_string(),
                content: YAML_HINT.to_string(),
                tool_calls: None,
                tool_call_id: None,
                cache_control: None,
            },
        );
        Ok(())
    }
}
