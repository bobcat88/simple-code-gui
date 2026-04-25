use crate::ai_runtime::RuntimeManager;
use crate::ai_runtime::types::EmbeddingRequest;
use crate::vector_engine::types::{VectorChunk, VectorIndexStatus, VectorSearchResult};
use std::sync::Arc;
use tokio::sync::Mutex;

pub mod types;
pub mod indexer;

use crate::vector_engine::indexer::ProjectIndexer;
use std::path::PathBuf;

pub struct VectorEngine {
    runtime: Arc<RuntimeManager>,
    chunks: Arc<Mutex<Vec<VectorChunk>>>,
    status: Arc<Mutex<VectorIndexStatus>>,
}

impl VectorEngine {
    pub fn new(runtime: Arc<RuntimeManager>) -> Self {
        Self {
            runtime,
            chunks: Arc::new(Mutex::new(Vec::new())),
            status: Arc::new(Mutex::new(VectorIndexStatus {
                total_chunks: 0,
                indexed_chunks: 0,
                is_indexing: false,
                last_updated: 0,
            })),
        }
    }

    pub async fn add_chunks(&self, mut new_chunks: Vec<VectorChunk>) {
        let mut chunks = self.chunks.lock().await;
        let mut status = self.status.lock().await;
        
        status.total_chunks += new_chunks.len();
        chunks.append(&mut new_chunks);
        
        // Trigger background indexing if not already running
        if !status.is_indexing {
            let engine_chunks = self.chunks.clone();
            let engine_status = self.status.clone();
            let runtime = self.runtime.clone();
            
            status.is_indexing = true;
            
            tokio::spawn(async move {
                Self::indexing_loop(engine_chunks, engine_status, runtime).await;
            });
        }
    }

    async fn indexing_loop(
        chunks_mutex: Arc<Mutex<Vec<VectorChunk>>>,
        status_mutex: Arc<Mutex<VectorIndexStatus>>,
        runtime: Arc<RuntimeManager>,
    ) {
        loop {
            let mut target_index = None;
            let mut target_content = None;

            {
                let chunks = chunks_mutex.lock().await;
                for (i, chunk) in chunks.iter().enumerate() {
                    if chunk.embedding.is_none() {
                        target_index = Some(i);
                        target_content = Some(chunk.content.clone());
                        break;
                    }
                }
            }

            if let (Some(index), Some(content)) = (target_index, target_content) {
                let request = EmbeddingRequest {
                    model: None, // Use default
                    input: vec![content],
                    policy: None,
                };

                match runtime.embed(request).await {
                    Ok(response) => {
                        if let Some(embedding) = response.embeddings.into_iter().next() {
                            let mut chunks = chunks_mutex.lock().await;
                            if index < chunks.len() {
                                chunks[index].embedding = Some(embedding);
                                
                                let mut status = status_mutex.lock().await;
                                status.indexed_chunks += 1;
                                status.last_updated = std::time::SystemTime::now()
                                    .duration_since(std::time::UNIX_EPOCH)
                                    .unwrap_or_default()
                                    .as_secs();
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("Vector indexing error: {}", e);
                        // Wait a bit before retrying
                        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                    }
                }
            } else {
                // All caught up
                let mut status = status_mutex.lock().await;
                status.is_indexing = false;
                break;
            }

            // Small delay to prevent hammering
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        }
    }

    pub async fn search(&self, query: String, limit: usize) -> Result<Vec<VectorSearchResult>, String> {
        let request = EmbeddingRequest {
            model: None,
            input: vec![query],
            policy: None,
        };

        let response = self.runtime.embed(request).await?;
        let query_vec = response.embeddings.into_iter().next()
            .ok_or("No embedding returned for query")?;

        let chunks = self.chunks.lock().await;
        let mut results = Vec::new();

        for chunk in chunks.iter() {
            if let Some(chunk_vec) = &chunk.embedding {
                let score = cosine_similarity(&query_vec, chunk_vec);
                results.push(VectorSearchResult {
                    chunk: chunk.clone(),
                    score,
                });
            }
        }

        results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        results.truncate(limit);

        Ok(results)
    }

    pub async fn get_status(&self) -> VectorIndexStatus {
        self.status.lock().await.clone()
    }
}

fn cosine_similarity(v1: &[f32], v2: &[f32]) -> f32 {
    if v1.len() != v2.len() {
        return 0.0;
    }
    let dot_product: f32 = v1.iter().zip(v2.iter()).map(|(a, b)| a * b).sum();
    let norm1: f32 = v1.iter().map(|a| a * a).sum::<f32>().sqrt();
    let norm2: f32 = v2.iter().map(|a| a * a).sum::<f32>().sqrt();
    
    if norm1 == 0.0 || norm2 == 0.0 {
        return 0.0;
    }
    
    dot_product / (norm1 * norm2)
}

#[tauri::command]
pub async fn vector_index_project(
    project_path: String,
    engine: tauri::State<'_, Arc<VectorEngine>>,
) -> Result<usize, String> {
    let path = PathBuf::from(&project_path);
    if !path.exists() {
        return Err(format!("Project path does not exist: {}", project_path));
    }

    let indexer = ProjectIndexer::new(path);
    let chunks = indexer.scan();
    let count = chunks.len();
    
    engine.add_chunks(chunks).await;
    
    Ok(count)
}
