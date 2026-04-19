# Spec And Acceptance Criteria Task Surface Design

Status: task-surface contract for `simple-code-gui-wux`

This document defines the spec-aware task surface that will evolve the current
Beads/KSpec task panel without breaking existing backend behavior.

It builds on:

- `docs/spec-driven-development-contract.md`
- `docs/project-capability-scanner-design.md`
- `docs/initialization-upgrade-flow-design.md`

## Purpose

The task panel currently normalizes Beads and KSpec tasks into a small
`UnifiedTask` shape: title, status, priority, type, description, tags,
automation, and a `hasSpec` hint.

The target surface must show spec-driven information directly:

- linked spec item
- acceptance criteria
- trait tags
- derived tasks
- validation status
- implementation status
- automation eligibility
- source-system metadata

The UI must continue to work for both Beads and KSpec projects. Beads-only
projects must not be presented as fully spec-driven unless explicit spec metadata
exists.

## Surface Areas

### Task List Row

The task list row remains compact. It should add spec-aware indicators without
turning the list into the detail view.

Required indicators:

- source backend: Beads or KSpec
- spec link indicator when task has linked spec item
- AC progress summary such as `2/4 AC`
- validation state indicator
- automation eligibility indicator
- trait chips, capped to two visible chips plus overflow count

Fallback behavior:

- If a backend does not provide AC data, hide AC progress.
- If a backend only provides `hasSpec`, show a simple spec indicator.
- If no spec metadata exists, do not show empty placeholders.

### Task Detail Modal

The detail modal is the primary spec-aware view.

Required sections in read mode:

- Overview
- Linked Spec
- Acceptance Criteria
- Traits
- Derived Tasks
- Validation
- Automation
- Source

Sections with no data should be hidden unless they are useful explanation for an
upgrade path. For example, a Beads-only task may show a small "No linked spec"
notice if the project has KSpec available but the task is not linked.

### Create Task Modal

Task creation should remain simple. The first implementation should not require
spec metadata to create a task.

Additive fields may be introduced later:

- linked spec item selector
- automation eligibility selector
- trait selector
- acceptance criteria editor

Until backend support exists, creation should keep current behavior and only
collect fields that round-trip safely.

### Browser Modal

The browser view should eventually support filters:

- has linked spec
- missing acceptance criteria
- validation failed
- automation eligible
- source backend
- trait

This can be deferred until the detail/list surface has the data model.

## Data Projection

The current `UnifiedTask` should become a compatibility projection plus optional
spec fields.

Recommended additive fields:

```ts
interface UnifiedTaskSpecProjection {
  specItems?: TaskSpecLink[]
  acceptanceCriteria?: TaskAcceptanceCriterion[]
  traits?: TaskTrait[]
  derivedTasks?: TaskDerivedTask[]
  validation?: TaskValidationSummary
  implementation?: TaskImplementationSummary
  source?: TaskSourceMetadata
}
```

```ts
interface TaskSpecLink {
  id: string
  externalId?: string
  title: string
  kind?: string
  status?: string
  sourceSystem: 'kspec' | 'beads' | 'simple_code_gui'
}
```

```ts
interface TaskAcceptanceCriterion {
  id: string
  text: string
  status: 'not_started' | 'in_progress' | 'satisfied' | 'failed' | 'waived'
  validationMethod?: string
  evidenceArtifactIds?: string[]
  sourceSystem: 'kspec' | 'beads' | 'simple_code_gui'
}
```

```ts
interface TaskTrait {
  id: string
  label: string
  kind?: 'domain' | 'quality' | 'routing' | 'workflow'
  sourceSystem: 'kspec' | 'beads' | 'simple_code_gui'
}
```

```ts
interface TaskDerivedTask {
  id: string
  title: string
  status: string
  sourceSystem: 'kspec' | 'beads' | 'simple_code_gui'
}
```

```ts
interface TaskValidationSummary {
  status: 'unknown' | 'not_started' | 'in_progress' | 'passed' | 'failed' | 'waived'
  totalCriteria: number
  satisfiedCriteria: number
  failedCriteria: number
  evidenceArtifactIds?: string[]
}
```

```ts
interface TaskImplementationSummary {
  status: 'unknown' | 'not_started' | 'in_progress' | 'implemented' | 'reviewing' | 'blocked'
  executionRunIds?: string[]
  artifactIds?: string[]
}
```

