use async_trait::async_trait;
use crate::ai_runtime::types::CompletionRequest;
use super::context::{OptimizationContext, EmbeddingService};

#[async_trait]
pub trait OptimizationMiddleware: Send + Sync {
    fn name(&self) -> &str;
    async fn apply(
        &self, 
        request: &mut CompletionRequest, 
        context: &OptimizationContext,
        embedding_service: Option<&dyn EmbeddingService>
    ) -> Result<(), String>;
}
