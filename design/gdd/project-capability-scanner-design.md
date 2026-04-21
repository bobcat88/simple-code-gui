# Project Capability Scanner Design

> **Status**: Finalized
> **Author**: Antigravity
> **Last Updated**: 2026-04-21
> **Implements Pillar**: Unified Repository Observability, Safety & Determinism

## Overview

The Project Capability Scanner is a read-only diagnostic engine that classifies repository state before any initialization, upgrade, or automation tasks occur. It acts as the primary "adapter" between the raw filesystem and the high-level `Project` and `Capability` entities defined in the Spec-Driven Development Contract.

## Player Fantasy

The developer fantasy for the Scanner is **X-Ray Vision**.

When pointing Simple Code GUI at a repository, the developer shouldn't have to guess if their environment is set up correctly. The scanner "lights up" the hidden structure of the project:
- **Marker Detection**: Seeing the "invisible" markers (like `.kspec/` or `.beads/`) as functional components.
- **Health Diagnostics**: Instantly knowing if a CLI is missing or if a config file is malformed before an agent starts working.
- **Safe Proposals**: Feeling the confidence of a "No-Touch" diagnostic that only proposes changes, never forcing them.

It provides a sense of **Total Environmental Control**, ensuring that every automated step is backed by a verified state.

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

## Detailed Design

### Core Models

#### 1. Detected Marker
Markers are specific artifacts or environmental flags that indicate the presence of a tool or system.
- `markerId`: Unique identifier (e.g., `beads_dir`, `simplecode_manifest`).
- `kind`: `file`, `directory`, `cli`, `config`, `mcp_tool`.
- `status`: `present`, `missing`, `unreadable`, `stale`.
- `sourceSystem`: One of the SourceSystems defined in the Contract.

#### 2. Capability Scan Result
Capabilities are the functional interpretation of one or more markers.
- `capabilityId`: Unique identifier (e.g., `beads_task_backend`).
- `markerIds`: List of markers that support this capability.
- `health`: 
  - `healthy`: All supporting markers are present and readable.
  - `warning`: Markers are present, but supporting CLI is missing or outdated.
  - `error`: Mandatory markers are malformed or unreadable.

### Classification Logic

The scanner determines the `ProjectInitializationState` using a hierarchical evaluation of the gathered capabilities:

1. **Conflicting**: If overlapping authoritative markers exist (e.g., `.kspec/` and `.spec/`) OR if the manifest references a backend that is missing markers.
2. **Fully Initialized**: If `.simplecode/manifest.toml` exists AND at least one task/spec backend is healthy.
3. **Third-Party Initialized**: If `.simplecode/manifest.toml` is missing BUT strong markers for Beads, KSpec, or GSD are found.
4. **Partially Initialized**: If `.simplecode/manifest.toml` exists but core markers (like `AGENTS.md`) are missing.
5. **Not Initialized**: If no recognized markers are found.

## Formulas

### Scan Performance Target
The scanner is optimized for "Instant Feel" (latency < 200ms).

`maxScanDuration = 200 + (fileCount / 1000) * 10`

**Variables:**
| Variable | Symbol | Type | Range | Description |
| :--- | :--- | :--- | :--- | :--- |
| File Count | `fileCount` | int | 0–10k | The number of files in the project root (non-recursive). |

**Target**: A project with 100 root files must be scanned in under **201ms**.

### Capability Health Score
Each capability calculates a normalized health score (0.0 to 1.0).

`capabilityHealthScore = (presenceRatio * 0.7) + (cliStatus * 0.3)`

**Variables:**
| Variable | Symbol | Type | Range | Description |
| :--- | :--- | :--- | :--- | :--- |
| Presence Ratio | `presenceRatio` | float | 0.0–1.0 | Percentage of mandatory markers present and readable. |
| CLI Status | `cliStatus` | float | 0.0–1.0 | 1.0 if CLI is in path and version matches; 0.5 if version mismatch; 0.0 if missing. |

**Output Range**: 0.0 (Critical) to 1.0 (Healthy).

## Edge Cases

- **Broken Symlinks**: The scanner MUST identify and ignore broken symlinks during traversal. It should not throw a fatal error or halt the scan.
- **Permission Denied**: If a root-level subdirectory (e.g., `node_modules/` or a restricted folder) is unreadable, the scanner MUST record a `ScanWarning` for that path but continue processing all other sibling directories.
- **Circular Directory Structures**: To prevent infinite loops, the scanner MUST implement a `maxDepth` limit (default: 3) and maintain a "Visited Paths" set to detect and abort on circular references.
- **Network Latency/Timeouts**: If a single file-system check exceeds 100ms (indicating a slow network mount), the scanner MUST abort the current scan cycle, report `degraded` performance, and prompt the user to enable "Shallow Mode."
- **Empty or Corrupted Markers**: If a marker directory (e.g., `.beads/`) exists but is empty or contains zero-byte configuration files, the capability is classified as `installed: true, health: error`.

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

## Dependencies

### Internal Dependencies
- **Spec-Driven Development Contract**: (Hard) Provides the canonical schema for `Capability`, `Marker`, and `SourceSystem` entities.
- **Project Initializer**: (Soft) Consumes the `upgradeInputs` from the scanner to generate proposals.
- **Activity Feed**: (Soft) Uses scanner warnings to surface project health issues to the user.

### Infrastructure Dependencies
- **Rust WalkDir**: (Hard) Used for high-performance root-level and shallow recursive filesystem traversal.
- **Rust std::process::Command**: (Hard) Used to execute lightweight CLI health checks (e.g., `bd --version`).
- **Serde (JSON/TOML)**: (Hard) Used for parsing the project manifest and CLI command outputs.
- **Tauri Path Resolver**: (Hard) Ensures the scanner correctly identifies project roots across different Operating Systems.

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

## Tuning Knobs

| Knob | Data Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `maxScanDepth` | int | 3 | Maximum recursion depth for finding workflow markers (e.g., looking for `.kspec/` in subdirectories). |
| `cliHealthTimeout` | int (ms) | 1000 | Maximum duration allowed for a single CLI version or health check command. |
| `includeGitHealth` | bool | true | When true, the scanner will query the git binary for dirty file counts and staged state. |
| `includeCliHealth` | bool | true | When true, the scanner will execute `bd`, `kspec`, and `rtk` to verify their availability and version. |
| `forceRefresh` | bool | false | When true, the scanner ignores existing `ProjectCapabilityScan` caches and forces a full filesystem walk. |

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

## Acceptance Criteria

- [ ] **Recursion Safety**: The scanner MUST identify and ignore circular symlinks without hanging or crashing, using a `maxDepth` limit and visited path tracking.
- [ ] **Deterministic State Mapping**: A repository containing only third-party markers (e.g., `.beads/`) MUST be classified as `third_party_initialized` if the `.simplecode/` manifest is missing.
- [ ] **Marker Accuracy**: Every marker ID defined in the GDD MUST be correctly identified with the appropriate `status` and `sourceSystem` when present in a test fixture.
- [ ] **Health Calculus**: A missing required CLI (e.g., `bd`) MUST result in the dependent capability (e.g., `beads_task_backend`) having a health status of `warning`.
- [ ] **No-Mutation Guarantee**: The scanner MUST be strictly read-only. Verification must confirm that file modification times (`mtime`) and checksums remain unchanged after a full scan.
- [ ] **Performance SLA**: A scan of a repository with 100 root files MUST complete in under 201ms on standard hardware (non-network drive).

