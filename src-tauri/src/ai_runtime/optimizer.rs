#![allow(dead_code)]

use std::sync::Arc;

use async_trait::async_trait;

use super::types::{
    AgentRole, CompletionRequest, CompletionResponse, EmbeddingRequest, EmbeddingResponse,
    ModelInfo, ProviderKind, RoutingPolicy, TaskType,
};
use super::AIProvider;

#[derive(Debug, Clone, PartialEq)]
pub struct OptimizationContext {
    pub provider: Option<ProviderKind>,
    pub task: Option<TaskType>,
    pub role: Option<AgentRole>,
    pub human_facing: bool,
}

impl OptimizationContext {
    pub fn from_request(request: &CompletionRequest) -> Self {
        let explicit = request.optimization.as_ref();
        let (policy_task, policy_role) = match &request.policy {
            Some(RoutingPolicy::Tiered { task, .. }) => (Some(task.clone()), None),
            Some(RoutingPolicy::Agent { role }) => (None, Some(role.clone())),
            _ => (None, None),
        };

        Self {
            provider: explicit.and_then(|opt| opt.provider.clone()),
            task: explicit.and_then(|opt| opt.task.clone()).or(policy_task),
            role: explicit.and_then(|opt| opt.role.clone()).or(policy_role),
            human_facing: explicit.and_then(|opt| opt.human_facing).unwrap_or(true),
        }
    }
}

#[derive(Debug, Clone)]
pub struct OptimizationPipeline {
    enabled: bool,
}

impl OptimizationPipeline {
    pub fn disabled() -> Self {
        Self { enabled: false }
    }

    pub fn new() -> Self {
        Self { enabled: true }
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    pub fn optimize(&self, request: CompletionRequest) -> Result<CompletionRequest, String> {
        if !self.enabled {
            return Ok(request);
        }

        let _context = OptimizationContext::from_request(&request);
        Ok(request)
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
        let optimized = self.pipeline.optimize(request)?;
        self.inner.completion(optimized).await
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
    use crate::ai_runtime::types::{Message, OptimizationRequest};

    #[test]
    fn context_infers_task_from_tiered_policy() {
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

    #[test]
    fn explicit_optimization_overrides_policy_context() {
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
}
