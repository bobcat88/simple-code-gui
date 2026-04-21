pub mod types;
pub mod providers;

use types::{CompletionRequest, CompletionResponse, ModelInfo};
use std::sync::Arc;
use tokio::sync::Mutex;
use std::collections::HashMap;
use crate::database::DatabaseManager;

use async_trait::async_trait;

#[async_trait]
pub trait AIProvider: Send + Sync {
    fn name(&self) -> &str;
    async fn completion(&self, request: CompletionRequest) -> Result<CompletionResponse, String>;
    async fn list_models(&self) -> Result<Vec<ModelInfo>, String>;
    async fn check_health(&self) -> bool;
}

pub struct RuntimeManager {
    providers: Arc<Mutex<HashMap<String, Box<dyn AIProvider>>>>,
}

impl RuntimeManager {
    pub fn new() -> Self {
        Self {
            providers: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn register_provider(&self, provider: Box<dyn AIProvider>) {
        let mut providers = self.providers.lock().await;
        providers.insert(provider.name().to_string(), provider);
    }

    pub async fn completion(&self, provider_name: &str, request: CompletionRequest) -> Result<CompletionResponse, String> {
        let providers = self.providers.lock().await;
        let provider = providers.get(provider_name).ok_or_else(|| format!("Provider {} not found", provider_name))?;
        provider.completion(request).await
    }

    pub async fn list_models(&self, provider_name: &str) -> Result<Vec<ModelInfo>, String> {
        let providers = self.providers.lock().await;
        let provider = providers.get(provider_name).ok_or_else(|| format!("Provider {} not found", provider_name))?;
        provider.list_models().await
    }

    pub async fn list_providers(&self) -> Vec<String> {
        let providers = self.providers.lock().await;
        providers.keys().cloned().collect()
    }
}

#[tauri::command]
pub async fn ai_completion(
    manager: tauri::State<'_, Arc<RuntimeManager>>,
    provider: String,
    request: CompletionRequest,
) -> Result<CompletionResponse, String> {
    manager.completion(&provider, request).await
}

#[tauri::command]
pub async fn ai_list_models(
    manager: tauri::State<'_, Arc<RuntimeManager>>,
    provider: String,
) -> Result<Vec<ModelInfo>, String> {
    manager.list_models(&provider).await
}

#[tauri::command]
pub async fn ai_list_providers(
    manager: tauri::State<'_, Arc<RuntimeManager>>,
) -> Result<Vec<String>, String> {
    Ok(manager.list_providers().await)
}

#[tauri::command]
pub async fn ai_save_key(
    db: tauri::State<'_, Arc<DatabaseManager>>,
    provider: String,
    key: String,
    base_url: Option<String>,
) -> Result<(), String> {
    sqlx::query("INSERT OR REPLACE INTO api_keys (provider, key, base_url) VALUES (?, ?, ?)")
        .bind(provider)
        .bind(key)
        .bind(base_url)
        .execute(&db.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
