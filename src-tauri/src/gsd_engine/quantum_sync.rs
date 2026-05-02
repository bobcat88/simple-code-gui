use notify::{Watcher, RecursiveMode, Event, Config};
use std::sync::Arc;
use tokio::sync::Mutex;
use std::path::Path;
use tokio::sync::mpsc;
use crate::gsd_engine::knowledge::SwarmMemory;
use crate::gsd_engine::sync::GlobalSync;
use tauri::AppHandle;
use tauri::Emitter;

pub struct QuantumSyncManager {
    memory: Arc<SwarmMemory>,
    app: AppHandle,
    watcher: Arc<Mutex<Option<notify::RecommendedWatcher>>>,
}

impl QuantumSyncManager {
    pub fn new(memory: Arc<SwarmMemory>, app: AppHandle) -> Self {
        Self { 
            memory, 
            app,
            watcher: Arc::new(Mutex::new(None)),
        }
    }

    pub async fn start_synaptic_watch(&self) -> Result<(), String> {
        {
            let w_lock = self.watcher.lock().await;
            if w_lock.is_some() {
                println!("QuantumSync: Synaptic watch already active.");
                return Ok(());
            }
        }
        let vault_path = GlobalSync::get_vault_path();
        let path = Path::new(&vault_path);

        if !path.exists() {
            // Ensure parent directory exists
            if let Some(parent) = path.parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            // Create empty file if not exists
            std::fs::write(path, "[]").map_err(|e| e.to_string())?;
        }

        let (tx, mut rx) = mpsc::channel(1);
        let memory = self.memory.clone();
        let app = self.app.clone();

        let mut watcher = notify::recommended_watcher(move |res: notify::Result<Event>| {
            if let Ok(event) = res {
                if event.kind.is_modify() || event.kind.is_create() {
                    let _ = tx.blocking_send(());
                }
            }
        }).map_err(|e| e.to_string())?;

        watcher.watch(path, RecursiveMode::NonRecursive).map_err(|e| e.to_string())?;
        
        let mut w_lock = self.watcher.lock().await;
        *w_lock = Some(watcher);

        tauri::async_runtime::spawn(async move {
            println!("QuantumSync: Synaptic watch started on {}", vault_path);
            while let Some(_) = rx.recv().await {
                println!("QuantumSync: Synaptic shift detected. Synchronizing...");
                match GlobalSync::import(&memory) {
                    Ok(count) => {
                        if count > 0 {
                            let _ = app.emit("gsd-sync-event", serde_json::json!({
                                "status": "synced",
                                "event_type": "Synaptic Shift",
                                "pattern_count": count,
                                "timestamp": chrono::Utc::now().timestamp_millis()
                            }));
                        }
                    },
                    Err(e) => eprintln!("QuantumSync error: {}", e),
                }
            }
        });

        // Initial sync
        let _ = GlobalSync::import(&self.memory);

        Ok(())
    }

    pub fn trigger_quantum_export(&self) -> Result<(), String> {
        GlobalSync::export(&self.memory)
    }
}
