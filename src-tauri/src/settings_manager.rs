use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
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
}

fn default_true() -> bool { true }
fn default_accent() -> String { String::from("#3b82f6") }
fn default_tts_speed() -> f32 { 1.0 }

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
        }
    }
}

pub struct SettingsManager {
    path: PathBuf,
    settings: Mutex<AppSettings>,
}

impl SettingsManager {
    pub fn new(app: &AppHandle) -> Self {
        let path = app.path().app_config_dir().unwrap().join("settings.json");
        
        // Ensure directory exists
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).ok();
        }

        let settings = if path.exists() {
            let content = fs::read_to_string(&path).unwrap_or_default();
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            AppSettings::default()
        };

        Self {
            path,
            settings: Mutex::new(settings),
        }
    }

    pub fn get(&self) -> AppSettings {
        self.settings.lock().unwrap().clone()
    }

    pub fn save(&self, new_settings: AppSettings) -> Result<(), String> {
        let content = serde_json::to_string_pretty(&new_settings)
            .map_err(|e| e.to_string())?;
        fs::write(&self.path, content).map_err(|e| e.to_string())?;
        *self.settings.lock().unwrap() = new_settings;
        Ok(())
    }
}
