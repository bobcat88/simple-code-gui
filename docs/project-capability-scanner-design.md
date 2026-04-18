# Project Capability Scanner Design

Status: design baseline for `simple-code-gui-g40`

This document defines the scanner/classifier that existing and new projects use
before initialization, upgrade, task loading, or spec-driven execution.

The scanner is read-only. It must never create, edit, delete, initialize, repair,
or migrate files. It returns facts, classification, warnings, and proposal inputs.

## Purpose

The scanner answers four questions:

- What workflow markers exist in this repo?
- Which capabilities are installed, initialized, enabled, healthy, degraded, or
  missing?
- How should Simple Code GUI classify the project initialization state?
- What information is needed to build a safe initialization or upgrade proposal?

This replaces scattered single-purpose checks such as "does `.beads` exist?" or
"does `.kspec` exist?" with a single typed scan result.

## Inputs

Required input:

- `rootPath`: absolute project root path.

Optional inputs:

- `includeCliHealth`: run lightweight CLI version/status commands.
- `includeGitHealth`: inspect git state.
- `includeProviderHealth`: inspect provider command availability.
- `includeMcpHealth`: parse and validate MCP config.
- `maxDepth`: maximum depth for marker search; default should be shallow.

The first implementation should default to shallow root-level marker detection
and only run fast commands. Expensive graph/index checks should be opt-in.

## Output Contract

The Tauri command should eventually expose:

```ts
type ProjectInitializationState =
  | 'not_initialized'
  | 'partially_initialized'
  | 'fully_initialized'
  | 'third_party_initialized'
  | 'conflicting_initialization'

interface ProjectCapabilityScan {
  rootPath: string
  scannedAt: string
  initializationState: ProjectInitializationState
  markers: DetectedMarker[]
  capabilities: CapabilityScanResult[]
  warnings: ScanWarning[]
  blockers: ScanBlocker[]
  upgradeInputs: UpgradeProposalInput
}
```

## Marker Model

Markers are file, directory, config, command, or generated-index evidence found
by the scanner.

```ts
interface DetectedMarker {
  id: string
  kind: 'file' | 'directory' | 'config' | 'command' | 'index' | 'generated'
  path?: string
  command?: string
  sourceSystem: SourceSystem
  confidence: 'low' | 'medium' | 'high'
  status: 'present' | 'missing' | 'unreadable' | 'stale' | 'unknown'
  details?: Record<string, unknown>
}
```

Initial marker IDs:

- `simplecode_manifest`: `.simplecode/manifest.toml`
- `simplecode_profile`: `.simplecode/project-profile.json`
- `simplecode_state`: `.simplecode/state.db`
- `ai_contract`: `ai.md`
- `agents_contract`: `AGENTS.md`
- `claude_contract`: `CLAUDE.md` or `.claude/CLAUDE.md`
- `claude_settings`: `.claude/settings.json`
- `codex_config`: `.codex/`
- `mcp_project_config`: `.mcp/`
- `mcp_claude_config`: `.claude/mcp_config.json`
- `hooks`: `.hooks/`
- `planning_dir`: `.planning/`
- `spec_dir`: `.spec/`
- `kspec_worktree`: `.kspec/`
- `kspec_agents_generated`: `kspec-agents.md`
- `beads_dir`: `.beads/`
- `gitnexus_index`: `.gitnexus/meta.json`
- `gitnexus_store`: `.gitnexus/`
- `rtk_config`: `.rtk/`
- `rtk_rules`: `.agents/rules/antigravity-rtk-rules.md`
- `gsd_project`: `PROJECT.md`
- `gsd_requirements`: `REQUIREMENTS.md`
- `gsd_roadmap`: `ROADMAP.md`
- `gsd_state`: `STATE.md`
- `env_file`: `.env`, `.env.local`, `.env.example`
- `git_repo`: `.git/`
- `package_json`: `package.json`
- `cargo_manifest`: `Cargo.toml` or `src-tauri/Cargo.toml`

## Capability Model

