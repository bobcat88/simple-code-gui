# Adoption Plan

> **Generated**: 2026-04-21
> **Reconciled**: 2026-04-26
> **Project phase**: Production
> **Engine**: Tauri 2.10.3
> **Template version**: v1.0+

Work through these steps in order. Check off each item as you complete it.
Re-run `/adopt` anytime to check remaining gaps.

---

## Step 1: Fix High-Priority Gaps

### 1a. Retrofit GDDs in `docs/`
The core GDDs were moved to `design/gdd/` and are now tracked in `design/gdd/systems-index.md`.
- [x] `docs/initialization-upgrade-flow-design.md` moved to `design/gdd/initialization-upgrade-flow-design.md`
- [x] `docs/project-capability-scanner-design.md` moved to `design/gdd/project-capability-scanner-design.md`
- [ ] `docs/spec-acceptance-task-surface-design.md` remains a standalone design note until the task/spec surface is promoted into the GDD index.
- [x] `docs/spec-driven-development-contract.md` moved to `design/gdd/spec-driven-development-contract.md`
- [ ] `docs/superpowers/plans/2026-04-17-phase-2-rust-migration.md` remains historical migration planning material.
**Time**: 30 min each

---

## Step 2: Bootstrap Infrastructure

### 2a. Register existing requirements (creates tr-registry.yaml)
Run `/architecture-review` — even if ADRs don't exist yet, this run will scan your source code and GDDs to bootstrap the TR registry.
**Time**: 1 session
- [ ] Deferred. Use Beads/KSpec plus `design/gdd/systems-index.md` as the current source of truth until architecture registry work is explicitly scheduled.

### 2b. Create control manifest
Run `/create-control-manifest` to define your layer rules (Frontend vs Backend).
**Time**: 30 min
- [ ] Deferred. Current boundary rules are documented in `AGENTS.md`, `CLAUDE.md`, and the unified renderer `Api` bridge.

### 2c. Create sprint tracking file
Run `/sprint-plan update` to initialize the tracking system.
**Time**: 5 min
- [ ] Deferred. Beads is the active task tracker for this convergence run.

### 2d. Set authoritative project stage
Run `/gate-check production` to finalize the stage setting.
**Time**: 5 min
- [ ] Deferred. Project phase remains documented here as Production.

---

## Step 3: Medium-Priority Gaps

### 3a. Configure Performance Budgets
`technical-preferences.md` now has explicit desktop bundle and responsiveness budgets.
**Time**: 10 min
- [x] Update `.claude/docs/technical-preferences.md` with target frame times and bundle size limits.

### 3b. Bundle Warning Policy
`bun run build:frontend` currently produces a primary renderer chunk below the configured 1.4 MB desktop budget. Vite's `chunkSizeWarningLimit` is set to that budget so warnings indicate actual budget pressure instead of the generic 500 kB web default.
- [x] Configure `vite.config.ts` bundle warning threshold.
- [x] Record current minified/gzip baseline in `.claude/docs/technical-preferences.md`.

---

## Re-run
Run `/adopt` again after completing Step 2 to verify all blocking and high gaps are resolved.
