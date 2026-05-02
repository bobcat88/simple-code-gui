use crate::ai_runtime::types::{
    CacheStrategy, CompletionRequest, CompletionResponse, EmbeddingRequest, EmbeddingResponse,
    ModelInfo, Usage,
};
use crate::ai_runtime::AIProvider;
use reqwest::Client;
use serde_json::{json, Value};

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

fn should_cache_claude_system(request: &CompletionRequest) -> bool {
    request
        .optimization
        .as_ref()
        .and_then(|optimization| optimization.cache.as_ref())
        .is_some_and(|cache| matches!(cache.strategy, CacheStrategy::ProviderNative))
}

fn claude_text_block(text: String, cacheable: bool) -> Value {
    let mut block = json!({
        "type": "text",
        "text": text,
    });
    if cacheable {
        block["cache_control"] = json!({ "type": "ephemeral" });
    }
    block
}

fn apply_claude_optimization_fields(
    body: &mut Value,
    request: &CompletionRequest,
    system_parts: Vec<Value>,
) {
    if !system_parts.is_empty() {
        body["system"] = json!(system_parts);
    }

    let Some(reasoning) = request
        .optimization
        .as_ref()
        .and_then(|optimization| optimization.reasoning.as_ref())
    else {
        return;
    };
    let Some(budget_tokens) = reasoning.budget_tokens else {
        return;
    };
    if budget_tokens < 1024 {
        return;
    }

    body["thinking"] = json!({
        "type": "enabled",
        "budget_tokens": budget_tokens,
    });
    body.as_object_mut()
        .map(|object| object.remove("temperature"));
}

#[async_trait]
impl AIProvider for ClaudeProvider {
    fn name(&self) -> &str {
        "claude"
    }

    async fn completion(&self, request: CompletionRequest) -> Result<CompletionResponse, String> {
        let model = request.model.clone().expect("Model must be specified");

        let mut messages = Vec::new();
        let mut system_parts = Vec::new();
        for msg in &request.messages {
            if msg.role == "system" {
                system_parts.push(claude_text_block(
                    msg.content.clone(),
                    should_cache_claude_system(&request),
                ));
            } else if msg.role == "tool" {
                messages.push(json!({
                    "role": "user",
                    "content": [
                        {
                            "type": "tool_result",
                            "tool_use_id": msg.tool_call_id.clone().unwrap_or_default(),
                            "content": msg.content.clone(),
                        }
                    ]
                }));
            } else if let Some(tool_calls) = &msg.tool_calls {
                let mut content = vec![json!({ "type": "text", "text": msg.content.clone() })];
                for tc in tool_calls {
                    content.push(json!({
                        "type": "tool_use",
                        "id": tc.id,
                        "name": tc.name,
                        "input": serde_json::from_str::<Value>(&tc.arguments).unwrap_or(json!({}))
                    }));
                }
                messages.push(json!({
                    "role": msg.role.clone(),
                    "content": content
                }));
            } else {
                messages.push(json!({
                    "role": msg.role.clone(),
                    "content": msg.content.clone()
                }));
            }
        }

        let mut body = json!({
            "model": model,
            "messages": messages,
            "max_tokens": request.max_tokens.unwrap_or(1024),
            "temperature": request.temperature.unwrap_or(0.7),
        });

        apply_claude_optimization_fields(&mut body, &request, system_parts);

        if let Some(tools) = &request.tools {
            let anthropic_tools: Vec<Value> = tools
                .iter()
                .map(|t| {
                    json!({
                        "name": t.name,
                        "description": t.description,
                        "input_schema": t.parameters
                    })
                })
                .collect();
            body["tools"] = json!(anthropic_tools);

            if let Some(choice) = &request.tool_choice {
                body["tool_choice"] = json!({ "type": choice });
            }
        }

        let response = self
            .client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let status = response.status();
        let body_text = response.text().await.map_err(|e| e.to_string())?;

        if !status.is_success() {
            return Err(format!("Claude API Error ({}): {}", status, body_text));
        }

        let json: Value = serde_json::from_str(&body_text).map_err(|e| e.to_string())?;

        let mut content = String::new();
        let mut tool_calls = Vec::new();

        if let Some(content_blocks) = json["content"].as_array() {
            for block in content_blocks {
                match block["type"].as_str() {
                    Some("text") => {
                        if let Some(text) = block["text"].as_str() {
                            content.push_str(text);
                        }
                    }
                    Some("tool_use") => {
                        tool_calls.push(crate::ai_runtime::types::ToolCall {
                            id: block["id"].as_str().unwrap_or_default().to_string(),
                            name: block["name"].as_str().unwrap_or_default().to_string(),
                            arguments: block["input"].to_string(),
                        });
                    }
                    _ => {}
                }
            }
        }

        let usage = Usage {
            input_tokens: json["usage"]["input_tokens"].as_u64().unwrap_or(0) as u32,
            output_tokens: json["usage"]["output_tokens"].as_u64().unwrap_or(0) as u32,
            ..Default::default()
        };

        Ok(CompletionResponse {
            id: json["id"].as_str().unwrap_or("unknown").to_string(),
            model,
            content,
            tool_calls: if tool_calls.is_empty() {
                None
            } else {
                Some(tool_calls)
            },
            usage: Some(usage),
        })
    }

    async fn embed(&self, _request: EmbeddingRequest) -> Result<EmbeddingResponse, String> {
        Err("Claude does not support embeddings currently".to_string())
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
            },
        ])
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai_runtime::types::{
        CacheOptimization, CacheTtl, OptimizationRequest, PromptCacheRetention,
        ReasoningOptimization,
    };

    #[test]
    fn adds_cache_control_to_system_blocks() {
        let request = CompletionRequest {
            optimization: Some(OptimizationRequest {
                cache: Some(CacheOptimization {
                    strategy: CacheStrategy::ProviderNative,
                    ttl: Some(CacheTtl::FiveMinutes),
                    prompt_cache_key: None,
                    retention: Some(PromptCacheRetention::InMemory),
                    cached_content_name: None,
                }),
                ..Default::default()
            }),
            ..Default::default()
        };

        let block = claude_text_block("stable".to_string(), should_cache_claude_system(&request));

        assert_eq!(block["cache_control"]["type"], "ephemeral");
    }

    #[test]
    fn enables_thinking_and_removes_temperature() {
        let request = CompletionRequest {
            optimization: Some(OptimizationRequest {
                reasoning: Some(ReasoningOptimization {
                    effort: None,
                    budget_tokens: Some(4096),
                    include_thoughts: false,
                    preserve_reasoning_items: false,
                }),
                ..Default::default()
            }),
            ..Default::default()
        };
        let mut body = json!({
            "model": "claude-sonnet-4",
            "messages": [],
            "temperature": 0.7,
        });

        apply_claude_optimization_fields(&mut body, &request, vec![]);

        assert_eq!(body["thinking"]["type"], "enabled");
        assert_eq!(body["thinking"]["budget_tokens"], 4096);
        assert!(body.get("temperature").is_none());
    }
}
