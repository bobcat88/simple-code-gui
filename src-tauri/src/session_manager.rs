use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub session_id: String,
    pub slug: String,
}

pub fn discover_sessions(
    project_path: &str,
    backend: Option<&str>,
) -> Result<Vec<Session>, String> {
    let backend = backend.unwrap_or("claude");

    match backend {
        "claude" => discover_claude_sessions(project_path),
        "opencode" => discover_opencode_sessions(project_path),
        _ => Ok(Vec::new()),
    }
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

    let mut sessions: Vec<(Session, SystemTime)> = Vec::new();
    let mut seen_sessions = std::collections::HashSet::new();

    for dir in project_dirs {
        if !dir.is_dir() {
            continue;
        }

        for entry in WalkDir::new(dir).max_depth(1) {
            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };

            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
                if let Some(session_id) = path.file_stem().and_then(|s| s.to_str()) {
                    if seen_sessions.contains(session_id) {
                        continue;
                    }

                    if let Ok(slug) = extract_slug_from_jsonl(path) {
                        let modified = entry
                            .metadata()
                            .ok()
                            .and_then(|metadata| metadata.modified().ok())
                            .unwrap_or(SystemTime::UNIX_EPOCH);
                        sessions.push((
                            Session {
                                session_id: session_id.to_string(),
                                slug,
                            },
                            modified,
                        ));
                        seen_sessions.insert(session_id.to_string());
                    }
                }
            }
        }
    }

    sessions.sort_by(|(_, left), (_, right)| right.cmp(left));

    Ok(sessions.into_iter().map(|(session, _)| session).collect())
}

fn discover_opencode_sessions(project_path: &str) -> Result<Vec<Session>, String> {
    let db_paths = opencode_db_paths(project_path);
    for db_path in db_paths {
        if !db_path.exists() {
            continue;
        }

        match read_opencode_sessions(&db_path, project_path) {
            Ok(sessions) => return Ok(sessions),
            Err(_) => continue,
        }
    }

    Ok(Vec::new())
}

fn opencode_db_paths(project_path: &str) -> Vec<PathBuf> {
    let mut paths = vec![Path::new(project_path)
        .join(".opencode")
        .join("opencode.db")];
    if let Some(data_dir) = dirs::data_dir() {
        paths.push(data_dir.join("opencode").join("opencode.db"));
    }
    paths
}

