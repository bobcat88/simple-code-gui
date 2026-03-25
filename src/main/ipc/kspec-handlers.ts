/**
 * Kspec IPC Handlers
 *
 * Minimal handlers for operations that need main process access:
 * - Filesystem checks (.kspec/ existence)
 * - Project initialization (runs kspec CLI)
 * - Daemon lifecycle (start/stop)
 *
 * Most kspec operations go directly to the daemon HTTP API from the renderer.
 * These handlers only cover what can't be done from the browser context.
 */

import { ipcMain } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'
import { getEnhancedPathWithPortable } from '../platform'

const TASK_INSTRUCTIONS_START = '<!-- TASK_MANAGEMENT_START -->'
const TASK_INSTRUCTIONS_END = '<!-- TASK_MANAGEMENT_END -->'

function getTaskInstructions(backend: 'beads' | 'kspec'): string {
  const beadsCommands = `### CLI Commands (beads)
- \`bd list\` — List tasks (add \`--status=open\` to filter)
- \`bd show <id>\` — Show task details
- \`bd create --title="..." --type=task|bug|feature --priority=2\` — Create a task
- \`bd update <id> --status=in_progress\` — Start a task
- \`bd close <id>\` — Complete a task
- \`bd ready\` — Show tasks ready to work on

### Workflow
1. Check the task panel in the GUI sidebar for available work
2. Click a task to start it, or use the CLI commands above
3. Mark tasks complete from the GUI or CLI when done`

  const kspecInstructions = `@kspec-agents.md

This project uses **kspec** for task management. Full agent instructions are in \`kspec-agents.md\`.

### CRITICAL: Do NOT spawn subagents for kspec tasks
- **NEVER** use the Agent tool, background agents, or subprocesses to work on tasks
- **NEVER** launch multiple parallel workers for different tasks
- Work on tasks **one at a time, sequentially, in this session**
- If the user says "dispatch" or "launch agents", they mean \`kspec agent dispatch start\` — the kspec daemon's own dispatch system, NOT Claude subagents

### Task Workflow
1. \`kspec task list\` — See available tasks
2. \`kspec task start <ref>\` — Claim a task (marks it in_progress)
3. Do the work in this session
4. \`kspec task submit <ref>\` — Submit when done (creates PR/commit)
5. \`kspec task complete <ref>\` — Mark complete after merge

### Task Commands
- \`kspec task list\` — List tasks
- \`kspec task add --title "..." --type task|bug|epic|spike|infra --priority 3\` — Create a task
- \`kspec task start <ref>\` — Start a task
- \`kspec task submit <ref>\` — Submit completed work
- \`kspec task complete <ref>\` — Mark task done
- \`kspec inbox add "..."\` — Add idea for later triage

### Creating Tasks for Dispatch — REQUIRED Steps
When creating tasks intended for automated dispatch, you MUST complete ALL of these steps for each task:
1. **Create the task**: \`kspec task add --title "..." --type task --priority 3 --spec-ref @spec-ref\`
   - **The description MUST contain full context.** The dispatched agent starts with ZERO context from your conversation. Include: what to build, why, where in the codebase, relevant file paths, architectural decisions, constraints, specific user requests/requirements, desired behavior, and any non-obvious details. If the user asked for specific features or details, those MUST be in the description — the agent cannot read your conversation. Write as if briefing a new developer who has never seen this codebase or talked to the user.
2. **Add task todos** (implementation checklist): \`kspec task todo add @task-ref "Step 1: ..."\` — concrete steps the agent must complete
3. **Add spec ACs** (if spec doesn't have them yet): \`kspec item ac add @spec-ref --given "..." --when "..." --then "..."\`
4. **Set dependencies**: \`kspec task set @task-2 --depends-on @task-1\` — chain tasks that touch the same files
5. **Mark automation-eligible**: \`kspec task set @ref --automation eligible\`
- A task without todos/ACs will be picked up by an agent that has no clear definition of "done" — this leads to incomplete or wrong implementations
- A task without \`--automation eligible\` will never be picked up by dispatch
- Verify with: \`kspec tasks ready --eligible\` — only tasks shown here will be dispatched

### Agent Dispatch (kspec's built-in system)
- \`kspec agent dispatch start\` — Start kspec's autonomous dispatch engine
- \`kspec agent dispatch stop\` — Stop dispatch
- \`kspec agent dispatch status\` — Check dispatch status and active agents
- \`kspec agent dispatch watch\` — Stream live agent activity
- Dispatched agents work in **isolated git worktrees** on managed branches
- Check \`kspec task list --status pending_review\` for submitted work ready to merge

### Dispatch Branch Model — How Merging Works
- Each dispatched agent creates a **new branch** from main (or from its dependency's branch)
- When tasks are chained with \`depends_on\`, each subsequent agent **branches off the previous task's branch**, not main
- This forms a branch chain: \`main → task-1-branch → task-2-branch → ... → task-N-branch\`
- Each branch contains ALL the work from its ancestors plus its own changes
- **When all tasks complete: merge ONLY the last task's branch into main** — it contains everything
- \`git merge <last-task-branch>\` — one merge, done. Do NOT merge intermediate branches.
- **When reviewing branches, always use three-dot diff**: \`git diff main...branch\` (what the branch adds since diverging). Never use two-dot \`git diff main..branch\` — it shows bidirectional differences and will misleadingly show main's newer commits as "deletions" from the branch.

### Dispatch Troubleshooting
- **Stale worktrees blocking dispatch**: If dispatch shows "enabled" but 0 active invocations while tasks are ready, stale workspace entries from previous runs are likely blocking new worktree provisioning. Check and clear stale entries in \`.kspec/project.dispatch-workspaces.yaml\`.
- **Stale review records**: Resetting a task does NOT clear its review records. If the pr-reviewer skips a \`pending_review\` task, check for leftover review records from a previous run that may be blocking it.

### Spec-First Development
- **Before creating tasks for new features, update the kspec spec first.** New behavior that doesn't exist in the spec must be added as spec items (modules, features, requirements) with acceptance criteria BEFORE creating tasks. Tasks reference specs via \`spec_ref\` — without a spec, there's no definition of what to build.
- Specs define WHAT to build. Tasks track the WORK of building it.
- Use \`/kspec:writing-specs\` to create spec items (modules, features, requirements, acceptance criteria)
- Use \`/kspec:plan\` to translate plans into specs and tasks

### Acceptance Criteria & Task Todos
- **Spec-level ACs** (given/when/then): Define "done" for a spec item. Tasks referencing that spec inherit its ACs.
  - Add: \`kspec item ac add @spec-ref --given "context" --when "action" --then "expected result"\`
  - Annotate tests with \`// AC: @spec-ref ac-N\` to link code to acceptance criteria
- **Task-level todos** (checklist): Concrete implementation steps on the task itself. Agents use these as their work checklist.
  - Add: \`kspec task todo add @task-ref "Implement X"\`
  - Mark done: \`kspec task todo done @task-ref <id>\`
- When creating tasks for dispatch, add todos as a checklist of what the agent must do
- Use \`kspec task submit @ref\` only when ALL ACs are satisfied and todos are complete

### Dependencies — CRITICAL for All Tasks
- **Default: chain ALL tasks into a single dependency chain** — even if tasks seem independent
- **Order the chain logically**: put foundational/infrastructure tasks first, then tasks that build on them. Find the most natural sequence where each task benefits from the previous one's work (e.g., data models → parsers → UI → integration → polish)
- Why single chain: each agent branches off the previous task's branch. One chain = ONE final branch to merge, zero conflict risk. Multiple parallel chains require merging multiple branches which can conflict if they touched overlapping files or code.
- Set dependencies: \`kspec task set @task-2 --depends-on @task-1\`
- **Only use parallel chains when tasks are in completely separate projects or repos**
- Dispatch respects \`depends_on\` — blocked tasks won't be picked up until dependencies complete
- Check readiness: \`kspec tasks ready\` shows only unblocked tasks

### Automation Eligibility
- Before dispatching, tasks must be marked automation-eligible
- Assess eligibility: \`kspec tasks assess\` or use \`/kspec:triage-automation\`
- Mark eligible: \`kspec task set @ref --automation eligible\`
- Requirements for automation eligibility:
  - Task has a clear spec_ref with acceptance criteria
  - Dependencies are properly set
  - Task scope is well-defined (no ambiguous "improve X" tasks)
  - Required context is available (no human decisions needed)
- \`kspec tasks ready --eligible\` shows tasks ready for automated dispatch

### Triage
- \`/kspec:triage\` — Triage inbox items, observations, and automation eligibility
- \`/kspec:triage-inbox\` — Process inbox items (promote to task/spec, merge, defer, delete)
- \`kspec inbox add "idea"\` — Capture ideas for later triage (not yet tasks)`

  return `${TASK_INSTRUCTIONS_START}
## Task Management

${backend === 'beads' ? beadsCommands : kspecInstructions}
${TASK_INSTRUCTIONS_END}
`
}

