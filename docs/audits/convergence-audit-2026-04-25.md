# Convergence Audit - 2026-04-25

Source issue: `simple-code-gui-hem`

## Executive Summary

The project is not converged. The release build can complete, but several
stronger quality gates fail and the planning systems disagree about current
state. The immediate risk is not one isolated bug; it is contract drift between
the roadmap, KSpec, Beads, Rust IPC, TypeScript API types, and React call sites.

The app should enter a convergence phase before more feature work. Fix gates in
order: task/spec integrity, TypeScript contracts, test harness/runtime mocks,
Rust test drift, then Phase 26 product completion.

## 2026-04-26 Convergence Addendum

The convergence run closed the original high-risk gate failures:

- KSpec references are valid; remaining alignment/completeness warnings are
  accepted in `docs/audits/kspec-validation-accepted-warnings-2026-04-26.md`.
- `bunx tsc --noEmit` passes.
- `bun run test` passes.
- `cargo test --manifest-path src-tauri/Cargo.toml` passes.
- Phase 26 now has a working sidebar seed/draft and seed-to-KSpec/Beads bridge;
  larger canvas/sketch/review scope is tracked separately as `simple-code-gui-51q`.
- Frontend bundle size is explicitly budgeted in
  `.claude/docs/technical-preferences.md`, and Vite warns at the 1.4 MB desktop
  renderer budget instead of the generic 500 kB web default.

The remaining ready work after this addendum should be tracked by Beads rather
than inferred from this historical audit snapshot.

## Tracker And Planning State

### Beads

- `simple-code-gui-hem` is in progress for this audit.
- `simple-code-gui-du5` is in progress for Phase 26 Ideation Canvas Integration.
- No open ready work was available before creating the convergence audit issue.

### KSpec

`kspec validate` fails.

- Schema: OK.
- Reference errors: 1.
- Broken dependency: `@task-advanced-workspace-control` in
  `.kspec/project.tasks.yaml`.
- Alignment warnings: 15 orphaned specs.
- Completeness warnings: 56, including 44 missing acceptance criteria and 12
  missing own-AC coverage entries.
- All 9 KSpec tasks are marked completed, so KSpec currently has no live task
  queue despite the validation failure.

### GSD / Superpowers

- No `.planning/` directory exists.
- Active roadmap state lives in `ROADMAP.md` and
  `docs/superpowers/plans/2026-04-25-brainstorm-companion.md`.
- The Phase 26 plan still shows every checkbox unchecked, but code already
  contains a partial Brainstorm foundation.

## Quality Gate Results

### Passing

- `bun run build:frontend` passes.
- `bun run build` passes and produces the Tauri `.deb`.

### Failing

- `kspec validate` fails due to the broken task dependency above.
- `bunx tsc --noEmit` fails with broad TypeScript contract drift.
- `bun run test` fails in Vitest.
- `cargo test --manifest-path src-tauri/Cargo.toml` does not compile.

### Warning

- Frontend bundle is large:
  `dist/assets/index-Cf7BS08S.js` is 1,310.63 kB minified / 355.24 kB gzip.

## High-Confidence Findings

### F-01: KSpec Graph Is Invalid

Severity: high

`.kspec/project.tasks.yaml` and the corresponding completed task reference
`@task-advanced-workspace-control`, but that ref does not exist. There is an
implemented spec item for `workspace-control`, so this is likely a stale slug or
task ref.

Classification: auto-fixable after deciding whether the dependency should point
to the existing spec item or be removed from the completed task.

### F-02: TypeScript Type Gate Is Not Enforced By Build

Severity: high

`bun run build:frontend` passes, but `bunx tsc --noEmit` fails across many
surfaces. This means production bundling can hide broken contracts.

Major clusters:

- Optional API methods invoked as required in `GSDPlanner`, `TerminalBar`,
  `VoiceBrowserModal`, and intelligence components.
- Missing imports and undefined identifiers such as `Coins`, `Activity`,
  `useApi`, `rows`, `cols`, and `options`.
- Settings model drift around `aiRuntime`.
- Vector search result shape drift in `Spotlight`.
- Upgrade report shape drift between `affectedFiles` and `affected_files`.
- Brainstorm seed/draft shape drift.
- Beads/KSpec adapter export/import drift.

Classification: manual phase, split by subsystem. Too broad for one safe patch.

### F-03: Vitest Harness Does Not Mock Tauri Events

Severity: high

`bun run test` fails because components call `@tauri-apps/api/event.listen` in
jsdom and the Tauri internals are undefined.

Observed sources:

