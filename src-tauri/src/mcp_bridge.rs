use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::State;
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct McpServerConfig {
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    pub env: HashMap<String, String>,
}

pub struct McpManager {
    pub servers: Mutex<HashMap<String, McpServerConfig>>,
}

impl McpManager {
    pub fn new() -> Self {
        Self {
            servers: Mutex::new(HashMap::new()),
        }
    }
}

#[tauri::command]
pub async fn register_mcp_server(
    config: McpServerConfig,
    manager: State<'_, McpManager>,
) -> Result<(), String> {
    let mut servers = manager.servers.lock().unwrap();
    servers.insert(config.name.clone(), config);
    Ok(())
}

#[tauri::command]
pub async fn get_registered_mcp_servers(
    manager: State<'_, McpManager>,
) -> Result<Vec<McpServerConfig>, String> {
    let servers = manager.servers.lock().unwrap();
    Ok(servers.values().cloned().collect())
}

// Future: Actual JSON-RPC over Stdio for native MCP tool usage
