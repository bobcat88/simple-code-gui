Yes — and I’d treat this as a **new product architecture**, not a port.

One caveat first: I could verify the public positioning of **Simple Code GUI** and the current capabilities of **get-shit-done**, **RTK**, and the publicly visible **kynetic-spec** skill pages, but I could not directly inspect the `DonutsDelivery/simple-code-gui` repository contents from GitHub in this session. So the “current project” list below is based on the public app description, your screenshot, and the related public project docs rather than a full repo audit. ([DonutsDelivery.online][1])

## 1) What the current project appears to be

From the public description and the UI you shared, **Simple Code GUI** is currently positioned as a desktop AI coding assistant manager with:

* multi-session/threaded workspaces,
* project organization,
* voice support,
* support for multiple coding backends/models,
* terminal integration,
* a settings/skills/automation style surface,
* and a productivity-focused desktop UX. ([DonutsDelivery.online][1])

Given your target integrations, the “current project + ecosystem” should now be thought of as these capability pillars:

1. **Core desktop shell**
   Windowing, navigation, workspaces, session/thread management, settings, project switching, notifications, updater.

2. **AI runtime layer**
   Provider abstraction for Claude, Codex/OpenAI, Gemini, Ollama, and later others.

3. **Task/spec system**
   `kynetic-spec`-style spec and task attribution for “what to build” and “who/what agent should do it.” Publicly visible kynetic-spec materials emphasize spec items, acceptance criteria, traits, and validation. ([Skill Gallery][2])

