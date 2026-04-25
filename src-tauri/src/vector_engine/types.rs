use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VectorChunk {
    pub id: String,
    pub symbol_name: String,
    pub project_path: String,
    pub file_path: String,
    pub content: String,
    pub metadata: HashMap<String, String>,
    pub embedding: Option<Vec<f32>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VectorIndexStatus {
    pub total_chunks: usize,
    pub indexed_chunks: usize,
    pub is_indexing: bool,
    pub last_updated: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VectorSearchResult {
    pub chunk: VectorChunk,
    pub score: f32,
}
