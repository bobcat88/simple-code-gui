use crate::ai_runtime::types::{
    AgentRole, CompletionRequest, ProviderKind, RoutingPolicy, TaskType,
};

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

pub fn provider_kind_from_hint(hint: &str) -> Option<ProviderKind> {
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
