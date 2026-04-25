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

        let mut system_instruction = None;
        let contents: Vec<Value> = request.messages.iter().filter_map(|m| {
            if m.role == "system" {
                system_instruction = Some(json!({
                    "parts": [{"text": m.content}]
                }));
                return None;
            }

            let mut parts = Vec::new();
            
            if !m.content.is_empty() {
                parts.push(json!({"text": m.content}));
            }

            if let Some(tool_calls) = &m.tool_calls {
                for tc in tool_calls {
                    parts.push(json!({
                        "functionCall": {
                            "name": tc.name,
                            "args": serde_json::from_str::<Value>(&tc.arguments).unwrap_or(json!({}))
                        }
                    }));
                }
            }

            if let Some(tool_call_id) = &m.tool_call_id {
                // In Gemini, the tool_call_id (if we use it as the function name) 
                // maps to the functionResponse part.
                parts.push(json!({
                    "functionResponse": {
                        "name": tool_call_id,
                        "response": { "content": m.content }
                    }
                }));
            }

            Some(json!({
                "role": if m.role == "user" || m.role == "tool" { "user" } else { "model" },
                "parts": parts
            }))
        }).collect();

        let mut body = json!({
            "contents": contents,
            "generationConfig": {
                "temperature": request.temperature.unwrap_or(0.7),
                "maxOutputTokens": request.max_tokens.unwrap_or(2048),
            }
        });

        if let Some(sys) = system_instruction {
            body["systemInstruction"] = sys;
        }

        if let Some(tools) = request.tools {
            let function_declarations: Vec<Value> = tools.into_iter().map(|t| json!({
                "name": t.name,
                "description": t.description,
                "parameters": t.parameters,
            })).collect();
            
            body["tools"] = json!([{
                "functionDeclarations": function_declarations
            }]);
        }

        let response = self.client.post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let status = response.status();
        let body_text = response.text().await.map_err(|e| e.to_string())?;

        if !status.is_success() {
            return Err(format!("Gemini API Error ({}): {}", status, body_text));
        }

        let json: Value = serde_json::from_str(&body_text).map_err(|e| e.to_string())?;
        
        let candidate = &json["candidates"][0];
        let mut content = String::new();
        let mut tool_calls = None;

        if let Some(parts) = candidate["content"]["parts"].as_array() {
            let mut calls = Vec::new();
            for part in parts {
                if let Some(text) = part["text"].as_str() {
                    content.push_str(text);
                }
                if let Some(call) = part["functionCall"].as_object() {
                    calls.push(crate::ai_runtime::types::ToolCall {
                        id: call["name"].as_str().unwrap_or("").to_string(), // Use name as ID for Gemini
                        name: call["name"].as_str().unwrap_or("").to_string(),
                        arguments: call["args"].to_string(),
                    });
                }
            }
            if !calls.is_empty() {
                tool_calls = Some(calls);
            }
        }

        let usage = Usage {
            input_tokens: json["usageMetadata"]["promptTokenCount"].as_u64().unwrap_or(0) as u32,
            output_tokens: json["usageMetadata"]["candidatesTokenCount"].as_u64().unwrap_or(0) as u32,
            ..Default::default()
        };

        Ok(CompletionResponse {
            id: "gemini-resp".to_string(),
            model,
            content,
            tool_calls,
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
        let total_tokens = 0;

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
