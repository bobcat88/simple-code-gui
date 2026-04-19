/**
 * Kspec Adapter
 *
 * Talks to the native Tauri orchestration backend.
 * Normalizes kspec tasks into the unified TaskAdapter interface.
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
    case 'completed':
    case 'cancelled':
      return 'closed'
    case 'pending':
    case 'blocked':
    case 'pending_review':
    case 'needs_work':
    default:
      return 'open'
  }
}

function toUnified(raw: Record<string, unknown>): UnifiedTask {
  const tags = Array.isArray(raw.tags) ? raw.tags.map(String) : undefined
  const slugs = Array.isArray(raw.slugs) ? raw.slugs : []
  const id = slugs.length > 0 ? String(slugs[0]) : String(raw._ulid ?? raw.slug ?? raw.id ?? '')
  
  const hasSpec = typeof raw.spec_ref === 'string' && raw.spec_ref.length > 0
  const specItems = hasSpec ? [{
    id: String(raw.spec_ref),
    title: String(raw.spec_ref),
    sourceSystem: 'kspec' as const
  }] : undefined

  const rawAC = Array.isArray(raw.acceptance_criteria) ? raw.acceptance_criteria : []
  const acceptanceCriteria = rawAC.map((ac: any, index: number) => ({
    id: ac.id ?? `ac-${index}`,
    text: typeof ac === 'string' ? ac : String(ac.text ?? ''),
    status: (ac.status ?? 'not_started') as any,
    sourceSystem: 'kspec' as const
  }))

  const traits = tags?.map(tag => ({
    id: tag,
    label: tag,
    sourceSystem: 'kspec' as const
  }))

  return {
    id,
    displayId: slugs.length > 0 ? String(slugs[0]) : (id.length > 12 ? id.slice(0, 8) : id),
    title: String(raw.title ?? ''),
    status: normalizeStatus(String(raw.status ?? 'pending')),
    priority: typeof raw.priority === 'number' ? raw.priority : undefined,
    type: typeof raw.type === 'string' ? raw.type : undefined,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    created_at: typeof raw.created_at === 'string' ? raw.created_at : undefined,
    updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : undefined,
    tags,
    automation: typeof raw.automation === 'string' ? raw.automation as UnifiedTask['automation'] : undefined,
    hasSpec,
    specItems,
    acceptanceCriteria: acceptanceCriteria.length > 0 ? acceptanceCriteria : undefined,
    traits,
    source: {
      backend: 'kspec',
      sourceSystem: 'kspec',
      externalId: id,
      supportsSpecItems: true,
      supportsAcceptanceCriteria: true,
      supportsTraits: true,
      supportsValidation: true,
      supportsDerivedTasks: true
    },
    _backend: 'kspec'
  }
}

export class KspecAdapter implements TaskAdapter {
  readonly kind = 'kspec' as const

  async check(cwd: string): Promise<BackendStatus> {
    if (window.electronAPI?.kspecCheck) {
      const res = await window.electronAPI.kspecCheck(cwd)
      return { 
        kind: 'kspec', 
        installed: !!res?.installed, 
        initialized: !!res?.initialized 
      }
    }
    return { kind: 'kspec', installed: false, initialized: false }
  }

  async init(cwd: string): Promise<{ success: boolean; error?: string }> {
    const result = await window.electronAPI?.kspecInit?.(cwd)
    return { success: !!result?.success, error: result?.error }
  }

  async list(cwd: string): Promise<UnifiedTask[]> {
    try {
      const res = await window.electronAPI?.kspecList?.(cwd)
      if (res?.success && Array.isArray(res.items)) {
        return res.items.map(toUnified)
      }
      return []
    } catch {
      return []
    }
  }

  async show(cwd: string, taskId: string): Promise<UnifiedTask | null> {
    try {
      const res = await window.electronAPI?.kspecShow?.(cwd, taskId)
      if (res?.success && res.task) {
        return toUnified(res.task)
      }
      return null
    } catch {
      return null
    }
  }

  async create(cwd: string, params: CreateTaskParams): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await window.electronAPI?.kspecCreate?.(
        cwd, 
        params.title, 
        params.description, 
        params.priority, 
        params.type, 
        params.tags
      )
      return { success: !!res?.success, error: res?.error }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  }

  async start(cwd: string, taskId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await window.electronAPI?.kspecStart?.(cwd, taskId)
      return { success: !!res?.success, error: res?.error }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  }

  async complete(cwd: string, taskId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await window.electronAPI?.kspecComplete?.(cwd, taskId)
      return { success: !!res?.success, error: res?.error }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  }

  async delete(cwd: string, taskId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await window.electronAPI?.kspecDelete?.(cwd, taskId)
      return { success: !!res?.success, error: res?.error }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  }

  async update(cwd: string, taskId: string, params: UpdateTaskParams): Promise<{ success: boolean; error?: string }> {
    try {
      // Map unified status names back to kspec native status names
      const status = params.status === 'open' ? 'pending' : (params.status === 'closed' ? 'completed' : params.status)
      const res = await window.electronAPI?.kspecUpdate?.(
        cwd, 
        taskId, 
        status, 
        params.title, 
        params.description, 
        params.priority
      )
      return { success: !!res?.success, error: res?.error }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  }

  async cycleStatus(cwd: string, taskId: string, currentStatus: TaskStatus): Promise<{ success: boolean; error?: string }> {
    switch (currentStatus) {
      case 'open': return this.start(cwd, taskId)
      case 'in_progress': return this.complete(cwd, taskId)
      default:
        return this.update(cwd, taskId, { status: 'open' })
    }
  }

  watch(cwd: string): void {
    window.electronAPI?.kspecWatch?.(cwd)
  }

  unwatch(cwd: string): void {
    window.electronAPI?.kspecUnwatch?.(cwd)
  }

  onTasksChanged(callback: (data: { cwd: string }) => void): () => void {
    if (window.electronAPI?.onKspecTasksChanged) {
      return window.electronAPI.onKspecTasksChanged(callback)
    }
    return () => {}
  }
}
