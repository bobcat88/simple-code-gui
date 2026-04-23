pub mod providers;
pub mod types;

use crate::database::DatabaseManager;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use types::{AgentRole, CompletionRequest, CompletionResponse, ModelInfo, ModelTier, RoutingPolicy, TaskType};

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
    settings: Arc<Mutex<Option<Arc<crate::settings_manager::SettingsManager>>>>,
    db: Arc<Mutex<Option<Arc<DatabaseManager>>>>,
}

impl RuntimeManager {
    pub fn new() -> Self {
        Self {
            providers: Arc::new(Mutex::new(HashMap::new())),
            settings: Arc::new(Mutex::new(None)),
            db: Arc::new(Mutex::new(None)),
        }
    }

    pub async fn set_settings_manager(&self, manager: Arc<crate::settings_manager::SettingsManager>) {
        let mut settings = self.settings.lock().await;
        *settings = Some(manager);
    }

    pub async fn set_database_manager(&self, manager: Arc<DatabaseManager>) {
        let mut db = self.db.lock().await;
        *db = Some(manager);
    }

    pub async fn register_provider(&self, provider: Box<dyn AIProvider>) {
        let mut providers = self.providers.lock().await;
        providers.insert(provider.name().to_string(), provider);
    }

    pub async fn sync_settings(&self) -> Result<(), String> {
        let settings_lock = self.settings.lock().await;
        let manager = settings_lock.as_ref().ok_or("Settings manager not set")?;
        let settings = manager.get().await;

        let db_lock = self.db.lock().await;
        let db = db_lock.as_ref();

        for p_config in &settings.ai_runtime.providers {
            if !p_config.enabled {
                continue;
            }

            // Try database first
            let mut api_key = p_config.api_key.clone();
            let mut base_url = p_config.base_url.clone();

            if let Some(db_mgr) = db {
                let db_row = sqlx::query_as::<_, (String, Option<String>)>("SELECT key, base_url FROM api_keys WHERE provider = ?")
                    .bind(&p_config.id)
                    .fetch_optional(&db_mgr.pool)
                    .await
                    .ok()
                    .flatten();
                
                if let Some((key, url)) = db_row {
                    api_key = Some(key);
                    if url.is_some() {
                        base_url = url;
                    }
                }
            }

            if let Some(key) = api_key {
                if key.is_empty() {
                    continue;
                }

                match p_config.id.as_str() {
                    "claude" => {
                        self.register_provider(Box::new(
                            providers::claude::ClaudeProvider::new(key),
                        ))
                        .await;
                    }
                    "gemini" => {
                        self.register_provider(Box::new(
                            providers::gemini::GeminiProvider::new(key),
                        ))
                        .await;
                    }
                    "openai" => {
                        self.register_provider(Box::new(
                            providers::openai::OpenAIProvider::new(
                                key,
                                base_url,
                            ),
                        ))
                        .await;
                    }
                    "ollama" => {
                        self.register_provider(Box::new(
                            providers::ollama::OllamaProvider::new(
                                base_url.or_else(|| Some("http://localhost:11434".to_string())),
                            ),
                        ))
                        .await;
                    }
                    _ => {}
                }
            }
        }
        Ok(())
    }

