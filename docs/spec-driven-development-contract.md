# Spec-Driven Development Contract

Status: baseline contract for `simple-code-gui-cqv`

This document defines the product contract for moving Simple Code GUI from a
multi-terminal assistant manager toward a repo-aware, spec-driven execution
desktop. It reconciles the current implementation with the architecture direction
in `notes.md`.

## Product Center

The product center is not the AI provider. The stable product objects are:

- Project
- Context source
- Spec item
- Acceptance criterion
- Trait
- Task
- Agent
- Execution run
- Artifact
- Provider
- Capability

Providers are interchangeable execution backends. Specs, tasks, executions, and
artifacts are the durable product surface.

## Current Baseline

The current app already has these foundations:

- Tauri 2 shell with Rust command handlers.
- Rust PTY manager for terminal sessions.
- Workspace and settings persistence through JSON files.
- React/Zustand renderer state for projects, tabs, layout, and settings.
- Terminal backends for Claude, Gemini, Codex, OpenCode, and Aider.
- Beads and KSpec task adapters normalized into `UnifiedTask`.
- KSpec dispatch controls exposed in the Beads panel.
- GSD status and command shortcuts.
- MCP bridge and extension registry surface.
- Voice input/output settings and runtime hooks.

The current gap is that task/spec concepts are not yet first-class domain
objects. They are projected directly from external CLIs into the UI.

## Ownership Decisions

### Internal Simple Code GUI Domain

Simple Code GUI owns the canonical in-app projection:

- project identity and project profile
- capability detection results
- provider routing policy
- model plans
- agent role definitions
- execution run records
- artifact registry
- token and cost events
- token saving events
- UI state and user preferences

This internal projection should be persisted locally and rebuilt from external
systems when possible. It is allowed to cache external IDs, but it must not hide
which external system is authoritative for a record.

### KSpec

KSpec is the preferred authority for spec-driven work:

- spec items
- acceptance criteria
- traits
- validation state
- task derivation from specs
- review records when KSpec review is enabled
- automation eligibility

The app should expose KSpec concepts directly in the task/spec UI instead of
reducing them to plain task title, status, and priority.

### Beads

Beads remains supported as a task-tracking backend:

- ready/open/in-progress/closed task lifecycle
- priority
- issue type
- notes/comments
- dependencies

Beads is not the preferred authority for spec items or trait-level validation.
When a Beads project has acceptance criteria or spec-like metadata, the app may
project it into the internal model, but it should label the source as Beads and
avoid pretending full KSpec semantics exist.

### GSD

GSD is treated as an execution workflow adapter:

- project/roadmap phase state
- quick task and full phase modes
- planning artifacts
- verifier loops
- wave execution concepts

The app should not make GSD markdown files the primary UI model. GSD artifacts
should be imported, displayed, and generated through internal `ExecutionRun` and
`Artifact` records.

### RTK

RTK is treated as a command-output optimization and telemetry capability:

- command filtering mode
- raw output token estimate
- filtered output token estimate
- saved token/cost estimate
- degraded platform mode

RTK must not own task or spec state.

### GitNexus

GitNexus is treated as a repo-intelligence capability:

- code graph index health
- symbol and process context
- blast-radius results
- context source enrichment
- impact analysis attached to execution runs

GitNexus must not own task state. It enriches planning, review, and verification.

### Providers

Providers own only execution transport and model metadata:

- authentication state
- model catalog
- context limits
- streaming/tool/structured-output support
- pricing profile
- health and rate-limit state

Provider selection is a routing decision made by the app or user-defined model
plan, not by the task system.

## Canonical Entities

### Project

Represents a repo or workspace root known to the app.

Required fields:

- `id`
- `name`
- `rootPath`
- `profilePath`
- `initializationState`
- `capabilities`
- `defaultProviderPlanId`
- `createdAt`
- `updatedAt`

Source mapping:

- Current app: `Project` in renderer workspace store.
- Future app: `.simplecode/project-profile.json` plus local state database.

### ProjectInitializationState

Classifies how ready a repo is for the Simple Code GUI workflow.

Allowed values:

- `not_initialized`
- `partially_initialized`
- `fully_initialized`
- `third_party_initialized`
- `conflicting_initialization`

The scanner issue must produce this value from detected markers rather than from
a single file check.

### Capability

Represents an installed, initialized, enabled, or degraded integration.

Core fields:

- `id`
- `kind`
- `installed`
- `initialized`
- `enabled`
- `mode`
- `version`
- `health`
- `source`
- `details`

Kinds:

- `task_backend`
- `spec_backend`
- `execution_workflow`
- `repo_intelligence`
- `token_optimizer`
- `mcp_server`
- `provider`
- `voice`
- `updater`

### ContextSource

Represents material attached to planning or execution.

Examples:

- file
- directory
- terminal output
- command output
- GitNexus symbol context
- MCP resource
- documentation page
- previous execution artifact
- user note

Core fields:

- `id`
- `projectId`
- `kind`
- `uri`
- `title`
- `sourceSystem`
- `freshness`
- `tokenEstimate`
- `metadata`

### SpecItem

Represents product behavior, requirement, module, or feature intent.

KSpec is the preferred authority.

Core fields:

