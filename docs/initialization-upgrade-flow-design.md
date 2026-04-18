# Initialization And Upgrade Flow Design

Status: design baseline for `simple-code-gui-dgl`

This document defines the new-project initialization and existing-project upgrade
proposal flow. It builds on:

- `docs/spec-driven-development-contract.md`
- `docs/project-capability-scanner-design.md`

The flow must be proposal-first. It may inspect a project, generate a plan, and
show exact operations, but it must not mutate a repository until the user
explicitly applies an approved proposal.

## Goals

- Turn scanner output into a safe initialization or upgrade proposal.
- Support new projects and existing repositories.
- Make created files, modified files, preserved files, compatibility notes, and
  rollback visible before apply.
- Provide clear presets: minimal, standard, full/spec-driven, guarded, and
  local-first.
- Preserve third-party workflows such as Beads, KSpec, GSD, RTK, GitNexus, MCP,
  Claude, and Codex instead of overwriting them.

## Non-Goals

- Do not implement repository mutation in the scanner.
- Do not auto-migrate Beads to KSpec from the proposal screen.
- Do not install CLIs silently.
- Do not generate provider credentials or secrets.
- Do not rewrite existing `AGENTS.md`, `CLAUDE.md`, or `ai.md` without an
  explicit diff and approval.

## Flow Overview

The same proposal engine serves both entry points:

1. Select or create project root.
2. Run read-only capability scan.
3. Choose proposal preset.
4. Generate proposal from scan result and preset.
5. Present summary, file operations, compatibility notes, risks, and rollback.
6. User approves.
7. Apply operations transactionally where possible.
8. Re-scan and show verification result.

## Entry Points

### New Project

Used when the user creates a new folder from the app.

Expected project state:

- root path may not exist yet, or exists as an empty/lightly populated directory.
- scanner likely returns `not_initialized`.
- proposal defaults to `standard` unless user selected another preset.

Required UI steps:

- project name
- root directory
- preset
- task/spec backend choice
- provider plan
- optional capabilities
- review proposal
- apply
- open project

### Existing Project

Used when the user adds or opens an existing repository.

Expected project state may be any scanner classification:

- `not_initialized`
- `partially_initialized`
- `fully_initialized`
- `third_party_initialized`
- `conflicting_initialization`

Required UI steps:

- scan summary
- detected capabilities
- warnings and blockers
- recommended preset
- preserve/import choices
- review proposal
- apply or skip

If scan returns blockers, the UI must default to manual review and disable
automatic apply until the blocker is resolved or explicitly acknowledged where
safe.

## Presets

### Minimal

Purpose: register the project with Simple Code GUI without changing workflow.

Creates:

- `.simplecode/manifest.toml`
- `.simplecode/project-profile.json`

May create:

- `ai.md` if no AI contract exists and user opts in.

Preserves:

- existing task backend
- existing instruction files
- existing MCP/GSD/RTK/GitNexus files

Does not create:

- `.kspec/`
- `.beads/`
- `.mcp/`
- `.rtk/`
- `.gitnexus/`
- hooks

Recommended for:

- third-party initialized repos
- dirty worktrees
- unknown teams
- first-time import

### Standard

Purpose: create the app contract and one task/spec backend.

Creates:

- `.simplecode/manifest.toml`
- `.simplecode/project-profile.json`
- `ai.md`
- `AGENTS.md` if missing

Creates one of:

- `.kspec/` via explicit KSpec initialization
- `.beads/` via explicit Beads initialization

May create:

- `.simplecode/providers.toml`

Preserves:

- existing `CLAUDE.md`
- existing `.claude/`
- existing GSD files
- existing `.gitnexus/`
- existing RTK rules

Recommended for:

- new projects
- not initialized repos
- partially initialized repos without conflicts

### Full Spec-Driven

Purpose: make specs, acceptance criteria, task derivation, validation, and agent
dispatch the first-class workflow.

Creates:

- all Standard files
- KSpec metadata/worktree
- provider plan
- default agent role policy
- task/spec UI projection profile

May create:

- `.mcp/`
- `.planning/`
- `.simplecode/providers.toml`
- GitNexus config/index request
- RTK config/instructions

