#![allow(dead_code)]

use std::collections::HashMap;
use std::sync::Arc;

use redis::AsyncCommands;
use tokio::sync::Mutex;

use super::types::{CompletionRequest, CompletionResponse};

#[derive(Clone)]
pub struct SemanticCache {
    backend: CacheBackend,
    similarity_threshold: f32,
}

#[derive(Clone)]
enum CacheBackend {
    Disabled,
    Memory(Arc<Mutex<HashMap<String, CompletionResponse>>>),
    Redis(Arc<Mutex<redis::aio::ConnectionManager>>),
}

impl SemanticCache {
    pub fn disabled() -> Self {
        Self {
            backend: CacheBackend::Disabled,
            similarity_threshold: 0.95,
        }
    }

    pub fn memory() -> Self {
        Self {
            backend: CacheBackend::Memory(Arc::new(Mutex::new(HashMap::new()))),
            similarity_threshold: 0.95,
        }
    }

    pub async fn redis(redis_url: Option<&str>) -> Self {
        let Some(redis_url) = redis_url else {
            return Self::disabled();
        };
        let Ok(client) = redis::Client::open(redis_url) else {
            return Self::disabled();
        };
        match client.get_connection_manager().await {
            Ok(connection) => Self {
                backend: CacheBackend::Redis(Arc::new(Mutex::new(connection))),
                similarity_threshold: 0.95,
            },
            Err(_) => Self::disabled(),
        }
    }

    pub fn similarity_threshold(&self) -> f32 {
        self.similarity_threshold
    }

    pub async fn get(&self, request: &CompletionRequest) -> Option<CompletionResponse> {
        let key = cache_key(request);
        match &self.backend {
            CacheBackend::Disabled => None,
            CacheBackend::Memory(cache) => cache.lock().await.get(&key).cloned(),
            CacheBackend::Redis(connection) => {
                let mut connection = connection.lock().await;
                let payload: Option<String> = connection.get(&key).await.ok()?;
                serde_json::from_str(&payload?).ok()
            }
        }
    }

    pub async fn set(&self, request: &CompletionRequest, response: &CompletionResponse) {
        let key = cache_key(request);
        match &self.backend {
            CacheBackend::Disabled => {}
            CacheBackend::Memory(cache) => {
                cache.lock().await.insert(key, response.clone());
            }
            CacheBackend::Redis(connection) => {
                if let Ok(payload) = serde_json::to_string(response) {
                    let mut connection = connection.lock().await;
                    let _: redis::RedisResult<()> = connection.set(key, payload).await;
                }
            }
        }
    }
}

pub fn cache_key(request: &CompletionRequest) -> String {
    let mut material = String::new();
    material.push_str(request.project_path.as_deref().unwrap_or("global"));
    material.push('\n');
    material.push_str(request.session_id.as_deref().unwrap_or("sessionless"));
    material.push('\n');
    material.push_str(request.model.as_deref().unwrap_or("model"));
    for message in &request.messages {
        material.push('\n');
        material.push_str(&message.role);
        material.push(':');
        material.push_str(&message.content);
    }
    format!("simple-code-gui:semantic-cache:{:x}", md5::compute(material))
}

pub fn cosine_similarity(a: &[f32], b: &[f32]) -> Option<f32> {
    if a.len() != b.len() || a.is_empty() {
        return None;
    }
    let mut dot = 0.0;
    let mut norm_a = 0.0;
    let mut norm_b = 0.0;
    for (left, right) in a.iter().zip(b.iter()) {
        dot += left * right;
        norm_a += left * left;
        norm_b += right * right;
    }
    if norm_a == 0.0 || norm_b == 0.0 {
        return None;
    }
    Some(dot / (norm_a.sqrt() * norm_b.sqrt()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai_runtime::types::{Message, Usage};

    #[test]
    fn cache_key_is_project_scoped() {
        let mut left = request("a");
        let mut right = request("b");
        left.project_path = Some("/repo/a".to_string());
        right.project_path = Some("/repo/b".to_string());

        assert_ne!(cache_key(&left), cache_key(&right));
    }

    #[test]
    fn cosine_similarity_scores_vectors() {
        assert_eq!(cosine_similarity(&[1.0, 0.0], &[1.0, 0.0]), Some(1.0));
        assert_eq!(cosine_similarity(&[1.0], &[1.0, 0.0]), None);
    }

    #[tokio::test]
    async fn memory_cache_round_trips_response() {
        let cache = SemanticCache::memory();
        let request = request("hello");
        let response = CompletionResponse {
            id: "cached".to_string(),
            model: "model".to_string(),
            content: "response".to_string(),
            tool_calls: None,
            usage: Some(Usage::default()),
        };

        cache.set(&request, &response).await;

        assert_eq!(cache.get(&request).await.unwrap().content, "response");
    }

    fn request(content: &str) -> CompletionRequest {
        CompletionRequest {
            messages: vec![Message {
                role: "user".to_string(),
                content: content.to_string(),
                tool_calls: None,
                tool_call_id: None,
            }],
            model: Some("model".to_string()),
            ..Default::default()
        }
    }
}
