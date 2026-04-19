use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{ChildStdin, Command};
use tokio::sync::{oneshot, Mutex};
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct McpServerConfig {
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
}

pub struct McpServerHandle {
    pub config: McpServerConfig,
    pub stdin: Arc<Mutex<ChildStdin>>,
    pub pending_requests: Arc<Mutex<HashMap<Value, oneshot::Sender<Result<Value, String>>>>>,
}

pub struct McpManager {
    pub servers: Arc<Mutex<HashMap<String, McpServerHandle>>>,
}

impl McpManager {
    pub fn new() -> Self {
        Self {
            servers: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct JsonRpcRequest {
    jsonrpc: String,
    id: Value,
    method: String,
    params: Value,
}

#[derive(Debug, Serialize, Deserialize)]
struct JsonRpcResponse {
    jsonrpc: String,
    id: Option<Value>,
    result: Option<Value>,
    error: Option<JsonRpcError>,
}

#[derive(Debug, Serialize, Deserialize)]
struct JsonRpcError {
    code: i32,
    message: String,
    data: Option<Value>,
}

impl McpServerHandle {
    pub async fn spawn(config: McpServerConfig) -> Result<Self, String> {
        let mut child = Command::new(&config.command)
            .args(&config.args)
            .envs(&config.env)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn MCP server {}: {}", config.name, e))?;

        let stdin = child.stdin.take().ok_or("Failed to open stdin")?;
        let stdout = child.stdout.take().ok_or("Failed to open stdout")?;
        let stderr = child.stderr.take().ok_or("Failed to open stderr")?;

        let stdin = Arc::new(Mutex::new(stdin));
        let pending_requests: Arc<Mutex<HashMap<Value, oneshot::Sender<Result<Value, String>>>>> = Arc::new(Mutex::new(HashMap::new()));
        
        let pending_clone = pending_requests.clone();
        let name_clone = config.name.clone();

        // Stdout reader task
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                if let Ok(response) = serde_json::from_str::<JsonRpcResponse>(&line) {
                    if let Some(id) = response.id {
                        let mut pending = pending_clone.lock().await;
                        if let Some(tx) = pending.remove(&id) {
                            if let Some(error) = response.error {
                                let _ = tx.send(Err(format!("MCP Error {}: {}", error.code, error.message)));
                            } else {
                                let _ = tx.send(Ok(response.result.unwrap_or(Value::Null)));
                            }
                        }
                    }
                }
            }
            eprintln!("MCP server {} stdout closed", name_clone);
        });

        // Stderr reader task
        let name_clone_err = config.name.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                eprintln!("[MCP {} STDERR] {}", name_clone_err, line);
            }
        });

        let handle = Self {
            config,
            stdin,
            pending_requests,
        };

        // Send initialize request
        handle.call("initialize", json!({
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {
                "name": "simple-code-gui",
                "version": "0.1.0"
            }
        })).await?;

        // Send initialized notification
        handle.notify("notifications/initialized", json!({})).await?;

        Ok(handle)
    }

    pub async fn call(&self, method: &str, params: Value) -> Result<Value, String> {
        let id = json!(uuid::Uuid::new_v4().to_string());
        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: id.clone(),
            method: method.to_string(),
            params,
        };

        let (tx, rx) = oneshot::channel();
        {
            let mut pending = self.pending_requests.lock().await;
            pending.insert(id, tx);
        }

        let json = serde_json::to_string(&request).map_err(|e| e.to_string())?;
        {
            let mut stdin = self.stdin.lock().await;
            stdin.write_all(format!("{}\n", json).as_bytes()).await.map_err(|e| e.to_string())?;
            stdin.flush().await.map_err(|e| e.to_string())?;
        }

        rx.await.map_err(|e| format!("oneshot error: {}", e))?
    }

    pub async fn notify(&self, method: &str, params: Value) -> Result<(), String> {
        let request = json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params
        });

        let json = serde_json::to_string(&request).map_err(|e| e.to_string())?;
        let mut stdin = self.stdin.lock().await;
        stdin.write_all(format!("{}\n", json).as_bytes()).await.map_err(|e| e.to_string())?;
        stdin.flush().await.map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[tauri::command]
pub async fn mcp_load_config(
    manager: State<'_, McpManager>,
) -> Result<(), String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    
    // Paths to check in order of priority
    let paths = vec![
        home.join(".claude").join("mcp_config.json"),
        home.join(".config").join("Claude").join("claude_desktop_config.json"),
    ];

    for config_path in paths {
        if !config_path.exists() {
            continue;
        }

        let content = std::fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
        let config: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;

        if let Some(mcp_servers) = config.get("mcpServers").and_then(|v| v.as_object()) {
            for (name, server_val) in mcp_servers {
                if let Some(command) = server_val.get("command").and_then(|v| v.as_str()) {
                    let args: Vec<String> = server_val
                        .get("args")
                        .and_then(|v| v.as_array())
                        .map(|a| a.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                        .unwrap_or_default();

                    let env: HashMap<String, String> = server_val
                        .get("env")
                        .and_then(|v| v.as_object())
                        .map(|o| o.iter().filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string()))).collect())
                        .unwrap_or_default();

                    let config = McpServerConfig {
                        name: name.clone(),
                        command: command.to_string(),
                        args,
                        env,
                    };

                    // Register (and spawn) the server
                    let _ = register_mcp_server(config, manager.clone()).await;
                }
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn register_mcp_server(
    config: McpServerConfig,
    manager: State<'_, McpManager>,
) -> Result<(), String> {
    let mut servers = manager.servers.lock().await;
    
    // If already running, we might want to restart it or just skip
    if servers.contains_key(&config.name) {
        // For now, let's just replace/restart
        servers.remove(&config.name);
    }

    let handle = McpServerHandle::spawn(config.clone()).await?;
    servers.insert(config.name.clone(), handle);
    Ok(())
}

#[tauri::command]
pub async fn get_registered_mcp_servers(
    manager: State<'_, McpManager>,
) -> Result<Vec<McpServerConfig>, String> {
    let servers = manager.servers.lock().await;
    Ok(servers.values().map(|h| h.config.clone()).collect())
}

#[tauri::command]
pub async fn mcp_list_tools(
    server_name: String,
    manager: State<'_, McpManager>,
) -> Result<Value, String> {
    let servers = manager.servers.lock().await;
    let server = servers.get(&server_name).ok_or_else(|| format!("Server {} not found", server_name))?;
    server.call("tools/list", json!({})).await
}

#[tauri::command]
pub async fn mcp_call_tool(
    server_name: String,
    tool_name: String,
    args: Value,
    manager: State<'_, McpManager>,
) -> Result<Value, String> {
    let servers = manager.servers.lock().await;
    let server = servers.get(&server_name).ok_or_else(|| format!("Server {} not found", server_name))?;
    server.call("tools/call", json!({
        "name": tool_name,
        "arguments": args
    })).await
}

#[tauri::command]
pub async fn mcp_list_resources(
    server_name: String,
    manager: State<'_, McpManager>,
) -> Result<Value, String> {
    let servers = manager.servers.lock().await;
    let server = servers.get(&server_name).ok_or_else(|| format!("Server {} not found", server_name))?;
    server.call("resources/list", json!({})).await
}

#[tauri::command]
pub async fn mcp_read_resource(
    server_name: String,
    uri: String,
    manager: State<'_, McpManager>,
) -> Result<Value, String> {
    let servers = manager.servers.lock().await;
    let server = servers.get(&server_name).ok_or_else(|| format!("Server {} not found", server_name))?;
    server.call("resources/read", json!({
        "uri": uri
    })).await
}
