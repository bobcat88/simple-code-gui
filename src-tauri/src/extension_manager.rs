use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::collections::HashSet;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Extension {
    pub id: String,
    pub name: String,
    pub description: String,
    pub r#type: String, // "skill", "mcp", or "agent"
    pub repo: Option<String>,
    pub npm: Option<String>,
    pub commands: Option<Vec<String>>,
    pub tags: Option<Vec<String>>,
    pub config_schema: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InstalledExtension {
    #[serde(flatten)]
    pub extension: Extension,
    pub installed_at: u64,
    pub enabled: bool,
    pub scope: String, // "global" or "project"
    pub project_path: Option<String>,
    pub config: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Registry {
    pub version: u32,
    pub skills: Vec<Extension>,
    pub mcps: Vec<Extension>,
    pub agents: Vec<Extension>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RegistryCache {
    pub data: Registry,
    pub fetched_at: u64,
}

const DEFAULT_REGISTRY_URL: &str = "https://raw.githubusercontent.com/anthropics/claude-code-extensions/main/registry.json";
const REGISTRY_CACHE_TTL: u64 = 60 * 60; // 1 hour in seconds

fn get_extensions_dir() -> PathBuf {
    dirs::home_dir().unwrap().join(".claude").join("extensions")
}

fn get_installed_json_path() -> PathBuf {
    get_extensions_dir().join("installed.json")
}

fn get_registry_cache_path() -> PathBuf {
    get_extensions_dir().join("registry-cache.json")
}

fn get_mcp_config_path() -> PathBuf {
    dirs::home_dir().unwrap().join(".claude").join("mcp_config.json")
}

fn get_builtin_registry() -> Registry {
    Registry {
        version: 1,
        skills: vec![
            Extension {
                id: "get-shit-done".to_string(),
                name: "Get Shit Done (GSD)".to_string(),
                description: "Autonomous task execution framework with planning, codebase mapping, and guided execution".to_string(),
                r#type: "skill".to_string(),
                repo: Some("https://github.com/glittercowboy/get-shit-done".to_string()),
                npm: None,
                commands: Some(vec!["/gsd:plan".to_string(), "/gsd:execute".to_string(), "/gsd:status".to_string(), "/gsd:map-codebase".to_string()]),
                tags: Some(vec!["workflow".to_string(), "autonomous".to_string(), "planning".to_string(), "tasks".to_string()]),
                config_schema: None,
            }
        ],
        mcps: vec![
            Extension {
                id: "filesystem".to_string(),
                name: "Filesystem MCP".to_string(),
                description: "Read and write file access for Claude with configurable roots".to_string(),
                r#type: "mcp".to_string(),
                repo: None,
                npm: Some("@modelcontextprotocol/server-filesystem".to_string()),
                commands: None,
                tags: Some(vec!["files".to_string(), "io".to_string(), "core".to_string()]),
                config_schema: Some(serde_json::json!({
                    "roots": { "type": "array", "items": { "type": "string" }, "description": "Allowed directories" }
                })),
            }
        ],
        agents: vec![],
    }
}

#[tauri::command]
pub async fn extensions_fetch_registry(force_refresh: bool) -> Result<Registry, String> {
    let cache_path = get_registry_cache_path();
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();

    if !force_refresh && cache_path.exists() {
        if let Ok(content) = fs::read_to_string(&cache_path) {
            if let Ok(cache) = serde_json::from_str::<RegistryCache>(&content) {
                if now - cache.fetched_at < REGISTRY_CACHE_TTL {
                    return Ok(cache.data);
                }
            }
        }
    }

    // Ensure directory exists
    let _ = fs::create_dir_all(get_extensions_dir());

    // Fetch from network
    match reqwest::get(DEFAULT_REGISTRY_URL).await {
        Ok(response) => {
            if let Ok(remote_data) = response.json::<Registry>().await {
                let builtin = get_builtin_registry();
                
                // Merge (basic implementation)
                let mut skills = builtin.skills;
                let mut mcps = builtin.mcps;
                let mut agents = builtin.agents;

                let skill_ids: HashSet<_> = skills.iter().map(|s| s.id.clone()).collect();
                let mcp_ids: HashSet<_> = mcps.iter().map(|m| m.id.clone()).collect();
                let agent_ids: HashSet<_> = agents.iter().map(|a| a.id.clone()).collect();

                skills.extend(remote_data.skills.into_iter().filter(|s| !skill_ids.contains(&s.id)));
                mcps.extend(remote_data.mcps.into_iter().filter(|m| !mcp_ids.contains(&m.id)));
                agents.extend(remote_data.agents.into_iter().filter(|a| !agent_ids.contains(&a.id)));

                // Add custom URLs
                if let Ok(custom_urls) = extensions_get_custom_urls().await {
                    for url in custom_urls {
                        if let Ok(Some(ext)) = extensions_fetch_from_url(url.clone()).await {
                            if ext.r#type == "skill" && !skill_ids.contains(&ext.id) {
                                skills.push(ext);
                            } else if ext.r#type == "mcp" && !mcp_ids.contains(&ext.id) {
                                mcps.push(ext);
                            } else if ext.r#type == "agent" && !agent_ids.contains(&ext.id) {
                                agents.push(ext);
                            }
                        }
                    }
                }

                let data = Registry {
                    version: u32::max(builtin.version, remote_data.version),
                    skills,
                    mcps,
                    agents,
                };

                let cache = RegistryCache {
                    data: data.clone(),
                    fetched_at: now,
                };

                if let Ok(json) = serde_json::to_string_pretty(&cache) {
                    let _ = fs::write(cache_path, json);
                }

                return Ok(data);
            }
        }
        Err(e) => {
            eprintln!("Failed to fetch remote registry: {}", e);
        }
    }

    let builtin = get_builtin_registry();
    let mut skills = builtin.skills;
    let mut mcps = builtin.mcps;
    let mut agents = builtin.agents;

    let skill_ids: HashSet<_> = skills.iter().map(|s| s.id.clone()).collect();
    let mcp_ids: HashSet<_> = mcps.iter().map(|m| m.id.clone()).collect();
    let agent_ids: HashSet<_> = agents.iter().map(|a| a.id.clone()).collect();

    // Add custom URLs
    if let Ok(custom_urls) = extensions_get_custom_urls().await {
        for url in custom_urls {
            if let Ok(Some(ext)) = extensions_fetch_from_url(url.clone()).await {
                if ext.r#type == "skill" && !skill_ids.contains(&ext.id) {
                    skills.push(ext);
                } else if ext.r#type == "mcp" && !mcp_ids.contains(&ext.id) {
                    mcps.push(ext);
                } else if ext.r#type == "agent" && !agent_ids.contains(&ext.id) {
                    agents.push(ext);
                }
            }
        }
    }

    Ok(Registry {
        version: builtin.version,
        skills,
        mcps,
        agents,
    })
}