    pub async fn completion(
        &self,
        provider_name: &str,
        request: CompletionRequest,
    ) -> Result<CompletionResponse, String> {
        let providers = self.providers.lock().await;
        let provider = providers
            .get(provider_name)
            .ok_or_else(|| format!("Provider {} not found", provider_name))?;

        let mut req = request;
        if req.model.is_none() {
            // Pick first model if none specified
            let models = provider.list_models().await?;
            req.model = Some(
                models
                    .first()
                    .ok_or("No models available for provider")?
                    .id
                    .clone(),
            );
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

    async fn resolve_routes(
        &self,
        request: &CompletionRequest,
    ) -> Result<Vec<(String, String)>, String> {
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
            Some(RoutingPolicy::Tiered {
                task,
                allow_fallback,
            }) => {
                let target_tier = match task {
                    TaskType::Reasoning | TaskType::Coding => ModelTier::Tier1,
                    TaskType::Vision | TaskType::Creative => ModelTier::Tier2,
                    TaskType::Fast => ModelTier::Tier3,
                };

                let mut routes: Vec<(String, String)> = all_models
                    .iter()
                    .filter(|(_, m)| m.tier == target_tier)
                    .map(|(p, m)| (p.clone(), m.id.clone()))
                    .collect();

                if *allow_fallback && routes.is_empty() {
                    // Fallback to Tier1 then Tier2 then Tier3
                    for tier in [ModelTier::Tier1, ModelTier::Tier2, ModelTier::Tier3] {
                        routes.extend(
                            all_models
                                .iter()
                                .filter(|(_, m)| m.tier == tier)
                                .map(|(p, m)| (p.clone(), m.id.clone())),
                        );
                    }
                }

                if routes.is_empty() {
                    Err("No models found for tiered policy".to_string())
                } else {
                    Ok(routes)
                }
            }
            Some(RoutingPolicy::CheapFirst) => {
                all_models.sort_by(|(_, a), (_, b)| {
                    a.pricing_input_1m.partial_cmp(&b.pricing_input_1m).unwrap()
                });
                Ok(all_models.into_iter().map(|(p, m)| (p, m.id)).collect())
            }
            Some(RoutingPolicy::QualityFirst) | None => {
                // Default to quality first (Tier1 > Tier2 > Tier3)
                all_models.sort_by(|(_, a), (_, b)| a.tier.partial_cmp(&b.tier).unwrap());
                Ok(all_models.into_iter().map(|(p, m)| (p, m.id)).collect())
            }
            Some(RoutingPolicy::Agent { role }) => {
                let settings_lock = self.settings.lock().await;
                if let Some(settings_manager) = &*settings_lock {
                    let settings = settings_manager.get().await;
                    let role_str = match role {
                        AgentRole::Planner => "planner",
                        AgentRole::Builder => "builder",
                        AgentRole::Reviewer => "reviewer",
                        AgentRole::Researcher => "researcher",
                    };

                    // Find routing policy for this role
                    let policy = settings.ai_runtime.routing.iter().find(|r| r.role == role_str);
                    
                    if let Some(p) = policy {
                        // Check for explicit overrides
                        if let (Some(prov), Some(mod_id)) = (&p.provider_override, &p.model_override) {
                            return Ok(vec![(prov.clone(), mod_id.clone())]);
                        }

                        // Otherwise use the plan
                        if let Some(plan_id) = &p.plan_id {
                            if let Some(plan) = settings.ai_runtime.plans.iter().find(|pl| pl.id == *plan_id) {
                                let model_id = match role {
                                    AgentRole::Planner => &plan.planner_model,
                                    AgentRole::Builder => &plan.builder_model,
                                    AgentRole::Reviewer => &plan.reviewer_model,
                                    AgentRole::Researcher => &plan.researcher_model,
                                };

                                // Find which provider has this model
                                for (prov_name, provider) in providers.iter() {
                                    if let Ok(models) = provider.list_models().await {
                                        if models.iter().any(|m| m.id == *model_id) {
                                            return Ok(vec![(prov_name.clone(), model_id.clone())]);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                
                // Fallback to default quality routing if no agent policy found or settings missing
                all_models.sort_by(|(_, a), (_, b)| a.tier.partial_cmp(&b.tier).unwrap());
                Ok(all_models.into_iter().map(|(p, m)| (p, m.id)).collect())
            }
        }
    }

    pub async fn list_models(&self, provider_name: &str) -> Result<Vec<ModelInfo>, String> {
        let providers = self.providers.lock().await;
        let provider = providers
            .get(provider_name)
            .ok_or_else(|| format!("Provider {} not found", provider_name))?;
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
    runtime: tauri::State<'_, Arc<RuntimeManager>>,
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

    // Trigger runtime sync to reload providers with the new key
    let _ = runtime.sync_settings().await;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use types::{Message, Usage};

    struct MockProvider {
        name: String,
        models: Vec<ModelInfo>,
        fail: bool,
    }

    #[async_trait]
    impl AIProvider for MockProvider {
        fn name(&self) -> &str {
            &self.name
        }

        async fn completion(
            &self,
            request: CompletionRequest,
        ) -> Result<CompletionResponse, String> {
            if self.fail {
                return Err(format!("{} failed", self.name));
            }

            Ok(CompletionResponse {
                id: format!("{}-response", self.name),
                model: request.model.unwrap_or_else(|| "missing".to_string()),
                content: self.name.clone(),
                usage: Some(Usage::default()),
            })
        }

        async fn list_models(&self) -> Result<Vec<ModelInfo>, String> {
            Ok(self.models.clone())
        }

        async fn check_health(&self) -> bool {
            !self.fail
        }
    }

    fn model(id: &str, tier: ModelTier, input_price: f64) -> ModelInfo {
        ModelInfo {
            id: id.to_string(),
            name: id.to_string(),
            tier,
            context_window: 128_000,
            pricing_input_1m: input_price,
            pricing_output_1m: input_price * 4.0,
        }
    }

    fn request(policy: Option<RoutingPolicy>) -> CompletionRequest {
        CompletionRequest {
            messages: vec![Message {
                role: "user".to_string(),
                content: "hello".to_string(),
            }],
            model: None,
            policy,
            temperature: None,
            max_tokens: None,
            stream: None,
        }
    }

    async fn register_mock(
        manager: &RuntimeManager,
        name: &str,
        models: Vec<ModelInfo>,
        fail: bool,
    ) {
        manager
            .register_provider(Box::new(MockProvider {
                name: name.to_string(),
                models,
                fail,
            }))
            .await;
    }

    #[tokio::test]
    async fn dispatch_uses_direct_provider_and_model() {
        let manager = RuntimeManager::new();
        register_mock(
            &manager,
            "openai",
            vec![model("gpt-5.4", ModelTier::Tier1, 2.5)],
            false,
        )
        .await;

        let response = manager
            .dispatch(request(Some(RoutingPolicy::Direct {
                provider: "openai".to_string(),
                model: "gpt-5.4".to_string(),
            })))
            .await
            .expect("direct dispatch should succeed");

        assert_eq!(response.model, "gpt-5.4");
        assert_eq!(response.content, "openai");
    }

    #[tokio::test]
    async fn cheap_first_routes_by_input_price() {
        let manager = RuntimeManager::new();
        register_mock(
            &manager,
            "claude",
            vec![model("claude-haiku", ModelTier::Tier3, 0.25)],
            false,
        )
        .await;
        register_mock(
            &manager,
            "openai",
            vec![model("gpt-nano", ModelTier::Tier3, 0.20)],
            false,
        )
        .await;

        let response = manager
            .dispatch(request(Some(RoutingPolicy::CheapFirst)))
            .await
            .expect("cheap first dispatch should succeed");

        assert_eq!(response.content, "openai");
        assert_eq!(response.model, "gpt-nano");
    }
}