Preserves:

- Beads tasks as import source if Beads exists
- GSD markdown as artifacts
- existing instruction files via merge proposal

Recommended for:

- greenfield product builds
- repos already using KSpec
- teams that want formal AC/review gates

### Guarded

Purpose: prioritize safety and review.

Creates:

- `.simplecode/manifest.toml`
- `.simplecode/project-profile.json`
- proposal artifact only

May create:

- `ai.md` as a new file only if missing

Does not modify existing files by default.

Recommended for:

- dirty worktrees
- conflicting initialization
- enterprise or shared repos
- repos with existing complex instruction files

### Local-First

Purpose: prefer local/private execution and explicit cloud opt-in.

Creates:

- Standard contract files
- provider plan with local-first routing
- privacy notes in `ai.md`

Prefers:

- Ollama/local models for summarization and labeling
- RTK for command filtering
- GitNexus local graph context

Requires explicit opt-in for:

- cloud provider calls
- telemetry
- remote indexes

Recommended for:

- privacy-sensitive projects
- offline-capable workflows
- local model users

## Proposal Model

```ts
interface InitializationProposal {
  id: string
  rootPath: string
  createdAt: string
  sourceScanId: string
  preset: ProposalPreset
  status: 'draft' | 'approved' | 'applying' | 'applied' | 'failed' | 'cancelled'
  summary: string
  operations: ProposalOperation[]
  compatibilityNotes: CompatibilityNote[]
  warnings: ProposalWarning[]
  blockers: ProposalBlocker[]
  rollbackPlan: RollbackPlan
  verificationPlan: VerificationPlan
}
```

```ts
type ProposalPreset =
  | 'minimal'
  | 'standard'
  | 'full_spec_driven'
  | 'guarded'
  | 'local_first'
```

## Operation Model

```ts
interface ProposalOperation {
  id: string
  kind:
    | 'create_file'
    | 'modify_file'
    | 'create_directory'
    | 'run_command'
    | 'import_metadata'
    | 'preserve'
    | 'skip'
  path?: string
  command?: string
  sourceSystem: SourceSystem
  reason: string
  preview?: string
  diff?: string
  risk: 'low' | 'medium' | 'high'
  requiresApproval: boolean
  rollback: RollbackStep[]
}
```

Rules:

- `create_file` must show path and full preview.
- `modify_file` must show diff.
- `run_command` must show command, expected effects, and rollback limits.
- `preserve` must explain why existing content stays authoritative.
- high-risk operations require separate confirmation.

## Compatibility Notes

```ts
interface CompatibilityNote {
  id: string
  severity: 'info' | 'warning' | 'risk'
  title: string
  detail: string
  relatedOperationIds: string[]
  relatedCapabilityIds: string[]
}
```

Examples:

- Existing `AGENTS.md` will be preserved and referenced by `ai.md`.
- Beads is initialized; KSpec upgrade should be separate from initialization.
- Generated `kspec-agents.md` exists without `.kspec/`; manual review needed.
- GitNexus metadata points to this repo but has no embeddings.
- RTK rules exist, but `.rtk/` config does not.

## Rollback Plan

```ts
interface RollbackPlan {
  strategy: 'delete_created_files' | 'restore_backups' | 'manual'
  steps: RollbackStep[]
  backupDirectory?: string
  limitations: string[]
}
```

```ts
interface RollbackStep {
  id: string
  description: string
  path?: string
  command?: string
  automatic: boolean
}
```

Rollback requirements:

- Every created file must have a delete step.
- Every modified file must have a backup/restore step.
- Every command operation must state whether rollback is automatic.
- External CLI initializations such as `kspec init` or `bd init` must be marked
  as limited rollback unless the app can safely remove all generated files.

## Verification Plan

```ts
interface VerificationPlan {
  steps: VerificationStep[]
  expectedInitializationState: ProjectInitializationState
  expectedCapabilityIds: string[]
}
```

```ts
interface VerificationStep {
  id: string
  kind: 'rescan' | 'file_exists' | 'command' | 'manual'
  description: string
  path?: string
  command?: string
}
```