#[tauri::command]
pub async fn extensions_get_installed() -> Result<Vec<InstalledExtension>, String> {
    let path = get_installed_json_path();
    if !path.exists() {
        return Ok(vec![]);
    }

    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

fn get_custom_urls_path() -> PathBuf {
    get_extensions_dir().join("custom-urls.json")
}

#[tauri::command]
pub async fn extensions_get_custom_urls() -> Result<Vec<String>, String> {
    let path = get_custom_urls_path();
    if !path.exists() {
        return Ok(vec![]);
    }

    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn extensions_add_custom_url(url: String) -> Result<(), String> {
    let mut urls = extensions_get_custom_urls().await?;
    if !urls.contains(&url) {
        urls.push(url);
        let path = get_custom_urls_path();
        let _ = fs::create_dir_all(get_extensions_dir());
        let json = serde_json::to_string_pretty(&urls).map_err(|e| e.to_string())?;
        fs::write(path, json).map_err(|e| e.to_string())?;
        
        // Invalidate cache
        let _ = fs::remove_file(get_registry_cache_path());
    }
    Ok(())
}

#[tauri::command]
pub async fn extensions_remove_custom_url(url: String) -> Result<(), String> {
    let mut urls = extensions_get_custom_urls().await?;
    if let Some(idx) = urls.iter().position(|u| u == &url) {
        urls.remove(idx);
        let path = get_custom_urls_path();
        let json = serde_json::to_string_pretty(&urls).map_err(|e| e.to_string())?;
        fs::write(path, json).map_err(|e| e.to_string())?;
        
        // Invalidate cache
        let _ = fs::remove_file(get_registry_cache_path());
    }
    Ok(())
}

#[tauri::command]
pub async fn extensions_install_skill(extension: Extension, scope: String) -> Result<serde_json::Value, String> {
    let mut installed = extensions_get_installed().await?;
    
    // Check if already installed
    if installed.iter().any(|e| e.extension.id == extension.id) {
        return Ok(serde_json::json!({ "success": true }));
    }

    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
    
    let new_ext = InstalledExtension {
        extension,
        installed_at: now,
        enabled: true,
        scope,
        project_path: None,
        config: None,
    };

    installed.push(new_ext);
    
    let path = get_installed_json_path();
    let _ = fs::create_dir_all(get_extensions_dir());
    let json = serde_json::to_string_pretty(&installed).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;

    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn extensions_install_mcp(extension: Extension) -> Result<serde_json::Value, String> {
    // Similar to skill, but also update mcp_config.json
    extensions_install_skill(extension.clone(), "global".to_string()).await?;

    let mcp_path = get_mcp_config_path();
    let mut mcp_config: serde_json::Value = if mcp_path.exists() {
        let content = fs::read_to_string(&mcp_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).unwrap_or(serde_json::json!({ "mcpServers": {} }))
    } else {
        serde_json::json!({ "mcpServers": {} })
    };

    if let Some(mcp_servers) = mcp_config.get_mut("mcpServers").and_then(|v| v.as_object_mut()) {
        if let Some(npm_package) = &extension.npm {
            mcp_servers.insert(
                extension.id.clone(),
                serde_json::json!({
                    "command": "npx",
                    "args": ["-y", npm_package],
                }),
            );
        }
    }

    let json = serde_json::to_string_pretty(&mcp_config).map_err(|e| e.to_string())?;
    fs::write(mcp_path, json).map_err(|e| e.to_string())?;

    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn extensions_remove(id: String) -> Result<serde_json::Value, String> {
    let mut installed = extensions_get_installed().await?;
    let index = installed.iter().position(|e| e.extension.id == id);
    
    if let Some(idx) = index {
        installed.remove(idx);
        let path = get_installed_json_path();
        let json = serde_json::to_string_pretty(&installed).map_err(|e| e.to_string())?;
        fs::write(path, json).map_err(|e| e.to_string())?;
    }

    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn extensions_enable_for_project(id: String, project_path: String) -> Result<(), String> {
    let mut installed = extensions_get_installed().await?;
    let mut changed = false;

    // Check if we already have a project-specific entry
    let project_entry_exists = installed.iter().any(|e| e.extension.id == id && e.project_path.as_deref() == Some(&project_path));

    if !project_entry_exists {
        // Find the global entry to copy from
        if let Some(global_ext) = installed.iter().find(|e| e.extension.id == id && e.scope == "global").cloned() {
            let mut new_ext = global_ext;
            new_ext.scope = "project".to_string();
            new_ext.project_path = Some(project_path);
            new_ext.enabled = true;
            installed.push(new_ext);
            changed = true;
        }
    } else {
        // Just enable it
        if let Some(ext) = installed.iter_mut().find(|e| e.extension.id == id && e.project_path.as_deref() == Some(&project_path)) {
            if !ext.enabled {
                ext.enabled = true;
                changed = true;
            }
        }
    }

    if changed {
        let path = get_installed_json_path();
        let json = serde_json::to_string_pretty(&installed).map_err(|e| e.to_string())?;
        fs::write(path, json).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn extensions_disable_for_project(id: String, project_path: String) -> Result<(), String> {
    let mut installed = extensions_get_installed().await?;
    let mut changed = false;

    if let Some(ext) = installed.iter_mut().find(|e| e.extension.id == id && e.project_path.as_deref() == Some(&project_path)) {
        if ext.enabled {
            ext.enabled = false;
            changed = true;
        }
    } else {
        // If it's a global extension, we might need to create a project-specific "disabled" entry 
        // or just handle it in the frontend. For now, let's assume project-specific entries exist if toggled.
        if let Some(global_ext) = installed.iter().find(|e| e.extension.id == id && e.scope == "global").cloned() {
            let mut new_ext = global_ext;
            new_ext.scope = "project".to_string();
            new_ext.project_path = Some(project_path);
            new_ext.enabled = false;
            installed.push(new_ext);
            changed = true;
        }
    }

    if changed {
        let path = get_installed_json_path();
        let json = serde_json::to_string_pretty(&installed).map_err(|e| e.to_string())?;
        fs::write(path, json).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn extensions_fetch_from_url(url: String) -> Result<Option<Extension>, String> {
    // Very basic parsing
    if !url.contains("github.com") {
        return Err("Only GitHub URLs are supported".to_string());
    }

    let parts: Vec<&str> = url.split('/').collect();
    if parts.len() < 5 {
        return Err("Invalid GitHub URL".to_string());
    }

    let user = parts[3];
    let repo = parts[4].replace(".git", "");
    
    // Try to fetch extension.json or package.json from main/master
    let branches = vec!["main", "master"];
    let files = vec!["extension.json", "package.json"];

    for branch in branches {
        for file in &files {
            let raw_url = format!("https://raw.githubusercontent.com/{}/{}/{}/{}", user, repo, branch, file);
            if let Ok(response) = reqwest::get(&raw_url).await {
                if response.status().is_success() {
                    if let Ok(json) = response.json::<serde_json::Value>().await {
                        let mut ext = Extension {
                            id: repo.clone(),
                            name: repo.clone(),
                            description: format!("Extension from {}", url),
                            r#type: "skill".to_string(),
                            repo: Some(url.clone()),
                            npm: None,
                            commands: None,
                            tags: None,
                            config_schema: None,
                        };

                        if *file == "extension.json" {
                            if let Some(name) = json.get("name").and_then(|v| v.as_str()) {
                                ext.name = name.to_string();
                            }
                            if let Some(desc) = json.get("description").and_then(|v| v.as_str()) {
                                ext.description = desc.to_string();
                            }
                            if let Some(ext_type) = json.get("type").and_then(|v| v.as_str()) {
                                ext.r#type = ext_type.to_string();
                            }
                            if let Some(schema) = json.get("configSchema") {
                                ext.config_schema = Some(schema.clone());
                            }
                        } else if *file == "package.json" {
                            if let Some(name) = json.get("name").and_then(|v| v.as_str()) {
                                ext.name = name.to_string();
                            }
                            if let Some(desc) = json.get("description").and_then(|v| v.as_str()) {
                                ext.description = desc.to_string();
                            }
                            // Guess if it's an MCP
                            if json.get("mcpServers").is_some() || json.get("dependencies").and_then(|d| d.get("@modelcontextprotocol/sdk")).is_some() {
                                ext.r#type = "mcp".to_string();
                            }
                        }
                        
                        return Ok(Some(ext));
                    }
                }
            }
        }
    }

    // Fallback
    Ok(Some(Extension {
        id: repo.clone(),
        name: repo.clone(),
        description: format!("Extension from {}", url),
        r#type: "skill".to_string(),
        repo: Some(url),
        npm: None,
        commands: None,
        tags: None,
        config_schema: None,
    }))
}


#[tauri::command]
pub async fn extensions_set_config(id: String, config: serde_json::Value) -> Result<(), String> {
    let mut installed = extensions_get_installed().await?;
    if let Some(ext) = installed.iter_mut().find(|e| e.extension.id == id) {
        ext.config = Some(config);
        let path = get_installed_json_path();
        let json = serde_json::to_string_pretty(&installed).map_err(|e| e.to_string())?;
        fs::write(path, json).map_err(|e| e.to_string())?;
    }
    Ok(())
}
