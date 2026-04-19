use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub session_id: String,
    pub slug: String,
}

pub fn discover_sessions(project_path: &str, backend: Option<&str>) -> Result<Vec<Session>, String> {
    let backend = backend.unwrap_or("claude");
    
    if backend == "claude" {
        return discover_claude_sessions(project_path);
    }
    
    // Other backends not implemented yet
    Ok(Vec::new())
}

fn discover_claude_sessions(project_path: &str) -> Result<Vec<Session>, String> {
    let home_dir = dirs::home_dir().ok_or("Could not find home directory")?;
    let claude_projects_dir = home_dir.join(".claude").join("projects");
    
    if !claude_projects_dir.exists() {
        return Ok(Vec::new());
    }

    // Sanitize path: replace non-alphanumeric with '-'
    let sanitized = sanitize_path(project_path);
    
    // Try both with and without leading '-'
    let mut project_dirs = Vec::new();
    
    let dir_with_dash = claude_projects_dir.join(format!("-{}", sanitized));
    if dir_with_dash.exists() {
        project_dirs.push(dir_with_dash);
    }
    
    let dir_without_dash = claude_projects_dir.join(&sanitized);
    if dir_without_dash.exists() {
        project_dirs.push(dir_without_dash);
    }
    
    // Also try a more aggressive sanitization if needed
    // (Claude Code seems to have variations)
    
    let mut sessions = Vec::new();
    let mut seen_sessions = std::collections::HashSet::new();

    for dir in project_dirs {
        if !dir.is_dir() { continue; }
        
        for entry in WalkDir::new(dir).max_depth(1) {
            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };
            
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
                if let Some(session_id) = path.file_stem().and_then(|s| s.to_str()) {
                    if seen_sessions.contains(session_id) { continue; }
                    
                    if let Ok(slug) = extract_slug_from_jsonl(path) {
                        sessions.push(Session {
                            session_id: session_id.to_string(),
                            slug,
                        });
                        seen_sessions.insert(session_id.to_string());
                    }
                }
            }
        }
    }
    
    // Sort by session_id (which might be chronological or we can use file mtime)
    // Actually, sorting by file modification time is better for "recent" sessions.
    
    Ok(sessions)
}

fn sanitize_path(path: &str) -> String {
    let mut sanitized = String::with_capacity(path.len());
    for c in path.chars() {
        if c.is_alphanumeric() {
            sanitized.push(c);
        } else {
            // Replace any non-alphanumeric with '-'
            // Avoid consecutive dashes if possible, but Claude Code seems to allow them
            sanitized.push('-');
        }
    }
    // Remove leading dash if we're going to add it later anyway
    if sanitized.starts_with('-') {
        sanitized.remove(0);
    }
    sanitized
}

fn extract_slug_from_jsonl(path: &Path) -> Result<String, String> {
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    
    // The slug is usually at the end of assistant messages.
    // We'll look for the last occurrence of `"slug":"..."`.
    
    let mut last_slug = None;
    for line in content.lines().rev() {
        if let Some(start) = line.find("\"slug\":\"") {
            let rest = &line[start + 8..];
            if let Some(end) = rest.find('\"') {
                last_slug = Some(rest[..end].to_string());
                break;
            }
        }
    }
    
    last_slug.ok_or_else(|| "No slug found".to_string())
}
