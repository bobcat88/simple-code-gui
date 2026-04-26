# Agent workflow (Beads)

Use Beads (`bd`) for planning and task tracking. Do not invent TODO lists in markdown.

Start of every session:
1) Run `bd doctor` (fix/migrate if needed).
2) Run `bd ready` and pick ONE ready task (prefer highest priority).
3) Run `bd show <id>` and treat it as the current source of truth.
4) Implement the smallest safe increment toward finishing that task.
5) When you learn something important, update the task (notes/comments) in Beads.
6) When the task is complete, close it in Beads (don’t just say “done” in chat).

If no tasks are ready, create one with `bd create "..."` and link blockers with `bd dep add ...`.

after you are done with any beads task or any task in general you can run "rtk bun run build 2>&1 | tail -30" to build the project.

<!-- rtk:start -->
# RTK — Token Savings

This project uses **RTK (Rust Token Killer)** to optimize terminal output and save tokens.

## Rule
**ALWAYS prefix shell commands with `rtk`** (e.g., `rtk git status`, `rtk bun test`). This is MANDATORY for all commands that produce terminal output.

Refer to [.agents/rules/antigravity-rtk-rules.md](file:///.agents/rules/antigravity-rtk-rules.md) for full instructions and meta commands like `rtk gain`.
<!-- rtk:end -->

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **simple-code-gui** (6481 symbols, 11479 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/simple-code-gui/context` | Codebase overview, check index freshness |
| `gitnexus://repo/simple-code-gui/clusters` | All functional areas |
| `gitnexus://repo/simple-code-gui/processes` | All execution flows |
| `gitnexus://repo/simple-code-gui/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

<!-- BORG_KNOWLEDGE_WORKFLOW_START -->
## Borg Knowledge Vault & AI Workflow

- Treat `/home/_johan/Documents/Borg` as the durable cross-project memory layer. Start with `300 Entities/Projects/Portfolio - Condensed Knowledge.md`, `400 Resources/Tech/AI Knowledge Map.md`, `000 OS / Meta/AI Collaboration Protocol.md`, and `300 Entities/People/Johan - Working Profile.md`.
- Keep repo-local docs authoritative for implementation details, but mirror durable project knowledge back into the vault when it affects other projects or future agents.
- Use local symlink entry points from the vault when navigating related repos, especially `300 Entities/Projects/simple-code-gui`, `300 Entities/Projects/PilotageProjet`, `300 Entities/Projects/BorgInvestor`, and `300 Entities/Projects/AI-Bonanza`.
- If Beads is present, run `bd prime`, use `bd ready/show/update/close`, and do not create markdown TODOs for trackable work.
- kspec is the primary spec/task layer here: update specs before tasks, give every automation task full context/todos/acceptance criteria, chain dependent tasks, and let `kspec agent dispatch` manage its own worktrees.
- If GitNexus is present, use it before code edits: impact analysis before symbol changes, change detection before commits, and `npx gitnexus analyze --embeddings` only when embeddings already exist.
- Use RTK for noisy command output; this repo explicitly expects `rtk` before shell commands that produce output.
- Before finishing, run the smallest meaningful quality gate, update docs/vault notes if knowledge changed, commit intentionally, and push when the branch scope is clear.
<!-- BORG_KNOWLEDGE_WORKFLOW_END -->