- `id`
- `projectId`
- `sourceSystem`
- `externalId`
- `title`
- `kind`
- `status`
- `description`
- `traits`
- `acceptanceCriteria`
- `parentSpecId`
- `createdAt`
- `updatedAt`

### AcceptanceCriterion

Represents a verifiable condition attached to a spec item or task.

Core fields:

- `id`
- `specItemId`
- `taskId`
- `text`
- `status`
- `validationMethod`
- `evidenceArtifactIds`
- `sourceSystem`

Allowed statuses:

- `not_started`
- `in_progress`
- `satisfied`
- `failed`
- `waived`

### Trait

Represents routing and quality metadata.

Examples:

- `ui`
- `backend`
- `accessibility`
- `security`
- `performance`
- `migration`
- `docs`
- `test`
- `voice`
- `local_first`

Traits affect agent assignment, provider routing, review depth, and validation
requirements.

### Task

Represents work to be done. A task may come from Beads, KSpec, or an internal
execution plan.

Core fields:

- `id`
- `projectId`
- `sourceSystem`
- `externalId`
- `title`
- `description`
- `status`
- `priority`
- `type`
- `specItemIds`
- `acceptanceCriterionIds`
- `traits`
- `automationEligibility`
- `assigneeAgentId`
- `blockedByTaskIds`
- `createdAt`
- `updatedAt`

Current `UnifiedTask` is a minimal projection of this entity. It should grow by
composition, not by forcing every backend to fake unsupported fields.

### Agent

Represents an execution role, not necessarily a separate process.

Core roles:

- planner
- builder
- reviewer
- verifier
- docs
- git
- researcher
- voice
- ops

Core fields:

- `id`
- `role`
- `displayName`
- `providerPlanId`
- `capabilities`
- `status`
- `currentTaskId`
- `policy`

### ExecutionRun

Represents a single attempt to plan, implement, verify, review, or recover work.

Core fields:

- `id`
- `projectId`
- `taskId`
- `specItemIds`
- `mode`
- `status`
- `agentIds`
- `providerCalls`
- `contextSourceIds`
- `artifactIds`
- `startedAt`
- `finishedAt`
- `resultSummary`
- `failureReason`

Modes:

- `quick_task`
- `full_phase`
- `research`
- `discuss`
- `validate`
- `review`
- `recovery`

### Artifact

Represents output produced or consumed during work.

Examples:

- plan
- diff
- commit
- test log
- build log
- review record
- terminal transcript
- generated file
- migration proposal

Core fields:

- `id`
- `projectId`
- `executionRunId`
- `kind`
- `uri`
- `summary`
- `createdAt`
- `metadata`

### Provider

Represents an AI or local model provider.

Core fields:

- `id`
- `kind`
- `displayName`
- `authState`
- `models`
- `health`
- `locality`
- `pricingProfile`
- `capabilities`

Provider kinds:

- `claude`
- `openai_codex`
- `gemini`
- `ollama`
- `opencode`
- `aider`

### ModelPlan

Represents named routing policy.

Examples:

- Budget
- Balanced
- High quality
- Private local
- Deep architecture

Core fields:

- `id`
- `name`
- `routes`
- `budgetLimits`
- `fallbackRules`
- `privacyPolicy`

### TokenEvent

Represents token and cost spend.

Core fields:

- `id`
- `projectId`
- `executionRunId`
- `providerId`
- `modelId`
- `inputTokens`
- `outputTokens`
- `cachedTokens`
- `estimatedCost`
- `latencyMs`
- `createdAt`

### TokenSavingEvent

Represents saved context or cost.

Core fields:

- `id`
- `projectId`
- `executionRunId`
- `source`
- `rawTokenEstimate`
- `reducedTokenEstimate`
- `savedTokenEstimate`
- `savedCostEstimate`
- `metadata`

Sources:

- `rtk`
- `mcp_resource`
- `gitnexus_context`
- `cache`
- `summarization`

## Source Systems

All projected records should keep their source explicit.

Allowed initial source systems:

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

## Boundary Rules

- Never silently mutate a project repository during initialization or upgrade.
- Always show proposed file creates, file edits, compatibility notes, and rollback.
- Do not collapse KSpec acceptance criteria into plain task descriptions.
- Do not make provider-specific behavior leak into task/spec/domain objects.
- Do not make Beads-only projects appear fully spec-driven without explicit upgrade.
- Preserve external IDs for round-tripping to Beads, KSpec, GSD, GitNexus, and MCP.
- Store immutable execution and token events; derive dashboards from events.
- Treat GitNexus and RTK as optional capabilities with degraded modes.

## Implementation Implications

The next code-facing contract should introduce a shared domain package before UI
expansion:

- Rust domain structs for project scanning, capabilities, execution runs, and
  token events.
- TypeScript mirror types for renderer state and API responses.
- Adapter mappers from Beads/KSpec/GSD/GitNexus/RTK into the internal projection.
- A scanner command that returns `ProjectInitializationState` and `Capability[]`.

The existing `UnifiedTask` should remain as the compatibility projection until
the spec-aware task surface is implemented.

## Follow-On Gates

Before implementing scanner UI, the scanner should return:

- initialization classification
- detected markers
- capability list
- warnings for conflicts
- safe upgrade proposal inputs

Before implementing the spec-aware task panel, task loading should be able to
return:

- linked spec items
- acceptance criteria
- traits
- validation status
- automation eligibility
- source-system metadata

