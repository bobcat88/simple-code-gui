This document outlines the product vision for a **local-first agentic software operations desktop**.

## 1) Future Feature Map

### A. Workspace

* Activity feed
* Token/cost HUD

### B. Project Intelligence

* dependency inventory
* upgrade availability

### C. Orchestration

* assignments
* approvals
* post-run verification

### D. AI Runtime

Everything model/provider related.

* providers
* models
* context windows
* pricing profiles
* auth
* routing policies
* fallback rules
* rate limits
* token accounting


### F. System + Updates

Everything operational.

* app updates
* dependency updates
* plugin updates
* health checks
* telemetry/analytics
* crash reporting
* background jobs

## 2) Pending UX Components

### 1. Home / Workspace switcher

Shows recent projects, pinned projects, active sessions, token usage summary, update alerts.


### 4. Agent board

Cards for Planner, Builder, Reviewer, Researcher, Docs, Git, Voice, Ops.
Each card shows:

* model
* provider
* status
* queue
* current repo/task
* token burn rate
* last action
* quality/risk score


### 6. Dependency & upgrades center

Shows:

* detected integrations
* version state
* upgrade impact
* one-click update
* rollback option
* changelog / migration warnings

### 7. Cost & token observability view

Shows:

* per session
* per task
* per agent
* per provider/model
* estimated cost
* token saved by RTK/MCP
* trend lines
* monthly budgets

## 3) Implementation Roadmap

---

## 4) Core Principles

---

## 9) Multi-provider design

Need a true provider router, not just a dropdown.

### Providers to support first

* Claude
* OpenAI/Codex
* Gemini
* Ollama

### Provider abstraction must include

* auth method
* model list
* token accounting
* context limits
* streaming support
* tool support
* voice support
* structured output support
* reasoning/latency profile
* pricing profile
* local vs cloud classification

### Routing policy examples

* Planner → Claude or Gemini
* Code patching → Codex or Claude
* Repo summarization → Gemini or local Ollama
* Cheap background labeling → Ollama or cheap cloud model
* Reviewer agent → Claude / Codex higher-reliability model
* Voice response → cheaper low-latency model

### Model plans

The app should let users define named plans:

* Budget
* Balanced
* High quality
* Private local
* Deep architecture

Then show live token and cost impact by plan.

---

## 10) Token spent tracking and token saved tracking

This should be a first-class subsystem.

### Track “spent”

For every provider/model:

* input tokens
* output tokens
* cached tokens if applicable
* estimated cost
* latency
* retries
* failures

### Track “saved”

For RTK / MCP / GitNexus / caching:

* commands filtered
* raw estimated token size
* reduced token size
* percent saved
* saved cost estimate
* saved context window
* provider-specific impact

RTK publicly positions itself as reducing command-output token consumption by roughly 60–90% on supported workflows, so your product can use that mental model for the savings dashboard. ([GitHub][4])

### UX

Show:

* live session burn
* task burn
* agent burn
* provider burn
* monthly trend
* “this task would have cost X more without RTK/MCP”

---

## 12) get-shit-done integration design

GSD should become the **execution engine pattern**, not merely an import.

GSD publicly centers around project initialization, roadmap/phase planning, quick tasks, agent orchestration, state files, and wave-based execution. ([GitHub][3])

### What to reuse conceptually

* phase-based decomposition
* quick mode vs full mode
* state tracking
* wave execution
* verifier loop
* atomic commits
* planning artifacts

### What to redesign

Do not expose raw markdown-file mechanics as the primary user experience.
Instead:

* UI creates/manages artifacts
* artifacts remain exportable and git-visible
* app provides higher-level orchestration on top

### Execution modes

* Quick task
* Full project phase
* Research mode
* Discuss mode
* Validate mode
* Recovery / retry mode

---

## 16) Dependency scanning and auto-upgrade plan

Yes, this should exist, but safely.

### Detect

* app integrations: GSD, RTK, GitNexus, Kynetic-spec
* language package managers: npm/pnpm, cargo, pip, uv, bun, go, etc.
* hooks/rules/config versions
* MCP manifests
* local index versions
* updater availability

### Upgrade flow

When updates are available:

1. show current vs target version
2. show impact summary
3. show migration notes
4. allow “upgrade now”
5. run upgrade in isolated job
6. verify post-upgrade health
7. offer rollback if needed

### Important

There should be 3 classes of upgrades:

* safe patch
* minor with migration check
* breaking/manual review required

---

## 17) Recommended data model

Core entities:

