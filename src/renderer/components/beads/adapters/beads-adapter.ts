/**
 * Beads Adapter
 *
 * Wraps existing beads* calls into the TaskAdapter interface.
 * This is a thin shim — all logic stays in the existing IPC handlers.
 */

import type {
  TaskAdapter,
  BackendStatus,
  UnifiedTask,
  CreateTaskParams,
  UpdateTaskParams,
  TaskStatus
} from './types.js'

function normalizeStatus(status: string): TaskStatus {
  switch (status) {
    case 'in_progress': return 'in_progress'
    case 'closed': return 'closed'
    default: return 'open'
  }
}

function toUnified(raw: Record<string, unknown>): UnifiedTask {
  const id = String(raw.id ?? '')
  const acceptanceCriteriaText = typeof raw.acceptance_criteria === 'string' ? raw.acceptance_criteria : ''
  const hasSpec = acceptanceCriteriaText.length > 0

  // Conservative AC detection for Beads: split by newlines if it looks like a list
  const acceptanceCriteria = acceptanceCriteriaText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('-') || line.startsWith('*') || /^\d+\./.test(line))
    .map((line, index) => ({
      id: `ac-${index}`,
      text: line.replace(/^[-*\d.]+\s*/, ''),
      status: 'not_started' as const,
      sourceSystem: 'beads' as const
    }))

  return {
    id,
    title: String(raw.title ?? ''),
    status: normalizeStatus(String(raw.status ?? 'open')),
    priority: typeof raw.priority === 'number' ? raw.priority : undefined,
    type: typeof raw.issue_type === 'string' ? raw.issue_type : undefined,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    created_at: typeof raw.created_at === 'string' ? raw.created_at : typeof raw.created === 'string' ? raw.created : undefined,
    updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : undefined,
    hasSpec,
    acceptanceCriteria: acceptanceCriteria.length > 0 ? acceptanceCriteria : undefined,
    source: {
      backend: 'beads',
      sourceSystem: 'beads',
      externalId: id,
      supportsSpecItems: false,
      supportsAcceptanceCriteria: acceptanceCriteria.length > 0,
      supportsTraits: false, // Beads doesn't map traits directly yet
      supportsValidation: false,
      supportsDerivedTasks: false
    },
    _backend: 'beads'
  }
}

export class BeadsAdapter implements TaskAdapter {
  readonly kind = 'beads' as const

  constructor(private api: Api) {}

  async check(cwd: string): Promise<BackendStatus> {
    const status = await this.api.beadsCheck(cwd)
    if (!status) {
      return { kind: 'beads', installed: false, initialized: false }
    }
    return {
      kind: 'beads',
      installed: status.installed,
      initialized: status.initialized
    }
  }

  async init(cwd: string): Promise<{ success: boolean; error?: string }> {
    const result = await this.api.beadsInit(cwd)
    return { success: !!result?.success, error: result?.error }
  }

  async list(cwd: string): Promise<UnifiedTask[]> {
    const result = await this.api.beadsList(cwd)
    if (!result?.success || !result.tasks) return []
    return (result.tasks as Record<string, unknown>[]).map(toUnified)
  }

  async show(cwd: string, taskId: string): Promise<UnifiedTask | null> {
    const result = await this.api.beadsShow(cwd, taskId)
    if (!result?.success || !result.task) return null
    return toUnified(result.task as Record<string, unknown>)
  }

  async create(cwd: string, params: CreateTaskParams): Promise<{ success: boolean; error?: string }> {
    const result = await this.api.beadsCreate(
      cwd,
      params.title,
      params.description,
      params.priority,
      params.type,
      params.tags
    )
    return { success: !!result?.success, error: result?.error }
  }

  async start(cwd: string, taskId: string): Promise<{ success: boolean; error?: string }> {
    const result = await this.api.beadsStart(cwd, taskId)
    return { success: !!result?.success, error: result?.error }
  }

  async complete(cwd: string, taskId: string): Promise<{ success: boolean; error?: string }> {
    const result = await this.api.beadsComplete(cwd, taskId)
    return { success: !!result?.success, error: result?.error }
  }

  async delete(cwd: string, taskId: string): Promise<{ success: boolean; error?: string }> {
    const result = await this.api.beadsDelete(cwd, taskId)
    return { success: !!result?.success, error: result?.error }
  }

  async update(cwd: string, taskId: string, params: UpdateTaskParams): Promise<{ success: boolean; error?: string }> {
    const result = await this.api.beadsUpdate(
      cwd, 
      taskId, 
      params.status, 
      params.title, 
      params.description, 
      params.priority,
      params.acceptanceCriteria,
      params.traits
    )
    return { success: !!result?.success, error: result?.error }
  }

  async cycleStatus(cwd: string, taskId: string, currentStatus: TaskStatus): Promise<{ success: boolean; error?: string }> {
    let nextStatus: string
    switch (currentStatus) {
      case 'open': nextStatus = 'in_progress'; break
      case 'in_progress': nextStatus = 'closed'; break
      default: nextStatus = 'open'
    }
    return this.update(cwd, taskId, { status: nextStatus as TaskStatus })
  }

  watch(cwd: string): void {
    this.api.beadsWatch(cwd)
  }

  unwatch(cwd: string): void {
    this.api.beadsUnwatch(cwd)
  }

  onTasksChanged(callback: (data: { cwd: string }) => void): () => void {
    return this.api.onBeadsTasksChanged(callback) ?? (() => {})
  }
}
