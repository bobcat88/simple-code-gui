use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use std::collections::HashMap;
use crate::database::DatabaseManager;
use chrono::Utc;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ContextSignature {
    pub id: String,
    pub hash: String,
    pub size_tokens: usize,
    pub hits: usize,
    pub last_used: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OptimizationResult {
    pub original_tokens: usize,
    pub optimized_tokens: usize,
    pub saved_tokens: usize,
    pub reuse_id: Option<String>,
}

pub struct RtkContextManager {
    db: Arc<DatabaseManager>,
    // In-memory cache of context hashes for fast lookups during a session
    signatures: Mutex<HashMap<String, ContextSignature>>,
}

impl RtkContextManager {
    pub fn new(db: Arc<DatabaseManager>) -> Self {
        Self {
            db,
            signatures: Mutex::new(HashMap::new()),
        }
    }

    pub async fn identify_and_optimize(&self, content: &str) -> Result<OptimizationResult, String> {
        // 1. Calculate Hash
        let hash = format!("{:x}", md5::compute(content));
        
        // 2. Check in-memory cache first
        let mut sigs = self.signatures.lock().await;
        if let Some(sig) = sigs.get_mut(&hash) {
            sig.hits += 1;
            sig.last_used = Utc::now().to_rfc3339();
            
            // Log the hit to database in background
            let db = self.db.clone();
            let id = sig.id.clone();
            tokio::spawn(async move {
                let _ = sqlx::query("UPDATE context_signatures SET hits = hits + 1, last_used = CURRENT_TIMESTAMP WHERE id = ?")
                    .bind(id)
                    .execute(&db.pool)
                    .await;
            });

            return Ok(OptimizationResult {
                original_tokens: sig.size_tokens,
                optimized_tokens: 0, // In Cache-reused scenario, we assume the provider keeps it
                saved_tokens: sig.size_tokens,
                reuse_id: Some(sig.id.clone()),
            });
        }

        // 3. Check Database
        let db_row = sqlx::query_as::<_, (String, String, i32, i32, String)>(
            "SELECT id, hash, size_tokens, hits, last_used FROM context_signatures WHERE hash = ?"
        )
        .bind(&hash)
        .fetch_optional(&self.db.pool)
        .await
        .map_err(|e| e.to_string())?;

        if let Some(row) = db_row {
            let sig = ContextSignature {
                id: row.0,
                hash: row.1,
                size_tokens: row.2 as usize,
                hits: (row.3 + 1) as usize,
                last_used: Utc::now().to_rfc3339(),
            };
            
            sigs.insert(hash, sig.clone());
            
            // Update DB in background
            let db = self.db.clone();
            let id = sig.id.clone();
            tokio::spawn(async move {
                let _ = sqlx::query("UPDATE context_signatures SET hits = hits + 1, last_used = CURRENT_TIMESTAMP WHERE id = ?")
                    .bind(id)
                    .execute(&db.pool)
                    .await;
            });

            return Ok(OptimizationResult {
                original_tokens: sig.size_tokens,
                optimized_tokens: 0, 
                saved_tokens: sig.size_tokens,
                reuse_id: Some(sig.id.clone()),
            });
        }

        // 4. New Context: Register it
        let id = uuid::Uuid::new_v4().to_string();
        let size = content.len() / 4; // Token approximation
        let sig = ContextSignature {
            id: id.clone(),
            hash: hash.clone(),
            size_tokens: size,
            hits: 1,
            last_used: Utc::now().to_rfc3339(),
        };

        sigs.insert(hash.clone(), sig.clone());

        // Save to DB in background
        let db = self.db.clone();
        tokio::spawn(async move {
            let _ = sqlx::query("INSERT INTO context_signatures (id, hash, size_tokens, hits) VALUES (?, ?, ?, 1)")
                .bind(id)
                .bind(hash)
                .bind(size as i32)
                .execute(&db.pool)
                .await;
        });

        Ok(OptimizationResult {
            original_tokens: size,
            optimized_tokens: size,
            saved_tokens: 0,
            reuse_id: None,
        })
    }
}

// Tauri Commands
#[tauri::command]
pub async fn rtk_optimize_context(
    state: tauri::State<'_, Arc<RtkContextManager>>,
    prompt: String,
) -> Result<OptimizationResult, String> {
    state.identify_and_optimize(&prompt).await
}
