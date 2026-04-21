# Spec-Driven Development Contract

> **Status**: In Design
> **Author**: Antigravity
> **Last Updated**: 2026-04-21
> **Implements Pillar**: Spec-Driven Execution, Unified Repository Observability

## Overview

The Spec-Driven Development Contract establishes the unified data model and domain boundaries for Simple Code GUI. It acts as the "source of truth" that reconciles disparate external agentic systems (KSpec, Beads, GSD) into a first-class internal projection. 

By defining stable product objects—Projects, Specs, Tasks, and Execution Runs—this system enables the application to provide a consistent visual interface for complex repo-aware workflows. It is a pure infrastructure layer that handles the translation, persistence, and routing policies required for multi-backend AI coordination without leaking provider-specific details into the core user experience.

## Player Fantasy

The developer fantasy for the Spec-Driven Contract is **Absolute Determinism**.

In an environment where multiple AI agents and disparate command-line tools are modifying the codebase, the developer maintains a "God View" of the project's health and requirements. The contract ensures that every piece of work is anchored to a stable definition of intent (the Spec) and verified by measurable outcomes (Acceptance Criteria). 

The developer feels a sense of **Evidence-Backed Confidence**: they no longer have to "trust" that an agent finished a task; they see the internal projection of the result, linked to the artifacts and validation records produced during the execution run. It is the transition from "Managing Terminals" to "Architecting Outcomes."

## Detailed Design

### Core Rules
1. **Source Attribution**: Every internal object MUST maintain a `sourceSystem` field. If projected from an external CLI (Beads, KSpec, GSD), the `externalId` must be preserved for round-tripping.
2. **Authoritative UI Projection**: The internal Simple Code GUI model is the authoritative view for the UI. It is populated by scanners and adapters; the UI cannot silently mutate the underlying repository state without an explicit command handler.
3. **Provider Decoupling**: Provider routing (e.g., sending a prompt to Claude vs. Gemini) is a routing policy decoupled from the Task/Spec backend. Any task can be routed to any capable provider.
4. **Local-First Persistence**: Project profiles and execution runs are persisted in `.simplecode/` to ensure offline availability of project intelligence.

### States and Transitions

| Domain | State | Meaning |
| :--- | :--- | :--- |
| **Project** | `not_initialized` | No contract markers found. |
| **Project** | `partially_initialized` | Some markers exist, but missing baseline manifest or AI contract. |
| **Project** | `fully_initialized` | Baseline markers (manifest, AGENTS.md, ai.md) present and valid. |
| **Project** | `third_party_initialized` | External markers (.kspec, .beads) exist without app contract. |
| **Project** | `conflicting_initialization` | Incompatible or ambiguous authorities detected. |
| **Criterion** | `not_started` | Baseline state. |
| **Criterion** | `satisfied` | Verification loop passed; evidence artifact linked. |
| **Execution** | `quick_task` | Standalone execution without a full phase plan. |
| **Execution** | `recovery` | Specialized mode for resolving interrupted or failed runs. |

### Ownership Decisions

#### Internal Simple Code GUI Domain
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

#### KSpec
KSpec is the preferred authority for spec-driven work:
- spec items, acceptance criteria, traits, validation state
- task derivation from specs
- review records when KSpec review is enabled
- automation eligibility

#### Beads
Beads remains supported as a task-tracking backend:
- ready/open/in-progress/closed task lifecycle
- priority, issue type, notes/comments, dependencies

#### GSD
GSD is treated as an execution workflow adapter:
- project/roadmap phase state
- planning artifacts, verifier loops, wave execution concepts

### Canonical Entities

#### Project
Represents a repo or workspace root known to the app.
- `id`, `name`, `rootPath`, `profilePath`, `initializationState`, `capabilities`, `defaultProviderPlanId`.

#### Capability
Represents an installed, initialized, enabled, or degraded integration.
- `id`, `kind`, `installed`, `initialized`, `enabled`, `mode`, `version`, `health`, `source`.

#### ContextSource
Represents material attached to planning or execution (file, terminal output, symbol context).

#### SpecItem
Represents product behavior, requirement, module, or feature intent.

#### AcceptanceCriterion
Represents a verifiable condition attached to a spec item or task.

#### Trait
Represents routing and quality metadata (`ui`, `backend`, `security`, `performance`).

#### Task
Represents work to be done. Grow by composition from Beads/KSpec.

#### Agent
Represents an execution role (planner, builder, reviewer, verifier).

#### ExecutionRun
Represents a single attempt to plan, implement, verify, review, or recover work.

#### Artifact
Represents output produced or consumed during work (plan, diff, commit, log).

#### Provider
Represents an AI or local model provider (Claude, Gemini, Ollama, etc.).

#### TokenEvent / TokenSavingEvent
Represents token spend and optimized context savings.

### Interactions with Other Systems
- **Renderer <-> Tauri**: Uses the unified `Api` bridge. TypeScript (PascalCase) <-> Rust (snake_case).
- **App <-> KSpec/Beads**: Bi-directional projection. Status reads from CLI; edits dispatched via CLI.
- **App <-> RTK**: Telemetry integration. `TokenSavingEvent` records are generated per command execution.

## Formulas

### Token Savings (RTK)
The `savedTokenEstimate` formula is defined as:

`savedTokenEstimate = rawTokenEstimate - reducedTokenEstimate`

