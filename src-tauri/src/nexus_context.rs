use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::process::Command;
use tauri::command;

#[derive(Debug, Deserialize)]
pub struct ContextRequest {
    pub files: Vec<String>,
    pub prompt: String,
    pub project_path: String,
}

#[derive(Debug, Serialize)]
pub struct ContextResponse {
    pub kept_files: Vec<String>,
    pub pruned_files: Vec<String>,
    pub total_kept: usize,
    pub total_pruned: usize,
}

#[derive(Debug, Deserialize)]
struct GitNexusSymbol {
    #[serde(rename = "filePath")]
    file_path: String,
}

#[derive(Debug, Deserialize)]
struct GitNexusProcess {
    symbols: Vec<GitNexusSymbol>,
}

#[derive(Debug, Deserialize)]
struct GitNexusQueryResult {
    process_symbols: Option<Vec<GitNexusSymbol>>,
    definitions: Option<Vec<GitNexusSymbol>>,
}

#[command]
pub async fn nexus_prune_context(request: ContextRequest) -> Result<ContextResponse, String> {
    let mut relevant_files = HashSet::new();

    // 1. Run gitnexus query on the prompt to find semantically relevant files
    let output = Command::new("gitnexus")
        .arg("query")
        .arg(&request.prompt)
        .arg("--repo")
        .arg(&request.project_path)
        .arg("--limit")
        .arg("10")
        .output()
        .map_err(|e| format!("Failed to execute gitnexus query: {}", e))?;

    if output.status.success() {
        if let Ok(result) = serde_json::from_slice::<GitNexusQueryResult>(&output.stdout) {
            if let Some(symbols) = result.process_symbols {
                for sym in symbols {
                    relevant_files.insert(sym.file_path);
                }
            }
            if let Some(defs) = result.definitions {
                for def in defs {
                    relevant_files.insert(def.file_path);
                }
            }
        }
    }

    // 2. Fetch internal project intelligence to 'assimilate' raw graph data
    let dirty_files: HashSet<String> = crate::project_intelligence::get_dirty_files(&request.project_path)
        .into_iter()
        .collect();

    // 3. Filter input files with Nexus Logic
    let mut kept_files = Vec::new();
    let mut pruned_files = Vec::new();

    for file in request.files {
        // Nexus Logic: A file is kept if:
        // a) It's semantically relevant (GitNexus)
        // b) It's dirty (Internal Git Logic - Assimilated)
        // c) It's explicitly mentioned in the prompt
        let is_relevant = relevant_files.iter().any(|rf| file.contains(rf)) 
            || dirty_files.contains(&file)
            || request.prompt.to_lowercase().contains(&file.to_lowercase());
            
        if is_relevant {
            kept_files.push(file);
        } else {
            pruned_files.push(file);
        }
    }

    Ok(ContextResponse {
        total_kept: kept_files.len(),
        total_pruned: pruned_files.len(),
        kept_files,
        pruned_files,
    })
}
