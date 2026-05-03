use async_trait::async_trait;
use serde_json::json;
use crate::ai_runtime::types::{CompletionRequest, ProviderKind};
use super::super::context::OptimizationContext;
use super::super::middleware::OptimizationMiddleware;

pub struct CacheMiddleware;

#[async_trait]
impl OptimizationMiddleware for CacheMiddleware {
    fn name(&self) -> &str {
        "cache"
    }

    async fn apply(
        &self, 
        request: &mut CompletionRequest, 
        context: &OptimizationContext,
        _embedding_service: Option<&dyn crate::ai_runtime::optimizer::context::EmbeddingService>
    ) -> Result<(), String> {
        let provider = match context.provider {
            Some(ref p) => p,
            None => return Ok(()),
        };

        match provider {
            ProviderKind::Anthropic => {
                // Anthropic ephemeral caching (beta)
                // We apply it to the system prompt (first message) or the last few messages
                // to maintain a stable prefix.
                if let Some(msg) = request.messages.get_mut(0) {
                    if msg.role == "system" {
                        msg.cache_control = Some(json!({"type": "ephemeral"}));
                    }
                }
            }
            ProviderKind::Gemini => {
                // Gemini cachedContent logic
                // If the total input is large (>4k tokens), we could signal to use cached content.
                // This usually requires a separate management flow, but we can store the intent.
                if let Some(ref opt) = request.optimization {
                    if let Some(ref cache) = opt.cache {
                        if let Some(ref name) = cache.cached_content_name {
                            // If we already have a cached content name, the provider implementation
                            // should use it instead of sending the full prefix.
                            // We can use the context to track token counts in the future.
                        }
                    }
                }
            }
            ProviderKind::DeepSeekFlash | ProviderKind::DeepSeekPro | ProviderKind::DeepSeekReasoner => {
                // DeepSeek prefix caching is automatic and doesn't require explicit markers.
                // It just requires the prefix to be identical across requests.
                // Our SystemPromptMiddleware ensures the system message is always at the start.
            }
            _ => {}
        }

        Ok(())
    }
}
