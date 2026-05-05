use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{ChildStdin, Command};
use tokio::sync::{oneshot, Mutex};
use tauri::State;
use std::time::Duration;
use local_ip_address::local_ip;
use futures::future::join_all;
use mdns_sd::{ServiceDaemon, ServiceEvent};
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct McpServerConfig {
    pub name: String,
    pub command: Option<String>,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    pub url: Option<String>, // New: support for remote MCP servers
}

pub enum McpTransport {
    Local {
        stdin: Arc<Mutex<ChildStdin>>,
    },
    Remote {
        url: String,
        client: reqwest::Client,
    },
}

pub struct McpServerHandle {
    pub config: McpServerConfig,
    pub transport: McpTransport,
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
        let pending_requests: Arc<Mutex<HashMap<Value, oneshot::Sender<Result<Value, String>>>>> = Arc::new(Mutex::new(HashMap::new()));

        let transport = if let Some(url) = &config.url {
            // Remote HTTP/SSE Transport
            let client = reqwest::Client::new();
            
            // For now, assume simple POST-based JSON-RPC if no SSE is established yet
            // TODO: Establish SSE connection for real-time notifications from server
            McpTransport::Remote {
                url: url.clone(),
                client,
            }
        } else if let Some(command) = &config.command {
            // Local Process Transport
            let mut child = Command::new(command)
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

            let stdin_mutex = Arc::new(Mutex::new(stdin));
            let pending_clone = pending_requests.clone();
            let name_clone = config.name.clone();

            // Stdout reader task for local process
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

            // Stderr reader task for local process
            let name_clone_err = config.name.clone();
            tokio::spawn(async move {
                let mut reader = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    eprintln!("[MCP {} STDERR] {}", name_clone_err, line);
                }
            });

            McpTransport::Local { stdin: stdin_mutex }
        } else {
            return Err(format!("MCP server {} has neither command nor url", config.name));
        };

        let handle = Self {
            config,
            transport,
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

        match &self.transport {
            McpTransport::Local { stdin } => {
                let (tx, rx) = oneshot::channel();
                {
                    let mut pending = self.pending_requests.lock().await;
                    pending.insert(id, tx);
                }

                let json = serde_json::to_string(&request).map_err(|e| e.to_string())?;
                {
                    let mut stdin_lock = stdin.lock().await;
                    stdin_lock.write_all(format!("{}\n", json).as_bytes()).await.map_err(|e| e.to_string())?;
                    stdin_lock.flush().await.map_err(|e| e.to_string())?;
                }

                rx.await.map_err(|e| format!("oneshot error: {}", e))?
            }
            McpTransport::Remote { url, client } => {
                let response = client
                    .post(url)
                    .json(&request)
                    .send()
                    .await
                    .map_err(|e| format!("Remote MCP call failed: {}", e))?;

                let res_json: JsonRpcResponse = response
                    .json()
                    .await
                    .map_err(|e| format!("Failed to parse remote MCP response: {}", e))?;

                if let Some(error) = res_json.error {
                    Err(format!("MCP Error {}: {}", error.code, error.message))
                } else {
                    Ok(res_json.result.unwrap_or(Value::Null))
                }
            }
        }
    }

    pub async fn notify(&self, method: &str, params: Value) -> Result<(), String> {
        let request = json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params
        });

        match &self.transport {
            McpTransport::Local { stdin } => {
                let json = serde_json::to_string(&request).map_err(|e| e.to_string())?;
                let mut stdin_lock = stdin.lock().await;
                stdin_lock.write_all(format!("{}\n", json).as_bytes()).await.map_err(|e| e.to_string())?;
                stdin_lock.flush().await.map_err(|e| e.to_string())?;
                Ok(())
            }
            McpTransport::Remote { url, client } => {
                let _ = client
                    .post(url)
                    .json(&request)
                    .send()
                    .await
                    .map_err(|e| format!("Remote MCP notify failed: {}", e))?;
                Ok(())
            }
        }
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
                let command = server_val.get("command").and_then(|v| v.as_str()).map(|s| s.to_string());
                let url = server_val.get("url").and_then(|v| v.as_str()).map(|s| s.to_string());

                if command.is_some() || url.is_some() {
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
                        command,
                        args,
                        env,
                        url,
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

#[tauri::command]
pub async fn mcp_discover_servers() -> Result<Vec<McpServerConfig>, String> {
    let my_ip = local_ip().map_err(|e| format!("Failed to get local IP: {}", e))?;
    let octets = match my_ip {
        std::net::IpAddr::V4(v4) => v4.octets(),
        _ => return Err("Only IPv4 supported for subnet discovery".into()),
    };
    let mut discovered = Vec::new();

    // Scan common ports on the local subnet (simplified for demo)
    let ports = vec![3000, 4747, 8080];
    let mut tasks = Vec::new();

    for i in 1..255 {
        if i == octets[3] {
            continue;
        } // Skip self
        let target_ip = format!("{}.{}.{}.{}", octets[0], octets[1], octets[2], i);

        for &port in &ports {
            let url = format!("http://{}:{}/mcp/info", target_ip, port);
            tasks.push(tokio::spawn(async move {
                let client = reqwest::Client::builder()
                    .timeout(Duration::from_millis(200))
                    .build()
                    .unwrap();

                if let Ok(resp) = client.get(&url).send().await {
                    if resp.status().is_success() {
                        if let Ok(config) = resp.json::<McpServerConfig>().await {
                            return Some(config);
                        }
                    }
                }
                None
            }));
        }
    }

    for task in tasks {
        if let Ok(Some(config)) = task.await {
            discovered.push(config);
        }
    }

    // Also discover via mDNS
    if let Ok(mdns_nodes) = discover_mdns().await {
        for node in mdns_nodes {
            if !discovered.iter().any(|d| d.name == node.name) {
                discovered.push(node);
            }
        }
    }

    Ok(discovered)
}

async fn discover_mdns() -> Result<Vec<McpServerConfig>, String> {
    let mdns = ServiceDaemon::new().map_err(|e| e.to_string())?;
    let service_type = "_mcp._tcp.local.";
    let receiver = mdns.browse(service_type).map_err(|e| e.to_string())?;

    let mut nodes = Vec::new();
    let start = std::time::Instant::now();
    let timeout = Duration::from_secs(2);

    while start.elapsed() < timeout {
        if let Ok(event) = receiver.recv_timeout(Duration::from_millis(100)) {
            match event {
                ServiceEvent::ServiceResolved(info) => {
                    let name = info.get_fullname().to_string();
                    let port = info.get_port();
                    let addresses = info.get_addresses();
                    
                    if let Some(addr) = addresses.iter().next() {
                        nodes.push(McpServerConfig {
                            name: name.replace("._mcp._tcp.local.", ""),
                            command: None,
                            args: vec![],
                            env: std::collections::HashMap::new(),
                            url: Some(format!("http://{}:{}/sse", addr, port)),
                        });
                    }
                }
                _ => {}
            }
        }
    }

    Ok(nodes)
}