Capabilities project marker and CLI health into the contract from
`docs/spec-driven-development-contract.md`.

```ts
interface CapabilityScanResult {
  id: string
  kind:
    | 'task_backend'
    | 'spec_backend'
    | 'execution_workflow'
    | 'repo_intelligence'
    | 'token_optimizer'
    | 'mcp_server'
    | 'provider'
    | 'voice'
    | 'updater'
    | 'project_contract'
  sourceSystem: SourceSystem
  installed: boolean
  initialized: boolean
  enabled: boolean
  mode: 'full' | 'partial' | 'instruction_only' | 'degraded' | 'disabled' | 'unknown'
  health: 'healthy' | 'warning' | 'error' | 'unknown'
  version?: string
  markerIds: string[]
  details?: Record<string, unknown>
}
```

Initial capability IDs:

- `simplecode_project_contract`
- `agents_instructions`
- `claude_instructions`
- `beads_task_backend`
- `kspec_spec_backend`
- `gsd_execution_workflow`
- `rtk_token_optimizer`
- `gitnexus_repo_intelligence`
- `mcp_bridge`
- `provider_claude`
- `provider_gemini`
- `provider_codex`
- `provider_opencode`
- `provider_aider`
- `provider_ollama`
- `git_repository`

## Source Systems

Use the source-system names from the product contract:

- `simple_code_gui`
- `beads`
- `kspec`
- `gsd`
- `rtk`
- `gitnexus`
- `mcp`
- `provider`
- `git`
- `terminal`
- `user`

## Classification Rules

### not_initialized

Use when none of the following are present:

- Simple Code GUI project contract markers.
- Recognized task/spec backend markers.
- Recognized execution workflow markers.
- Agent instruction markers.

Package manager files or `.git/` alone do not initialize a project for Simple
Code GUI.

### partially_initialized

Use when at least one Simple Code GUI marker exists, but the project is missing
one or more required baseline contract markers.

Baseline contract markers:

- `.simplecode/manifest.toml`
- `ai.md`
- `AGENTS.md`
- at least one task or spec backend capability

Example: `AGENTS.md` and `.beads/` exist, but no `.simplecode/manifest.toml` or
`ai.md`.

### fully_initialized

Use when the project has a coherent Simple Code GUI contract:

- `.simplecode/manifest.toml`
- `ai.md`
- `AGENTS.md`
- initialized task/spec backend
- no conflict-level warnings

Optional capabilities such as RTK, GitNexus, GSD, MCP, voice, and provider plans
may be missing without preventing full initialization.

### third_party_initialized

Use when the project has strong third-party agentic workflow markers but no
Simple Code GUI contract.

Examples:

- `.kspec/` exists without `.simplecode/manifest.toml`.
- `.beads/` and `AGENTS.md` exist without `ai.md`.
- GSD project files exist without Simple Code GUI manifest.
- `.claude/CLAUDE.md` exists without app contract files.

This state should lead to an import/upgrade proposal, not a blind initialization.

### conflicting_initialization

Use when markers imply incompatible or ambiguous authorities.

Initial conflict rules:

- `.simplecode/manifest.toml` exists but is unreadable or references a missing
  project root.
- Both `.kspec/` and `.spec/` exist with different apparent authorities.
- Both Beads and KSpec are initialized, but the manifest selects neither or
  selects a missing backend.
- Multiple instruction files exist with contradictory app ownership markers.
- GitNexus metadata exists but points at a different `repoPath`.
- A project has generated KSpec instructions (`kspec-agents.md`) but no `.kspec/`
  worktree and no manifest explaining generated-only mode.

Conflict classification should include blockers, not just warnings.

## Warning Model

Warnings are non-blocking scan findings.

```ts
interface ScanWarning {
  id: string
  severity: 'info' | 'warning'
  title: string
  detail: string
  markerIds: string[]
  capabilityIds: string[]
}
```

Initial warnings:

