use walkdir::WalkDir;
use std::path::{Path, PathBuf};
use crate::vector_engine::types::VectorChunk;
use regex::Regex;
use std::fs;

pub struct ProjectIndexer {
    root: PathBuf,
}

impl ProjectIndexer {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    pub fn scan(&self) -> Vec<VectorChunk> {
        let mut chunks = Vec::new();
        let walker = WalkDir::new(&self.root)
            .into_iter()
            .filter_entry(|e| !is_ignored(e.path()));

        for entry in walker.flatten() {
            if entry.path().is_file() {
                if let Some(file_chunks) = self.process_file(entry.path()) {
                    chunks.extend(file_chunks);
                }
            }
        }
        chunks
    }

    fn process_file(&self, path: &Path) -> Option<Vec<VectorChunk>> {
        let ext = path.extension()?.to_str()?;
        if !is_text_extension(ext) {
            return None;
        }

        let content = fs::read_to_string(path).ok()?;
        let rel_path = path.strip_prefix(&self.root).ok()?.to_string_lossy().to_string();
        
        let mut file_chunks = Vec::new();

        // 1. Extract Symbols (Functions/Classes)
        let symbols = extract_symbols(&content, ext);
        for symbol in symbols {
            file_chunks.push(VectorChunk {
                id: uuid::Uuid::new_v4().to_string(),
                symbol_name: symbol.name.clone(),
                project_path: self.root.to_string_lossy().to_string(),
                file_path: rel_path.clone(),
                content: symbol.content,
                metadata: {
                    let mut m = std::collections::HashMap::new();
                    m.insert("kind".to_string(), "symbol".to_string());
                    m.insert("symbol_name".to_string(), symbol.name);
                    m.insert("language".to_string(), ext.to_string());
                    m
                },
                embedding: None,
            });
        }

        // 2. Generic chunking for the whole file if it's not too large, or split into windows
        if content.len() < 2000 {
            file_chunks.push(VectorChunk {
                id: uuid::Uuid::new_v4().to_string(),
                symbol_name: rel_path.clone(),
                project_path: self.root.to_string_lossy().to_string(),
                file_path: rel_path.clone(),
                content: content.clone(),
                metadata: {
                    let mut m = std::collections::HashMap::new();
                    m.insert("kind".to_string(), "file".to_string());
                    m.insert("language".to_string(), ext.to_string());
                    m
                },
                embedding: None,
            });
        } else {
            // Sliding window chunking
            let window_size = 1500;
            let overlap = 300;
            let mut start = 0;
            while start < content.len() {
                let end = (start + window_size).min(content.len());
                let chunk_text = &content[start..end];
                
                file_chunks.push(VectorChunk {
                    id: uuid::Uuid::new_v4().to_string(),
                    symbol_name: format!("{}:{}", rel_path, start),
                    project_path: self.root.to_string_lossy().to_string(),
                    file_path: rel_path.clone(),
                    content: chunk_text.to_string(),
                    metadata: {
                        let mut m = std::collections::HashMap::new();
                        m.insert("kind".to_string(), "segment".to_string());
                        m.insert("language".to_string(), ext.to_string());
                        m.insert("offset".to_string(), start.to_string());
                        m
                    },
                    embedding: None,
                });

                if end == content.len() { break; }
                start += window_size - overlap;
            }
        }

        Some(file_chunks)
    }
}

fn is_ignored(path: &Path) -> bool {
    let s = path.to_string_lossy();
    s.contains("/node_modules/") || 
    s.contains("/.git/") || 
    s.contains("/target/") || 
    s.contains("/dist/") ||
    s.contains("/build/") ||
    s.contains("/.next/") ||
    s.contains("/.output/")
}

fn is_text_extension(ext: &str) -> bool {
    matches!(ext, "rs" | "ts" | "js" | "tsx" | "jsx" | "py" | "go" | "c" | "cpp" | "h" | "hpp" | "md" | "txt" | "toml" | "yaml" | "yml" | "json")
}

struct SymbolMatch {
    name: String,
    content: String,
}

fn extract_symbols(content: &str, ext: &str) -> Vec<SymbolMatch> {
    let mut matches = Vec::new();
    
    // Very basic regex-based symbol extraction
    // This is a placeholder for a more robust tree-sitter based approach
    let patterns = match ext {
        "rs" => vec![
            (Regex::new(r"(?m)^pub\s+fn\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(").unwrap(), "function"),
            (Regex::new(r"(?m)^fn\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(").unwrap(), "function"),
            (Regex::new(r"(?m)^pub\s+struct\s+([a-zA-Z_][a-zA-Z0-9_]*)").unwrap(), "struct"),
            (Regex::new(r"(?m)^struct\s+([a-zA-Z_][a-zA-Z0-9_]*)").unwrap(), "struct"),
        ],
        "ts" | "js" | "tsx" | "jsx" => vec![
            (Regex::new(r"(?m)^export\s+function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(").unwrap(), "function"),
            (Regex::new(r"(?m)^function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(").unwrap(), "function"),
            (Regex::new(r"(?m)^export\s+const\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*\(").unwrap(), "arrow_function"),
            (Regex::new(r"(?m)^const\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*\(").unwrap(), "arrow_function"),
            (Regex::new(r"(?m)^class\s+([a-zA-Z_][a-zA-Z0-9_]*)").unwrap(), "class"),
        ],
        "py" => vec![
            (Regex::new(r"(?m)^def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(").unwrap(), "function"),
            (Regex::new(r"(?m)^class\s+([a-zA-Z_][a-zA-Z0-9_]*)").unwrap(), "class"),
        ],
        _ => Vec::new(),
    };

    for (re, _kind) in patterns {
        for cap in re.captures_iter(content) {
            if let Some(name_match) = cap.get(1) {
                let name = name_match.as_str().to_string();
                // Find block end (naive: next empty line or next symbol start or just take 50 lines)
                let start_idx = cap.get(0).unwrap().start();
                let end_idx = (start_idx + 2000).min(content.len());
                let symbol_content = &content[start_idx..end_idx];
                
                matches.push(SymbolMatch {
                    name,
                    content: symbol_content.to_string(),
                });
            }
        }
    }

    matches
}
