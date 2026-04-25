use std::collections::HashMap;
use std::sync::Arc;
use std::io::{Read, Write};
use std::thread;
use parking_lot::Mutex;
use portable_pty::{native_pty_system, Child, CommandBuilder, PtyPair, PtySize};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use tauri::{AppHandle, Emitter};
use crate::platform::is_windows;
use std::path::PathBuf;
use regex::Regex;

#[allow(dead_code)]
#[derive(Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub id: String,
    pub cwd: String,
    pub backend: String,
    pub session_id: Option<String>,
    pub nexus_session_id: Option<String>,
    pub spawned_at: u64,
}

struct OutputBuffer {
    lines: Vec<String>,
    partial: String,
}

struct Session {
    id: String,
    pair: PtyPair,
    child: Box<dyn Child + Send + Sync>,
    backend: String,
    cwd: String,
    args: Vec<String>,
    rows: u16,
    cols: u16,
    output_buffer: Arc<Mutex<OutputBuffer>>,
    writer: Box<dyn Write + Send>,
    resize_handle: Option<tokio::task::JoinHandle<()>>,
}

impl OutputBuffer {
    fn new() -> Self {
        Self {
            lines: Vec::with_capacity(200),
            partial: String::new(),
        }
    }

    fn append(&mut self, data: &str) {
        let text = format!("{}{}", self.partial, data);
        let mut parts: Vec<&str> = text.split('\n').collect();
        
        if let Some(last) = parts.pop() {
            self.partial = last.to_string();
        }

        let ansi_regex = Regex::new(r"\x1b\[[0-9;]*[a-zA-Z]|\x1b\][^\x07]*\x07").unwrap();

        for line in parts {
            let clean = ansi_regex.replace_all(line, "").trim().to_string();
            if !clean.is_empty() {
                self.lines.push(clean);
                if self.lines.len() > 200 {
                    self.lines.remove(0);
                }
            }
        }
    }
}

pub struct PtyManager {
    sessions: Arc<Mutex<HashMap<String, Session>>>,
    portable_bin_dirs: Arc<Mutex<Vec<PathBuf>>>,
}

