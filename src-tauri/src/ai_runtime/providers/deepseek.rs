use crate::ai_runtime::providers::openai::OpenAIProvider;
use crate::ai_runtime::types::{
    CompletionRequest, CompletionResponse, EmbeddingRequest, EmbeddingResponse, ModelInfo,
    ModelTier, Usage,
};
use crate::ai_runtime::AIProvider;
use async_trait::async_trait;
use reqwest::Client;
use serde_json::{json, Value};

pub struct DeepSeekProvider {
    client: Client,
    api_key: String,
    base_url: String,
    inner: OpenAIProvider,
}

impl DeepSeekProvider {
    pub fn new(api_key: String, base_url: Option<String>) -> Self {
        let base_url = base_url.unwrap_or_else(|| "https://api.deepseek.com".to_string());
        Self {
            client: Client::new(),
            api_key: api_key.clone(),
            base_url: base_url.clone(),
            inner: OpenAIProvider::new(api_key, Some(base_url)),
        }
    }

    fn fim_body(&self, request: &CompletionRequest) -> Option<Value> {
        let fim = request.optimization.as_ref()?.fim.as_ref()?;
        Some(json!({
            "model": request.model.clone().unwrap_or_else(|| "deepseek-chat".to_string()),
            "prompt": fim.prefix,
            "suffix": fim.suffix,
            "max_tokens": fim.max_tokens.or(request.max_tokens).unwrap_or(1024),
        }))
    }

    async fn fim_completion(
        &self,
        request: CompletionRequest,
    ) -> Result<CompletionResponse, String> {
        let model = request
            .model
            .clone()
            .unwrap_or_else(|| "deepseek-chat".to_string());
        let body = self
            .fim_body(&request)
            .ok_or("DeepSeek FIM request missing fim context")?;
        let response = self
            .client
            .post(format!(
                "{}/beta/completions",
                self.base_url.trim_end_matches('/')
            ))
            .bearer_auth(&self.api_key)
            .header("content-type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let status = response.status();
        let body_text = response.text().await.map_err(|e| e.to_string())?;
        if !status.is_success() {
            return Err(format!("DeepSeek FIM Error ({}): {}", status, body_text));
        }

        let json: Value = serde_json::from_str(&body_text).map_err(|e| e.to_string())?;
        let content = json["choices"][0]["text"]
            .as_str()
            .unwrap_or("")
            .to_string();
        let usage = Usage {
            input_tokens: json["usage"]["prompt_tokens"].as_u64().unwrap_or(0) as u32,
            output_tokens: json["usage"]["completion_tokens"].as_u64().unwrap_or(0) as u32,
            ..Default::default()
        };

        Ok(CompletionResponse {
            id: json["id"].as_str().unwrap_or("deepseek-fim").to_string(),
            model,
            content,
            tool_calls: None,
            usage: Some(usage),
        })
    }
}

#[async_trait]
impl AIProvider for DeepSeekProvider {
    fn name(&self) -> &str {
        "deepseek"
    }

    async fn completion(&self, request: CompletionRequest) -> Result<CompletionResponse, String> {
        if request
            .optimization
            .as_ref()
            .and_then(|opt| opt.fim.as_ref())
            .is_some()
        {
            return self.fim_completion(request).await;
        }
        self.inner
            .completion(strip_unsupported_openai_compat_options(request))
            .await
    }

    async fn embed(&self, request: EmbeddingRequest) -> Result<EmbeddingResponse, String> {
        self.inner.embed(request).await
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>, String> {
        Ok(vec![
            ModelInfo {
                id: "deepseek-v4-flash".to_string(),
                name: "DeepSeek V4 Flash".to_string(),
                tier: ModelTier::Tier2,
                context_window: 1_000_000,
                pricing_input_1m: 0.14,
                pricing_output_1m: 0.28,
            },
            ModelInfo {
                id: "deepseek-v4-pro".to_string(),
                name: "DeepSeek V4 Pro".to_string(),
                tier: ModelTier::Tier1,
                context_window: 1_000_000,
                pricing_input_1m: 1.74,
                pricing_output_1m: 3.48,
            },
            ModelInfo {
                id: "deepseek-reasoner".to_string(),
                name: "DeepSeek Reasoner".to_string(),
                tier: ModelTier::Tier1,
                context_window: 128_000,
                pricing_input_1m: 0.28,
                pricing_output_1m: 0.42,
            },
        ])
    }
}

fn strip_unsupported_openai_compat_options(mut request: CompletionRequest) -> CompletionRequest {
    if let Some(optimization) = request.optimization.as_mut() {
        optimization.cache = None;
        optimization.reasoning = None;
        optimization.response_format = None;
    }
    request
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai_runtime::types::{FimRequest, OptimizationRequest};

    #[tokio::test]
    async fn exposes_deepseek_models_with_documented_metadata() {
        let provider = DeepSeekProvider::new("test-key".to_string(), None);

        let models = provider.list_models().await.unwrap();

        assert_eq!(provider.name(), "deepseek");
        assert!(models.iter().any(|model| model.id == "deepseek-v4-flash"
            && model.context_window == 1_000_000
            && model.pricing_input_1m == 0.14
            && model.pricing_output_1m == 0.28));
        assert!(models.iter().any(|model| model.id == "deepseek-v4-pro"
            && model.context_window == 1_000_000
            && model.pricing_input_1m == 1.74
            && model.pricing_output_1m == 3.48));
    }

    #[test]
    fn strips_openai_only_optimization_fields() {
        let request = CompletionRequest {
            optimization: Some(OptimizationRequest {
                response_format: Some(crate::ai_runtime::types::ResponseFormat::JsonObject),
                reasoning: Some(crate::ai_runtime::types::ReasoningOptimization {
                    effort: Some(crate::ai_runtime::types::ReasoningEffort::Low),
                    budget_tokens: Some(1024),
                    include_thoughts: false,
                    preserve_reasoning_items: false,
                }),
                ..Default::default()
            }),
            ..Default::default()
        };

        let stripped = strip_unsupported_openai_compat_options(request);

        let optimization = stripped.optimization.unwrap();
        assert!(optimization.reasoning.is_none());
        assert!(optimization.response_format.is_none());
    }

    #[test]
    fn builds_deepseek_fim_beta_body() {
        let provider = DeepSeekProvider::new("test-key".to_string(), None);
        let request = CompletionRequest {
            model: Some("deepseek-chat".to_string()),
            max_tokens: Some(512),
            optimization: Some(OptimizationRequest {
                fim: Some(FimRequest {
                    prefix: "fn main() {".to_string(),
                    suffix: Some("}".to_string()),
                    max_tokens: None,
                }),
                ..Default::default()
            }),
            ..Default::default()
        };

        let body = provider.fim_body(&request).unwrap();

        assert_eq!(body["model"], "deepseek-chat");
        assert_eq!(body["prompt"], "fn main() {");
        assert_eq!(body["suffix"], "}");
        assert_eq!(body["max_tokens"], 512);
    }
}