- `UpgradePanel.tsx` listens for `upgrade-progress`.
- `tauri-ipc.ts` listens for `agent-message`, used by `useSwarmMessages`.

Classification: auto-fixable. Add a proper Tauri event mock in
`src/__tests__/setup.ts` or mock the Tauri modules in Vitest config.

### F-04: Rust Tests Drifted From Runtime Types

Severity: high

`cargo test --manifest-path src-tauri/Cargo.toml` does not compile.

Observed clusters:

- `AIProvider` test mock is missing required trait methods.
- Tests call `resolve_routes`, but the current method is
  `resolve_routes_for_embedding`.
- `TokenTransactionInput` test initializers are missing `nexus_session_id`.
- `TokenHistoryFilters` test initializer is missing `session_id` and
  `nexus_session_id`.

Classification: auto-fixable in test code, but should be patched after deciding
whether these tests still cover the intended current behavior.

### F-05: Phase 26 Brainstorm Foundation Is Partial And Contract-Mismatched

Severity: high

Code exists for the Brainstorm foundation, but it does not match the full
roadmap or its own type contracts.

Present:

- Rust handlers: `gsd_list_seeds`, `gsd_plant_seed`, `kspec_list_drafts`,
  `kspec_write_draft`.
- Tauri handler registration.
- TypeScript API methods.
- `BrainstormTab` registered in the intelligence sidebar.

Missing or incomplete:

- JSON Canvas / node-based ideation canvas.
- Agentic sketching.
- Real promote-to-Beads/KSpec workflow.
- Multi-agent design review.
- KSpec shadow-branch integration and validation.
- Dedicated `IdeaInbox`, `SpecDraftEditor`, and `PromotionWorkflow` components
  described by the spec were collapsed into one component.

Contract issues:

- Rust serializes `when_to_surface` and `last_modified`.
- TypeScript expects `whenToSurface` and `lastModified`.
- `BrainstormTab` uses fields not present in the declared types:
  `createdAt`, `moduleId`, and `updatedAt`.

Classification: mixed. Type normalization is auto-fixable; product completion is
manual design/implementation work.

### F-06: Architecture / Adoption Docs Are Stale

Severity: medium

`docs/adoption-plan-2026-04-21.md` still lists architecture bootstrap and doc
retrofit tasks. Some referenced docs already moved into `design/gdd/`, but the
system index still says implementations are TBD for systems that appear partly
or fully implemented.

Classification: manual. Needs reconciliation after code gates are stable.

## Recommended Convergence Run

### Wave 1: Restore Truth Sources

Goal: make task/spec state valid before touching feature code.

- Fix the KSpec broken dependency.
- Decide whether Beads Phase 26 should remain in progress, be split into
  smaller Beads issues, or become blocked on convergence.
- Update Phase 26 plan checkboxes to reflect actual implementation only after
  code gates are green.

Exit criteria:

- `kspec validate` has no reference errors.
- Beads shows one active convergence task and clearly scoped follow-up tasks.

### Wave 2: Restore Type Safety

Goal: make TypeScript contracts meaningful.

- Add `tsc --noEmit` as an explicit quality gate.
- Fix errors by subsystem, starting with undefined identifiers and API shape
  drift.
- Normalize snake_case/camelCase boundaries at the IPC adapter layer.

Exit criteria:

- `bunx tsc --noEmit` passes.

### Wave 3: Restore Automated Tests

Goal: make frontend and Rust tests trustworthy again.

- Mock Tauri event APIs for jsdom tests.
- Repair Rust test fixtures and mock providers against current trait/type
  definitions.

Exit criteria:

- `bun run test` passes.
- `cargo test --manifest-path src-tauri/Cargo.toml` passes.

### Wave 4: Phase 26 Completion

Goal: converge Brainstorm Companion with the roadmap.

- Normalize seed/draft DTOs.
- Implement real promotion to Beads/KSpec.
- Decide whether JSON Canvas is embedded as a library, file-backed canvas, or a
  custom node model.
- Add validation around KSpec drafts before they are presented as usable.

Exit criteria:

- Phase 26 acceptance criteria are testable and tracked in Beads/KSpec.
- Build, typecheck, frontend tests, Rust tests, and KSpec validation pass.

### Wave 5: Documentation And Performance

Goal: align docs and manage bundle growth.

- Reconcile `ROADMAP.md`, `design/gdd/systems-index.md`, and adoption docs.
- Add or document bundle budget targets.
- Consider code-splitting high-cost panels after functional gates are stable.

Exit criteria:

- Planning docs match the code and trackers.
- Frontend build warnings are either resolved or explicitly accepted with a
  budget note.