- `generated_kspec_without_worktree`
- `beads_without_spec_backend`
- `claude_contract_without_agents_contract`
- `rtk_rules_without_rtk_config`
- `gitnexus_without_embeddings`
- `mcp_config_global_only`
- `provider_command_missing`
- `large_dirty_worktree`

## Blocker Model

Blockers prevent automatic initialization or upgrade.

```ts
interface ScanBlocker {
  id: string
  title: string
  detail: string
  markerIds: string[]
  recommendedAction: string
}
```

Initial blockers:

- `unreadable_project_root`
- `manifest_unreadable`
- `manifest_root_mismatch`
- `conflicting_spec_authority`
- `gitnexus_root_mismatch`
- `unsafe_existing_ai_contract`

## Upgrade Proposal Inputs

The scanner should not decide the final upgrade. It should provide inputs for
the separate initialization/upgrade proposal flow.

```ts
interface UpgradeProposalInput {
  canProposeMinimal: boolean
  canProposeStandard: boolean
  canProposeFull: boolean
  recommendedPreset:
    | 'minimal'
    | 'standard'
    | 'full_spec_driven'
    | 'guarded'
    | 'local_first'
    | 'manual_review'
  createCandidates: string[]
  modifyCandidates: string[]
  preserveCandidates: string[]
  migrationSources: SourceSystem[]
  rollbackNotes: string[]
}
```

Candidate examples:

- Create `.simplecode/manifest.toml` when no manifest exists.
- Create `ai.md` when no AI contract exists.
- Preserve existing `AGENTS.md` and propose an append/merge strategy.
- Import `.beads/` tasks as task backend, without claiming spec semantics.
- Import `.kspec/` as preferred spec backend.
- Preserve GSD markdown as artifacts.

## CLI Health Checks

Fast health checks may run when `includeCliHealth` is true.

Recommended commands:

- `bd version`
- `bd ready --json`
- `kspec --version`
- `kspec tasks list --json`
- `kspec shadow status --json` if available
- `rtk --version`
- `npx gitnexus --version` or `npx gitnexus status` if available
- provider command discovery for `claude`, `gemini`, `codex`, `opencode`,
  `aider`, and `ollama`

Rules:

- Timebox each command.
- Treat command failures as capability health, not scan failure.
- Do not run init, repair, migrate, install, update, analyze, or push commands.
- Do not rely on shell hooks being active.

## Git Health

When `includeGitHealth` is true, collect:

- whether `.git/` exists
- current branch
- dirty file count
- staged file count
- remote tracking state if cheap

Git health should inform warnings and upgrade safety. A dirty worktree does not
prevent scanning, but it should push upgrade proposal toward `manual_review` or
`guarded`.

## First Implementation Shape

Suggested Rust module:

- `src-tauri/src/project_scanner.rs`

Suggested Tauri command:

- `scan_project_capabilities(root_path: String, options: ScanOptions)`

Suggested renderer API:

- `api.scanProjectCapabilities(projectPath, options)`

Suggested UI consumers:

- project sidebar health badges
- project initialization wizard
- settings/integrations panel
- task/spec panel backend selection
- upgrade proposal flow

## Migration From Current Checks

Current one-off checks should eventually become adapter functions used by the
scanner:

- `beads_check` becomes Beads capability detection.
- `kspec_check` becomes KSpec capability detection.
- GSD installed/progress checks become GSD capability detection.
- MCP config loading becomes MCP capability detection plus runtime bridge load.
- backend executable discovery becomes provider capability detection.

The existing direct UI calls can stay temporarily. New UI should prefer the scan
result so initialization state is consistent across panels.

## Acceptance Criteria For Implementation

The implementation task after this design should satisfy:

- Scanner returns every required marker with status and source system.
- Scanner classifies the five initialization states deterministically.
- Scanner reports at least Beads, KSpec, GSD, RTK, GitNexus, MCP, Git, and
  provider capabilities.
- Scanner does not mutate the target repo.
- Scanner handles unreadable/missing paths with blockers instead of panics.
- Scanner produces upgrade proposal inputs without performing the upgrade.
- Renderer types mirror Rust output shape.

