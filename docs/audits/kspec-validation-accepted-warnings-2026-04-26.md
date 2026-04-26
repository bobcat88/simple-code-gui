# KSpec Validation Accepted Warnings - 2026-04-26

Task: `simple-code-gui-en6`

## Status

KSpec validation has no schema or reference errors. The project accepts the current
alignment and completeness warnings as backlog/spec maturity debt while convergence
work continues.

Validation command:

```bash
kspec validate --warnings-ok
```

Current result:

- Files checked: 12
- Items checked: 63
- Tasks checked: 9
- Schema: OK
- References: OK
- Warning-tolerant exit code: 0

## Accepted Alignment Warnings

The validator reports 15 orphaned specs with no direct implementation task. These
are accepted because they describe module-level or future capability areas, not
currently ready implementation work:

- Terminal Management
- Layout & Navigation
- Voice I/O
- Task Management
- Connectivity
- Extensions & Configuration
- AI Intelligence & Orchestration
- Provider Abstraction Interface
- Auth & API Key Management
- Model Routing Policies
- Named Model Plans
- Phase-based Decomposition
- Wave-based Execution
- Verification & Retry Loop
- Execution State Persistence

## Accepted Completeness Warnings

The validator reports 44 specs without acceptance criteria. These remain accepted
as historical or module-level requirements until the next spec hardening pass.

The validator also reports 12 specs whose own acceptance criteria are not covered
by direct KSpec tasks:

- `@pty-lifecycle`: `ac-1`, `ac-2`, `ac-3`
- `@multi-backend`: `ac-1`, `ac-2`
- `@tiled-layout`: `ac-1`, `ac-2`
- `@stt`: `ac-1`
- `@tts`: `ac-1`
- `@task-adapter`: `ac-1`, `ac-2`
- `@orchestrator`: `ac-1`, `ac-2`
- `@mobile-server`: `ac-1`
- `@dual-env`: `ac-1`
- `@workspace-persist`: `ac-1`
- `@token-economics`: `ac-1`, `ac-2`, `ac-3`, `ac-4`
- `@01KPNWTT`: `ac-1`, `ac-2`, `ac-3`, `ac-4`

## Follow-Up Policy

Do not create placeholder implementation tasks solely to silence these warnings.
When one of the accepted specs becomes active work, create or update the KSpec
task with explicit acceptance criteria coverage before implementation begins.
