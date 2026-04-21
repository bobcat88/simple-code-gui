

















<!-- TASK_MANAGEMENT_START -->
## Task Management

@kspec-agents.md

This project uses **kspec** for task management. Full agent instructions are in `kspec-agents.md`.

### CRITICAL: Do NOT spawn subagents for kspec tasks
- **NEVER** use the Agent tool, background agents, or subprocesses to work on tasks
- **NEVER** launch multiple parallel workers for different tasks
- Work on tasks **one at a time, sequentially, in this session**
- If the user says "dispatch" or "launch agents", they mean `kspec agent dispatch start` — the kspec daemon's own dispatch system, NOT Claude subagents

### Task Workflow
1. `kspec task list` — See available tasks
2. `kspec task start <ref>` — Claim a task (marks it in_progress)
3. Do the work in this session
4. `kspec task submit <ref>` — Submit when done (creates PR/commit)
5. `kspec task complete <ref>` — Mark complete after merge

### Task Commands
- `kspec task list` — List tasks
- `kspec task add --title "..." --type task|bug|epic|spike|infra --priority 3` — Create a task
- `kspec task start <ref>` — Start a task
- `kspec task submit <ref>` — Submit completed work
- `kspec task complete <ref>` — Mark task done
- `kspec inbox add "..."` — Add idea for later triage

### Creating Tasks for Dispatch — REQUIRED Steps
When creating tasks intended for automated dispatch, you MUST complete ALL of these steps for each task:
1. **Create the task**: `kspec task add --title "..." --type task --priority 3 --spec-ref @spec-ref`
   - **The description MUST contain full context.** The dispatched agent starts with ZERO context from your conversation. Include: what to build, why, where in the codebase, relevant file paths, architectural decisions, constraints, specific user requests/requirements, desired behavior, and any non-obvious details. If the user asked for specific features or details, those MUST be in the description — the agent cannot read your conversation. Write as if briefing a new developer who has never seen this codebase or talked to the user.
