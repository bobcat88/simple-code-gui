pub mod context;
pub mod middleware;
pub mod middlewares;

use std::sync::Arc;
use async_trait::async_trait;

use super::semantic_cache::SemanticCache;
use super::opt_metrics::OptimizationMetrics;
use super::context_compressor::ContextCompressor;
use super::types::{
    CompletionRequest, CompletionResponse, EmbeddingRequest, EmbeddingResponse,
    ModelInfo,
};
use super::AIProvider;

pub use context::{OptimizationContext, ProviderCapabilities};
pub use middleware::OptimizationMiddleware;
use middlewares::*;

#[derive(Clone)]
pub struct OptimizationPipeline {
    enabled: bool,
    middlewares: Vec<Arc<dyn OptimizationMiddleware>>,
    semantic_cache: Option<Arc<SemanticCache>>,
    metrics: Option<Arc<OptimizationMetrics>>,
}

impl OptimizationPipeline {
    pub fn disabled() -> Self {
        Self {
            enabled: false,
            middlewares: Vec::new(),
            semantic_cache: None,
            metrics: None,
        }
    }

    pub fn new() -> Self {
        let middlewares: Vec<Arc<dyn OptimizationMiddleware>> = vec![
            Arc::new(SystemPromptMiddleware),
            Arc::new(BudgetMiddleware),
            Arc::new(FormatHintMiddleware),
            Arc::new(ReasoningMiddleware),
        ];
        
        Self {
            enabled: true,
            middlewares,
            semantic_cache: None,
            metrics: None,
        }
    }

    pub fn with_components(
        mut self,
        semantic_cache: Option<Arc<SemanticCache>>,
        compressor: Option<Arc<ContextCompressor>>,
        metrics: Option<Arc<OptimizationMetrics>>,
    ) -> Self {
        self.semantic_cache = semantic_cache;
        self.metrics = metrics.clone();
        
        if let Some(comp) = compressor {
            self.middlewares.push(Arc::new(CompressionMiddleware::new(comp)));
        }
        
        self
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    pub async fn optimize(&self, mut request: CompletionRequest) -> Result<CompletionRequest, String> {
        if !self.enabled {
            return Ok(request);
        }

        let context = OptimizationContext::from_request(&request);
        
        for middleware in &self.middlewares {
            middleware.apply(&mut request, &context).await?;
            
            // Special case for compression metrics for now
            if middleware.name() == "compression" {
                if let Some(metrics) = &self.metrics {
                    metrics.record_compression();
                }
            }
        }
        
        Ok(request)
    }

    pub async fn cached_response(&self, request: &CompletionRequest) -> Option<CompletionResponse> {
        let cache = self.semantic_cache.as_ref()?;
        let response = cache.get(request).await;
        if let Some(metrics) = &self.metrics {
            if response.is_some() {
                metrics.record_cache_hit();
            } else {
                metrics.record_cache_miss();
            }
        }
        response
    }

    pub async fn store_response(&self, request: &CompletionRequest, response: &CompletionResponse) {
        if let Some(cache) = &self.semantic_cache {
            cache.set(request, response).await;
        }
    }
}

impl Default for OptimizationPipeline {
    fn default() -> Self {
        Self::disabled()
    }
}

pub struct OptimizedProvider {
    inner: Arc<dyn AIProvider>,
    pipeline: Arc<OptimizationPipeline>,
}

impl OptimizedProvider {
    pub fn new(inner: Arc<dyn AIProvider>, pipeline: Arc<OptimizationPipeline>) -> Self {
        Self { inner, pipeline }
    }
}

#[async_trait]
impl AIProvider for OptimizedProvider {
    fn name(&self) -> &str {
        self.inner.name()
    }

    async fn completion(&self, request: CompletionRequest) -> Result<CompletionResponse, String> {
        if let Some(response) = self.pipeline.cached_response(&request).await {
            return Ok(response);
        }
        let cache_request = request.clone();
        let optimized = self.pipeline.optimize(request).await?;
        let response = self.inner.completion(optimized).await?;
        self.pipeline.store_response(&cache_request, &response).await;
        Ok(response)
    }