Minimum verification after apply:

- re-run project capability scanner
- confirm expected created files exist
- confirm expected task/spec backend initialized, if selected
- confirm no new conflict blockers

## File Contracts

### `.simplecode/manifest.toml`

Purpose: machine-readable project initialization record.

Minimum fields:

```toml
version = 1
project_id = "..."
root_path = "..."
initialized_at = "..."
preset = "standard"
task_backend = "kspec"
spec_backend = "kspec"

[capabilities]
beads = false
kspec = true
gsd = false
rtk = false
gitnexus = false
mcp = false
```

### `.simplecode/project-profile.json`

Purpose: app-owned projection and UI defaults.

Minimum fields:

```json
{
  "version": 1,
  "projectId": "...",
  "displayName": "...",
  "defaultProviderPlanId": "balanced",
  "enabledCapabilityIds": [],
  "createdAt": "...",
  "updatedAt": "..."
}
```

### `ai.md`

Purpose: human-readable local AI contract.

Sections:

- project intent
- coding standards
- task/spec source of truth
- provider routing policy
- token/cost policy
- voice behavior
- git rules
- approval policy
- context sources
- enabled capabilities
- upgrade policy

### `AGENTS.md`

Purpose: agent-facing workflow instructions.

Rules:

- If missing, create from template.
- If present, preserve and propose append/merge only.
- If generated by another tool, preserve source marker.

## Existing File Policies

### `AGENTS.md`

- Missing: create.
- Existing: preserve by default.
- Existing with conflicting Simple Code GUI block: require manual review.

### `CLAUDE.md` and `.claude/CLAUDE.md`

- Never rewrite directly during initialization.
- Link or reference from `ai.md` when useful.
- If both root and `.claude/` versions exist, warn but do not block unless
  scanner found contradictory app ownership.

### `ai.md`

- Missing: create.
- Existing: show full diff for any proposed edit.
- Existing without recognizable sections: guarded/manual review.

### `.beads/`

- Existing: preserve as task backend.
- Do not migrate to KSpec automatically.
- Full spec-driven preset may propose a separate follow-up migration task.

### `.kspec/`

- Existing: prefer as spec backend.
- Verify worktree health before proposing dispatch.
- Do not run repair automatically.

### GSD Files

- Preserve as artifacts or execution workflow state.
- Do not rewrite markdown roadmap/state files during app initialization.

### `.gitnexus/`

- Preserve existing index.
- If root mismatch, block automatic apply.
- If stale or missing embeddings, warn only.

### RTK

- Preserve existing rules.
- Do not install shell hooks during initialization.
- Proposal may add instruction-only mode first.

## Apply Semantics

Apply should be implemented as a staged operation:

1. Re-scan root and compare with proposal source scan.
2. Abort or warn if scan materially changed.
3. Create backup directory for modified files.
4. Execute file operations.
5. Execute approved CLI init commands.
6. Write proposal result artifact.
7. Re-scan root.
8. Show verification result.

If a step fails:

- stop remaining operations
- show completed operations
- show rollback options
- keep logs as artifacts

## UI Requirements

Required views:

- scan summary
- preset selector
- capability matrix
- file operation review
- compatibility notes
- rollback plan
- apply progress
- verification result

The file operation review must group operations by:

- created files
- modified files
- directories
- commands
- preserved files
- skipped capabilities

The apply button must be disabled when unresolved blockers exist.

## Follow-Up Implementation Tasks

This design does not require immediate implementation. The next implementation
tasks should be filed separately:

- implement Rust proposal model and generator
- implement file template rendering for manifest/profile/ai/agents
- implement proposal review UI
- implement safe apply engine with backup and rollback
- integrate proposal flow into Make Project and existing project import

## Acceptance Criteria

The implementation of this design is complete when:

- New project flow can generate a proposal before mutation.
- Existing project flow can generate a proposal from scanner output.
- Presets produce deterministic operation sets.
- Every create/modify/command operation has preview and rollback metadata.
- Existing third-party files are preserved by default.
- Blockers disable automatic apply.
- Applying a proposal re-scans and verifies the expected initialization state.