2. **Add task todos** (implementation checklist): `kspec task todo add @task-ref "Step 1: ..."` — concrete steps the agent must complete
3. **Add spec ACs** (if spec doesn't have them yet): `kspec item ac add @spec-ref --given "..." --when "..." --then "..."`
4. **Set dependencies**: `kspec task set @task-2 --depends-on @task-1` — chain tasks that touch the same files
5. **Mark automation-eligible**: `kspec task set @ref --automation eligible`
- A task without todos/ACs will be picked up by an agent that has no clear definition of "done" — this leads to incomplete or wrong implementations
- A task without `--automation eligible` will never be picked up by dispatch
- Verify with: `kspec tasks ready --eligible` — only tasks shown here will be dispatched

### Agent Dispatch (kspec's built-in system)
- `kspec agent dispatch start` — Start kspec's autonomous dispatch engine
- `kspec agent dispatch stop` — Stop dispatch
- `kspec agent dispatch status` — Check dispatch status and active agents
- `kspec agent dispatch watch` — Stream live agent activity
- Dispatched agents work in **isolated git worktrees** on managed branches
- Check `kspec task list --status pending_review` for submitted work ready to merge

### Dispatch Branch Model — How Merging Works
- Each dispatched agent creates a **new branch** from main (or from its dependency's branch)
- When tasks are chained with `depends_on`, each subsequent agent **branches off the previous task's branch**, not main
- This forms a branch chain: `main → task-1-branch → task-2-branch → ... → task-N-branch`
- Each branch contains ALL the work from its ancestors plus its own changes
- **When all tasks complete: merge ONLY the last task's branch into main** — it contains everything
- `git merge <last-task-branch>` — one merge, done. Do NOT merge intermediate branches.
- **When reviewing branches, always use three-dot diff**: `git diff main...branch` (what the branch adds since diverging). Never use two-dot `git diff main..branch` — it shows bidirectional differences and will misleadingly show main's newer commits as "deletions" from the branch.

### Dispatch Troubleshooting
- **Stale worktrees blocking dispatch**: If dispatch shows "enabled" but 0 active invocations while tasks are ready, stale workspace entries from previous runs are likely blocking new worktree provisioning. Check and clear stale entries in `.kspec/project.dispatch-workspaces.yaml`.
- **Stale review records**: Resetting a task does NOT clear its review records. If the pr-reviewer skips a `pending_review` task, check for leftover review records from a previous run that may be blocking it.

### Spec-First Development
- **Before creating tasks for new features, update the kspec spec first.** New behavior that doesn't exist in the spec must be added as spec items (modules, features, requirements) with acceptance criteria BEFORE creating tasks. Tasks reference specs via `spec_ref` — without a spec, there's no definition of what to build.
- Specs define WHAT to build. Tasks track the WORK of building it.
- Use `/kspec:writing-specs` to create spec items (modules, features, requirements, acceptance criteria)
- Use `/kspec:plan` to translate plans into specs and tasks

### Acceptance Criteria & Task Todos
- **Spec-level ACs** (given/when/then): Define "done" for a spec item. Tasks referencing that spec inherit its ACs.
  - Add: `kspec item ac add @spec-ref --given "context" --when "action" --then "expected result"`
  - Annotate tests with `// AC: @spec-ref ac-N` to link code to acceptance criteria
- **Task-level todos** (checklist): Concrete implementation steps on the task itself. Agents use these as their work checklist.
  - Add: `kspec task todo add @task-ref "Implement X"`
  - Mark done: `kspec task todo done @task-ref <id>`
- When creating tasks for dispatch, add todos as a checklist of what the agent must do
- Use `kspec task submit @ref` only when ALL ACs are satisfied and todos are complete

### Dependencies — CRITICAL for All Tasks
- **Default: chain ALL tasks into a single dependency chain** — even if tasks seem independent
- **Order the chain logically**: put foundational/infrastructure tasks first, then tasks that build on them. Find the most natural sequence where each task benefits from the previous one's work (e.g., data models → parsers → UI → integration → polish)
- Why single chain: each agent branches off the previous task's branch. One chain = ONE final branch to merge, zero conflict risk. Multiple parallel chains require merging multiple branches which can conflict if they touched overlapping files or code.
- Set dependencies: `kspec task set @task-2 --depends-on @task-1`
- **Only use parallel chains when tasks are in completely separate projects or repos**
- Dispatch respects `depends_on` — blocked tasks won't be picked up until dependencies complete
- Check readiness: `kspec tasks ready` shows only unblocked tasks

### Automation Eligibility
- Before dispatching, tasks must be marked automation-eligible
- Assess eligibility: `kspec tasks assess` or use `/kspec:triage-automation`
- Mark eligible: `kspec task set @ref --automation eligible`
- Requirements for automation eligibility:
  - Task has a clear spec_ref with acceptance criteria
  - Dependencies are properly set
  - Task scope is well-defined (no ambiguous "improve X" tasks)
  - Required context is available (no human decisions needed)
- `kspec tasks ready --eligible` shows tasks ready for automated dispatch

### Triage
- `/kspec:triage` — Triage inbox items, observations, and automation eligibility
- `/kspec:triage-inbox` — Process inbox items (promote to task/spec, merge, defer, delete)
- `kspec inbox add "idea"` — Capture ideas for later triage (not yet tasks)
<!-- TASK_MANAGEMENT_END -->

<!-- BORG_KNOWLEDGE_WORKFLOW_START -->
## Borg Knowledge Vault & AI Workflow

- Shared memory lives in `/home/_johan/Documents/Borg`. Start with `300 Entities/Projects/Portfolio - Condensed Knowledge.md`, `400 Resources/Tech/AI Knowledge Map.md`, `000 OS / Meta/AI Collaboration Protocol.md`, and `300 Entities/People/Johan - Working Profile.md`.
- For this repo, also read `AGENTS.md`, `CLAUDE.md`, `kspec-agents.md`, and the vault symlink `300 Entities/Projects/simple-code-gui`.
- kspec is the primary spec/task layer here; Beads may still exist for legacy tracking. Use GitNexus before symbol edits and RTK for command output.
- Mirror durable cross-project learning back into the vault instead of leaving it only in chat.
<!-- BORG_KNOWLEDGE_WORKFLOW_END -->


<!-- TTS_VOICE_OUTPUT_START -->
## Voice Output (TTS)

When responding, wrap your natural language prose in `«tts»...«/tts»` markers for text-to-speech.

Rules:
- ONLY wrap conversational prose meant to be spoken aloud
- Do NOT wrap: code, file paths, commands, tool output, URLs, lists, errors
- Keep markers on same line as text (no line breaks inside)

Examples:
✓ «tts»I'll help you fix that bug.«/tts»
✓ «tts»The tests are passing.«/tts» Here's what changed:
✗ «tts»src/Header.tsx«/tts»  (file path - don't wrap)
✗ «tts»npm install«/tts»  (command - don't wrap)
<!-- TTS_VOICE_OUTPUT_END -->