* `Project`
* `ProjectInitializationState`
* `Provider`
* `Model`
* `ModelPlan`
* `Agent`
* `SpecItem`
* `Task`
* `AcceptanceCriterion`
* `ExecutionRun`
* `Artifact`
* `Dependency`
* `UpgradeNotice`
* `TokenEvent`
* `TokenSavingEvent`
* `VoiceCommand`
* `ContextSource`

This will save you pain later.

---

## 5) Delivery Roadmap

## Phase 6 — GSD execution layer

Build:

* quick mode
* full phase mode
* planning waves
* verifier/retry loop
* atomic commit pipeline

Deliverable:
The app stops being a chat shell and becomes an execution system.

## Phase 7 — Token savings telemetry

Build:

* RTK detection/install/check
* command optimization metrics
* live savings dashboard
* degraded-mode handling

Deliverable:
Visible cost reduction and context efficiency.

---

## 19) Biggest product risks

### Risk 1: Too many concepts at once

Fix:
Ship the shell + provider layer + project init before deep orchestration.

### Risk 2: “Integration soup”

Fix:
Everything behind adapters and capability flags.

### Risk 3: Windows/Linux/macOS differences

Fix:
Model platform capability explicitly.
RTK and shell hooks especially need this. ([GitHub][4])

### Risk 4: Cost/accounting drift

Fix:
Store raw provider events and derive dashboard numbers from immutable logs.

### Risk 5: Voice becomes novelty

Fix:
Design voice around command workflows, not casual conversation.

---

## 20) My strongest recommendation

If you want this to be genuinely excellent:

**Use Tauri + Rust + React/shadcn/ui.**
Do not go pure Rust UI.
Do not go Electron again.
Do not make the app “just another AI chat client.”

Make it a **repo-aware, spec-driven, multi-provider execution desktop** with:

* Codex-like UX,
* Rust core,
* project initialization and upgrade intelligence,
* visible token economics,
* and agent orchestration as the main product story.

That is the version that feels coherent.

If you want, I can turn this into a **full technical spec with folder structure, module boundaries, DB schema, and screen-by-screen UX map**.

---

## 21) Implementation Status (April 2026)

### ✅ Completed Phases
- **Phase 1: Rust Foundation**: Tauri shell, SQLite persistence, and multi-terminal IPC bridge.
- **Phase 2: Modern UI/UX**: Glassmorphism shell, Tiled terminal view, and density-optimized layouts.
- **Phase 3: Multi-provider runtime**: Provider abstraction and native adapters (Claude/Gemini/Ollama).
- **Phase 6: GSD Execution Layer**: Phase-based decomposition, executor loop, and atomic commit pipeline.
- **Phase 7: Token Savings Telemetry**: RTK integration for token savings tracking and dashboard metrics.
- **Phase 4: Initialization & Upgrade**: Integrated Wizard for project setup and capability discovery.
- **Phase 5: Spec/Task System**: Deepening the Beads integration for richer AC/Trait tracking.
- **Phase 8: GitNexus Intelligence**: Full sidebar integration with repo health, stack detection, and architectural graph metadata.
- **Phase 9: Voice and TTS**: Push-to-Talk workflow with Piper/Whisper integration.
- **Phase 10: Updater**: Auto-update service for application binaries and dependencies.

### 🚧 In Progress / Next
- **Phase 11: Activity Feed**: Workspace-wide event stream for observability.
- **Phase 12: Crash Reporting**: Native crash handler and diagnostic bundle generator.

### 📍 Current Milestone
**Intelligence & Observability Gate**: The app now provides a high-fidelity view of the repository's health and architecture, enabling agents to operate with context-awareness.

[1]: https://donutsdelivery.online/index.php/about/?utm_source=chatgpt.com "DonutsDelivery.online — Free Open-Source Desktop Apps"
[2]: https://www.skill-gallery.jp/en/skills/kynetic-ai/spec?utm_source=chatgpt.com "spec - Agent Skill | Skill Gallery"
[3]: https://github.com/gsd-build/get-shit-done?utm_source=chatgpt.com "GitHub - gsd-build/get-shit-done: A light-weight and powerful meta-prompting, context engineering and spec-driven development system for Claude Code by TÂCHES. · GitHub"
[4]: https://github.com/rtk-ai/rtk?utm_source=chatgpt.com "GitHub - rtk-ai/rtk: CLI proxy that reduces LLM token consumption by 60-90% on common dev commands. Single Rust binary, zero dependencies · GitHub"
[5]: https://rywalker.com/research/gitnexus?utm_source=chatgpt.com "GitNexus | Ry Walker Research | Ry Walker"
[6]: https://ui.shadcn.com/docs?utm_source=chatgpt.com "Introduction - shadcn/ui"
