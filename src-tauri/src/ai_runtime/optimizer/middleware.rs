use async_trait::async_trait;
use crate::ai_runtime::types::CompletionRequest;
use super::context::OptimizationContext;

#[async_trait]
pub trait OptimizationMiddleware: Send + Sync {
    fn name(&self) -> &str;
    async fn apply(&self, request: &mut CompletionRequest, context: &OptimizationContext) -> Result<(), String>;
}