fn find_executable(backend: &str, portable_dirs: &[PathBuf]) -> String {
    let enhanced_path = crate::platform::get_enhanced_path(portable_dirs);
    let sep = crate::platform::get_path_sep();
    
    if is_windows() {
        let ext = if backend == "aider" { ".exe" } else { ".cmd" };
        let exe_name = format!("{}{}", backend, ext);
        
        // First check portable dirs
        for dir in portable_dirs {
            let path = dir.join(&exe_name);
            if path.exists() {
                return path.to_string_lossy().into_owned();
            }
        }
        
        // Then check enhanced path
        for part in enhanced_path.split(sep) {
            let path = PathBuf::from(part).join(&exe_name);
            if path.exists() {
                return path.to_string_lossy().into_owned();
            }
        }
    } else {
        // On Unix, check portable dirs first
        for dir in portable_dirs {
            let path = dir.join(backend);
            if path.exists() {
                return path.to_string_lossy().into_owned();
            }
        }
        
        // Then check enhanced path
        for part in enhanced_path.split(sep) {
            if part.is_empty() { continue; }
            let path = PathBuf::from(part).join(backend);
            if path.exists() {
                // Check if it's executable
                #[cfg(unix)]
                {
                    use std::os::unix::fs::MetadataExt;
                    if let Ok(metadata) = std::fs::metadata(&path) {
                        if metadata.mode() & 0o111 != 0 {
                            return path.to_string_lossy().into_owned();
                        }
                    }
                }
                #[cfg(not(unix))]
                return path.to_string_lossy().into_owned();
            }
        }
    }
    
    backend.to_string()
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            portable_bin_dirs: Arc::new(Mutex::new(Vec::new())),
        }
    }

    #[allow(dead_code)]
    pub fn set_portable_dirs(&self, dirs: Vec<PathBuf>) {
        *self.portable_bin_dirs.lock() = dirs;
    }

    pub fn spawn(
        &self,
        app: AppHandle,
        cwd: String,
        backend: String,
        args: Vec<String>,
        rows: u16,
        cols: u16,
        nexus_session_id: Option<String>,
    ) -> Result<String, String> {
        let id = Uuid::new_v4().to_string();
        let pty_system = native_pty_system();
        
        let pair = pty_system.openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        }).map_err(|e: anyhow::Error| e.to_string())?;

        let portable_dirs = self.portable_bin_dirs.lock().clone();
        let exe = find_executable(&backend, &portable_dirs);
        println!("[PTY] Found executable: {}", exe);
        
        let mut cmd = CommandBuilder::new(exe);
        cmd.cwd(cwd.clone());
        cmd.args(args.clone());
        
        // Environment
        let enhanced_path = crate::platform::get_enhanced_path(&portable_dirs);
        println!("[PTY] Enhanced PATH: {}", enhanced_path);
        cmd.env("PATH", &enhanced_path);
        if crate::platform::is_windows() {
            cmd.env("Path", &enhanced_path);
        }
        cmd.env("SIMPLE_CODE_GUI", "1");
        if let Some(nexus_id) = nexus_session_id {
            cmd.env("RTK_AI_NEXUS_SESSION_ID", nexus_id);
        }

        println!("[PTY] Spawning command in {}", cwd);
        let child = pair.slave.spawn_command(cmd).map_err(|e: anyhow::Error| {
            let err_msg = format!("Failed to spawn command: {}", e);
            println!("[PTY] Error: {}", err_msg);
            err_msg
        })?;
        let pid = child.process_id();
        if let Some(p) = pid {
            let _ = app.emit(&format!("pty-pid-{}", id), p.to_string());
        }

        println!("[PTY] Command spawned successfully with ID: {}", id);
        let output_buffer = Arc::new(Mutex::new(OutputBuffer::new()));
        let output_buffer_clone = Arc::clone(&output_buffer);
        let id_clone = id.clone();
        let app_clone = app.clone();
        
        // Spawn reader thread
        let mut reader = pair.master.try_clone_reader().map_err(|e: anyhow::Error| e.to_string())?;
        thread::spawn(move || {
            let osc_regex = Regex::new(r"\x1b\]([0-9]+);([^\x07\x1b]*)(?:\x07|\x1b\\)").unwrap();
            let mut buf = [0u8; 8192];
            loop {
                match reader.read(&mut buf) {
                    Ok(n) if n > 0 => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        
                        // Metadata extraction (Title, Path)
                        for cap in osc_regex.captures_iter(&data) {
                            let code = &cap[1];
                            let value = &cap[2];
                            match code {
                                "0" | "1" | "2" => {
                                    let _ = app_clone.emit(&format!("pty-title-{}", id_clone), value.to_string());
                                }
                                "7" => {
                                    // OSC 7 value is usually file://hostname/path
                                    let path = if value.starts_with("file://") {
                                        // Simple extraction: find the first '/' after file://hostname
                                        if let Some(path_start) = value.find("//") {
                                            if let Some(actual_path_start) = value[path_start+2..].find('/') {
                                                value[path_start+2+actual_path_start..].to_string()
                                            } else {
                                                "/".to_string()
                                            }
                                        } else {
                                            value.to_string()
                                        }
                                    } else {
                                        value.to_string()
                                    };
                                    let _ = app_clone.emit(&format!("pty-path-{}", id_clone), path);
                                }
                                _ => {}
                            }
                        }

                        output_buffer_clone.lock().append(&data);
                        let _ = app_clone.emit(&format!("pty-data-{}", id_clone), data);
                    }
                    Ok(_) => break, // EOF
                    Err(_) => break, // Error
                }
            }
            let _ = app_clone.emit(&format!("pty-exit-{}", id_clone), 0);
        });

        let writer = pair.master.take_writer().map_err(|e: anyhow::Error| e.to_string())?;

        let session = Session {
            id: id.clone(),
            pair,
            child,
            backend,
            cwd,
            args,
            rows,
            cols,
            output_buffer,
            writer,
            resize_handle: None,
        };

        self.sessions.lock().insert(id.clone(), session);
        Ok(id)
    }

    pub fn set_backend(
        &self,
        app: AppHandle,
        id: &str,
        new_backend: String,
    ) -> Result<(), String> {
        let mut sessions = self.sessions.lock();
        let session = sessions.get_mut(id).ok_or_else(|| "Session not found".to_string())?;

        // Kill existing child
        let _ = session.child.kill();

        // Prepare new command
        let portable_dirs = self.portable_bin_dirs.lock().clone();
        let exe = find_executable(&new_backend, &portable_dirs);
        
        let mut cmd = CommandBuilder::new(exe);
        cmd.cwd(session.cwd.clone());
        
        // Map arguments based on backend (simplified logic from spawn)
        let mut new_args = Vec::new();
        if new_backend == "claude" {
            new_args.push("code".to_string());
        }
        cmd.args(new_args.clone());
        
        let enhanced_path = crate::platform::get_enhanced_path(&portable_dirs);
        cmd.env("PATH", &enhanced_path);
        if crate::platform::is_windows() {
            cmd.env("Path", &enhanced_path);
        }
        cmd.env("SIMPLE_CODE_GUI", "1");

        // Spawn new child in the SAME PTY pair
        let child = session.pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
        
        // Update session
        let pid = child.process_id();
        session.child = child;
        session.backend = new_backend.clone();
        session.args = new_args;

        if let Some(p) = pid {
            let _ = app.emit(&format!("pty-pid-{}", id), p.to_string());
        }

        // Emit recreation event
        let _ = app.emit("pty-recreated", serde_json::json!({
            "oldId": id,
            "newId": id,
            "backend": new_backend
        }));

        Ok(())
    }

    pub fn write(&self, id: &str, data: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock();
        if let Some(session) = sessions.get_mut(id) {
            session.writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
            session.writer.flush().map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn resize(&self, id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let mut sessions = self.sessions.lock();
        if let Some(session) = sessions.get_mut(id) {
            // Cancel existing resize task if any
            if let Some(handle) = session.resize_handle.take() {
                handle.abort();
            }

            // Update session dimensions
            session.cols = cols;
            session.rows = rows;

            // Ink-based backends (like claude) need debouncing to avoid crashes
            if session.backend == "claude" {
                let id_clone = id.to_string();
                let sessions_clone = Arc::clone(&self.sessions);
                
                let handle = tokio::spawn(async move {
                    // 1.5s debounce as per implementation plan
                    tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
                    
                    let mut sessions = sessions_clone.lock();
                    if let Some(session) = sessions.get_mut(&id_clone) {
                        println!("[PTY] Applying debounced resize for {}: {}x{}", id_clone, session.cols, session.rows);
                        let _ = session.pair.master.resize(PtySize {
                            rows: session.rows,
                            cols: session.cols,
                            pixel_width: 0,
                            pixel_height: 0,
                        });
                        session.resize_handle = None;
                    }
                });
                session.resize_handle = Some(handle);
            } else {
                // Immediate resize for other backends
                session.pair.master.resize(PtySize {
                    rows,
                    cols,
                    pixel_width: 0,
                    pixel_height: 0,
                }).map_err(|e| e.to_string())?;
            }
        }
        Ok(())
    }

    pub fn kill(&self, id: &str) {
        let mut sessions = self.sessions.lock();
        if let Some(mut session) = sessions.remove(id) {
            let _ = session.child.kill();
        }
    }

    #[allow(dead_code)]
    pub fn list_sessions(&self) -> Vec<SessionInfo> {
        let sessions = self.sessions.lock();
        sessions.values().map(|s| SessionInfo {
            id: s.id.clone(),
            cwd: "".to_string(),
            backend: s.backend.clone(),
            session_id: None,
            nexus_session_id: None,
            spawned_at: 0,
        }).collect()
    }

    pub fn check_health(&self) -> Vec<String> {
        let mut sessions = self.sessions.lock();
        let mut dead_ids = Vec::new();
        
        for (id, session) in sessions.iter_mut() {
            match session.child.try_wait() {
                Ok(Some(_)) => {
                    // Process exited
                    dead_ids.push(id.clone());
                }
                Err(_) => {
                    // Error checking status, assume dead
                    dead_ids.push(id.clone());
                }
                Ok(None) => {
                    // Still running
                }
            }
        }

        for id in &dead_ids {
            sessions.remove(id);
        }

        dead_ids
    }

    #[allow(dead_code)]
    pub fn read_output(&self, id: &str, max_lines: usize) -> Option<Vec<String>> {
        let sessions = self.sessions.lock();
        if let Some(session) = sessions.get(id) {
            let buffer = session.output_buffer.lock();
            let start = if buffer.lines.len() > max_lines {
                buffer.lines.len() - max_lines
            } else {
                0
            };
            return Some(buffer.lines[start..].to_vec());
        }
        None
    }
}
