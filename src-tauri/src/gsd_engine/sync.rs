use serde::{Deserialize, Serialize};
use std::path::Path;
use crate::gsd_engine::knowledge::SwarmMemory;

#[derive(Debug, Serialize, Deserialize, Clone, Hash, PartialEq, Eq)]
pub struct MemoryEntry {
    #[serde(rename = "type")]
    pub entry_type: String,
    pub context: String,
    pub content: String,
    pub meta: String,
}

pub struct GlobalSync;

impl GlobalSync {
    pub fn get_vault_path() -> String {
        "/home/_johan/Documents/Borg/000 OS / Meta/Swarm Memory/collective_memory.yaml".to_string()
    }

    pub fn export(memory: &SwarmMemory) -> Result<(), String> {
        let entries = memory.get_all_entries().map_err(|e| e.to_string())?;
        let vault_path = Self::get_vault_path();
        
        let yaml = serde_yaml::to_string(&entries).map_err(|e| e.to_string())?;
        std::fs::write(vault_path, yaml).map_err(|e| e.to_string())?;
        
        Ok(())
    }

    pub fn import(memory: &SwarmMemory) -> Result<usize, String> {
        let vault_path = Self::get_vault_path();
        if !Path::new(&vault_path).exists() {
            return Ok(0);
        }

        let yaml = std::fs::read_to_string(vault_path).map_err(|e| e.to_string())?;
        let entries: Vec<MemoryEntry> = serde_yaml::from_str(&yaml).map_err(|e| e.to_string())?;
        
        let mut count = 0;
        for entry in entries {
            // Use INSERT OR IGNORE logic to avoid duplicates
            // We need to update SwarmMemory::record to use INSERT OR IGNORE if possible,
            // or we do a manual check. FTS5 doesn't support UNIQUE constraints easily.
            // For now, we'll just insert and accept potential duplicates or update SwarmMemory.
            memory.record(&entry.entry_type, &entry.context, &entry.content, &entry.meta)
                .map_err(|e| e.to_string())?;
            count += 1;
        }
        
        Ok(count)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gsd_engine::knowledge::SwarmMemory;
    use tempfile::tempdir;

    #[test]
    fn test_sync_cycle() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test_memory.db");
        let memory = SwarmMemory::new(db_path).unwrap();
        
        memory.record("pattern", "test", "Never use tabs", "{}").unwrap();
        
        // Mock vault path for test
        let test_vault = dir.path().join("vault.yaml");
        let yaml = serde_yaml::to_string(&memory.get_all_entries().unwrap()).unwrap();
        std::fs::write(&test_vault, yaml).unwrap();
        
        // Verify we can read it back
        let read_yaml = std::fs::read_to_string(&test_vault).unwrap();
        let entries: Vec<MemoryEntry> = serde_yaml::from_str(&read_yaml).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].content, "Never use tabs");
    }
}