export function installTaskInstructions(projectPath: string, backend: 'beads' | 'kspec'): boolean {
  try {
    const claudeDir = join(projectPath, '.claude')
    const claudeMdPath = join(claudeDir, 'CLAUDE.md')

    if (!existsSync(claudeDir)) {
      mkdirSync(claudeDir, { recursive: true })
    }

    let content = ''
    if (existsSync(claudeMdPath)) {
      content = readFileSync(claudeMdPath, 'utf8')
      // Remove existing task section if present
      if (content.includes(TASK_INSTRUCTIONS_START)) {
        const startIdx = content.indexOf(TASK_INSTRUCTIONS_START)
        const endIdx = content.indexOf(TASK_INSTRUCTIONS_END)
        if (startIdx !== -1 && endIdx !== -1) {
          content = content.substring(0, startIdx) + content.substring(endIdx + TASK_INSTRUCTIONS_END.length)
        }
      }
    }

    content += getTaskInstructions(backend)
    writeFileSync(claudeMdPath, content)
    return true
  } catch (e) {
    console.error('Failed to install task instructions:', e)
    return false
  }
}

function getExecOptions() {
  return {
    env: { ...process.env, PATH: getEnhancedPathWithPortable() }
  }
}

function spawnCommand(cmd: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      cwd,
      env: getExecOptions().env,
      shell: false
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => { stdout += data.toString() })
    proc.stderr.on('data', (data) => { stderr += data.toString() })

    proc.on('close', (code) => {
      resolve({ stdout, stderr, code: code ?? 1 })
    })

    proc.on('error', (err) => {
      resolve({ stdout, stderr: err.message, code: 1 })
    })
  })
}

