pub mod providers;
pub mod types;

use crate::database::{DatabaseManager, insert_token_transaction, TokenTransactionInput};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use types::{AgentRole, CompletionRequest, CompletionResponse, ModelInfo, ModelTier, RoutingPolicy, TaskType, Usage};

use async_trait::async_trait;

#[async_trait]
pub trait AIProvider: Send + Sync {
    fn name(&self) -> &str;
    async fn completion(&self, request: CompletionRequest) -> Result<CompletionResponse, String>;
    async fn list_models(&self) -> Result<Vec<ModelInfo>, String>;
    async fn check_health(&self) -> bool;
}

#[derive(Debug, Clone)]
struct HealthInfo {
    last_failure: Option<std::time::Instant>,
    consecutive_failures: u32,
    is_degraded: bool,
}

pub struct RuntimeManager {
    providers: Arc<Mutex<HashMap<String, Box<dyn AIProvider>>>>,
    settings: Arc<Mutex<Option<Arc<crate::settings_manager::SettingsManager>>>>,
    db: Arc<Mutex<Option<Arc<DatabaseManager>>>>,
    agents: Arc<Mutex<Option<Arc<crate::agent_manager::AgentManager>>>>,
    health: Arc<Mutex<HashMap<String, HealthInfo>>>,
}