    async fn embed(&self, request: EmbeddingRequest) -> Result<EmbeddingResponse, String> {
        self.inner.embed(request).await
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>, String> {
        self.inner.list_models().await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai_runtime::types::{
        OptimizationRequest, ReasoningOptimization, SystemPromptOptimization, AgentRole, Message, RoutingPolicy, TaskType, ResponseFormat, ProviderKind
    };

    #[tokio::test]
    async fn context_infers_task_from_tiered_policy() {
        let request = CompletionRequest {
            messages: vec![Message {
                role: "user".to_string(),
                content: "build".to_string(),
                tool_calls: None,
                tool_call_id: None,
            }],
            policy: Some(RoutingPolicy::Tiered {
                task: TaskType::Coding,
                allow_fallback: true,
            }),
            ..Default::default()
        };

        let context = OptimizationContext::from_request(&request);

        assert_eq!(context.task, Some(TaskType::Coding));
        assert_eq!(context.role, None);
        assert!(context.human_facing);
    }

    #[tokio::test]
    async fn explicit_optimization_overrides_policy_context() {
        let request = CompletionRequest {
            policy: Some(RoutingPolicy::Tiered {
                task: TaskType::Fast,
                allow_fallback: true,
            }),
            optimization: Some(OptimizationRequest {
                provider: Some(ProviderKind::Gemini),
                task: Some(TaskType::Reasoning),
                role: Some(AgentRole::Planner),
                human_facing: Some(false),
                ..Default::default()
            }),
            ..Default::default()
        };

        let context = OptimizationContext::from_request(&request);

        assert_eq!(context.provider, Some(ProviderKind::Gemini));
        assert_eq!(context.task, Some(TaskType::Reasoning));
        assert_eq!(context.role, Some(AgentRole::Planner));
        assert!(!context.human_facing);
    }

    #[test]
    fn deepseek_capabilities_are_explicit() {
        let flash = ProviderCapabilities::for_provider(&ProviderKind::DeepSeekFlash);
        let reasoner = ProviderCapabilities::for_provider(&ProviderKind::DeepSeekReasoner);

        assert!(flash.automatic_prefix_cache);
        assert!(flash.fim_completion);
        assert!(!flash.reasoning_controls);
        assert!(reasoner.automatic_prefix_cache);
        assert!(reasoner.reasoning_controls);
        assert!(!reasoner.fim_completion);
    }

    #[tokio::test]
    async fn optimizer_sets_budget_only_when_missing() {
        let pipeline = OptimizationPipeline::new();
        let request = CompletionRequest {
            policy: Some(RoutingPolicy::Tiered {
                task: TaskType::Fast,
                allow_fallback: true,
            }),
            ..Default::default()
        };
        let explicit = CompletionRequest {
            policy: Some(RoutingPolicy::Tiered {
                task: TaskType::Fast,
                allow_fallback: true,
            }),
            max_tokens: Some(123),
            ..Default::default()
        };

        assert_eq!(pipeline.optimize(request).await.unwrap().max_tokens, Some(512));
        assert_eq!(pipeline.optimize(explicit).await.unwrap().max_tokens, Some(123));
    }

    #[tokio::test]
    async fn planner_role_gets_larger_budget() {
        let pipeline = OptimizationPipeline::new();
        let request = CompletionRequest {
            optimization: Some(OptimizationRequest {
                role: Some(AgentRole::Planner),
                task: Some(TaskType::Reasoning),
                reasoning: Some(ReasoningOptimization {
                    effort: None,
                    budget_tokens: None,
                    include_thoughts: false,
                    preserve_reasoning_items: false,
                }),
                ..Default::default()
            }),
            ..Default::default()
        };

        assert_eq!(pipeline.optimize(request).await.unwrap().max_tokens, Some(8_000));
    }

    #[tokio::test]
    async fn system_prompt_inserted_once_at_stable_prefix() {
        let pipeline = OptimizationPipeline::new();
        let request = CompletionRequest {
            messages: vec![Message {
                role: "user".to_string(),
                content: "work".to_string(),
                tool_calls: None,
                tool_call_id: None,
            }],
            optimization: Some(OptimizationRequest {
                system_prompt: Some(SystemPromptOptimization {
                    content: Some("Stable instructions".to_string()),
                    cacheable: true,
                }),
                ..Default::default()
            }),
            ..Default::default()
        };

        let optimized = pipeline.optimize(request.clone()).await.unwrap();
        let optimized_again = pipeline.optimize(optimized.clone()).await.unwrap();

        assert_eq!(optimized.messages[0].role, "system");
        assert_eq!(optimized.messages[0].content, "Stable instructions");
        assert_eq!(optimized_again.messages.len(), optimized.messages.len());
    }

    #[tokio::test]
    async fn yaml_hint_only_for_internal_non_tool_requests() {
        let pipeline = OptimizationPipeline::new();
        let internal = CompletionRequest {
            optimization: Some(OptimizationRequest {
                human_facing: Some(false),
                response_format: Some(ResponseFormat::Yaml),
                ..Default::default()
            }),
            ..Default::default()
        };
        let human = CompletionRequest {
            optimization: Some(OptimizationRequest {
                human_facing: Some(true),
                response_format: Some(ResponseFormat::Yaml),
                ..Default::default()
            }),
            ..Default::default()
        };

        let internal_opt = pipeline.optimize(internal).await.unwrap();
        let human_opt = pipeline.optimize(human).await.unwrap();

        assert!(internal_opt
            .messages
            .iter()
            .any(|msg| msg.content.contains("YAML")));
        assert!(!human_opt
            .messages
            .iter()
            .any(|msg| msg.content.contains("YAML")));
    }
}
