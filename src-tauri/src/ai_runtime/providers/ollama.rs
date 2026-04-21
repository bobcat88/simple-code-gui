use crate::ai_runtime::types::{CompletionRequest, CompletionResponse, ModelInfo, Usage};
use crate::ai_runtime::AIProvider;
use serde_json::{json, Value};
use reqwest::Client;

use async_trait::async_trait;

pub struct OllamaProvider {
    client: Client,
    base_url: String,
}

impl OllamaProvider {
    pub fn new(base_url: Option<String>) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.unwrap_or_else(|| "http://localhost:11434".to_string()),
        }
    }
}

#[async_trait]
impl AIProvider for OllamaProvider {
    fn name(&self) -> &str {
        "ollama"
    }

    async fn completion(&self, request: CompletionRequest) -> Result<CompletionResponse, String> {
        let url = format!("{}/api/chat", self.base_url);

        let response = self.client.post(&url)
            .json(&json!({
                "model": request.model,
                "messages": request.messages,
                "stream": false,
                "options": {
                    "temperature": request.temperature.unwrap_or(0.7),
                    "num_predict": request.max_tokens.unwrap_or(2048),
                }
            }))
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let status = response.status();
        let body = response.text().await.map_err(|e| e.to_string())?;

        if !status.is_success() {
            return Err(format!("Ollama API Error ({}): {}", status, body));
        }

        let json: Value = serde_json::from_str(&body).map_err(|e| e.to_string())?;
        
        let content = json["message"]["content"].as_str()
            .ok_or("Failed to parse content from Ollama response")?
            .to_string();

        let usage = Usage {
            input_tokens: json["prompt_eval_count"].as_u64().unwrap_or(0) as u32,
            output_tokens: json["eval_count"].as_u64().unwrap_or(0) as u32,
            saved_tokens: 0,
        };

        Ok(CompletionResponse {
            id: "ollama-resp".to_string(),
            model: request.model,
            content,
            usage: Some(usage),
        })
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>, String> {
        let url = format!("{}/api/tags", self.base_url);
        let response = self.client.get(&url).send().await.map_err(|e| e.to_string())?;
        let json: Value = response.json().await.map_err(|e| e.to_string())?;

        let mut models = Vec::new();
        if let Some(tags) = json["models"].as_array() {
            for tag in tags {
                if let Some(name) = tag["name"].as_str() {
                    models.push(ModelInfo {
                        id: name.to_string(),
                        name: name.to_string(),
                        context_window: 4096, // Default for most local models
                        pricing_input_1m: 0.0,
                        pricing_output_1m: 0.0,
                    });
                }
            }
        }

        Ok(models)
    }

    async fn check_health(&self) -> bool {
        let url = format!("{}/api/tags", self.base_url);
        self.client.get(&url).send().await.is_ok()
    }
}
