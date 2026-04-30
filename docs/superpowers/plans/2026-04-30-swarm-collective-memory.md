# Swarm Collective Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a hybrid context layer (Git + SQLite) and a specialized Forensic Agent to provide the swarm with "collective memory" of past successes and failures.

**Architecture:** 
1. **SQLite FTS5** stores fast execution patterns and forensic failure reasoning.
2. **Forensic Agent** automatically analyzes stashed waves to extract root causes.
3. **NeuralSwarmHUD** exposes these reports to the user on-demand.

**Tech Stack:** Rust (Tauri), SQLite, React, KSpec.

---

### Task 1: SQLite Knowledge Base Infrastructure

**Files:**
- Create: `src-tauri/src/gsd_engine/knowledge.rs`
- Modify: `src-tauri/src/gsd_engine/mod.rs`

- [ ] **Step 1: Create the Knowledge module**
```rust
// src-tauri/src/gsd_engine/knowledge.rs
use rusqlite::{params, Connection, Result};

pub struct SwarmMemory {
    conn: Connection,
}

impl SwarmMemory {
    pub fn new(path: &str) -> Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute(
            "CREATE VIRTUAL TABLE IF NOT EXISTS swarm_knowledge USING fts5(
                id,
                type, -- 'pattern', 'failure', 'decision'
                context, -- project area or code path
                content, -- the actual learning
                meta -- JSON metadata (fix_id, wave_id)
            )",
            [],
        )?;
        Ok(SwarmMemory { conn })
    }

    pub fn record(&self, entry_type: &str, context: &str, content: &str) -> Result<()> {
        self.conn.execute(
            "INSERT INTO swarm_knowledge (type, context, content) VALUES (?1, ?2, ?3)",
            params![entry_type, context, content],
        )?;
        Ok(())
    }

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
```

- [ ] **Step 2: Initialize Memory in GsdEngine**
Modify `src-tauri/src/gsd_engine/mod.rs` to include `swarm_memory` in the engine state.

- [ ] **Step 3: Commit**
```bash
git add src-tauri/src/gsd_engine/knowledge.rs src-tauri/src/gsd_engine/mod.rs
git commit -m "feat(gsd): initialize sqlite fts5 knowledge base for swarm memory"
```

---

### Task 2: Swarm Memory Commands

**Files:**
- Modify: `src-tauri/src/orchestration.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/renderer/api/types.ts`
- Modify: `src/renderer/api/tauri-backend.ts`

- [ ] **Step 1: Implement `swarm_query_memory` command**
In `src-tauri/src/orchestration.rs`:
```rust
#[tauri::command]
pub async fn swarm_query_memory(query: String) -> Result<Vec<String>, String> {
    // Access engine memory and query
    // ...
}
```

- [ ] **Step 2: Update Frontend API**
Update `ExtendedApi` and `TauriBackend` to expose the new query command.

- [ ] **Step 3: Commit**
```bash
git commit -m "feat(api): expose swarm_query_memory to frontend"
```

---

### Task 3: Specialized Forensic Agent

**Files:**
- Modify: `src-tauri/src/orchestration.rs`

- [ ] **Step 1: Implement the Forensic Reasoning Loop**
Modify `swarm_forensic_stash` to spawn a background agent (using existing `executor` logic) that runs a "forensic prompt" against the stashed branch.

- [ ] **Step 2: Record Analysis to Memory**
The forensic agent output should be automatically recorded into the SQLite DB using `SwarmMemory::record`.

- [ ] **Step 3: Commit**
```bash
git commit -m "feat(gsd): implement specialized forensic agent for failure reasoning"
```

---

### Task 4: HUD Integration & Report Viewer

**Files:**
- Create: `src/renderer/components/orchestration/ForensicReportViewer.tsx`
- Modify: `src/renderer/components/orchestration/NeuralSwarmHUD.tsx`

- [ ] **Step 1: Build the Report Viewer**
A modal component that displays the reasoning, hypothesis, and counter-patterns from the Forensic Agent.

- [ ] **Step 2: Connect HUD events**
Listen for "forensic-complete" events and show a "View Report" button on the failed wave card.

- [ ] **Step 3: Commit**
```bash
git commit -m "feat(ui): add forensic report viewer to Neural Swarm HUD"
```
