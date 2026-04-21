# Adoption Plan

> **Generated**: 2026-04-21
> **Project phase**: Production
> **Engine**: Tauri 2.10.3
> **Template version**: v1.0+

Work through these steps in order. Check off each item as you complete it.
Re-run `/adopt` anytime to check remaining gaps.

---

## Step 1: Fix High-Priority Gaps

### 1a. Retrofit GDDs in `docs/`
The following documents contain design logic but are missing the standard `**Status**:` header and required pipeline sections (Overview, Dependencies, etc.). They must be moved to `design/gdd/` and retrofitted.
- [ ] `docs/initialization-upgrade-flow-design.md` -> `/design-system retrofit`
- [ ] `docs/project-capability-scanner-design.md` -> `/design-system retrofit`
- [ ] `docs/spec-acceptance-task-surface-design.md` -> `/design-system retrofit`
- [ ] `docs/spec-driven-development-contract.md` -> `/design-system retrofit`
- [ ] `docs/superpowers/plans/2026-04-17-phase-2-rust-migration.md` -> `/design-system retrofit`
**Time**: 30 min each

---

## Step 2: Bootstrap Infrastructure

### 2a. Register existing requirements (creates tr-registry.yaml)
Run `/architecture-review` — even if ADRs don't exist yet, this run will scan your source code and GDDs to bootstrap the TR registry.
**Time**: 1 session
- [ ] `docs/architecture/tr-registry.yaml` created

### 2b. Create control manifest
Run `/create-control-manifest` to define your layer rules (Frontend vs Backend).
**Time**: 30 min
- [ ] `docs/architecture/control-manifest.md` created

### 2c. Create sprint tracking file
Run `/sprint-plan update` to initialize the tracking system.
**Time**: 5 min
- [ ] `production/sprint-status.yaml` created

### 2d. Set authoritative project stage
Run `/gate-check production` to finalize the stage setting.
**Time**: 5 min
- [ ] `production/stage.txt` written

---

## Step 3: Medium-Priority Gaps

### 3a. Configure Performance Budgets
`technical-preferences.md` still has `[TO BE CONFIGURED]` for performance.
**Time**: 10 min
- [ ] Update `.claude/docs/technical-preferences.md` with target frame times and bundle size limits.

---

## Re-run
Run `/adopt` again after completing Step 2 to verify all blocking and high gaps are resolved.
