#![allow(dead_code)]

use std::sync::Arc;

use async_trait::async_trait;

use super::types::{
    AgentRole, CompletionRequest, CompletionResponse, EmbeddingRequest, EmbeddingResponse, Message,
    ModelInfo, ProviderKind, ResponseFormat, RoutingPolicy, TaskType,
};
use super::AIProvider;

#[derive(Debug, Clone, PartialEq)]
pub struct OptimizationContext {
    pub provider: Option<ProviderKind>,
    pub task: Option<TaskType>,
    pub role: Option<AgentRole>,
    pub human_facing: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ProviderCapabilities {
    pub automatic_prefix_cache: bool,
    pub prompt_cache_key: bool,
    pub explicit_cached_content: bool,
    pub reasoning_controls: bool,
    pub fim_completion: bool,
}

impl ProviderCapabilities {
    pub fn for_provider(provider: &ProviderKind) -> Self {
        match provider {
            ProviderKind::DeepSeekFlash => Self {
                automatic_prefix_cache: true,
                prompt_cache_key: false,
                explicit_cached_content: false,
                reasoning_controls: false,
                fim_completion: true,
            },
            ProviderKind::DeepSeekPro | ProviderKind::DeepSeekReasoner => Self {
                automatic_prefix_cache: true,
                prompt_cache_key: false,
                explicit_cached_content: false,
                reasoning_controls: matches!(provider, ProviderKind::DeepSeekReasoner),
                fim_completion: false,
            },
            ProviderKind::OpenAI | ProviderKind::OpenAICompatible => Self {
                automatic_prefix_cache: true,
                prompt_cache_key: true,
                explicit_cached_content: false,
                reasoning_controls: true,
                fim_completion: false,
            },
            ProviderKind::Anthropic => Self {
                automatic_prefix_cache: false,
                prompt_cache_key: false,
                explicit_cached_content: false,
                reasoning_controls: true,
                fim_completion: false,
            },
            ProviderKind::Gemini => Self {
                automatic_prefix_cache: true,
                prompt_cache_key: false,
                explicit_cached_content: true,
                reasoning_controls: true,
                fim_completion: false,
            },
            ProviderKind::Ollama => Self {
                automatic_prefix_cache: false,
                prompt_cache_key: false,
                explicit_cached_content: false,
                reasoning_controls: false,
                fim_completion: false,
            },
        }
    }
}

impl OptimizationContext {
    pub fn from_request(request: &CompletionRequest) -> Self {
        let explicit = request.optimization.as_ref();
        let (policy_provider, policy_task, policy_role) = match &request.policy {
            Some(RoutingPolicy::Direct { provider, .. }) => {
                (provider_kind_from_hint(provider), None, None)
            }
            Some(RoutingPolicy::Tiered { task, .. }) => (None, Some(task.clone()), None),
            Some(RoutingPolicy::Agent { role }) => (None, None, Some(role.clone())),
            _ => (None, None, None),
        };

        Self {
            provider: explicit
                .and_then(|opt| opt.provider.clone())
                .or(policy_provider)
                .or_else(|| request.model.as_deref().and_then(provider_kind_from_hint)),
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

        let context = OptimizationContext::from_request(&request);
        let mut request = request;
        apply_system_prompt(&mut request);
        apply_budget(&mut request, &context);
        apply_internal_format_hint(&mut request, &context);
        Ok(request)
    }
}

fn provider_kind_from_hint(hint: &str) -> Option<ProviderKind> {
    let normalized = hint.to_ascii_lowercase();
    if normalized.contains("deepseek-reasoner") {
        Some(ProviderKind::DeepSeekReasoner)
    } else if normalized.contains("deepseek-v4-pro") || normalized.contains("deepseek-pro") {
        Some(ProviderKind::DeepSeekPro)
    } else if normalized.contains("deepseek") {
        Some(ProviderKind::DeepSeekFlash)
    } else if normalized.contains("claude") || normalized.contains("anthropic") {
        Some(ProviderKind::Anthropic)
    } else if normalized.contains("gemini") {
        Some(ProviderKind::Gemini)
    } else if normalized.contains("ollama") {
        Some(ProviderKind::Ollama)
    } else if normalized.contains("openai") || normalized.starts_with("gpt-") {
        Some(ProviderKind::OpenAI)
    } else {
        None
    }
}

fn apply_system_prompt(request: &mut CompletionRequest) {
    let Some(system_prompt) = request
        .optimization
        .as_ref()
        .and_then(|opt| opt.system_prompt.as_ref())
    else {
        return;
    };
    let Some(content) = system_prompt.content.as_ref() else {
        return;
    };
    if content.trim().is_empty() {
        return;
    }
    if request
        .messages
        .iter()
        .any(|msg| msg.role == "system" && msg.content == *content)
    {
        return;
    }

    request.messages.insert(
        0,
        Message {
            role: "system".to_string(),
            content: content.clone(),
            tool_calls: None,
            tool_call_id: None,
        },
    );
}

fn apply_budget(request: &mut CompletionRequest, context: &OptimizationContext) {
    if request.max_tokens.is_some() {
        return;
    }

    let budget = match (&context.task, &context.role) {
        (_, Some(AgentRole::Planner)) => Some(8_000),
        (Some(TaskType::Reasoning), _) => Some(4_000),
        (Some(TaskType::Coding), _) => Some(4_000),
        (Some(TaskType::Creative), _) => Some(2_000),
        (Some(TaskType::Vision), _) => Some(2_000),
        (Some(TaskType::Fast), _) => Some(512),
        _ => None,
    };

    if let Some(budget) = budget {
        request.max_tokens = Some(budget);
    }
}

fn apply_internal_format_hint(request: &mut CompletionRequest, context: &OptimizationContext) {
    if context.human_facing || request.tools.is_some() || request.tool_choice.is_some() {
        return;
    }
    let wants_yaml = request
        .optimization
        .as_ref()
        .and_then(|opt| opt.response_format.as_ref())
        == Some(&ResponseFormat::Yaml);
    if !wants_yaml {
        return;
    }

    const YAML_HINT: &str =
        "Respond in YAML only. Do not use JSON. Do not wrap the response in markdown.";
    if request
        .messages
        .iter()
        .any(|msg| msg.role == "system" && msg.content.contains(YAML_HINT))
    {
        return;
    }
    request.messages.insert(
        0,
        Message {
            role: "system".to_string(),
            content: YAML_HINT.to_string(),
            tool_calls: None,
            tool_call_id: None,
        },
    );
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
    use crate::ai_runtime::types::{
        OptimizationRequest, ReasoningOptimization, SystemPromptOptimization,
    };

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

    #[test]
    fn context_infers_provider_from_direct_policy_and_model() {
        let direct = CompletionRequest {
            policy: Some(RoutingPolicy::Direct {
                provider: "claude".to_string(),
                model: "unused".to_string(),
            }),
            ..Default::default()
        };
        let model = CompletionRequest {
            model: Some("deepseek-v4-pro".to_string()),
            ..Default::default()
        };

        assert_eq!(
            OptimizationContext::from_request(&direct).provider,
            Some(ProviderKind::Anthropic)
        );
        assert_eq!(
            OptimizationContext::from_request(&model).provider,
            Some(ProviderKind::DeepSeekPro)
        );
    }

    #[test]
    fn optimizer_sets_budget_only_when_missing() {
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

        assert_eq!(pipeline.optimize(request).unwrap().max_tokens, Some(512));
        assert_eq!(pipeline.optimize(explicit).unwrap().max_tokens, Some(123));
    }

    #[test]
    fn planner_role_gets_larger_budget() {
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

        assert_eq!(pipeline.optimize(request).unwrap().max_tokens, Some(8_000));
    }

    #[test]
    fn system_prompt_inserted_once_at_stable_prefix() {
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

        let optimized = pipeline.optimize(request.clone()).unwrap();
        let optimized_again = pipeline.optimize(optimized.clone()).unwrap();

        assert_eq!(optimized.messages[0].role, "system");
        assert_eq!(optimized.messages[0].content, "Stable instructions");
        assert_eq!(optimized_again.messages.len(), optimized.messages.len());
    }

    #[test]
    fn yaml_hint_only_for_internal_non_tool_requests() {
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

        let internal = pipeline.optimize(internal).unwrap();
        let human = pipeline.optimize(human).unwrap();

        assert!(internal
            .messages
            .iter()
            .any(|msg| msg.content.contains("YAML")));
        assert!(!human
            .messages
            .iter()
            .any(|msg| msg.content.contains("YAML")));
    }

    #[test]
    fn disabled_pipeline_is_noop() {
        let pipeline = OptimizationPipeline::disabled();
        let request = CompletionRequest {
            policy: Some(RoutingPolicy::Tiered {
                task: TaskType::Fast,
                allow_fallback: true,
            }),
            ..Default::default()
        };

        let optimized = pipeline.optimize(request).unwrap();

        assert_eq!(optimized.max_tokens, None);
        assert!(optimized.messages.is_empty());
    }
}
