use crate::ai_runtime::types::{CompletionRequest, CompletionResponse, ModelInfo, Usage};
use crate::ai_runtime::AIProvider;
use serde_json::{json, Value};
use reqwest::Client;

use async_trait::async_trait;

pub struct ClaudeProvider {
    client: Client,
    api_key: String,
}

impl ClaudeProvider {
    pub fn new(api_key: String) -> Self {
        Self {
            client: Client::new(),
            api_key,
        }
    }
}

#[async_trait]
impl AIProvider for ClaudeProvider {
    fn name(&self) -> &str {
        "claude"
    }

    async fn completion(&self, request: CompletionRequest) -> Result<CompletionResponse, String> {
        let model = request.model.clone().expect("Model must be specified");
        let response = self.client.post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&json!({
                "model": model,
                "messages": request.messages,
                "max_tokens": request.max_tokens.unwrap_or(1024),
                "temperature": request.temperature.unwrap_or(0.7),
            }))
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let status = response.status();
        let body = response.text().await.map_err(|e| e.to_string())?;

        if !status.is_success() {
            return Err(format!("Claude API Error ({}): {}", status, body));
        }

        let json: Value = serde_json::from_str(&body).map_err(|e| e.to_string())?;
        
        let content = json["content"][0]["text"].as_str()
            .ok_or("Failed to parse content from Claude response")?
            .to_string();

        let usage = Usage {
            input_tokens: json["usage"]["input_tokens"].as_u64().unwrap_or(0) as u32,
            output_tokens: json["usage"]["output_tokens"].as_u64().unwrap_or(0) as u32,
            saved_tokens: 0,
        };

        Ok(CompletionResponse {
            id: json["id"].as_str().unwrap_or("unknown").to_string(),
            model,
            content,
            usage: Some(usage),
        })
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>, String> {
        use crate::ai_runtime::types::ModelTier;
        Ok(vec![
            ModelInfo {
                id: "claude-3-5-sonnet-20241022".to_string(),
                name: "Claude 3.5 Sonnet (New)".to_string(),
                tier: ModelTier::Tier1,
                context_window: 200000,
                pricing_input_1m: 3.0,
                pricing_output_1m: 15.0,
            },
            ModelInfo {
                id: "claude-3-5-haiku-20241022".to_string(),
                name: "Claude 3.5 Haiku".to_string(),
                tier: ModelTier::Tier3,
                context_window: 200000,
                pricing_input_1m: 0.25,
                pricing_output_1m: 1.25,
            },
            ModelInfo {
                id: "claude-3-opus-20240229".to_string(),
                name: "Claude 3 Opus".to_string(),
                tier: ModelTier::Tier1,
                context_window: 200000,
                pricing_input_1m: 15.0,
                pricing_output_1m: 75.0,
            }
        ])
    }

    async fn check_health(&self) -> bool {
        // Simple health check could be listing models or a lightweight call
        !self.api_key.is_empty()
    }
}
