use rusqlite::{params, Connection, Result};
use std::path::Path;

pub struct SwarmMemory {
    conn: Connection,
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

        Ok(SwarmMemory { conn })
    }

    /// Record a new learning entry
    pub fn record(&self, entry_type: &str, context: &str, content: &str, meta: &str) -> Result<()> {
        self.conn.execute(
            "INSERT INTO swarm_knowledge (type, context, content, meta) VALUES (?1, ?2, ?3, ?4)",
            params![entry_type, context, content, meta],
        )?;
        Ok(())
    }

    /// Query the collective memory
    pub fn query(&self, term: &str) -> Result<Vec<String>> {
        let mut stmt = self.conn.prepare(
            "SELECT content FROM swarm_knowledge WHERE swarm_knowledge MATCH ?1 ORDER BY rank LIMIT 5"
        )?;
        let rows = stmt.query_map([term], |row| row.get(0))?;
        let mut results = Vec::new();
        for row in rows {
            results.push(row?);
        }
        Ok(results)
    }
}
