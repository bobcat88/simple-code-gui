use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct RtkSummary {
    pub total_commands: u64,
    pub total_input: u64,
    pub total_output: u64,
    pub total_saved: u64,
    pub avg_savings_pct: f64,
    pub total_time_ms: u64,
    pub avg_time_ms: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RtkStats {
    pub summary: RtkSummary,
}

#[command]
pub async fn rtk_check() -> Result<bool, String> {
    Ok(Command::new("rtk").arg("--version").output().is_ok())
}

#[command]
pub async fn rtk_get_stats() -> Result<RtkStats, String> {
    let output = Command::new("rtk")
        .arg("gain")
        .arg("--format")
        .arg("json")
        .output()
        .map_err(|e| format!("Failed to execute rtk: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stats: RtkStats = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse rtk output: {}", e))?;

    Ok(stats)
}

#[command]
pub async fn rtk_get_history() -> Result<serde_json::Value, String> {
    let output = Command::new("rtk")
        .arg("gain")
        .arg("--history")
        .arg("--format")
        .arg("json")
        .output()
        .map_err(|e| format!("Failed to execute rtk: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let history: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse rtk output: {}", e))?;

    Ok(history)
}
