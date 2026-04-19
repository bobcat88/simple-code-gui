/**
 * Unified Task Interface
 *
 * Backend-agnostic task type used by the TaskPanel.
 * Both beads and kspec tasks normalize to this shape.
 */

export interface UnifiedTask extends UnifiedTaskSpecProjection {
  id: string
  displayId?: string
  title: string
  status: TaskStatus
  priority?: number
  type?: string
  description?: string
  created_at?: string
  updated_at?: string
  tags?: string[]
  automation?: AutomationEligibility
  hasSpec?: boolean
  // Source tracking (invisible to user, used internally for routing)
  _backend: 'beads' | 'kspec'
}

export interface UnifiedTaskSpecProjection {
  specItems?: TaskSpecLink[]
  acceptanceCriteria?: TaskAcceptanceCriterion[]
  traits?: TaskTrait[]
  derivedTasks?: TaskDerivedTask[]
  validation?: TaskValidationSummary
  implementation?: TaskImplementationSummary
  source?: TaskSourceMetadata
}

export interface TaskSpecLink {
  id: string
  externalId?: string
  title: string
  kind?: string
  status?: string
  sourceSystem: 'kspec' | 'beads' | 'simple_code_gui'
}

export interface TaskAcceptanceCriterion {
  id: string
  text: string
  status: 'not_started' | 'in_progress' | 'satisfied' | 'failed' | 'waived'
  validationMethod?: string
  evidenceArtifactIds?: string[]
  sourceSystem: 'kspec' | 'beads' | 'simple_code_gui'
}

export interface TaskTrait {
  id: string
  label: string
  kind?: 'domain' | 'quality' | 'routing' | 'workflow'
  sourceSystem: 'kspec' | 'beads' | 'simple_code_gui'
}

export interface TaskDerivedTask {
  id: string
  title: string
  status: string
  sourceSystem: 'kspec' | 'beads' | 'simple_code_gui'
}

export interface TaskValidationSummary {
  status: 'unknown' | 'not_started' | 'in_progress' | 'passed' | 'failed' | 'waived'
  totalCriteria: number
  satisfiedCriteria: number
  failedCriteria: number
  evidenceArtifactIds?: string[]
}

export interface TaskImplementationSummary {
  status: 'unknown' | 'not_started' | 'in_progress' | 'implemented' | 'reviewing' | 'blocked'
  executionRunIds?: string[]
  artifactIds?: string[]
}

export interface TaskSourceMetadata {
  backend: 'beads' | 'kspec'
  sourceSystem: 'beads' | 'kspec'
  externalId: string
  canonicalRef?: string
  supportsSpecItems: boolean
  supportsAcceptanceCriteria: boolean
  supportsTraits: boolean
  supportsValidation: boolean
  supportsDerivedTasks: boolean
}


export type TaskStatus = 'open' | 'in_progress' | 'closed'

// Beads types: task, bug, feature, epic, chore
// Kspec types: task, bug, epic, spike, infra
export type TaskType = 'task' | 'bug' | 'feature' | 'epic' | 'chore' | 'spike' | 'infra'

export type AutomationEligibility = 'eligible' | 'needs_review' | 'manual_only'

export interface CreateTaskParams {
  title: string
  description?: string
  priority?: number
  type?: TaskType
  tags?: string
  automation?: AutomationEligibility
}

export interface UpdateTaskParams {
  status?: TaskStatus
  title?: string
  description?: string
  priority?: number
  automation?: AutomationEligibility
}

export type BackendKind = 'beads' | 'kspec' | 'none'

export interface BackendStatus {
  kind: BackendKind
  installed: boolean
  initialized: boolean
}

/**
 * TaskAdapter — the contract both backends implement.
 * The panel calls these methods without knowing which backend is active.
 */
export interface TaskAdapter {
  readonly kind: BackendKind

  check(cwd: string): Promise<BackendStatus>
  init(cwd: string): Promise<{ success: boolean; error?: string }>
  list(cwd: string): Promise<UnifiedTask[]>
  show(cwd: string, taskId: string): Promise<UnifiedTask | null>
  create(cwd: string, params: CreateTaskParams): Promise<{ success: boolean; error?: string }>
  start(cwd: string, taskId: string): Promise<{ success: boolean; error?: string }>
  complete(cwd: string, taskId: string): Promise<{ success: boolean; error?: string }>
  delete(cwd: string, taskId: string): Promise<{ success: boolean; error?: string }>
  update(cwd: string, taskId: string, params: UpdateTaskParams): Promise<{ success: boolean; error?: string }>
  cycleStatus(cwd: string, taskId: string, currentStatus: TaskStatus): Promise<{ success: boolean; error?: string }>

  watch(cwd: string): void
  unwatch(cwd: string): void
  onTasksChanged(callback: (data: { cwd: string }) => void): () => void
}
