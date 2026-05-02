use std::sync::Arc;
use async_trait::async_trait;
use crate::ai_runtime::context_compressor::ContextCompressor;
use crate::ai_runtime::types::CompletionRequest;
use super::super::context::OptimizationContext;
use super::super::middleware::OptimizationMiddleware;

pub struct CompressionMiddleware {
    compressor: Arc<ContextCompressor>,
}

impl CompressionMiddleware {
    pub fn new(compressor: Arc<ContextCompressor>) -> Self {
        Self { compressor }
    }
}

#[async_trait]
impl OptimizationMiddleware for CompressionMiddleware {
    fn name(&self) -> &str {
        "compression"
    }

    async fn apply(&self, request: &mut CompletionRequest, _context: &OptimizationContext) -> Result<(), String> {
        self.compressor.compress(request);
        Ok(())
    }
}