```ts
interface TaskSourceMetadata {
  backend: 'beads' | 'kspec'
  sourceSystem: 'beads' | 'kspec'
  externalId: string
  canonicalRef?: string
  supportsSpecItems: boolean
  supportsAcceptanceCriteria: boolean
  supportsTraits: boolean
  supportsValidation: boolean
  supportsDerivedTasks: boolean
}
```

## Backend Mapping

### KSpec

KSpec is the preferred authority for spec-driven fields.

Expected mappings:

- task slug/ULID -> `source.externalId`
- `spec_ref` or equivalent -> `specItems`
- acceptance criteria -> `acceptanceCriteria`
- traits/tags -> `traits`
- automation eligibility -> existing `automation`
- review/validation state -> `validation`
- task relationships -> `derivedTasks` when available

If a KSpec CLI command cannot return all fields in one call, the adapter should
load the base task first and defer richer linked metadata to detail view loading.

### Beads

Beads remains a task lifecycle backend.

Expected mappings:

- issue id -> `source.externalId`
- labels/tags -> `traits` only when clearly trait-like
- acceptance criteria text, if present -> `acceptanceCriteria`
- dependency records -> `derivedTasks` only when relationship direction is clear
- `hasSpec` remains a low-confidence hint unless structured metadata exists

Beads tasks should set support flags accurately:

- `supportsSpecItems`: false by default
- `supportsAcceptanceCriteria`: true only if structured or recognized AC data is
  available
- `supportsTraits`: partial when labels/tags exist
- `supportsValidation`: false by default
- `supportsDerivedTasks`: partial when dependencies are loaded

## Visual Semantics

Use restrained labels and badges:

- Spec: neutral badge with spec title or external ref.
- AC: progress badge, green only when all required ACs are satisfied.
- Failed validation: red/error badge.
- Automation eligible: small status badge.
- Traits: muted chips.
- Source: small backend label in detail metadata.

Do not use large explanatory copy in the main task list. Detailed explanation
belongs in the detail modal or upgrade flow.

## Empty And Partial States

KSpec task with no linked spec:

- show "No linked spec" in detail view
- offer no fake spec data

Beads task with no AC:

- hide AC section unless the user is in a spec-upgrade context

Backend supports only partial metadata:

- show available sections
- source metadata should make partial support visible to developer tools and
  debug views

Loading linked metadata:

- list view should render immediately from base task data
- detail view may show section-level loading for spec/AC data

## Editing Rules

Initial implementation should keep editing conservative:

- existing title/status/priority/description edits remain supported
- spec links are read-only until backend-specific round-trip commands exist
- AC status changes are read-only until KSpec/Beads command support is confirmed
- traits are read-only until mapping and write support are explicit

This prevents the app from presenting controls that cannot safely persist.

## Source Of Truth Rules

- KSpec fields should be labeled as KSpec-backed and round-trip through KSpec.
- Beads fields should be labeled as Beads-backed and round-trip through Beads.
- Internal Simple Code GUI projection may cache enriched metadata, but it should
  preserve external IDs and source systems.
- Do not merge KSpec and Beads task identities unless an explicit migration or
  link exists.

## Implementation Sequence

Recommended implementation order:

1. Add optional TypeScript projection fields to `UnifiedTask`.
2. Extend KSpec normalization with available spec/source fields.
3. Extend Beads normalization with accurate source metadata and conservative AC
   detection.
4. Update detail modal to render spec-aware sections read-only.
5. Add compact indicators to task list rows.
6. Add browser filters after richer data is available.

## Impact-Sensitive Symbols

Implementation will likely touch:

- `UnifiedTask`
- `toUnified` in Beads adapter
- `toUnified` in KSpec adapter
- `TaskDetailModal`
- `BeadsTaskList`
- possibly `BrowserModal`

Before editing these symbols, run GitNexus impact analysis for each edited
symbol and verify the affected flow with `gitnexus_detect_changes`.

## Acceptance Criteria

The implementation is complete when:

- Task detail view displays linked spec, ACs, traits, validation,
  implementation, automation, and source metadata when available.
- Task list row displays compact spec/AC/validation/trait indicators.
- Beads projects continue to load, create, edit, start, complete, and delete
  tasks as before.
- KSpec projects continue to load, create, edit, start, complete, delete, and
  dispatch tasks as before.
- Unsupported fields are hidden or read-only rather than faked.
- Source system and external IDs remain visible in the data model.
- Build and tests pass.

