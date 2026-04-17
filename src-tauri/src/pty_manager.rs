use std::collections::HashMap;
use std::sync::Arc;
use std::io::{Read, Write};
use std::thread;
use parking_lot::Mutex;
use portable_pty::{native_pty_system, Child, CommandBuilder, PtyPair, PtySize};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use tauri::{AppHandle, Emitter};
use crate::platform::{get_enhanced_path, is_windows};
use std::path::PathBuf;
use regex::Regex;

#[derive(Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub id: String,
    pub cwd: String,
    pub backend: String,
    pub session_id: Option<String>,
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
    output_buffer: Arc<Mutex<OutputBuffer>>,
    writer: Box<dyn Write + Send>,
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
    if is_windows() {
        let ext = if backend == "aider" { ".exe" } else { ".cmd" };
        let exe_name = format!("{}{}", backend, ext);
        
        for dir in portable_dirs {
            let path = dir.join(&exe_name);
            if path.exists() {
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

    pub fn set_portable_dirs(&self, dirs: Vec<PathBuf>) {
        *self.portable_bin_dirs.lock() = dirs;
    }

    pub fn spawn(
        &self,
        app: AppHandle,
        cwd: String,
        backend: String,
        args: Vec<String>,
    ) -> Result<String, String> {
        let id = Uuid::new_v4().to_string();
        let pty_system = native_pty_system();
        
        let pair = pty_system.openpty(PtySize {
            rows: 30,
            cols: 120,
            pixel_width: 0,
            pixel_height: 0,
        }).map_err(|e: anyhow::Error| e.to_string())?;

        let portable_dirs = self.portable_bin_dirs.lock().clone();
        let exe = find_executable(&backend, &portable_dirs);
        
        let mut cmd = CommandBuilder::new(exe);
        cmd.cwd(cwd.clone());
        cmd.args(args);
        
        // Environment
        let enhanced_path = crate::platform::get_enhanced_path(&portable_dirs);
        cmd.env("PATH", &enhanced_path);
        if crate::platform::is_windows() {
            cmd.env("Path", &enhanced_path);
        }
        cmd.env("SIMPLE_CODE_GUI", "1");

        let child = pair.slave.spawn_command(cmd).map_err(|e: anyhow::Error| e.to_string())?;
        
        let output_buffer = Arc::new(Mutex::new(OutputBuffer::new()));
        let output_buffer_clone = Arc::clone(&output_buffer);
        let id_clone = id.clone();
        let app_clone = app.clone();
        
        // Spawn reader thread
        let mut reader = pair.master.try_clone_reader().map_err(|e: anyhow::Error| e.to_string())?;
        thread::spawn(move || {
            let mut buf = [0u8; 8192];
            loop {
                match reader.read(&mut buf) {
                    Ok(n) if n > 0 => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
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
            output_buffer,
            writer,
        };

        self.sessions.lock().insert(id.clone(), session);
        Ok(id)
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
        let sessions = self.sessions.lock();
        if let Some(session) = sessions.get(id) {
            session.pair.master.resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            }).map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn kill(&self, id: &str) {
        let mut sessions = self.sessions.lock();
        if let Some(mut session) = sessions.remove(id) {
            let _ = session.child.kill();
        }
    }

    pub fn list_sessions(&self) -> Vec<SessionInfo> {
        let sessions = self.sessions.lock();
        sessions.values().map(|s| SessionInfo {
            id: s.id.clone(),
            cwd: "".to_string(), // We don't track cwd yet in Session struct but could
            backend: s.backend.clone(),
            session_id: None,
            spawned_at: 0,
        }).collect()
    }

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
