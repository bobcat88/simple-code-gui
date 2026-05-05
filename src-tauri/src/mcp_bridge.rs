use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{ChildStdin, Command};
use tokio::sync::{oneshot, Mutex};
use tauri::{AppHandle, Manager, State, Emitter};
use std::time::Duration;
use local_ip_address::local_ip;
use futures::future::join_all;
use futures::StreamExt;
use mdns_sd::{ServiceDaemon, ServiceEvent};
use uuid::Uuid;
use chrono::Utc;
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
        post_url: Arc<Mutex<Option<String>>>,
    },
}

pub struct McpServerHandle {
    pub config: McpServerConfig,
    pub transport: McpTransport,
    pub pending_requests: Arc<Mutex<HashMap<Value, oneshot::Sender<Result<Value, String>>>>>,
    pub app_handle: Option<AppHandle>,
}

pub struct McpManager {
    pub servers: Arc<Mutex<HashMap<String, McpServerHandle>>>,
    pub trusted_nodes: Arc<Mutex<HashSet<String>>>,
}

impl McpManager {
    pub fn new() -> Self {
        Self {
            servers: Arc::new(Mutex::new(HashMap::new())),
            trusted_nodes: Arc::new(Mutex::new(HashSet::new())),
        }
    }

    pub async fn broadcast(&self, method: &str, params: Value) {
        let servers = self.servers.lock().await;
        for handle in servers.values() {
            let _ = handle.notify(method, params.clone()).await;
        }
    }

    pub async fn get_best_worker_node(&self) -> Option<String> {
        let trusted = self.trusted_nodes.lock().await;
        let servers = self.servers.lock().await;
        
        // Simple heuristic: pick first trusted remote server
        for (name, handle) in servers.iter() {
            if trusted.contains(name) {
                if let McpTransport::Remote { .. } = &handle.transport {
                    return Some(name.clone());
                }
            }
        }
        None
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
    pub async fn spawn(config: McpServerConfig, app_handle: Option<AppHandle>) -> Result<Self, String> {
        let pending_requests: Arc<Mutex<HashMap<Value, oneshot::Sender<Result<Value, String>>>>> = Arc::new(Mutex::new(HashMap::new()));

        let transport = if let Some(url) = &config.url {
            // Remote HTTP/SSE Transport
            let client = reqwest::Client::new();
            let post_url = Arc::new(Mutex::new(None));
            let post_url_clone = post_url.clone();
            let sse_url = if url.ends_with('/') { format!("{}sse", url) } else { format!("{}/sse", url) };
            let name_clone = config.name.clone();
            let client_clone = client.clone();
            let app_handle_clone = app_handle.clone();

            // Background SSE listener for remote server
            tokio::spawn(async move {
                let res = match client_clone.get(&sse_url).send().await {
                    Ok(res) => res,
                    Err(e) => {
                        eprintln!("Failed to connect to SSE for {}: {}", name_clone, e);
                        return;
                    }
                };

                let mut stream = res.bytes_stream();
                let mut current_event = String::new();

                while let Some(item) = stream.next().await {
                    if let Ok(bytes) = item {
                        if let Ok(text) = std::str::from_utf8(&bytes) {
                            for line in text.lines() {
                                if line.is_empty() {
                                    // End of event - currently not doing complex parsing
                                    current_event.clear();
                                    continue;
                                }

                                if line.starts_with("event:") {
                                    current_event = line["event:".len()..].trim().to_string();
                                } else if line.starts_with("data:") {
                                    let data = line["data:".len()..].trim();
                                    
                                    if current_event == "endpoint" {
                                        let mut p_url = post_url_clone.lock().await;
                                        *p_url = Some(data.to_string());
                                        eprintln!("Established MCP SSE endpoint for {}: {}", name_clone, data);
                                    } else {
                                        // Other notifications - broadcast to frontend
                                        if let Some(app) = &app_handle_clone {
                                            if current_event == "memory-update" {
                                                if let Ok(entry) = serde_json::from_str::<crate::gsd_engine::sync::MemoryEntry>(data) {
                                                    let gsd = app.state::<Arc<crate::gsd_engine::GsdEngine>>();
                                                    let knowledge = gsd.knowledge.lock().await;
                                                    if let Some(mem) = knowledge.as_ref() {
                                                        let _ = mem.record(&entry.entry_type, &entry.context, &entry.content, &entry.meta);
                                                        eprintln!("[Swarm] Synchronized remote memory from {}: {}", name_clone, entry.content);
                                                    }
                                                }
                                            }

                                            let _ = app.emit("mcp-notification", json!({
                                                "server": name_clone,
                                                "event": current_event,
                                                "data": data
                                            }));
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                eprintln!("MCP SSE stream for {} closed", name_clone);
            });

            McpTransport::Remote {
                url: url.clone(),
                client,
                post_url,
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
            app_handle,
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
            McpTransport::Remote { url, client, post_url } => {
                let target_url = {
                    let p_url = post_url.lock().await;
                    p_url.as_ref().cloned().unwrap_or_else(|| url.clone())
                };

                let response = client
                    .post(&target_url)
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
            McpTransport::Remote { url, client, post_url } => {
                let target_url = {
                    let p_url = post_url.lock().await;
                    p_url.as_ref().cloned().unwrap_or_else(|| url.clone())
                };

                client
                    .post(&target_url)
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
    app_handle: AppHandle,
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
                    let _ = register_mcp_server(config, app_handle.clone(), manager.clone()).await;
                }
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn register_mcp_server(
    config: McpServerConfig,
    app_handle: AppHandle,
    manager: State<'_, McpManager>,
) -> Result<(), String> {
    let mut servers = manager.servers.lock().await;
    
    // If already running, we might want to restart it or just skip
    if servers.contains_key(&config.name) {
        // For now, let's just replace/restart
        servers.remove(&config.name);
    }

    let handle = McpServerHandle::spawn(config.clone(), Some(app_handle)).await?;
    servers.insert(config.name.clone(), handle);
    Ok(())
}

#[tauri::command]
pub async fn mcp_trust_node(
    name: String,
    manager: State<'_, McpManager>,
) -> Result<(), String> {
    let mut trusted = manager.trusted_nodes.lock().await;
    trusted.insert(name);
    Ok(())
}

#[tauri::command]
pub async fn mcp_is_node_trusted(
    name: String,
    manager: State<'_, McpManager>,
) -> Result<bool, String> {
    let trusted = manager.trusted_nodes.lock().await;
    Ok(trusted.contains(&name))
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
    
    // Security check for remote servers
    if let McpTransport::Remote { .. } = &server.transport {
        let trusted = manager.trusted_nodes.lock().await;
        if !trusted.contains(&server_name) {
            return Err(format!("UNTRUSTED_REMOTE_NODE: {}", server_name));
        }
    }

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
#[tauri::command]
pub async fn gsd_spawn_remote_worker(
    mcp: State<'_, Arc<McpManager>>,
    task_description: String,
) -> Result<String, String> {
    let node_name = mcp.get_best_worker_node().await
        .ok_or_else(|| "No trusted remote nodes available for worker spawning".to_string())?;

    let servers = mcp.servers.lock().await;
    let handle = servers.get(&node_name)
        .ok_or_else(|| "Selected node unexpectedly vanished".to_string())?;

    // Phase 42: Spawn worker via notification
    let params = json!({
        "task": task_description,
        "worker_id": Uuid::new_v4().to_string(),
        "timestamp": Utc::now().to_rfc3339()
    });

    handle.notify("swarm/spawn-worker", params).await?;

    Ok(node_name)
}