fn read_opencode_sessions(db_path: &Path, project_path: &str) -> Result<Vec<Session>, String> {
    let connection = rusqlite::Connection::open(db_path).map_err(|e| e.to_string())?;
    let mut statement = connection
        .prepare(
            "SELECT id, COALESCE(NULLIF(slug, ''), NULLIF(title, ''), id) AS label
             FROM session
             WHERE directory = ?1
               AND (archived IS NULL OR archived = 0)
               AND (archived_at IS NULL OR archived_at = '')
             ORDER BY COALESCE(updated_at, created_at, '') DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = statement
        .query_map([project_path], |row| {
            Ok(Session {
                session_id: row.get(0)?,
                slug: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut sessions = Vec::new();
    for row in rows {
        sessions.push(row.map_err(|e| e.to_string())?);
    }

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
    let content = fs::read(path).map_err(|e| e.to_string())?;
    let content = String::from_utf8_lossy(&content);

    // The slug is usually at the end of assistant messages.
    // We'll look for the last occurrence of `"slug":"..."`.

    let mut last_slug = None;
    for line in content.lines().rev() {
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(line) {
            if let Some(slug) = value
                .pointer("/message/slug")
                .and_then(|value| value.as_str())
            {
                last_slug = Some(slug.to_string());
                break;
            }
            if let Some(slug) = value.get("slug").and_then(|value| value.as_str()) {
                last_slug = Some(slug.to_string());
                break;
            }
        }

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

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use tempfile::TempDir;

    fn claude_project_dir(root: &Path, project_path: &str) -> PathBuf {
        root.join(".claude")
            .join("projects")
            .join(format!("-{}", sanitize_path(project_path)))
    }

    #[test]
    fn extracts_slug_from_nested_jsonl_message() {
        let temp = TempDir::new().unwrap();
        let file = temp.path().join("session.jsonl");
        fs::write(
            &file,
            r#"{"message":{"slug":"first"}}
{"message":{"slug":"latest"}}
"#,
        )
        .unwrap();

        assert_eq!(extract_slug_from_jsonl(&file).unwrap(), "latest");
    }

    #[test]
    fn extracts_slug_from_legacy_lossy_jsonl() {
        let temp = TempDir::new().unwrap();
        let file = temp.path().join("session.jsonl");
        fs::write(&file, b"\xff{\"slug\":\"legacy\"}").unwrap();

        assert_eq!(extract_slug_from_jsonl(&file).unwrap(), "legacy");
    }

    #[test]
    fn claude_discovery_tolerates_missing_data() {
        let temp = TempDir::new().unwrap();
        let missing_project = temp.path().join("missing").to_string_lossy().to_string();

        assert!(discover_claude_sessions(&missing_project)
            .unwrap()
            .is_empty());
    }

    #[test]
    fn opencode_discovery_reads_project_database() {
        let temp = TempDir::new().unwrap();
        let project_path = temp.path().to_string_lossy().to_string();
        let db_dir = temp.path().join(".opencode");
        fs::create_dir_all(&db_dir).unwrap();
        let db_path = db_dir.join("opencode.db");

        let connection = Connection::open(&db_path).unwrap();
        connection
            .execute(
                "CREATE TABLE session (
                    id TEXT PRIMARY KEY,
                    directory TEXT NOT NULL,
                    slug TEXT,
                    title TEXT,
                    archived INTEGER,
                    archived_at TEXT,
                    updated_at TEXT,
                    created_at TEXT
                )",
                [],
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO session
                 (id, directory, slug, title, archived, archived_at, updated_at, created_at)
                 VALUES
                 ('old', ?1, 'old-slug', 'Old', 0, NULL, '2026-04-20', '2026-04-20'),
                 ('new', ?1, '', 'New Title', 0, NULL, '2026-04-21', '2026-04-21'),
                 ('archived', ?1, 'archived', 'Archived', 1, NULL, '2026-04-22', '2026-04-22'),
                 ('other', '/other', 'other', 'Other', 0, NULL, '2026-04-23', '2026-04-23')",
                [&project_path],
            )
            .unwrap();
        drop(connection);

        let sessions = discover_sessions(&project_path, Some("opencode")).unwrap();

        assert_eq!(sessions.len(), 2);
        assert_eq!(sessions[0].session_id, "new");
        assert_eq!(sessions[0].slug, "New Title");
        assert_eq!(sessions[1].session_id, "old");
        assert_eq!(sessions[1].slug, "old-slug");
    }

    #[test]
    fn opencode_discovery_tolerates_missing_or_corrupt_database() {
        let temp = TempDir::new().unwrap();
        let project_path = temp.path().to_string_lossy().to_string();
        fs::create_dir_all(temp.path().join(".opencode")).unwrap();
        fs::write(
            temp.path().join(".opencode").join("opencode.db"),
            "not sqlite",
        )
        .unwrap();

        assert!(discover_sessions(&project_path, Some("opencode"))
            .unwrap()
            .is_empty());
    }

    #[test]
    fn backend_dispatch_routes_to_known_backends() {
        let temp = TempDir::new().unwrap();
        let project_path = temp.path().to_string_lossy().to_string();

        assert!(discover_sessions(&project_path, Some("claude"))
            .unwrap()
            .is_empty());
        assert!(discover_sessions(&project_path, Some("opencode"))
            .unwrap()
            .is_empty());
        assert!(discover_sessions(&project_path, Some("unknown"))
            .unwrap()
            .is_empty());
    }

    #[test]
    fn claude_project_dir_uses_sanitized_path() {
        let temp = TempDir::new().unwrap();
        let dir = claude_project_dir(temp.path(), "/tmp/simple-code-gui");

        assert!(dir.ends_with(".claude/projects/-tmp-simple-code-gui"));
    }
}
