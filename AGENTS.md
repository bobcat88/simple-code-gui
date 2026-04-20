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

after you are done with any beads task or any task in general you can run "cd "/home/user/Programs/Pure Harmony Midi Editor/plugin/build" && cmake --build . --config Release 2>&1 | tail -30" to build the project.

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

<!-- BORG_KNOWLEDGE_WORKFLOW_START -->
## Borg Knowledge Vault & AI Workflow

- Treat `/home/_johan/Documents/Borg` as the durable cross-project memory layer. Start with `300 Entities/Projects/Portfolio - Condensed Knowledge.md`, `400 Resources/Tech/AI Knowledge Map.md`, `000 OS / Meta/AI Collaboration Protocol.md`, and `300 Entities/People/Johan - Working Profile.md`.
- Keep repo-local docs authoritative for implementation details, but mirror durable project knowledge back into the vault when it affects other projects or future agents.
- This is a legacy checkout of `simple-code-gui`; prefer the active `300 Entities/Projects/simple-code-gui` symlink for current work.
- If Beads is present, run `bd prime`, use `bd ready/show/update/close`, and do not create markdown TODOs for trackable work.
- If kspec is present, update specs before tasks, give every automation task full context/todos/acceptance criteria, and let `kspec agent dispatch` manage its own worktrees.
- If GitNexus is present, use it before code edits: impact analysis before symbol changes, change detection before commits, and preserve embeddings when re-analyzing.
- Use RTK for noisy command output when available or when terminal output would obscure decisions.
<!-- BORG_KNOWLEDGE_WORKFLOW_END -->