**Variables:**
| Variable | Symbol | Type | Range | Description |
| :--- | :--- | :--- | :--- | :--- |
| Raw Tokens | `rawTokenEstimate` | int | 0–1M | The total token count of the raw terminal output before filtering. |
| Reduced Tokens | `reducedTokenEstimate` | int | 0–1M | The token count of the filtered output actually sent to the model context. |

**Output Range**: 0 to `rawTokenEstimate`.
**Example**: A log file with 10,000 tokens filtered down to 500 tokens results in a saving of 9,500 tokens.

### Cost Estimation
The `estimatedCost` formula is defined as:

`estimatedCost = (inputTokens * inputPrice) + (outputTokens * outputPrice)`

**Variables:**
| Variable | Symbol | Type | Range | Description |
| :--- | :--- | :--- | :--- | :--- |
| Input Price | `inputPrice` | float | 0–0.001 | Price per token in USD (from Provider Pricing Profile). |
| Output Price | `outputPrice` | float | 0–0.001 | Price per token in USD (from Provider Pricing Profile). |

### Project Health Score
The `projectHealthScore` formula is defined as:

`projectHealthScore = (initializedCapabilities / totalCapabilities) * 100`

**Variables:**
| Variable | Symbol | Type | Range | Description |
| :--- | :--- | :--- | :--- | :--- |
| Initialized | `initializedCapabilities` | int | 0–N | Count of capabilities with `health: healthy`. |
| Total | `totalCapabilities` | int | 1–N | Total number of capabilities configured in the manifest. |

## Edge Cases

- **If a manifest (.simplecode/manifest.toml) exists but is unreadable or malformed**: The project MUST be classified as `conflicting_initialization`. A blocker must be displayed preventing further work until the manifest is repaired or deleted.
- **If multiple authoritative markers for the same capability exist (e.g., both .kspec/ and .spec/ directories)**: The scanner MUST classify the state as `conflicting_initialization` and prompt the user to select the authoritative source before continuing.
- **If an ExecutionRun is interrupted by an application crash or power loss**: Upon the next app launch, the system MUST detect the incomplete run, set its status to `failed` with the reason `interrupted_by_host_termination`, and offer a `recovery` mode to clean up stale lockfiles or temporary artifacts.
- **If an external CLI is disabled but its markers remain**: The capability is classified as `installed: true, enabled: false, health: warning`. The UI should surface a warning that the integration is inactive despite the presence of project files.
- **If a TokenSavingEvent produces a negative saving (raw < reduced)**: The `savedTokenEstimate` MUST be clamped to 0, and the event must be flagged with `telemetry_anomaly` in the metadata for audit.

## Dependencies

### Internal Dependencies
- **Project Capability Scanner**: (Hard) Consumes the `Capability` and `Marker` definitions to classify repository state.
- **Initialization & Upgrade Flow**: (Hard) Uses the `ProjectInitializationState` and `UpgradeProposalInput` to guide the user.
- **Agent Execution Engine**: (Hard) Implements the `ExecutionRun`, `Artifact`, and `Agent` logic to perform and record work.
- **Unified Task/Spec Panels**: (Hard) Projections of `SpecItem` and `Task` entities for the user interface.

### Infrastructure Dependencies
- **Tauri Core (Rust)**: Provides the file-system access and `serde` serialization for local-first persistence in `.simplecode/`.
- **Rust PTY Manager**: Provides the raw terminal output used to calculate `TokenSavingEvent` metrics.
- **External CLIs (Beads, KSpec, GSD)**: Upstream authorities for task and spec state; this contract defines the "adapter" surface for these systems.

## Tuning Knobs

| Knob | Data Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `scanFrequencyThreshold` | int (ms) | 5000 | Minimum interval between automatic capability scans to prevent UI flickering. |
| `telemetryRetentionDays` | int | 30 | Duration (in days) to retain execution logs and artifact metadata before automatic cleanup. |
| `maxArtifactSizeMB` | float | 5.0 | Maximum file size for captured artifacts to be loaded into the UI activity feed. |
| `providerTimeoutSeconds` | int | 60 | Default timeout for external provider API calls before transitioning a run to `failed`. |
| `healthWarningThreshold` | float | 0.8 | Minimum normalized health score (0.0 to 1.0) required to maintain a `healthy` status. |
| `maxConcurrentExecutions` | int | 1 | Maximum number of agents allowed to run in parallel per project (safety limit). |

## Acceptance Criteria

- [ ] **Serialization Integrity**: A `.simplecode/manifest.toml` file MUST be capable of round-trip serialization between the Rust backend (Serde) and TypeScript frontend (Zod) without loss of data or corruption of optional fields.
- [ ] **Scanner Determinism**: Adding a marker (e.g., `.beads/`) to a repository MUST result in the corresponding capability being reported as `installed: true` within one `scanFrequencyThreshold` interval.
- [ ] **Health Score Accuracy**: A project with 4 total capabilities, where 2 are healthy and 2 are failing, MUST return a `projectHealthScore` of exactly 50.0.
- [ ] **Conflict Resolution**: A repository containing overlapping authoritative markers (e.g., both `.kspec/` and `.spec/`) MUST trigger the `conflicting_initialization` state and block automation tasks until resolved.
- [ ] **Anomaly Clamping**: If telemetry data reports higher reduced tokens than raw tokens, the `savedTokenEstimate` MUST be clamped to 0.0 and reported with an `anomaly` flag.
- [ ] **State Immutability**: No background scan or upgrade check may modify the user's repository filesystem without an explicit `ExecutionRun` record being created and approved.

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

