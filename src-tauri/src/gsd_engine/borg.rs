use std::path::PathBuf;
use std::fs::{OpenOptions, create_dir_all};
use std::io::Write;
use chrono::Local;
use crate::gsd_engine::knowledge::SwarmMemory;

pub struct BorgBridge {
    vault_root: PathBuf,
}

impl BorgBridge {
    pub fn new() -> Self {
        Self {
            vault_root: PathBuf::from("/home/_johan/Documents/Borg"),
        }
    }

    /// Get the path to the project-specific folder in Borg
    pub fn get_project_vault_path(&self, project_name: &str) -> PathBuf {
        self.vault_root.join("300 Entities/Projects").join(project_name)
    }

    /// Append a new learning entry to the project's chronicle.md in Borg
    pub fn record_learning(&self, project_name: &str, title: &str, content: &str) -> Result<(), String> {
        let project_path = self.get_project_vault_path(project_name);
        if !project_path.exists() {
            create_dir_all(&project_path).map_err(|e| e.to_string())?;
        }

        let chronicle_path = project_path.join("chronicle.md");
        let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S");
        let entry = format!("\n### [{}] {}\n{}\n", timestamp, title, content);

        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&chronicle_path)
            .map_err(|e| format!("Failed to open chronicle at {}: {}", chronicle_path.display(), e))?;

        writeln!(file, "{}", entry).map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Sync the global swarm memory with Borg's collective memory
    pub fn sync_collective_memory(&self, memory: &SwarmMemory) -> Result<usize, String> {
        let collective_path = self.vault_root.join("000 OS / Meta/Swarm Memory/collective_memory.yaml");
        
        // 1. Import from Borg
        let imported = if collective_path.exists() {
            let yaml = std::fs::read_to_string(&collective_path).map_err(|e| e.to_string())?;
            let entries: Vec<super::sync::MemoryEntry> = serde_yaml::from_str(&yaml).map_err(|e| e.to_string())?;
            
            let mut count = 0;
            for entry in entries {
                if let Ok(_) = memory.record(&entry.entry_type, &entry.context, &entry.content, &entry.meta) {
                    count += 1;
                }
            }
            count
        } else {
            0
        };

        // 2. Export to Borg (merged local + imported)
        let all_entries = memory.get_all_entries().map_err(|e| e.to_string())?;
        let yaml = serde_yaml::to_string(&all_entries).map_err(|e| e.to_string())?;
        
        if let Some(parent) = collective_path.parent() {
            create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        
        std::fs::write(&collective_path, yaml).map_err(|e| e.to_string())?;

        Ok(imported)
    }
}
