use crate::ai_runtime::types::{CompletionRequest, CompletionResponse, EmbeddingRequest, EmbeddingResponse, ModelInfo, Usage};
use crate::ai_runtime::AIProvider;
use serde_json::{json, Value};
use reqwest::Client;

use async_trait::async_trait;

pub struct GeminiProvider {
    client: Client,
    api_key: String,
}

impl GeminiProvider {
    pub fn new(api_key: String) -> Self {
        Self {
            client: Client::new(),
            api_key,
        }
    }
}

#[async_trait]
impl AIProvider for GeminiProvider {
    fn name(&self) -> &str {
        "gemini"
    }

    async fn completion(&self, request: CompletionRequest) -> Result<CompletionResponse, String> {
        let model = request.model.clone().expect("Model must be specified");
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
            model, self.api_key
        );

        let contents: Vec<Value> = request.messages.iter().map(|m| {
            json!({
                "role": if m.role == "user" { "user" } else { "model" },
                "parts": [{"text": m.content}]
            })
        }).collect();

        let response = self.client.post(&url)
            .json(&json!({
                "contents": contents,
                "generationConfig": {
                    "temperature": request.temperature.unwrap_or(0.7),
                    "maxOutputTokens": request.max_tokens.unwrap_or(2048),
                }
            }))
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let status = response.status();
        let body = response.text().await.map_err(|e| e.to_string())?;

        if !status.is_success() {
            return Err(format!("Gemini API Error ({}): {}", status, body));
        }

        let json: Value = serde_json::from_str(&body).map_err(|e| e.to_string())?;
        
        let content = json["candidates"][0]["content"]["parts"][0]["text"].as_str()
            .ok_or("Failed to parse content from Gemini response")?
            .to_string();

        let usage = Usage {
            input_tokens: json["usageMetadata"]["promptTokenCount"].as_u64().unwrap_or(0) as u32,
            output_tokens: json["usageMetadata"]["candidatesTokenCount"].as_u64().unwrap_or(0) as u32,
            ..Default::default()
        };

        Ok(CompletionResponse {
            id: "gemini-resp".to_string(), // Gemini doesn't seem to provide a response ID in the same way
            model,
            content,
            usage: Some(usage),
        })
    }

    async fn embed(&self, request: EmbeddingRequest) -> Result<EmbeddingResponse, String> {
        let model = request.model.unwrap_or_else(|| "text-embedding-004".to_string());
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:embedContent?key={}",
            model, self.api_key
        );

        // Gemini embedContent takes a single string or multiple. We'll handle the first input for now as a common pattern,
        // or loop if there are multiple.
        let mut embeddings = Vec::new();
        let mut total_tokens = 0;

        for text in request.input {
            let response = self.client.post(&url)
                .json(&json!({
                    "content": {
                        "parts": [{"text": text}]
                    }
                }))
                .send()
                .await
                .map_err(|e| e.to_string())?;

            let status = response.status();
            let body = response.text().await.map_err(|e| e.to_string())?;

            if !status.is_success() {
                return Err(format!("Gemini Embedding Error ({}): {}", status, body));
            }

            let json: Value = serde_json::from_str(&body).map_err(|e| e.to_string())?;
            
            if let Some(embedding_values) = json["embedding"]["values"].as_array() {
                let vec: Vec<f32> = embedding_values
                    .iter()
                    .map(|v| v.as_f64().unwrap_or(0.0) as f32)
                    .collect();
                embeddings.push(vec);
            }
            
            // Gemini doesn't always return token count in embedContent in the same way, 
            // but we'll try to estimate or use what's there if present.
        }

        let usage = Usage {
            input_tokens: total_tokens,
            ..Default::default()
        };

        Ok(EmbeddingResponse {
            model,
            embeddings,
            usage: Some(usage),
        })
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>, String> {
        use crate::ai_runtime::types::ModelTier;
        Ok(vec![
            ModelInfo {
                id: "gemini-1.5-pro".to_string(),
                name: "Gemini 1.5 Pro".to_string(),
                tier: ModelTier::Tier1,
                context_window: 2000000,
                pricing_input_1m: 1.25,
                pricing_output_1m: 5.0,
            },
            ModelInfo {
                id: "gemini-1.5-flash".to_string(),
                name: "Gemini 1.5 Flash".to_string(),
                tier: ModelTier::Tier2,
                context_window: 1000000,
                pricing_input_1m: 0.075,
                pricing_output_1m: 0.3,
            },
            ModelInfo {
                id: "text-embedding-004".to_string(),
                name: "Text Embedding 004".to_string(),
                tier: ModelTier::Tier3,
                context_window: 2048,
                pricing_input_1m: 0.0,
                pricing_output_1m: 0.0,
            }
        ])
    }
}
