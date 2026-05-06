use local_ip_address::local_ip;
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DistributedNode {
    pub id: String,
    pub name: String,
    pub ip: String,
    pub port: u16,
    #[serde(alias = "node_type")]
    pub node_type: String,
    pub status: String,
    #[serde(alias = "last_seen")]
    pub last_seen: i64,
    pub capabilities: Vec<String>,
    #[serde(default = "default_credit_balance")]
    #[serde(alias = "credit_balance")]
    pub credit_balance: f64,
    #[serde(default)]
    pub utilization: f64,
    #[serde(default = "default_bid_floor_credits")]
    #[serde(alias = "bid_floor_credits")]
    pub bid_floor_credits: f64,
    #[serde(default)]
    #[serde(alias = "last_bid_credits")]
    pub last_bid_credits: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteToolBid {
    pub node_id: String,
    pub node_name: String,
    pub capability: String,
    pub bid_credits: f64,
    pub available_credits: f64,
    pub utilization: f64,
    pub reason: String,
}

pub struct DistributedManager {
    pub local_node: DistributedNode,
    pub redis_url: String,
    pub peers: Arc<Mutex<HashMap<String, DistributedNode>>>,
    pub is_running: std::sync::Arc<std::sync::atomic::AtomicBool>,
}

impl DistributedManager {
    pub fn new(node_name: String, redis_url: String) -> Self {
        let ip = local_ip()
            .map(|ip| ip.to_string())
            .unwrap_or_else(|_| "127.0.0.1".to_string());
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
                credit_balance: default_credit_balance(),
                utilization: 0.0,
                bid_floor_credits: default_bid_floor_credits(),
                last_bid_credits: 0.0,
            },
            redis_url,
            peers: Arc::new(Mutex::new(HashMap::new())),
            is_running: std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false)),
        }
    }

    pub async fn start_discovery(&self) -> Result<(), String> {
        if self
            .is_running
            .swap(true, std::sync::atomic::Ordering::SeqCst)
        {
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
                let node_json = match serde_json::to_string(&local_node) {
                    Ok(j) => j,
                    Err(e) => { log::error!("distributed: heartbeat serialize failed: {e}"); continue; }
                };
                let _: redis::RedisResult<()> =
                    conn.hset(registry_key, &local_node.id, node_json).await;
                let _: redis::RedisResult<()> = conn.expire(registry_key, 60).await; // Cleanup if registry is stale

                // Discover others
                let nodes: HashMap<String, String> = conn.hgetall(registry_key).await.unwrap_or_default();

                let mut current_peers = peers.lock().await;
                current_peers.clear();
                let now = chrono::Utc::now().timestamp();

                for (id, json) in nodes {
                    if id == local_node.id {
                        continue;
                    }
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
        self.is_running
            .store(false, std::sync::atomic::Ordering::SeqCst);
    }

    pub async fn get_nodes(&self) -> Vec<DistributedNode> {
        let mut nodes = vec![self.local_node.clone()];
        let peers = self.peers.lock().await;
        nodes.extend(peers.values().cloned());
        nodes
    }

    pub async fn quote_remote_tool_execution(
        &self,
        capability: String,
        base_cost_credits: f64,
    ) -> Vec<RemoteToolBid> {
        let base_cost = base_cost_credits.max(0.01);
        let nodes = self.get_nodes().await;
        let mut bids: Vec<RemoteToolBid> = nodes
            .into_iter()
            .filter(|node| node.status == "active")
            .filter(|node| node.capabilities.iter().any(|cap| cap == &capability))
            .map(|node| build_bid(&node, &capability, base_cost))
            .collect();

        bids.sort_by(|a, b| a.bid_credits.total_cmp(&b.bid_credits));
        bids
    }

    pub async fn apply_credit_delta(
        &mut self,
        node_id: &str,
        credit_delta: f64,
        utilization: Option<f64>,
    ) -> Result<DistributedNode, String> {
        if self.local_node.id == node_id {
            apply_economic_delta(&mut self.local_node, credit_delta, utilization);
            return Ok(self.local_node.clone());
        }

        let mut peers = self.peers.lock().await;
        let node = peers
            .get_mut(node_id)
            .ok_or_else(|| format!("Distributed node not found: {}", node_id))?;
        apply_economic_delta(node, credit_delta, utilization);
        Ok(node.clone())
    }
}

fn build_bid(node: &DistributedNode, capability: &str, base_cost: f64) -> RemoteToolBid {
    let utilization = node.utilization.clamp(0.0, 1.0);
    let utilization_multiplier = 1.0 + utilization;
    let scarcity_multiplier = if node.credit_balance < base_cost {
        1.5
    } else if node.credit_balance > base_cost * 20.0 {
        0.9
    } else {
        1.0
    };
    let bid_credits = (node.bid_floor_credits.max(base_cost)
        * utilization_multiplier
        * scarcity_multiplier
        * 100.0)
        .round()
        / 100.0;

    RemoteToolBid {
        node_id: node.id.clone(),
        node_name: node.name.clone(),
        capability: capability.to_string(),
        bid_credits,
        available_credits: node.credit_balance,
        utilization,
        reason: format!(
            "base={:.2}, utilization={:.0}%, balance={:.2}",
            base_cost,
            utilization * 100.0,
            node.credit_balance
        ),
    }
}

fn apply_economic_delta(node: &mut DistributedNode, credit_delta: f64, utilization: Option<f64>) {
    node.credit_balance = (node.credit_balance + credit_delta).max(0.0);
    if let Some(util) = utilization {
        node.utilization = util.clamp(0.0, 1.0);
    }
    node.last_bid_credits = build_bid(node, "mcp", node.bid_floor_credits).bid_credits;
}

fn default_credit_balance() -> f64 {
    100.0
}

fn default_bid_floor_credits() -> f64 {
    1.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn bids_sort_lower_utilization_first() {
        let manager =
            DistributedManager::new("local".to_string(), "redis://127.0.0.1/".to_string());
        {
            let mut peers = manager.peers.lock().await;
            peers.insert(
                "busy".to_string(),
                DistributedNode {
                    id: "busy".to_string(),
                    name: "Busy".to_string(),
                    ip: "127.0.0.2".to_string(),
                    port: 4747,
                    node_type: "worker".to_string(),
                    status: "active".to_string(),
                    last_seen: chrono::Utc::now().timestamp(),
                    capabilities: vec!["mcp".to_string()],
                    credit_balance: 100.0,
                    utilization: 0.9,
                    bid_floor_credits: 1.0,
                    last_bid_credits: 0.0,
                },
            );
            peers.insert(
                "idle".to_string(),
                DistributedNode {
                    id: "idle".to_string(),
                    name: "Idle".to_string(),
                    ip: "127.0.0.3".to_string(),
                    port: 4747,
                    node_type: "worker".to_string(),
                    status: "active".to_string(),
                    last_seen: chrono::Utc::now().timestamp(),
                    capabilities: vec!["mcp".to_string()],
                    credit_balance: 100.0,
                    utilization: 0.1,
                    bid_floor_credits: 1.0,
                    last_bid_credits: 0.0,
                },
            );
        }

        let bids = manager
            .quote_remote_tool_execution("mcp".to_string(), 1.0)
            .await;

        assert_eq!(bids[0].node_id, manager.local_node.id);
        assert!(
            bids.iter().position(|bid| bid.node_id == "idle").unwrap()
                < bids.iter().position(|bid| bid.node_id == "busy").unwrap()
        );
    }

    #[tokio::test]
    async fn credit_delta_clamps_balance_and_utilization() {
        let mut manager =
            DistributedManager::new("local".to_string(), "redis://127.0.0.1/".to_string());
        let node_id = manager.local_node.id.clone();

        let node = manager
            .apply_credit_delta(&node_id, -500.0, Some(2.0))
            .await
            .unwrap();

        assert_eq!(node.credit_balance, 0.0);
        assert_eq!(node.utilization, 1.0);
    }
}
