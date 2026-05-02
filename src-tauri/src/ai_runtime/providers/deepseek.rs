use crate::ai_runtime::providers::openai::OpenAIProvider;
use crate::ai_runtime::types::{
    CompletionRequest, CompletionResponse, EmbeddingRequest, EmbeddingResponse, ModelInfo,
    ModelTier,
};
use crate::ai_runtime::AIProvider;
use async_trait::async_trait;

pub struct DeepSeekProvider {
    inner: OpenAIProvider,
}

impl DeepSeekProvider {
    pub fn new(api_key: String, base_url: Option<String>) -> Self {
        Self {
            inner: OpenAIProvider::new(
                api_key,
                Some(base_url.unwrap_or_else(|| "https://api.deepseek.com".to_string())),
            ),
        }
    }
}

#[async_trait]
impl AIProvider for DeepSeekProvider {
    fn name(&self) -> &str {
        "deepseek"
    }

    async fn completion(&self, request: CompletionRequest) -> Result<CompletionResponse, String> {
        self.inner.completion(request).await
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

#[cfg(test)]
mod tests {
    use super::*;

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
}
