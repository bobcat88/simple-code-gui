use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use local_ip_address::local_ip;
use redis::AsyncCommands;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DistributedNode {
    pub id: String,
    pub name: String,
    pub ip: String,
    pub port: u16,
    pub node_type: String,
    pub status: String,
    pub last_seen: i64,
    pub capabilities: Vec<String>,
}

pub struct DistributedManager {
    pub local_node: DistributedNode,
    pub redis_url: String,
    pub peers: Arc<Mutex<HashMap<String, DistributedNode>>>,
    pub is_running: std::sync::Arc<std::sync::atomic::AtomicBool>,
}

impl DistributedManager {
    pub fn new(node_name: String, redis_url: String) -> Self {
        let ip = local_ip().map(|ip| ip.to_string()).unwrap_or_else(|_| "127.0.0.1".to_string());
        let id = format!("{}-{}", node_name, uuid::Uuid::new_v4());
        
        Self {
            local_node: DistributedNode {
                id,
                name: node_name,
                ip,
                port: 4747,
                node_type: "worker".to_string(),
                status: "active".to_string(),
                last_seen: chrono::Utc::now().timestamp(),
                capabilities: vec!["gsd".to_string(), "mcp".to_string()],
            },
            redis_url,
            peers: Arc::new(Mutex::new(HashMap::new())),
            is_running: std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false)),
        }
    }

    pub async fn start_discovery(&self) -> Result<(), String> {
        if self.is_running.swap(true, std::sync::atomic::Ordering::SeqCst) {
            return Ok(());
        }

        let local_node = self.local_node.clone();
        let redis_url = self.redis_url.clone();
        let peers = Arc::clone(&self.peers);
        let is_running = Arc::clone(&self.is_running);

        tokio::spawn(async move {
            let client = match redis::Client::open(redis_url.as_str()) {
                Ok(c) => c,
                Err(_) => {
                    is_running.store(false, std::sync::atomic::Ordering::SeqCst);
                    return;
                }
            };

            let mut conn = match client.get_multiplexed_async_connection().await {
                Ok(c) => c,
                Err(_) => {
                    is_running.store(false, std::sync::atomic::Ordering::SeqCst);
                    return;
                }
            };

            let registry_key = "swarm:nodes";
            
            while is_running.load(std::sync::atomic::Ordering::SeqCst) {
                // Heartbeat: register self
                let node_json = serde_json::to_string(&local_node).unwrap();
                let _: redis::RedisResult<()> = conn.hset(registry_key, &local_node.id, node_json).await;
                let _: redis::RedisResult<()> = conn.expire(registry_key, 60).await; // Cleanup if registry is stale

                // Discover others
                let nodes: HashMap<String, String> = match conn.hgetall(registry_key).await {
                    Ok(n) => n,
                    Err(_) => HashMap::new(),
                };

                let mut current_peers = peers.lock().await;
                current_peers.clear();
                let now = chrono::Utc::now().timestamp();

                for (id, json) in nodes {
                    if id == local_node.id { continue; }
                    if let Ok(mut node) = serde_json::from_str::<DistributedNode>(&json) {
                        // Check if still alive (simple timeout)
                        if now - node.last_seen < 30 {
                            node.status = "active".to_string();
                            current_peers.insert(id, node);
                        }
                    }
                }

                tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
            }
        });

        Ok(())
    }

    pub async fn stop_discovery(&self) {
        self.is_running.store(false, std::sync::atomic::Ordering::SeqCst);
    }

    pub async fn get_nodes(&self) -> Vec<DistributedNode> {
        let mut nodes = vec![self.local_node.clone()];
        let peers = self.peers.lock().await;
        nodes.extend(peers.values().cloned());
        nodes
    }
}