4. **Execution workflow system**
   `get-shit-done`-style planning, phase execution, agent orchestration, state files, and quick-task workflows. GSD currently supports multiple runtimes including Codex and Gemini, uses planning artifacts like `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, and supports task execution with agent orchestration. ([GitHub][3])

5. **Token efficiency / MCP optimization**
   RTK-style command filtering and token savings, with background accounting and surfacing of “saved” vs “spent.” RTK presents itself as a Rust CLI that reduces token consumption by filtering command outputs, and supports multiple AI tools including Codex, Gemini, Claude Code, Cursor, and others. ([GitHub][4])

6. **Repo intelligence layer**
   GitNexus-style code graph / knowledge graph / MCP context, so agents do not operate blind on large codebases. Public descriptions present GitNexus as a local or browser-based code-intelligence graph exposed through MCP for architectural awareness. ([rywalker.com][5])

That means the redesign should not be “AI chat app with a few tools.” It should be:

**a local-first agentic software operations desktop**.

## 2) Recommended fundamental redesign

### Recommended stack

I would build it as:

* **Desktop shell:** Tauri 2
* **Core app/backend:** Rust
* **Frontend:** React + TypeScript + Tailwind + shadcn/ui
* **State/query:** TanStack Query + Zustand or Redux Toolkit
* **Terminal streaming:** PTY bridge from Rust
* **Persistence:** SQLite + sqlx or Diesel
* **Search/index/cache:** SQLite first, Tantivy later if needed
* **Speech-to-text:** Whisper-compatible local/remote abstraction
* **TTS:** provider abstraction with local-first option
* **Updater:** Tauri updater plugin
* **Plugin/integration layer:** Rust capability plugins + MCP bridges ([Shadcn UI][6])

For your shadcn question specifically: **shadcn/ui is React-oriented**, so the cleanest answer is **Rust backend + React/shadcn frontend inside Tauri**, not a pure Rust UI framework. That gives you the modern product feel you want much faster than trying to force a Rust-native UI into a Codex-like design language. ([Shadcn UI][6])

## 3) Product vision for the redesign

The new app should be organized around 6 top-level domains:

### A. Workspace

Everything the user sees and switches between.

* Projects
* Sessions
* Threads
* Tasks
* Agents
* Terminal panes
* Activity feed
* Token/cost HUD
* Voice controls

### B. Project Intelligence

Everything the app knows about the repo.

* repo root
* stack detection
* initialized/not initialized status
* files like `AGENTS.md`, `ai.md`, hooks, MCP config, GSD/KSpec/RTK/GitNexus markers
* dependency inventory
* upgrade availability
* graph/index health
* git state

### C. Orchestration

Everything about planning and execution.

* spec items
* tasks
* acceptance criteria
* phases
* waves
* agents
* assignments
* approvals
* execution logs
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

### E. Voice + Interaction

Hands-free control and richer feedback.

* push-to-talk
* wake action
* dictated prompts
* spoken summaries
* read-aloud diffs
* interruption / cancel / continue

### F. System + Updates

Everything operational.

* app updates
* dependency updates
* plugin updates
* health checks
* telemetry/analytics
* crash reporting
* background jobs

---

## 4) UX direction: Codex-like, but productized

From your screenshot, the UI target is:

* dark, dense, elegant
* left navigation rail
* thread/task-centric
* central execution canvas
* top command/status bar
* right-side secondary intelligence panel
* subtle cards, soft borders, strong hierarchy
* keyboard-first, low visual noise

So I would design these screens.

### 1. Home / Workspace switcher

Shows recent projects, pinned projects, active sessions, token usage summary, update alerts.

### 2. Project view

Main shell with:

* left rail: Projects / Threads / Tasks / Agents / Skills / Automations / Settings
* center: selected thread/task/session
* right rail: agent roster, token spend, context sources, repo health

### 3. Task cockpit

This is the heart of the app.

Tabs:

* Plan
* Execute
* Files
* Agents
* Voice
* Metrics
* Git

This is where a task is analyzed, assigned, executed, reviewed, and committed.

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

### 5. Project initialization / upgrade wizard

Two main flows:

* **New Project**
* **Open Existing Project**

This must feel like a first-class onboarding funnel, not a settings page.

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

---

## 5) Architecture blueprint

## Layer 1: Desktop shell

Rust/Tauri owns:

* windowing
* filesystem access
* PTY/terminal
* background jobs
* secure credential storage
* OS integration
* updater
* process management
* audio device bridge

## Layer 2: Domain services in Rust

Separate crates/modules:

* `project_core`
* `repo_scan`
* `init_upgrade`
* `ai_runtime`
* `agent_orchestrator`
* `task_engine`
* `token_metering`
* `voice_io`
* `dependency_manager`
* `git_ops`
* `event_bus`

Each service publishes typed events.

## Layer 3: Frontend app

React UI subscribes to:

* project state
* live task execution
* terminal logs
* provider state
* token meter
* voice status
* upgrade notifications

## Layer 4: Integration adapters

Each external system gets its own adapter:

* `adapter_claude`
* `adapter_codex`
* `adapter_gemini`
* `adapter_ollama`
* `adapter_rtk`
* `adapter_kynetic`
* `adapter_gsd`
* `adapter_gitnexus`

No integration-specific logic should leak into the core domain.

---

## 6) Core redesign principle

Do **not** make “providers” the main abstraction.

Make these the main abstractions instead:

* **Project**
* **Context source**
* **Task**
* **Spec**
* **Agent**
* **Execution**
* **Artifact**
* **Provider**

Providers are replaceable.
Tasks/specs/executions are the product.

That keeps the app valuable even when model APIs change.

---

## 7) New-project initialization design

When creating a new project, the app should initialize a combined scaffold.

### Create these files/directories

At minimum:

* `.simplecode/manifest.toml`
* `.simplecode/state.db` or equivalent
* `ai.md`
* `AGENTS.md`
* `.mcp/`
* `.hooks/`
* `.planning/`
* `.spec/` or kynetic-compatible structure
* `.rtk/` if enabled
* `.gitnexus/` if enabled
* `.simplecode/providers.toml`
* `.simplecode/project-profile.json`

### `ai.md` should become the canonical local contract

It should include:

* project intent
* coding standards
* agent roles
* provider routing policy
* token/cost limits
* voice behavior rules
* Git rules
* approval policy
* repo-specific context sources
* enabled capabilities
* upgrade policy

### Initialization presets

Offer presets:

* Solo fast-build
* Spec-driven product build
* Enterprise guarded workflow
* Local-first privacy workflow
* Research-heavy architecture workflow

---

## 8) Existing-project “upgrade” flow

When a user points at an existing repo, the app should scan for markers and classify it as:

* fully initialized
* partially initialized
* third-party initialized
* not initialized
* conflicting initialization

### Scanner should detect

* `AGENTS.md`
* `CLAUDE.md`
* `ai.md`
* `.planning/`
* `.claude/`
* `.codex/`
* `.mcp/`
* `.rtk/`
* GitNexus config/index
* GSD files like `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`
* spec/task files from kynetic-like flows
* hooks and rules files
* provider config files
* `.env` patterns

### Upgrade proposal levels

If not initialized, propose:

* **Minimal upgrade**
  Add manifest, ai.md, provider config, project scan only.

* **Standard upgrade**
  Add task/spec structure, agent system, token tracking, hooks, update center.

* **Full upgrade**
  Add RTK, GitNexus, GSD/KSpec adapters, voice, cost dashboards, approval pipeline.

### Important rule

Never mutate a repo silently.
Always show:

* what will be created
* what will be modified
* compatibility notes
* rollback plan

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

## 11) Kynetic-spec integration design

I would not bury kynetic-spec as a hidden dependency.
Make it visible as the **spec/task spine**.

### Product role

Kynetic-spec should own:

* spec items
* acceptance criteria
* traits
* validation
* task derivation

That matches the public-facing documentation around spec items, AC, traits, and validation. ([Skill Gallery][2])

### In-app UI

For each task:

* linked spec item
* AC checklist
* trait tags
* derived tasks
* validation status
* implementation status

### Agent attribution

Use the spec metadata to decide:

* Planner
* Builder
* Reviewer
* Docs
* Test
* Git

Example:

* UI-heavy feature + accessibility trait → UI Builder + Reviewer
* backend constraint change → Architect + Builder + Verifier
* docs-only requirement → Docs agent only

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

## 13) RTK integration design

RTK is a great fit, especially because it is already Rust-based and focused on token savings across coding-agent workflows. ([GitHub][4])

### Recommended role

RTK becomes:

* command filtering layer
* cost reduction layer
* telemetry source for savings
* shell rewrite/helper layer where available

### Important constraint

Native Windows support has caveats for shell-hook behavior per RTK’s own docs, so the app should explicitly model:

* full hook mode
* instruction-only mode
* degraded mode on certain platforms
* WSL-recommended mode where relevant ([GitHub][4])

### In app

Show:

* hook installed?
* active?
* degraded?
* commands optimized
* commands bypassed
* percent token saved

---

## 14) GitNexus integration design

GitNexus looks highly relevant here because your app wants better task assignment, safer edits, and richer repo awareness. Public descriptions position it as a local/browser code knowledge graph exposed through MCP for dependency and execution-flow awareness. ([rywalker.com][5])

### Best role

Use GitNexus for:

* repo graph indexing
* architectural blast-radius analysis
* dependency-aware context selection
* smarter agent assignment
* safer review prompts
* upgrade impact analysis

### In-app usage

Before codegen or patching:

* query GitNexus
* pull impacted files/modules
* summarize architecture neighborhood
* attach findings to task context

### If incompatibility appears

Keep GitNexus optional behind a capability flag.
Do not hard-couple the app to it.

---

## 15) Voice, TTS, and recognition

This should not be a gimmick.
It should target real workflows:

* “start quick task”
* “summarize current plan”
* “read last diff”
* “switch to project X”
* “approve upgrade”
* “why did the reviewer fail this task”
* “dictate acceptance criteria”

### Voice architecture

* local mic capture in Rust
* STT adapter
* text command parser
* route to orchestration engine
* TTS adapter for spoken feedback

### Good default behavior

* push-to-talk
* optional wake phrase later
* concise spoken summaries
* never auto-speak code blocks unless requested

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

## 18) Delivery roadmap

## Phase 0 — Product/spec definition

Define:

* app identity
* supported workflows
* provider matrix
* initialization contract
* upgrade contract
* security model
* plugin boundaries

## Phase 1 — Rust foundation

Build:

* Tauri shell
* Rust services
* event bus
* SQLite persistence
* project scanner
* provider abstraction
* basic React UI shell

Deliverable:
A stable Codex-like shell with projects, sessions, settings, and logs.

## Phase 2 — Modern UI/UX

Build:

* left rail
* thread/task canvas
* right metrics panel
* command palette
* settings UX
* keyboard shortcuts
* dense dark theme
* smooth streaming/log rendering

Deliverable:
A product that already feels like the target.

## Phase 3 — Multi-provider runtime

Build:

* Claude/Codex/Gemini/Ollama adapters
* model plans
* routing rules
* provider health
* token accounting baseline

Deliverable:
Task execution across multiple providers.

## Phase 4 — Initialization and upgrade engine

Build:

* new project wizard
* existing project scan
* initialization classifier
* minimal/standard/full upgrades
* generated `ai.md` + agent/hook/MCP bundle

Deliverable:
The app can become the control plane for repos.

## Phase 5 — Spec/task system

Build:

* kynetic-style spec view
* AC editor
* trait handling
* task derivation
* agent attribution engine

Deliverable:
Spec-driven execution becomes first-class.

## Phase 6 — GSD execution layer

Build:

* quick mode
* full phase mode
* planning waves
* verifier/retry loop
* atomic commit pipeline

Deliverable:
The app stops being a chat shell and becomes an execution system.

## Phase 7 — RTK + savings telemetry

Build:

* RTK detection/install/check
* command optimization metrics
* live savings dashboard
* degraded-mode handling

Deliverable:
Visible cost reduction and context efficiency.

## Phase 8 — GitNexus intelligence

Build:

* index/detect/install bridge
* graph query UI
* impact analysis
* context enrichment
* pre-execution architectural summary

Deliverable:
Agents operate with much better repo awareness.

## Phase 9 — Voice and TTS

Build:

* STT/TTS adapters
* push-to-talk
* spoken summaries
* dictation of tasks/specs
* interruption controls

Deliverable:
True hands-free support.

## Phase 10 — Updater and ecosystem management

Build:

* app updater
* dependency updater
* migration warnings
* rollback
* background health jobs

Deliverable:
Operational maturity.

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
- **Phase 4: Initialization & Upgrade**: Integrated Wizard for project setup and capability discovery.
- **Phase 8: GitNexus Intelligence**: Full sidebar integration with repo health, stack detection, and architectural graph metadata.
- **Phase 10: Updater**: Auto-update service for application binaries and dependencies.

### 🚧 In Progress / Next
- **Phase 9: Voice and TTS**: Push-to-Talk workflow with Piper/Whisper integration (Targeting next session).
- **Phase 5: Spec/Task System**: Deepening the Beads integration for richer AC/Trait tracking.

### 📍 Current Milestone
**Intelligence & Observability Gate**: The app now provides a high-fidelity view of the repository's health and architecture, enabling agents to operate with context-awareness.

[1]: https://donutsdelivery.online/index.php/about/?utm_source=chatgpt.com "DonutsDelivery.online — Free Open-Source Desktop Apps"
[2]: https://www.skill-gallery.jp/en/skills/kynetic-ai/spec?utm_source=chatgpt.com "spec - Agent Skill | Skill Gallery"
[3]: https://github.com/gsd-build/get-shit-done?utm_source=chatgpt.com "GitHub - gsd-build/get-shit-done: A light-weight and powerful meta-prompting, context engineering and spec-driven development system for Claude Code by TÂCHES. · GitHub"
[4]: https://github.com/rtk-ai/rtk?utm_source=chatgpt.com "GitHub - rtk-ai/rtk: CLI proxy that reduces LLM token consumption by 60-90% on common dev commands. Single Rust binary, zero dependencies · GitHub"
[5]: https://rywalker.com/research/gitnexus?utm_source=chatgpt.com "GitNexus | Ry Walker Research | Ry Walker"
[6]: https://ui.shadcn.com/docs?utm_source=chatgpt.com "Introduction - shadcn/ui"
