use crate::ai_runtime::types::{
    CompletionRequest, CompletionResponse, Message, ModelInfo, ModelTier, Usage,
};
use crate::ai_runtime::AIProvider;
use async_trait::async_trait;
use reqwest::Client;
use serde_json::{json, Value};

pub struct OpenAIProvider {
    client: Client,
    api_key: String,
    base_url: String,
}

impl OpenAIProvider {
    pub fn new(api_key: String, base_url: Option<String>) -> Self {
        Self {
            client: Client::new(),
            api_key,
            base_url: base_url.unwrap_or_else(|| "https://api.openai.com/v1".to_string()),
        }
    }
}

#[async_trait]
impl AIProvider for OpenAIProvider {
    fn name(&self) -> &str {
        "openai"
    }

    async fn completion(&self, request: CompletionRequest) -> Result<CompletionResponse, String> {
        let model = request.model.clone().expect("Model must be specified");
        let messages: Vec<Message> = request
            .messages
            .into_iter()
            .map(|message| Message {
                role: normalize_role(&message.role),
                content: message.content,
            })
            .collect();

        let mut body = json!({
            "model": model,
            "messages": messages,
        });

        if let Some(max_tokens) = request.max_tokens {
            body["max_completion_tokens"] = json!(max_tokens);
        }

        if let Some(temperature) = request.temperature {
            body["temperature"] = json!(temperature);
        }

        let response = self
            .client
            .post(format!(
                "{}/chat/completions",
                self.base_url.trim_end_matches('/')
            ))
            .bearer_auth(&self.api_key)
            .header("content-type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let status = response.status();
        let body = response.text().await.map_err(|e| e.to_string())?;

        if !status.is_success() {
            return Err(format!("OpenAI API Error ({}): {}", status, body));
        }

        let json: Value = serde_json::from_str(&body).map_err(|e| e.to_string())?;
        let content = json["choices"][0]["message"]["content"]
            .as_str()
            .ok_or("Failed to parse content from OpenAI response")?
            .to_string();

        let usage = Usage {
            input_tokens: json["usage"]["prompt_tokens"].as_u64().unwrap_or(0) as u32,
            output_tokens: json["usage"]["completion_tokens"].as_u64().unwrap_or(0) as u32,
            ..Default::default()
        };

        Ok(CompletionResponse {
            id: json["id"].as_str().unwrap_or("unknown").to_string(),
            model,
            content,
            usage: Some(usage),
        })
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>, String> {
        Ok(vec![
            ModelInfo {
                id: "gpt-5.2".to_string(),
                name: "GPT-5.2".to_string(),
                tier: ModelTier::Tier1,
                context_window: 400_000,
                pricing_input_1m: 1.75,
                pricing_output_1m: 14.0,
            },
            ModelInfo {
                id: "gpt-5-mini".to_string(),
                name: "GPT-5 Mini".to_string(),
                tier: ModelTier::Tier2,
                context_window: 400_000,
                pricing_input_1m: 0.25,
                pricing_output_1m: 2.0,
            },
            ModelInfo {
                id: "gpt-5-nano".to_string(),
                name: "GPT-5 Nano".to_string(),
                tier: ModelTier::Tier3,
                context_window: 400_000,
                pricing_input_1m: 0.05,
                pricing_output_1m: 0.40,
            },
        ])
    }

    async fn check_health(&self) -> bool {
        !self.api_key.is_empty()
    }
}

fn normalize_role(role: &str) -> String {
    match role {
        "assistant" | "system" | "developer" | "tool" => role.to_string(),
        _ => "user".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_role_keeps_openai_roles() {
        assert_eq!(normalize_role("assistant"), "assistant");
        assert_eq!(normalize_role("system"), "system");
        assert_eq!(normalize_role("developer"), "developer");
        assert_eq!(normalize_role("unknown"), "user");
    }
}