impl RuntimeManager {
    pub fn new() -> Self {
        Self {
            providers: Arc::new(Mutex::new(HashMap::new())),
            settings: Arc::new(Mutex::new(None)),
            db: Arc::new(Mutex::new(None)),
            agents: Arc::new(Mutex::new(None)),
            health: Arc::new(Mutex::new(HashMap::new())),
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

    pub async fn set_agent_manager(&self, manager: Arc<crate::agent_manager::AgentManager>) {
        let mut agents = self.agents.lock().await;
        *agents = Some(manager);
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

    async fn record_success(&self, provider_name: &str) {
        let mut health = self.health.lock().await;
        let entry = health.entry(provider_name.to_string()).or_insert(HealthInfo {
            last_failure: None,
            consecutive_failures: 0,
            is_degraded: false,
        });
        entry.consecutive_failures = 0;
        entry.is_degraded = false;
    }

    async fn record_failure(&self, provider_name: &str) {
        let mut health = self.health.lock().await;
        let entry = health.entry(provider_name.to_string()).or_insert(HealthInfo {
            last_failure: None,
            consecutive_failures: 0,
            is_degraded: false,
        });
        entry.consecutive_failures += 1;
        entry.last_failure = Some(std::time::Instant::now());
        
        // Mark as degraded if more than 3 failures
        if entry.consecutive_failures >= 3 {
            entry.is_degraded = true;
        }
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

        let mut req = request.clone();
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

        let model_id = req.model.clone().unwrap();
        let mut resp = provider.completion(req).await?;
        
        // Finalize usage if success
        self.finalize_usage(provider_name, &model_id, &mut resp, &request).await;
        
        Ok(resp)
    }

    pub async fn dispatch(&self, request: CompletionRequest) -> Result<CompletionResponse, String> {
        let routes = self.resolve_routes(&request).await?;
        let retry_config = request.retry.clone().unwrap_or_default();

        let mut last_error = "No suitable routes found".to_string();
        for (provider_name, model_id) in routes {
            // Check health before trying
            {
                let health = self.health.lock().await;
                if let Some(info) = health.get(&provider_name) {
                    if info.is_degraded {
                        // Check if we should "retry" the degraded provider after some time (60s)
                        if let Some(last) = info.last_failure {
                            if last.elapsed().as_secs() < 60 {
                                continue; // Skip degraded provider
                            }
                        }
                    }
                }
            }

            let mut req = request.clone();
            req.model = Some(model_id.clone());

            let mut attempt = 0;
            let mut delay = retry_config.initial_delay_ms;

            while attempt <= retry_config.max_retries {
                match self.completion(&provider_name, req.clone()).await {
                    Ok(resp) => {
                        self.record_success(&provider_name).await;
                        return Ok(resp);
                    }
                    Err(e) => {
                        attempt += 1;
                        last_error = format!("{} ({}): attempt {}: {}", provider_name, model_id, attempt, e);
                        
                        if attempt <= retry_config.max_retries {
                            tokio::time::sleep(std::time::Duration::from_millis(delay)).await;
                            delay = (delay as f32 * retry_config.backoff_factor) as u64;
                            delay = delay.min(retry_config.max_delay_ms);
                        }
                    }
                }
            }
            
            // If all retries on THIS provider failed, record failure and move to next provider
            self.record_failure(&provider_name).await;
        }

        Err(format!("Dispatch failed after all retries and fallbacks: {}", last_error))
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
                // For direct, we still check if provider is registered
                if providers.contains_key(provider) {
                    Ok(vec![(provider.clone(), model.clone())])
                } else {
                    Err(format!("Provider {} not found for direct routing", provider))
                }
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
            Some(RoutingPolicy::QualityFirst) => {
                // Default to quality first (Tier1 > Tier2 > Tier3)
                // WITHIN tiers, sort by quality_score from agent metrics
                let agents_lock = self.agents.lock().await;
                let mut model_metrics = HashMap::new();

                if let Some(agent_manager) = &*agents_lock {
                    if let Ok(agents) = agent_manager.list().await {
                        for agent in agents {
                            if let (Some(prov), Some(mod_id)) = (agent.provider, agent.model) {
                                let entry = model_metrics.entry((prov, mod_id)).or_insert((0.0, 0, 0.0));
                                entry.0 += agent.quality_score.unwrap_or(0.0);
                                entry.1 += 1;
                                entry.2 += agent.error_rate.unwrap_or(0.0);
                            }
                        }
                    }
                }

                all_models.sort_by(|(p_a, m_a), (p_b, m_b)| {
                    // 1. Tier (Tier1 > Tier2 > Tier3)
                    let tier_cmp = m_a.tier.partial_cmp(&m_b.tier).unwrap();
                    if tier_cmp != std::cmp::Ordering::Equal {
                        return tier_cmp;
                    }

                    // 2. Error Rate (Lower is better)
                    let metrics_a = model_metrics.get(&(p_a.clone(), m_a.id.clone()));
                    let metrics_b = model_metrics.get(&(p_b.clone(), m_b.id.clone()));

                    let e_a = metrics_a.map(|m| m.2 / m.1 as f64).unwrap_or(0.0);
                    let e_b = metrics_b.map(|m| m.2 / m.1 as f64).unwrap_or(0.0);
                    let e_cmp = e_a.partial_cmp(&e_b).unwrap();
                    if e_cmp != std::cmp::Ordering::Equal {
                        return e_cmp;
                    }

                    // 3. Quality Score (Higher is better)
                    let s_a = metrics_a.map(|m| m.0 / m.1 as f64).unwrap_or(0.0);
                    let s_b = metrics_b.map(|m| m.0 / m.1 as f64).unwrap_or(0.0);

                    s_b.partial_cmp(&s_a).unwrap()
                });
                Ok(all_models.into_iter().map(|(p, m)| (p, m.id)).collect())
            }
            Some(RoutingPolicy::LatencyFirst) => {
                // Heuristic: Tier3 is fastest, then Tier2, then Tier1
                // WITHIN tiers, we sort by agent metrics (lowest queue, highest burn rate)
                let agents_lock = self.agents.lock().await;
                let mut model_metrics = HashMap::new();

                if let Some(agent_manager) = &*agents_lock {
                    if let Ok(agents) = agent_manager.list().await {
                        for agent in agents {
                            if let (Some(prov), Some(mod_id)) = (agent.provider, agent.model) {
                                let entry = model_metrics.entry((prov, mod_id)).or_insert((0, 0.0, 0, 0.0));
                                entry.0 += agent.queue_size.unwrap_or(0);
                                entry.1 += agent.burn_rate.unwrap_or(0.0);
                                entry.2 += 1;
                                entry.3 += agent.error_rate.unwrap_or(0.0);
                            }
                        }
                    }
                }

                all_models.sort_by(|(p_a, m_a), (p_b, m_b)| {
                    // 1. Tier (Tier3 > Tier2 > Tier1)
                    let tier_cmp = m_b.tier.partial_cmp(&m_a.tier).unwrap();
                    if tier_cmp != std::cmp::Ordering::Equal {
                        return tier_cmp;
                    }

                    // 2. Error Rate (Lower is better)
                    let metrics_a = model_metrics.get(&(p_a.clone(), m_a.id.clone()));
                    let metrics_b = model_metrics.get(&(p_b.clone(), m_b.id.clone()));

                    let e_a = metrics_a.map(|m| m.3 / m.2 as f64).unwrap_or(0.0);
                    let e_b = metrics_b.map(|m| m.3 / m.2 as f64).unwrap_or(0.0);
                    let e_cmp = e_a.partial_cmp(&e_b).unwrap();
                    if e_cmp != std::cmp::Ordering::Equal {
                        return e_cmp;
                    }

                    // 3. Queue Size (Lower is better)
                    let q_a = metrics_a.map(|m| m.0 as f64 / m.2 as f64).unwrap_or(0.0);
                    let q_b = metrics_b.map(|m| m.0 as f64 / m.2 as f64).unwrap_or(0.0);

                    let q_cmp = q_a.partial_cmp(&q_b).unwrap();
                    if q_cmp != std::cmp::Ordering::Equal {
                        return q_cmp;
                    }

                    // 3. Burn Rate (Higher is better)
                    let b_a = metrics_a.map(|m| m.1 / m.2 as f64).unwrap_or(0.0);
                    let b_b = metrics_b.map(|m| m.1 / m.2 as f64).unwrap_or(0.0);

                    b_b.partial_cmp(&b_a).unwrap()
                });
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
            Some(RoutingPolicy::Auto) | None => {
                // Intelligent routing: check settings first
                let settings_lock = self.settings.lock().await;
                if let Some(settings_manager) = &*settings_lock {
                    let settings = settings_manager.get().await;
                    
                    // Map strategy string to internal policy
                    let strategy = match settings.ai_runtime.default_strategy.as_str() {
                        "cheap" => Some(RoutingPolicy::CheapFirst),
                        "latency" => Some(RoutingPolicy::LatencyFirst),
                        "auto" => {
                            // Intelligent Auto: Pick best tier, but load balance within it
                            let mut target_models = all_models.clone();
                            
                            // Sort by Tier (Quality) first
                            target_models.sort_by(|(_, a), (_, b)| a.tier.partial_cmp(&b.tier).unwrap());
                            
                            if let Some((_, first_m)) = target_models.first() {
                                let best_tier = first_m.tier;
                                let mut best_tier_models: Vec<(String, ModelInfo)> = target_models.into_iter()
                                    .filter(|(_, m)| m.tier == best_tier)
                                    .collect();

                                // Now load balance within the best tier using metrics
                                let agents_lock = self.agents.lock().await;
                                let mut model_metrics = HashMap::new();

                                if let Some(agent_manager) = &*agents_lock {
                                    if let Ok(agents) = agent_manager.list().await {
                                        for agent in agents {
                                            if let (Some(prov), Some(mod_id)) = (agent.provider, agent.model) {
                                                let entry = model_metrics.entry((prov, mod_id)).or_insert((0, 0.0, 0, 0.0, 0.0));
                                                entry.0 += agent.queue_size.unwrap_or(0);
                                                entry.1 += agent.burn_rate.unwrap_or(0.0);
                                                entry.2 += 1;
                                                entry.3 += agent.quality_score.unwrap_or(0.0);
                                                entry.4 += agent.error_rate.unwrap_or(0.0);
                                            }
                                        }
                                    }
                                }

                                best_tier_models.sort_by(|(p_a, m_a), (p_b, m_b)| {
                                    let metrics_a = model_metrics.get(&(p_a.clone(), m_a.id.clone()));
                                    let metrics_b = model_metrics.get(&(p_b.clone(), m_b.id.clone()));

                                    // 1. Error Rate (Lower is better)
                                    let e_a = metrics_a.map(|m| m.4 / m.2 as f64).unwrap_or(0.0);
                                    let e_b = metrics_b.map(|m| m.4 / m.2 as f64).unwrap_or(0.0);
                                    let e_cmp = e_a.partial_cmp(&e_b).unwrap();
                                    if e_cmp != std::cmp::Ordering::Equal {
                                        return e_cmp;
                                    }

                                    // 2. Quality Score (Higher is better)
                                    let s_a = metrics_a.map(|m| m.3 / m.2 as f64).unwrap_or(0.0);
                                    let s_b = metrics_b.map(|m| m.3 / m.2 as f64).unwrap_or(0.0);
                                    let s_cmp = s_b.partial_cmp(&s_a).unwrap();
                                    if s_cmp != std::cmp::Ordering::Equal {
                                        return s_cmp;
                                    }

                                    // 3. Queue Size (Lower is better)
                                    let q_a = metrics_a.map(|m| m.0 as f64 / m.2 as f64).unwrap_or(0.0);
                                    let q_b = metrics_b.map(|m| m.0 as f64 / m.2 as f64).unwrap_or(0.0);

                                    let q_cmp = q_a.partial_cmp(&q_b).unwrap();
                                    if q_cmp != std::cmp::Ordering::Equal {
                                        return q_cmp;
                                    }

                                    // 4. Burn Rate (Higher is better)
                                    let b_a = metrics_a.map(|m| m.1 / m.2 as f64).unwrap_or(0.0);
                                    let b_b = metrics_b.map(|m| m.1 / m.2 as f64).unwrap_or(0.0);
                                    b_b.partial_cmp(&b_a).unwrap()
                                });

                                return Ok(best_tier_models.into_iter().map(|(p, m)| (p, m.id)).collect());
                            }
                            None
                        }
                        _ => Some(RoutingPolicy::QualityFirst), // Default to quality
                    };

                    if let Some(p) = strategy {
                        // Recurse with the derived strategy
                        let mut req = request.clone();
                        req.policy = Some(p);
                        return Box::pin(self.resolve_routes(&req)).await;
                    }
                }
                
                // Fallback to quality first
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

    async fn finalize_usage(
        &self,
        provider_name: &str,
        model_id: &str,
        response: &mut CompletionResponse,
        request: &CompletionRequest,
    ) {
        if let Some(usage) = &mut response.usage {
            // 1. Get model info for pricing
            let providers = self.providers.lock().await;
            let provider = providers.get(provider_name);
            let mut pricing = (0.0, 0.0); // (input, output)

            if let Some(p) = provider {
                if let Ok(models) = p.list_models().await {
                    if let Some(m) = models.iter().find(|m| m.id == model_id) {
                        pricing = (m.pricing_input_1m, m.pricing_output_1m);
                    }
                }
            }

            // 2. Calculate cost
            let input_cost = (usage.input_tokens as f64 / 1_000_000.0) * pricing.0;
            let output_cost = (usage.output_tokens as f64 / 1_000_000.0) * pricing.1;
            let total_cost = input_cost + output_cost;
            usage.cost_estimate = Some(total_cost);

            // 3. Record transaction to database
            let db_lock = self.db.lock().await;
            if let Some(db) = &*db_lock {
                let transaction = TokenTransactionInput {
                    session_id: request.session_id.clone().unwrap_or_else(|| "default".to_string()),
                    project_path: request.project_path.clone().unwrap_or_else(|| "none".to_string()),
                    backend: provider_name.to_string(),
                    input_tokens: usage.input_tokens as i64,
                    output_tokens: usage.output_tokens as i64,
                    cost_estimate: total_cost,
                    timestamp: None,
                };
                let _ = insert_token_transaction(&db.pool, &transaction).await;
            }
        }
    }
}

#[tauri::command]
pub async fn ai_dispatch(
    manager: tauri::State<'_, Arc<RuntimeManager>>,
    orchestration: tauri::State<'_, crate::orchestration::OrchestrationState>,
    mut request: CompletionRequest,
) -> Result<CompletionResponse, String> {
    if request.project_path.is_none() {
        request.project_path = orchestration.current_project_path.lock().clone();
    }
    manager.dispatch(request).await
}

#[tauri::command]
pub async fn ai_completion(
    manager: tauri::State<'_, Arc<RuntimeManager>>,
    orchestration: tauri::State<'_, crate::orchestration::OrchestrationState>,
    provider: String,
    mut request: CompletionRequest,
) -> Result<CompletionResponse, String> {
    if request.project_path.is_none() {
        request.project_path = orchestration.current_project_path.lock().clone();
    }
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
