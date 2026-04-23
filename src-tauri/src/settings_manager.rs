use serde::{Deserialize, Serialize};
use std::fs;
use tauri::{AppHandle, Manager};
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::database::DatabaseManager;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfig {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub models: Vec<String>,
    pub default_model: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModelPlan {
    pub id: String,
    pub name: String,
    pub description: String,
    pub planner_model: String,
    pub builder_model: String,
    pub reviewer_model: String,
    pub researcher_model: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AgentRoutingPolicy {
    pub role: String,
    pub plan_id: Option<String>,
    pub model_override: Option<String>,
    pub provider_override: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiRuntimeSettings {
    pub providers: Vec<ProviderConfig>,
    pub plans: Vec<ModelPlan>,
    pub routing: Vec<AgentRoutingPolicy>,
    pub active_plan_id: String,
    pub default_strategy: String, // "quality", "cheap", "latency", "auto"
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub default_project_dir: String,
    pub theme: String,
    pub permission_mode: String,
    pub auto_accept_tools: Vec<String>,
    pub backend: String,
    #[serde(default)]
    pub tts_voice: String,
    #[serde(default)]
    pub tts_engine: String,
    #[serde(default = "default_tts_speed")]
    pub tts_speed: f32,
    #[serde(default = "default_true")]
    pub glow_enabled: bool,
    #[serde(default = "default_accent")]
    pub accent_color: String,
    #[serde(default)]
    pub xtts_temperature: f32,
    #[serde(default)]
    pub xtts_top_k: u32,
    #[serde(default)]
    pub xtts_top_p: f32,
    #[serde(default)]
    pub xtts_repetition_penalty: f32,
    #[serde(default = "default_true")]
    pub auto_scan_enabled: bool,
    #[serde(default = "default_auto_scan_interval")]
    pub auto_scan_interval: u64, // seconds
    #[serde(default = "default_tada_voice")]
    pub tada_voice_sample: String,
    #[serde(default = "default_ai_runtime")]
    pub ai_runtime: AiRuntimeSettings,
}

fn default_true() -> bool { true }
fn default_accent() -> String { String::from("#3b82f6") }
fn default_auto_scan_interval() -> u64 { 3600 } // 1 hour
fn default_tts_speed() -> f32 { 1.0 }
fn default_tada_voice() -> String { String::from("v2/en_3") }

fn default_ai_runtime() -> AiRuntimeSettings {
    AiRuntimeSettings {
        providers: vec![
            ProviderConfig {
                id: "claude".to_string(),
                name: "Anthropic Claude".to_string(),
                enabled: true,
                api_key: None,
                base_url: None,
                models: vec!["claude-3-5-sonnet".to_string(), "claude-3-opus".to_string(), "claude-3-haiku".to_string()],
                default_model: Some("claude-3-5-sonnet".to_string()),
            },
            ProviderConfig {
                id: "gemini".to_string(),
                name: "Google Gemini".to_string(),
                enabled: true,
                api_key: None,
                base_url: None,
                models: vec!["gemini-1.5-pro".to_string(), "gemini-1.5-flash".to_string()],
                default_model: Some("gemini-1.5-pro".to_string()),
            },
            ProviderConfig {
                id: "openai".to_string(),
                name: "OpenAI / Codex".to_string(),
                enabled: false,
                api_key: None,
                base_url: None,
                models: vec!["gpt-4o".to_string(), "gpt-4-turbo".to_string(), "gpt-3.5-turbo".to_string()],
                default_model: Some("gpt-4o".to_string()),
            },
            ProviderConfig {
                id: "ollama".to_string(),
                name: "Local Ollama".to_string(),
                enabled: false,
                api_key: None,
                base_url: Some("http://localhost:11434".to_string()),
                models: vec!["llama3".to_string(), "codellama".to_string(), "mistral".to_string()],
                default_model: Some("llama3".to_string()),
            },
        ],
        plans: vec![
            ModelPlan {
                id: "balanced".to_string(),
                name: "Balanced".to_string(),
                description: "Optimal mix of speed and intelligence.".to_string(),
                planner_model: "claude-3-5-sonnet".to_string(),
                builder_model: "claude-3-5-sonnet".to_string(),
                reviewer_model: "claude-3-5-sonnet".to_string(),
                researcher_model: "gemini-1.5-flash".to_string(),
            },
            ModelPlan {
                id: "budget".to_string(),
                name: "Budget".to_string(),
                description: "Lowest cost, suitable for simple tasks.".to_string(),
                planner_model: "claude-3-haiku".to_string(),
                builder_model: "claude-3-haiku".to_string(),
                reviewer_model: "claude-3-haiku".to_string(),
                researcher_model: "gemini-1.5-flash".to_string(),
            },
        ],
        routing: vec![
            AgentRoutingPolicy { role: "planner".to_string(), plan_id: Some("balanced".to_string()), model_override: None, provider_override: None },
            AgentRoutingPolicy { role: "builder".to_string(), plan_id: Some("balanced".to_string()), model_override: None, provider_override: None },
            AgentRoutingPolicy { role: "reviewer".to_string(), plan_id: Some("balanced".to_string()), model_override: None, provider_override: None },
            AgentRoutingPolicy { role: "researcher".to_string(), plan_id: Some("balanced".to_string()), model_override: None, provider_override: None },
        ],
        active_plan_id: "balanced".to_string(),
        default_strategy: "quality".to_string(),
    }
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            default_project_dir: String::new(),
            theme: String::from("default"),
            permission_mode: String::from("default"),
            auto_accept_tools: Vec::new(),
            backend: String::from("default"),
            tts_voice: String::from("en_US-libritts_r-medium"),
            tts_engine: String::from("piper"),
            tts_speed: 1.0,
            glow_enabled: true,
            accent_color: String::from("#3b82f6"),
            xtts_temperature: 0.7,
            xtts_top_k: 50,
            xtts_top_p: 0.8,
            xtts_repetition_penalty: 2.0,
            tada_voice_sample: String::from("v2/en_3"),
            auto_scan_enabled: true,
            auto_scan_interval: 3600,
            ai_runtime: default_ai_runtime(),
        }
    }
}

pub struct SettingsManager {
    db: Arc<DatabaseManager>,
    settings: RwLock<AppSettings>,
}

impl SettingsManager {
    pub async fn new(app: &AppHandle, db: Arc<DatabaseManager>) -> Self {
        let path = app.path().app_config_dir().unwrap().join("settings.json");
        
        // Try to load from DB first
        let db_settings = sqlx::query_as::<_, (String, String)>("SELECT key, value FROM settings WHERE key = 'app_settings'")
            .fetch_optional(&db.pool)
            .await
            .ok()
            .flatten();

        let settings = if let Some((_, value)) = db_settings {
            serde_json::from_str(&value).unwrap_or_default()
        } else if path.exists() {
            // Migrate from JSON
            let content = fs::read_to_string(&path).unwrap_or_default();
            let settings: AppSettings = serde_json::from_str(&content).unwrap_or_default();
            
            // Save to DB
            let json = serde_json::to_string(&settings).unwrap();
            sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES ('app_settings', ?)")
                .bind(json)
                .execute(&db.pool)
                .await
                .ok();
            
            // Rename old file to mark migration
            let mut new_path = path.clone();
            new_path.set_extension("json.bak");
            fs::rename(path, new_path).ok();
            
            settings
        } else {
            AppSettings::default()
        };

        Self {
            db,
            settings: RwLock::new(settings),
        }
    }

    pub async fn get(&self) -> AppSettings {
        self.settings.read().await.clone()
    }

    pub async fn save(&self, new_settings: AppSettings) -> Result<(), String> {
        let json = serde_json::to_string(&new_settings)
            .map_err(|e| e.to_string())?;
        
        sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES ('app_settings', ?)")
            .bind(json)
            .execute(&self.db.pool)
            .await
            .map_err(|e| e.to_string())?;

        *self.settings.write().await = new_settings;
        Ok(())
    }
}

