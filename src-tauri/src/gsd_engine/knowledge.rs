use rusqlite::{params, Connection, Result};
use std::path::Path;

pub struct SwarmMemory {
    conn: std::sync::Mutex<Connection>,
}

impl SwarmMemory {
    pub fn new<P: AsRef<Path>>(path: P) -> Result<Self> {
        let conn = Connection::open(path)?;
        
        // Initialize FTS5 table for fast semantic-like searching
        conn.execute(
            "CREATE VIRTUAL TABLE IF NOT EXISTS swarm_knowledge USING fts5(
                type,    -- 'pattern', 'failure', 'decision'
                context, -- project area or code path
                content, -- the actual learning
                meta     -- JSON metadata (fix_id, wave_id)
            )",
            [],
        )?;

        Ok(SwarmMemory { conn: std::sync::Mutex::new(conn) })
    }

    /// Record a new learning entry
    pub fn record(&self, entry_type: &str, context: &str, content: &str, meta: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        // Simple duplicate check to keep collective memory clean
        let mut stmt = conn.prepare(
            "SELECT 1 FROM swarm_knowledge WHERE context = ?1 AND content = ?2 LIMIT 1"
        )?;
        let exists = stmt.exists(params![context, content])?;
        
        if !exists {
            conn.execute(
                "INSERT INTO swarm_knowledge (type, context, content, meta) VALUES (?1, ?2, ?3, ?4)",
                params![entry_type, context, content, meta],
            )?;
        }
        Ok(())
    }

    pub fn count_entries(&self) -> Result<usize> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT count(*) FROM swarm_knowledge")?;
        let count: usize = stmt.query_row([], |row| row.get(0))?;
        Ok(count)
    }

    pub fn prune_old_entries(&self, keep_latest: usize) -> Result<usize> {
        let conn = self.conn.lock().unwrap();
        // FTS5 doesn't have ROWID by default if not specified, but we can use rank or delete based on total count
        // For simplicity, we'll clear the table and the distiller will re-insert distilled knowledge.
        // In a production scenario, we'd use a real ID or timestamp.
        let deleted = conn.execute("DELETE FROM swarm_knowledge WHERE rowid NOT IN (SELECT rowid FROM swarm_knowledge ORDER BY rowid DESC LIMIT ?1)", params![keep_latest])?;
        Ok(deleted)
    }

    /// Query the collective memory
    pub fn query(&self, term: &str, entry_type: Option<&str>, limit: Option<usize>) -> Result<Vec<crate::gsd_engine::sync::MemoryEntry>> {
        let conn = self.conn.lock().unwrap();
        let limit = limit.unwrap_or(5);
        let sql = if let Some(_t) = entry_type {
            format!("SELECT type, context, content, meta FROM swarm_knowledge WHERE type = ?1 AND swarm_knowledge MATCH ?2 ORDER BY rank LIMIT {}", limit)
        } else {
            format!("SELECT type, context, content, meta FROM swarm_knowledge WHERE swarm_knowledge MATCH ?1 ORDER BY rank LIMIT {}", limit)
        };

        let mut stmt = conn.prepare(&sql)?;
        let mut results = Vec::new();

        if let Some(t) = entry_type {
            let rows = stmt.query_map(params![t, term], |row| {
                Ok(crate::gsd_engine::sync::MemoryEntry {
                    entry_type: row.get(0)?,
                    context: row.get(1)?,
                    content: row.get(2)?,
                    meta: row.get(3)?,
                })
            })?;
            for row in rows {
                results.push(row?);
            }
        } else {
            let rows = stmt.query_map([term], |row| {
                Ok(crate::gsd_engine::sync::MemoryEntry {
                    entry_type: row.get(0)?,
                    context: row.get(1)?,
                    content: row.get(2)?,
                    meta: row.get(3)?,
                })
            })?;
            for row in rows {
                results.push(row?);
            }
        };

        Ok(results)
    }

    /// Get all entries for sync
    pub fn get_all_entries(&self) -> Result<Vec<crate::gsd_engine::sync::MemoryEntry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT type, context, content, meta FROM swarm_knowledge"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(crate::gsd_engine::sync::MemoryEntry {
                entry_type: row.get(0)?,
                context: row.get(1)?,
                content: row.get(2)?,
                meta: row.get(3)?,
            })
        })?;

        let mut entries = Vec::new();
        for row in rows {
            entries.push(row?);
        }
        Ok(entries)
    }
}
