# Phase 28 Design: Swarm Collective Memory & Forensic Reasoning

## Objective
Implement a shared context layer for the Neural Swarm that allows agents to learn from both successful patterns and forensic failures. This system ensures that the swarm does not repeat the same mistakes in iterative "fix-and-verify" cycles.

## 1. Architecture: Hybrid Persistence
We will use a dual-layer storage approach:
- **Durable Memory (Git)**: High-level architectural decisions and "Golden Paths" are stored in a `swarm/memory` branch as Markdown files.
- **Fast Memory (SQLite + FTS5)**: Execution logs, error-fix pairs, and forensic reports are stored in a local SQLite database for sub-millisecond retrieval via Full-Text Search.

## 2. The Forensic Agent (Failure Reasoning)
When a swarm wave is forensically stashed (due to build failure or manual abort):
1. A **Forensic Agent** is spawned in the background.
2. It analyzes the `diff` between the wave start and the failure point.
3. It examines terminal logs (e.g., `tsc` errors, `bun build` failures).
4. It produces a **Forensic Report** containing:
   - **Hypothesis**: What the wave was trying to achieve.
   - **Failure Reason**: Root cause of the failure (syntax, logic, dependency).
   - **Counter-Pattern**: What future waves should *not* do in this context.
5. This report is indexed in the SQLite DB and linked to the forensic branch.

## 3. Knowledge Injection Workflow
- **Proactive**: The `gsd_engine` Supervisor queries the SQLite DB for the current task's context and injects relevant "Warnings" or "Patterns" into the worker agent's prompt.
- **Reactive**: Agents are equipped with `query_swarm_memory(query: string)` tool to perform semantic lookups on past forensic reports if they encounter friction.

## 4. HUD Integration
The Neural Swarm HUD will be updated with:
- **Memory Pulse**: A visual indicator when an agent is querying or updating the collective memory.
- **Report Viewer**: A modal to view the **Forensic Agent's** reasoning for any stashed wave.
- **Pattern Bookmark**: Allow the user to "Star" a specific fix or report, moving it from SQLite to the Git branch as a permanent project rule.

## 5. Implementation Steps
1. **Rust Backend**:
   - Initialize SQLite DB with FTS5 table `swarm_knowledge`.
   - Implement `swarm_record_pattern` and `swarm_query_memory` commands.
   - Create the `ForensicAgent` orchestration logic in `orchestration.rs`.
2. **Frontend**:
   - Update `NeuralSwarmHUD` to show "Knowledge Link" events.
   - Build the `ForensicReportViewer` component.
3. **KSpec Integration**:
   - Update the Supervisor agent to perform a pre-wave lookup.