async function migrateBeadsToKspec(cwd: string): Promise<{ success: boolean; migrated: number; error?: string }> {
  try {
    // 1. Read all beads tasks via bd list --json
    const listResult = await spawnCommand('bd', ['list', '--json'], cwd)
    if (listResult.code !== 0) {
      return { success: false, migrated: 0, error: `Failed to read beads tasks: ${listResult.stderr}` }
    }

    let beadsTasks: Array<Record<string, unknown>> = []
    try {
      const parsed = JSON.parse(listResult.stdout)
      beadsTasks = Array.isArray(parsed) ? parsed : (parsed.issues ?? parsed.tasks ?? [])
    } catch {
      // No tasks to migrate, or empty output — that's fine
      beadsTasks = []
    }

    // 2. Initialize kspec
    const gitDir = join(cwd, '.git')
    if (!existsSync(gitDir)) {
      const gitResult = await spawnCommand('git', ['init'], cwd)
      if (gitResult.code !== 0) {
        return { success: false, migrated: 0, error: `Failed to init git: ${gitResult.stderr}` }
      }
      await spawnCommand('git', ['config', 'user.name', 'kspec'], cwd)
      await spawnCommand('git', ['config', 'user.email', 'kspec@local'], cwd)
      await spawnCommand('git', ['commit', '--allow-empty', '-m', 'init'], cwd)
    }

    const initResult = await spawnCommand('kspec', ['init', '.', '--name', 'Project'], cwd)
    if (initResult.code !== 0) {
      return { success: false, migrated: 0, error: `kspec init failed: ${initResult.stderr}` }
    }

    // Run setup + generate agents instructions
    await spawnCommand('kspec', ['setup'], cwd)
    await spawnCommand('kspec', ['agents', 'generate'], cwd)

    // 3. Ensure daemon is running for task creation
    let daemonReady = false
    const healthCheck = await fetch('http://localhost:3456/api/health').catch(() => null)
    if (healthCheck?.ok) {
      daemonReady = true
    } else {
      const proc = spawn('kspec', ['serve', 'start', '--daemon'], {
        cwd,
        env: getExecOptions().env,
        detached: true,
        stdio: 'ignore'
      })
      proc.unref()
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 500))
        const check = await fetch('http://localhost:3456/api/health').catch(() => null)
        if (check?.ok) { daemonReady = true; break }
      }
    }

    // 4. Migrate each task to kspec
    let migrated = 0
    if (daemonReady && beadsTasks.length > 0) {
      // Register project with daemon
      await fetch('http://localhost:3456/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: cwd })
      }).catch(() => {})

      for (const task of beadsTasks) {
        try {
          // Map beads priority (0-4, 0=critical) to kspec priority (1-5, 1=highest)
          const beadsPriority = typeof task.priority === 'number' ? task.priority : 2
          const kspecPriority = Math.min(5, Math.max(1, beadsPriority + 1))

          // Map beads type to kspec type
          const beadsType = String(task.issue_type ?? task.type ?? 'task')
          const kspecType = beadsType === 'feature' ? 'task' : (['bug', 'task', 'epic'].includes(beadsType) ? beadsType : 'task')

          // Map beads status to kspec status
          const beadsStatus = String(task.status ?? 'open')
          let kspecStatus: string | undefined
          if (beadsStatus === 'in_progress') kspecStatus = 'in_progress'
          else if (beadsStatus === 'closed') kspecStatus = 'completed'
          // 'open' maps to 'pending' which is the default — no need to set

          const res = await fetch('http://localhost:3456/api/tasks', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Kspec-Dir': cwd
            },
            body: JSON.stringify({
              title: String(task.title ?? ''),
              description: task.description ? String(task.description) : undefined,
              priority: kspecPriority,
              type: kspecType,
              status: kspecStatus,
              tags: [`migrated-from:${String(task.id ?? '')}`]
            })
          })
          if (res.ok) migrated++
        } catch {
          // Skip individual task failures
        }
      }
    }

    // 5. Stop beads daemon and remove .beads/ directory
    const beadsDir = join(cwd, '.beads')
    if (existsSync(beadsDir)) {
      // Stop beads daemon first (releases lock files)
      await spawnCommand('bd', ['daemon', '--stop'], cwd).catch(() => {})
      // Small delay for daemon to release files
      await new Promise(r => setTimeout(r, 500))
      const { rmSync } = await import('fs')
      rmSync(beadsDir, { recursive: true, force: true })
    }

    // 6. Update CLAUDE.md to kspec instructions
    installTaskInstructions(cwd, 'kspec')

    return { success: true, migrated }
  } catch (e) {
    return { success: false, migrated: 0, error: String(e) }
  }
}

