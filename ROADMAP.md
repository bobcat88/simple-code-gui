# Transwarp Nexus Roadmap

This document outlines the strategic roadmap for the **simple-code-gui** (Transwarp Nexus) evolution.

## Phase 14: AI Runtime Orchestration (Complete)
Implementing the foundational multi-provider execution layer.

- [x] **Provider Abstraction**: Unified interface for Claude, Gemini, OpenAI, and Ollama.
- [x] **Settings Data Model**: Support for `ProviderConfigs`, `ModelPlans`, and `AgentRoutingPolicies`.
- [x] **Routing Infrastructure**: Intelligent dispatching based on quality, cost, and latency.
- [x] **RTK Integration**: Context hashing and token savings tracking.
- [x] **Autonomous Learning**: Background metric evolution for agent performance.
- [x] **Dynamic Plan Switching**: Live switching between model plans based on project health.

## Phase 15: Agent Board Evolution (Complete)
Visualizing the orchestration layer and agent performance.

- [x] **Real-time Metrics**: Visualizing `burn_rate`, `quality_score`, and `evolution_status` on agent cards.
- [x] **Queue Management**: Active task queue visualization and manual re-prioritization.
- [x] **Live Trace**: Step-by-step execution trace for active agent workflows.
- [x] **Cost HUD**: Real-time session and task cost estimation in the header.

## Phase 16: Dependency Scanning & Auto-Upgrade
Ensuring the "Assimilation" principle by keeping integrations up to date.

- [x] **Integration Scanner**: Detecting local versions of RTK, GSD, GitNexus, and Kspec.
- [x] **Upgrade Impact Analysis**: Predicting the "blast radius" of updating a dependency.
- [x] **One-Click Update**: Automated download and verification of dependency binaries.
- [x] **Rollback Infrastructure**: Version-based rollback for dependency upgrades.

## Phase 17: Deep Execution Engine (GSD v2)
Refining the GSD integration from a CLI wrapper to a native execution core.

- [x] **Native Phase Planning**: UI-driven phase decomposition with git-backed persistence.
- [x] **Wave Execution UI**: Visualizing parallel task waves and blockers.
- [x] **Verifier Feedback Loop**: Interactive UAT and auto-fix cycles within the GUI.

## Phase 18: Cognitive Search & Long-term Memory (Complete)
Enhancing project intelligence with vector embeddings and cross-project knowledge.

- [x] **Vector Indexing**: Background embedding generation for repository symbols.
- [x] **Cognitive Query**: Semantic search across the codebase and historical session logs.
- [x] **Borg Integration**: Durable cross-project memory layer for "Condensed Knowledge" sharing.

## Phase 19: Vector Persistence (Complete)
Ensuring vector knowledge survives application restarts.

- [x] **SQLite Storage**: Persistent storage for vector chunks and metadata.
- [x] **Background Loading**: Automatic restoration of indexed knowledge on startup.

## Phase 20: Borg Cognitive Integration (Complete)
Bridging global knowledge into the UI and backend indexing loop.

- [x] **Global Indexing**: Support for `~/.gemini/antigravity/knowledge` folder.
- [x] **Frontend Bridge**: UI triggers for "Sync Global Knowledge" in the Intelligence Sidebar.
- [x] **Unified Search**: Seamless semantic search across project and global memory.

## Phase 21: Neural UI Navigation (Complete)
Making project intelligence actionable through the user interface.

- [x] **Neural Spotlight**: Unified semantic search (Cmd+K) using vector embeddings.
- [x] **Contextual Quick Actions**: Smart suggestions based on the current active file.
- [x] **Session Re-threading**: Semantic context restoration for PTY sessions.

## Phase 22: GSD Deep Hardening & Agentic Tooling (Complete)
Replacing mock execution with real AI-driven tool calling and provider orchestration.

- [x] **Agentic Tooling**: Core system tools (read, write, bash, list) for GSD agents.
- [x] **Tool-Calling Protocol**: Unified tool-use support for Claude, OpenAI, and Gemini.
- [x] **Hardened Execution Loop**: Multi-turn agentic reasoning in GsdExecutor.
- [x] **Context-Aware Path Resolution**: Automatic project-root mapping for tools.

## Phase 23: Autonomous Debugging & Forensics
Enabling agents to perform root-cause analysis and systematic debugging.

- [x] **Systematic Debugging Toolset**: Trace-point injection and log analysis tools for agents.
- [x] **Git History Awareness**: Reading and comparing git diffs to identify regressions.
- [ ] **Forensic Triage**: Automated hypothesis testing for bug reports.
- [ ] **Error IPC Bridge**: Streaming real-time backend errors directly to the agent runtime.

---

*Last Updated: April 2026*
