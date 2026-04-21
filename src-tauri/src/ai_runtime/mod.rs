pub mod types;
pub mod providers;

use types::{CompletionRequest, CompletionResponse, ModelInfo, RoutingPolicy, TaskType, ModelTier};
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
        
        let mut req = request;
        if req.model.is_none() {
            // Pick first model if none specified
            let models = provider.list_models().await?;
            req.model = Some(models.first().ok_or("No models available for provider")?.id.clone());
        }
        
        provider.completion(req).await
    }

    pub async fn dispatch(&self, request: CompletionRequest) -> Result<CompletionResponse, String> {
        let routes = self.resolve_routes(&request).await?;
        
        let mut last_error = "No suitable routes found".to_string();
        for (provider_name, model_id) in routes {
            let mut req = request.clone();
            req.model = Some(model_id.clone());
            
            match self.completion(&provider_name, req).await {
                Ok(resp) => return Ok(resp),
                Err(e) => {
                    last_error = format!("{} ({}): {}", provider_name, model_id, e);
                    continue;
                }
            }
        }
        
        Err(format!("Dispatch failed: {}", last_error))
    }

    async fn resolve_routes(&self, request: &CompletionRequest) -> Result<Vec<(String, String)>, String> {
        let providers = self.providers.lock().await;
        let mut all_models = Vec::new();
        for (name, provider) in providers.iter() {
            if let Ok(models) = provider.list_models().await {
                for m in models {
                    all_models.push((name.clone(), m));
                }
            }
        }

        match &request.policy {
            Some(RoutingPolicy::Direct { provider, model }) => {
                Ok(vec![(provider.clone(), model.clone())])
            }
            Some(RoutingPolicy::Tiered { task, allow_fallback }) => {
                let target_tier = match task {
                    TaskType::Reasoning | TaskType::Coding => ModelTier::Tier1,
                    TaskType::Vision | TaskType::Creative => ModelTier::Tier2,
                    TaskType::Fast => ModelTier::Tier3,
                };

                let mut routes: Vec<(String, String)> = all_models.iter()
                    .filter(|(_, m)| m.tier == target_tier)
                    .map(|(p, m)| (p.clone(), m.id.clone()))
                    .collect();

                if *allow_fallback && routes.is_empty() {
                    // Fallback to Tier1 then Tier2 then Tier3
                    for tier in [ModelTier::Tier1, ModelTier::Tier2, ModelTier::Tier3] {
                        routes.extend(all_models.iter()
                            .filter(|(_, m)| m.tier == tier)
                            .map(|(p, m)| (p.clone(), m.id.clone())));
                    }
                }
                
                if routes.is_empty() {
                    Err("No models found for tiered policy".to_string())
                } else {
                    Ok(routes)
                }
            }
            Some(RoutingPolicy::CheapFirst) => {
                all_models.sort_by(|(_, a), (_, b)| a.pricing_input_1m.partial_cmp(&b.pricing_input_1m).unwrap());
                Ok(all_models.into_iter().map(|(p, m)| (p, m.id)).collect())
            }
            Some(RoutingPolicy::QualityFirst) | None => {
                // Default to quality first (Tier1 > Tier2 > Tier3)
                all_models.sort_by(|(_, a), (_, b)| a.tier.partial_cmp(&b.tier).unwrap());
                Ok(all_models.into_iter().map(|(p, m)| (p, m.id)).collect())
            }
        }
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
pub async fn ai_dispatch(
    manager: tauri::State<'_, Arc<RuntimeManager>>,
    request: CompletionRequest,
) -> Result<CompletionResponse, String> {
    manager.dispatch(request).await
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