async function checkAndUpdateKspec(): Promise<void> {
  try {
    const localResult = await spawnCommand('kspec', ['--version'], process.cwd())
    if (localResult.code !== 0) return
    const localVersion = localResult.stdout.trim().replace(/^v/, '')

    const npmResult = await spawnCommand('npm', ['view', '@kynetic-ai/spec', 'version'], process.cwd())
    if (npmResult.code !== 0) return
    const latestVersion = npmResult.stdout.trim()

    if (localVersion !== latestVersion) {
      console.log(`[kspec] Updating from ${localVersion} to ${latestVersion}...`)
      await spawnCommand('npm', ['install', '-g', '@kynetic-ai/spec@latest'], process.cwd())
      console.log(`[kspec] Updated to ${latestVersion}`)
    }
  } catch { /* silent */ }
}

export function registerKspecHandlers() {
  // Check if .kspec/ directory exists in a project
  ipcMain.handle('kspec:check', async (_event, cwd: string) => {
    const kspecPath = join(cwd, '.kspec')
    const exists = existsSync(kspecPath)
    return { exists }
  })

  // Initialize kspec in a project directory
  // Requires: git repo, kspec CLI available
  ipcMain.handle('kspec:init', async (_event, cwd: string) => {
    try {
      // Check if it's a git repo first
      const gitDir = join(cwd, '.git')
      if (!existsSync(gitDir)) {
        // Init git first
        const gitResult = await spawnCommand('git', ['init'], cwd)
        if (gitResult.code !== 0) {
          return { success: false, error: `Failed to init git: ${gitResult.stderr}` }
        }
        // Set default git config for the repo
        await spawnCommand('git', ['config', 'user.name', 'kspec'], cwd)
        await spawnCommand('git', ['config', 'user.email', 'kspec@local'], cwd)
        await spawnCommand('git', ['commit', '--allow-empty', '-m', 'init'], cwd)
      }

      // Run kspec init
      const result = await spawnCommand('kspec', ['init', '.', '--name', 'Project'], cwd)
      if (result.code !== 0) {
        return { success: false, error: result.stderr || 'kspec init failed' }
      }

      // Run kspec setup — sets up agent definitions, skills, .agents/ directory
      await spawnCommand('kspec', ['setup'], cwd)

      // Generate kspec-agents.md — full agent instructions with workflows, conventions, skills
      await spawnCommand('kspec', ['agents', 'generate'], cwd)

      // Add task instructions to CLAUDE.md pointing at kspec-agents.md
      installTaskInstructions(cwd, 'kspec')

      return { success: true }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  // Start kspec daemon if not running
  let updateCheckDone = false
  ipcMain.handle('kspec:ensure-daemon', async (_event, cwd: string) => {
    try {
      // Check if daemon is already running
      const res = await fetch('http://localhost:3456/api/health').catch(() => null)
      if (res?.ok) {
        // Register this project with the running daemon
        await fetch('http://localhost:3456/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: cwd })
        }).catch(() => {})

        // Background update check (once per app session, non-blocking)
        if (!updateCheckDone) {
          updateCheckDone = true
          checkAndUpdateKspec().catch(() => {})
        }

        return { success: true, alreadyRunning: true }
      }

      // Start daemon in background
      const proc = spawn('kspec', ['serve', 'start', '--daemon'], {
        cwd,
        env: getExecOptions().env,
        detached: true,
        stdio: 'ignore'
      })
      proc.unref()

      // Wait for daemon to be ready (up to 5 seconds)
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 500))
        const check = await fetch('http://localhost:3456/api/health').catch(() => null)
        if (check?.ok) {
          return { success: true, alreadyRunning: false }
        }
      }

      return { success: false, error: 'Daemon did not start in time' }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  // Check if kspec CLI is installed
  ipcMain.handle('kspec:check-cli', async () => {
    try {
      const result = await spawnCommand('kspec', ['--version'], process.cwd())
      return { installed: result.code === 0, version: result.stdout.trim() }
    } catch {
      return { installed: false }
    }
  })

  // Install kspec CLI via npm
  ipcMain.handle('kspec:install-cli', async () => {
    try {
      const result = await spawnCommand('npm', ['install', '-g', '@kynetic-ai/spec'], process.cwd())
      if (result.code !== 0) {
        return { success: false, error: result.stderr || 'npm install failed' }
      }
      return { success: true }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  // Migrate beads tasks to kspec (upgrade path)
  ipcMain.handle('kspec:migrate-from-beads', async (_event, cwd: string) => {
    return migrateBeadsToKspec(cwd)
  })

  // Check for kspec updates and install if available
  ipcMain.handle('kspec:update', async () => {
    try {
      // Get installed version
      const localResult = await spawnCommand('kspec', ['--version'], process.cwd())
      if (localResult.code !== 0) return { updated: false, error: 'kspec not installed' }
      const localVersion = localResult.stdout.trim().replace(/^v/, '')

      // Get latest version from npm
      const npmResult = await spawnCommand('npm', ['view', '@kynetic-ai/spec', 'version'], process.cwd())
      if (npmResult.code !== 0) return { updated: false, error: 'Could not check npm' }
      const latestVersion = npmResult.stdout.trim()

      if (localVersion === latestVersion) {
        return { updated: false, current: localVersion, latest: latestVersion }
      }

      // Update
      const updateResult = await spawnCommand('npm', ['install', '-g', '@kynetic-ai/spec@latest'], process.cwd())
      if (updateResult.code !== 0) {
        return { updated: false, error: updateResult.stderr || 'Update failed', current: localVersion, latest: latestVersion }
      }

      return { updated: true, previous: localVersion, current: latestVersion }
    } catch (e) {
      return { updated: false, error: String(e) }
    }
  })

  // Start agent dispatch
  ipcMain.handle('kspec:dispatch-start', async (_event, cwd: string) => {
    try {
      const result = await spawnCommand('kspec', ['agent', 'dispatch', 'start'], cwd)
      if (result.code !== 0) {
        return { success: false, error: result.stderr || 'Failed to start dispatch' }
      }
      return { success: true }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  // Stop agent dispatch
  ipcMain.handle('kspec:dispatch-stop', async (_event, cwd: string) => {
    try {
      const result = await spawnCommand('kspec', ['agent', 'dispatch', 'stop'], cwd)
      if (result.code !== 0) {
        return { success: false, error: result.stderr || 'Failed to stop dispatch' }
      }
      return { success: true }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  // Check agent dispatch status
  ipcMain.handle('kspec:dispatch-status', async (_event, cwd: string) => {
    try {
      const result = await spawnCommand('kspec', ['agent', 'dispatch', 'status', '--json'], cwd)
      if (result.code !== 0) {
        return { running: false }
      }
      try {
        const data = JSON.parse(result.stdout)
        return { running: true, ...data }
      } catch {
        return { running: result.stdout.toLowerCase().includes('running') }
      }
    } catch {
      return { running: false }
    }
  })
}
