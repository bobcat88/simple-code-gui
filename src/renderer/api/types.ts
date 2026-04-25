/**
 * API Abstraction Layer Types
 *
 * This module defines the contract for the API interface that can be implemented
 * by both Electron IPC (desktop) and HTTP/WebSocket (web/mobile) backends.
 */

// ============================================================================
// Connection State Types
// ============================================================================

/**
 * Connection state for HTTP backend
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

/**
 * Type of API backend being used
 */
export type ApiBackendType = 'electron' | 'http'

// ============================================================================
// Data Types
// ============================================================================

/**
 * Terminal ANSI colors customization
 */
export interface TerminalColorsCustomization {
  black?: string
  red?: string
  green?: string
  yellow?: string
  blue?: string
  magenta?: string
  cyan?: string
  white?: string
}

/**
 * Theme customization settings
 */
export interface ThemeCustomization {
  accentColor: string | null
  backgroundColor: string | null
  textColor: string | null
  terminalColors: TerminalColorsCustomization | null
}

/**
 * Application settings
 */
export interface Settings {
  defaultProjectDir: string
  theme: string
  themeCustomization?: ThemeCustomization | null
  voiceOutputEnabled?: boolean
  voiceVolume?: number
  voiceSpeed?: number
  voiceSkipOnNew?: boolean
  voiceSilenceThreshold?: number
  voicePushToTalk?: boolean
  voiceAutoListen?: boolean
  autoAcceptTools?: string[]
  permissionMode?: string
  backend?: BackendSelection
  terminal?: {
    fontSize: number
    fontFamily: string
    cursorStyle: 'block' | 'underline' | 'bar'
    cursorBlink: boolean
    theme: string
    opacity: number
    lineHeight: number
    letterSpacing: number
    padding: number
  }
}

/**
 * Project category for organizing projects in the sidebar
 */
export interface ProjectCategory {
  id: string
  name: string
  collapsed: boolean
  order: number
}

/**
 * Project configuration
 */
export interface Project {
  path: string
  name: string
  executable?: string
  apiPort?: number
  apiAutoStart?: boolean
  apiSessionMode?: 'existing' | 'new-keep' | 'new-close'
  apiModel?: 'default' | 'opus' | 'sonnet' | 'haiku'
  autoAcceptTools?: string[]
  permissionMode?: string
  color?: string
  ttsVoice?: string
  ttsEngine?: 'piper' | 'xtts'
  backend?: 'default' | BackendId
  categoryId?: string
  order?: number
}

/**
 * Open tab representing an active terminal session
 */
export interface OpenTab {
  id: string
  projectPath: string
  sessionId?: string
  title: string
  customTitle?: boolean
  ptyId: string
  backend?: BackendSelection
}

/**
 * Tile layout configuration for tiled view mode
 */
export interface TileLayout {
  id: string
  tabIds: string[]
  activeTabId: string
  x: number
  y: number
  width: number
  height: number
}

/**
 * Workspace state containing all projects, tabs, and layout
 */
export interface Workspace {
  projects: Project[]
  openTabs: OpenTab[]
  activeTabId: string | null
  viewMode?: 'tabs' | 'tiled'
  tileLayout?: TileLayout[]
  tileTree?: any
  categories: ProjectCategory[]
}

/**
 * Session discovery result
 */
export interface Session {
  sessionId: string
  slug: string
}

/**
 * Voice settings configuration
 */
export interface VoiceSettings {
  whisperModel?: string
  ttsEngine?: 'piper' | 'xtts' | 'openvoice'
  ttsVoice?: string
}

// ============================================================================
// Orchestration & Approval Types
// ============================================================================

export type ApprovalCategory = 'file_change' | 'command' | 'config_change' | 'destructive' | 'external'
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface FileDiff {
  path: string
  hunks: Array<{
    oldStart: number
    newStart: number
    lines: string[]
  }>
  isNew?: boolean
  isDeleted?: boolean
}

export interface ApprovalRequest {
  id: string
  agentId: string
  agentName: string
  category: ApprovalCategory
  risk: RiskLevel
  title: string
  description: string
  fileDiffs?: FileDiff[]
  command?: string
  affectedPaths?: string[]
  reversible: boolean
  timestamp: number
  expiresAt?: number
}

export interface ApprovalResponse {
  actionId: string
  decision: 'approved' | 'rejected' | 'modified'
  comment?: string
  conditions?: string[]
}

export interface AgentAction {
  id: string
  agentId: string
  agentName: string
  type: 'thought' | 'command' | 'file_change' | 'approval_request' | 'error' | 'success'
  message: string
  timestamp: number
  metadata?: Record<string, unknown>
}

export interface AgentStatus {
  id: string
  name: string
  role?: string
  status: 'idle' | 'busy' | 'blocked' | 'error'
  currentTask?: string
  progress?: number
}

// ============================================================================
// API Interface
// ============================================================================

export type Unsubscribe = () => void

export type PtyDataCallback = (data: string) => void
export type PtyExitCallback = (code: number) => void
export type PtyRecreatedCallback = (data: { oldId: string; newId: string; backend: BackendId }) => void

export type BackendId = 'claude' | 'gemini' | 'codex' | 'opencode' | 'aider'
export type BackendSelection = 'default' | BackendId

export interface ApiOpenSessionEvent {
  projectPath: string
  autoClose?: boolean
  model?: string
}

export type ApiOpenSessionCallback = (event: ApiOpenSessionEvent) => void

export interface UpdateNotice {
  id: string
  currentVersion: string
  latestVersion: string
  name: string
  type: string
}

export interface TokenTransactionInput {
  sessionId: string
  projectPath: string
  backend: BackendId
  inputTokens: number
  outputTokens: number
  costEstimate: number
  nexusSessionId?: string
  timestamp?: string
}

export interface TokenHistoryFilters {
  startDate?: string
  endDate?: string
  projectPath?: string
  backend?: BackendId
  nexusSessionId?: string
}

export interface TokenHistoryTotals {
  inputTokens: number
  outputTokens: number
  costEstimate: number
  transactionCount: number
}

export interface TokenHistorySession {
  sessionId: string
  projectPath: string
  backend: BackendId
  inputTokens: number
  outputTokens: number
  costEstimate: number
  firstTimestamp: string
  lastTimestamp: string
  transactionCount: number
}

export interface TokenHistoryBreakdown {
  key: string
  inputTokens: number
  outputTokens: number
  costEstimate: number
}

export interface TokenHistoryPoint {
  date: string
  inputTokens: number
  outputTokens: number
  costEstimate: number
}

export interface TokenHistoryResponse {
  totals: TokenHistoryTotals
  sessions: TokenHistorySession[]
  projectBreakdown: TokenHistoryBreakdown[]
  backendBreakdown: TokenHistoryBreakdown[]
  daily: TokenHistoryPoint[]
}

// ============================================================================
// Vector Engine Types
// ============================================================================

export interface VectorChunk {
  id: string
  symbolName: string
  projectPath: string
  filePath: string
  content: string
  metadata: Record<string, string>
  embedding?: number[]
}

export interface VectorIndexStatus {
  totalChunks: number
  indexedChunks: number
  isIndexing: boolean
  lastUpdated: number
}

export interface VectorSearchResult {
  chunk: VectorChunk
  score: number
}

/**
 * Core API interface for the renderer
 */
export interface Api {
  [key: string]: any;
  // Optional: Desktop-only voice catalog and XTTS management
  voiceCheckTTS?: () => Promise<{ installed: boolean; engine: string | null; voices: string[]; currentVoice: string | null }>
  voiceFetchCatalog?: (forceRefresh?: boolean) => Promise<any[]>
  voiceGetInstalled?: () => Promise<any[]>
  voiceDownloadFromCatalog?: (voiceKey: string) => Promise<{ success: boolean; error?: string }>
  voiceImportCustom?: () => Promise<{ success: boolean; error?: string }>
  voiceOpenCustomFolder?: () => Promise<void>
  
  xttsGetVoices?: () => Promise<any[]>
  xttsGetSampleVoices?: () => Promise<any[]>
  xttsGetLanguages?: () => Promise<any[]>
  xttsCheck?: () => Promise<{ installed: boolean; error?: string }>
  xttsDownloadSampleVoice?: (voiceId: string) => Promise<{ success: boolean; error?: string }>
  xttsDeleteVoice?: (voiceId: string) => Promise<{ success: boolean; error?: string }>
  xttsInstall?: () => Promise<{ success: boolean; error?: string }>
  xttsCreateVoice?: (audioPath: string, name: string, language: string) => Promise<{ success: boolean; error?: string }>

  voiceCheckWhisper?: () => Promise<{ installed: boolean; models: string[]; currentModel: string | null }>
  voiceInstallWhisper?: (model: string) => Promise<{ success: boolean; error?: string }>
  voiceGetSettings?: () => Promise<{ ttsVoice?: string; ttsEngine?: string; ttsSpeed?: number; xttsTemperature?: number; xttsTopK?: number; xttsTopP?: number; xttsRepetitionPenalty?: number }>
  voiceApplySettings?: (settings: { ttsVoice?: string; ttsEngine?: string; ttsSpeed?: number; xttsTemperature?: number; xttsTopK?: number; xttsTopP?: number; xttsRepetitionPenalty?: number }) => Promise<{ success: boolean }>
  voiceSetVoice?: (voice: string | { voice: string; engine: 'piper' | 'xtts' }) => Promise<{ success: boolean }>
  
  ttsRemoveInstructions?: (projectPath: string) => Promise<{ success: boolean }>
  extensionsGetInstalled?: () => Promise<Array<{ id: string; name: string; type: string }>>
  extensionsFetchRegistry?: (forceRefresh: boolean) => Promise<any>
  extensionsGetCustomUrls?: () => Promise<string[]>
  extensionsInstallSkill?: (extension: any, scope: string) => Promise<{ success: boolean; error?: string }>
  extensionsInstallMcp?: (extension: any) => Promise<{ success: boolean; error?: string }>
  extensionsRemove?: (id: string) => Promise<{ success: boolean; error?: string }>
  extensionsEnableForProject?: (id: string, projectPath: string) => Promise<void>
  extensionsDisableForProject?: (id: string, projectPath: string) => Promise<void>
  extensionsFetchFromUrl?: (url: string) => Promise<any | null>
  extensionsAddCustomUrl?: (url: string) => Promise<void>
  extensionsSetConfig?: (id: string, config: any) => Promise<void>
  extensionsCheckUpdates?: () => Promise<UpdateNotice[]>
  mcpListTools?: (serverName: string) => Promise<any>
  mcpCallTool?: (serverName: string, toolName: string, args: any) => Promise<any>
  mcpListResources?: (serverName: string) => Promise<any>
  mcpReadResource?: (serverName: string, uri: string) => Promise<any>
  mcpLoadConfig?: () => Promise<void>
  mcpGetServers?: () => Promise<any[]>

  // Optional: API server control (desktop only)
  apiStart?: (projectPath: string, port: number) => Promise<{ success: boolean; error?: string }>
  apiStop?: (projectPath: string) => Promise<{ success: boolean }>

  // ==========================================================================
  // Workspace Management
  // ==========================================================================

  /**
   * Get the current workspace state
   * @returns Promise resolving to workspace data
   */
  getWorkspace: () => Promise<Workspace>

  /**
   * Save the workspace state
   * @param workspace Workspace data to save
   */
  saveWorkspace: (workspace: Workspace) => Promise<void>

  // ==========================================================================
  // Settings Management
  // ==========================================================================

  /**
   * Get application settings
   * @returns Promise resolving to settings
   */
  getSettings: () => Promise<Settings>

  /**
   * Save application settings
   * @param settings Settings to save
   */
  saveSettings: (settings: Settings) => Promise<void>

  // ==========================================================================
  // Project Management
  // ==========================================================================

  /**
   * Open a directory picker to add a project
   * @returns Promise resolving to selected path or null
   */
  addProject: () => Promise<string | null>

  /**
   * Open a directory picker to select a parent folder and add all subdirectories as projects
   * @returns Promise resolving to array of projects or null
   */
  addProjectsFromParent: () => Promise<Array<{ path: string; name: string }> | null>

  // ==========================================================================
  // Session Discovery
  // ==========================================================================

  /**
   * Discover recent sessions for a project
   * @param projectPath Path to the project
   * @param backend Optional backend type ('claude', 'gemini', 'codex', 'opencode', or 'aider')
   */
  discoverSessions: (projectPath: string, backend?: BackendId) => Promise<Session[]>

  // ==========================================================================
  // PTY Management
  // ==========================================================================

  /**
   * Spawn a new PTY session
   * @param cwd Working directory
   * @param sessionId Optional session ID to resume
   * @param model Optional model override
   * @param backend Optional backend override ('claude', 'gemini', etc.)
   */
  spawnPty: (cwd: string, sessionId?: string, model?: string, backend?: BackendId, rows?: number, cols?: number, nexusSessionId?: string) => Promise<string>

  /**
   * Write data to a PTY
   */
  writePty: (id: string, data: string) => void

  /**
   * Resize a PTY
   */
  resizePty: (id: string, cols: number, rows: number) => void

  /**
   * Kill a PTY
   */
  killPty: (id: string) => void

  /**
   * Subscribe to PTY output
   */
  onPtyData: (id: string, callback: (data: string) => void) => Unsubscribe

  /**
   * Subscribe to PTY exit
   */
  onPtyExit: (id: string, callback: (code: number) => void) => Unsubscribe

  /**
   * Switch a PTY backend (desktop only)
   */
  setPtyBackend?: (id: string, backend: BackendId) => Promise<void>

  /**
   * Subscribe to PTY recreated events (backend switching)
   */
  onPtyRecreated: (callback: (data: { oldId: string; newId: string; backend: BackendId }) => void) => Unsubscribe

  /**
   * Subscribe to PTY title changes
   */
  onPtyTitle: (id: string, callback: (title: string) => void) => Unsubscribe

  /**
   * Subscribe to PTY path changes
   */
  onPtyPath: (id: string, callback: (path: string) => void) => Unsubscribe

  /**
   * Subscribe to PTY process ID changes
   */
  onPtyPid: (id: string, callback: (pid: string) => void) => Unsubscribe

  /**
   * Get auto-accept status for a PTY
   */
  getAutoAcceptStatus?: (ptyId: string) => Promise<boolean>

  /**
   * Set auto-accept status for a PTY
   */
  setAutoAccept?: (ptyId: string, enabled: boolean) => Promise<void>

  // ==========================================================================
  // TTS (Text-to-Speech)
  // ==========================================================================

  /**
   * Install TTS instructions (CLAUDE.md markers) for a project
   * @param projectPath Path to the project
   * @returns Promise resolving to success status
   */
  ttsInstallInstructions: (projectPath: string) => Promise<{ success: boolean }>

  /**
   * Speak text using TTS
   * @param text Text to speak
   * @returns Promise resolving to audio data or error
   */
  ttsSpeak: (text: string) => Promise<{ success: boolean; audioData?: string; error?: string }>

  /**
   * Stop current TTS playback
   * @returns Promise resolving to success status
   */
  ttsStop: () => Promise<{ success: boolean }>

  // ==========================================================================
  // Events
  // ==========================================================================

  /**
   * Subscribe to API open session events (triggered by external API calls)
   * @param callback Function called when session should be opened
   * @returns Unsubscribe function
   */
  onApiOpenSession: (callback: ApiOpenSessionCallback) => Unsubscribe
  
  /**
   * Subscribe to settings change events
   */
  onSettingsChanged?: (callback: (settings: Settings) => void) => Unsubscribe
  
  /**
   * Subscribe to workspace change events
   */
  onWorkspaceChanged?: (callback: (workspace: Workspace) => void) => Unsubscribe

  /**
   * Get connection info for external components (HTTP backend only)
   * @returns Connection info or undefined if not applicable
   */
  getConnectionInfo?: () => { host: string; port: number; token: string }

  // ==========================================================================
  // Approval Workflow
  // ==========================================================================

  onApprovalRequest?: (callback: (request: ApprovalRequest) => void) => Unsubscribe
  onApprovalResolved?: (callback: (actionId: string) => void) => Unsubscribe
  respondToApproval?: (response: ApprovalResponse) => Promise<{ success: boolean }>
  getPendingApprovals?: (cwd: string) => Promise<ApprovalRequest[]>

  // ==========================================================================
  // Project Initialization
  // ==========================================================================
  onProjectInitializationProgress?: (callback: (progress: ProposalProgress) => void) => Unsubscribe

  /**
   * Subscribe to model plan switched events (Dynamic Plan Switching)
   */
  onModelPlanSwitched?: (callback: (event: { old_plan: string; new_plan: string; health_score: number }) => void) => Unsubscribe

  // ==========================================================================
  // GSD Engine
  // ==========================================================================
  gsdCreatePlan?: (taskId: string, title: string) => Promise<GsdPlan>
  gsdListPlans?: (projectPath: string) => Promise<GsdPlan[]>
  gsdAddPhase?: (planId: string, title: string) => Promise<GsdPhase>
  gsdAddStep?: (planId: string, phaseId: string, title: string, description: string) => Promise<GsdStep>
  gsdExecutePlan?: (planId: string) => Promise<void>
  gsdRespondToCheckpoint?: (stepId: string, response: 'Approve' | 'Retry' | 'Abort') => Promise<void>
  onGsdExecutionEvent?: (callback: (event: GsdExecutionEvent) => void) => Unsubscribe
  onGsdPhaseUpdated?: (callback: (phase: GsdPhase) => void) => Unsubscribe
  onGsdStepUpdated?: (callback: (step: GsdStep) => void) => Unsubscribe

  // ==========================================================================
  // Vector Engine
  // ==========================================================================
  vectorSearch?: (query: string, limit?: number, projectPath?: string) => Promise<VectorSearchResult[]>
  vectorGetStatus?: () => Promise<VectorIndexStatus>
  vectorAddChunks?: (chunks: VectorChunk[]) => Promise<{ success: boolean }>
  vectorIndexProject?: (projectPath: string) => Promise<{ success: boolean; error?: string }>
}

// ============================================================================
// Extended API Interface (Desktop-only features)
// ============================================================================

/**
 * Extended API interface with desktop-specific features.
 * These methods are only available in the Electron implementation
 * and may throw or return null/undefined in the HTTP implementation.
 */
export interface ExtendedApi extends Api {
  // Directory and file selection dialogs
  selectDirectory: () => Promise<string | null>
  selectExecutable: () => Promise<string | null>
  runExecutable?: (executable: string, cwd: string) => Promise<{ success: boolean; error?: string }>
  getCategoryMetaPath?: (categoryName: string) => Promise<string>
  getMetaProjectsPath?: () => Promise<string>

  // Window controls (Desktop-only)
  windowMinimize: () => void
  windowMaximize: () => void
  windowClose: () => void
  windowIsMaximized: () => Promise<boolean>

  // File utilities
  getPathForFile: (file: File) => string

  // Clipboard operations
  readClipboardImage: () => Promise<{ success: boolean; hasImage?: boolean; path?: string; error?: string }>

  // App utilities
  getVersion: () => Promise<string>
  isDebugMode: () => Promise<boolean>
  refresh: () => Promise<void>
  openExternal: (url: string) => Promise<void>

  // Updater (Tauri/Electron)
  checkForUpdate: () => Promise<{ available: boolean; version?: string; body?: string }>
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>
  installUpdate: () => Promise<void>

  // Debug
  debugLog: (message: string) => void

  // Token Metering
  logTokenEvent: (transaction: TokenTransactionInput, savedTokens?: number) => Promise<void>
  getTokenStats: (projectId?: string) => Promise<{ totalInput: number; totalOutput: number; totalSaved: number; totalCost: number }>
  getTokenHistory: (filters?: TokenHistoryFilters) => Promise<TokenHistoryResponse>

  // Project Initialization Wizard
  projectScan: (path: string, options?: ScanOptions) => Promise<ProjectCapabilityScan>
  projectScanAsync: (path: string) => Promise<{ success: boolean; job_id: string }>,
  setCurrentProject: (path: string | null) => Promise<void>,
  projectGenerateProposal: (scan: ProjectCapabilityScan, preset: string, projectName: string, taskBackend: string) => Promise<InitializationProposal>
  projectApplyProposal: (proposal: InitializationProposal) => Promise<string[]>,
  scanProjectIntelligence: (path: string) => Promise<ProjectIntelligence>,

  // Orchestration (Beads/Kspec)
  kspecDispatchStatus: (cwd: string) => Promise<any>,
  kspecDispatchStart: (cwd: string) => Promise<{ success: boolean; error?: string }>,
  kspecDispatchStop: (cwd: string) => Promise<{ success: boolean; error?: string }>,
  apiStatus?: (projectPath: string) => Promise<{ running: boolean; port?: number }>,
  beadsCheck?: (cwd: string) => Promise<{ installed: boolean; initialized: boolean }>,
  beadsList: (cwd: string) => Promise<any>,
  beadsStart: (cwd: string, task_id: string) => Promise<any>,
  beadsComplete: (cwd: string, task_id: string) => Promise<any>,

  // Approval Workflow
  onApprovalRequest: (callback: (request: ApprovalRequest) => void) => Unsubscribe,
  onApprovalResolved: (callback: (actionId: string) => void) => Unsubscribe,
  respondToApproval: (response: ApprovalResponse) => Promise<{ success: boolean }>,
  getPendingApprovals: (cwd: string) => Promise<ApprovalRequest[]>,

  // Project Initialization
  onProjectInitializationProgress: (callback: (progress: ProposalProgress) => void) => Unsubscribe,

  // Diagnostics
  diagnosticsGenerateBundle: () => Promise<DiagnosticResult>

  // Custom Commands
  commandsSave?: (path: string, commands: any[]) => Promise<{ success: boolean; error?: string }>
  aiSaveKey?: (provider: string, key: string, baseUrl?: string) => Promise<void>

  // Voice (Extended/Desktop)
  voiceGetInstalled?: () => Promise<any[]>
  voiceGetSettings?: () => Promise<any>
  voiceApplySettings?: (settings: any) => Promise<{ success: boolean }>
  voiceSpeak?: (text: string, voice?: string, speed?: number) => Promise<any>
  voiceStopSpeaking?: () => Promise<void>
  voiceStartListening?: () => Promise<void>
  voiceStopListening?: () => Promise<void>
  onVoiceTranscription?: (callback: (text: string) => void) => Unsubscribe
  xttsGetVoices?: () => Promise<any[]>

  // Updater
  onUpdateProgress?: (callback: (progress: number) => void) => Unsubscribe

  // Mobile/Connection
  mobileGetConnectionInfo?: () => Promise<{ host: string; port: number; token: string }>
  mobileRegenerateToken?: () => Promise<{ host: string; port: number; token: string }>

  // Vector Engine (Desktop-specific overrides/extensions if needed)
  vectorSearch: (query: string, limit?: number, projectPath?: string) => Promise<VectorSearchResult[]>
  vectorGetStatus: () => Promise<VectorIndexStatus>
  vectorAddChunks: (chunks: VectorChunk[]) => Promise<{ success: boolean }>
  vectorIndexProject: (projectPath: string) => Promise<{ success: boolean; error?: string }>
}

// ============================================================================
// Project Wizard Types
// ============================================================================

export interface ScanOptions {
  includeCliHealth?: boolean
  includeGitHealth?: boolean
  maxDepth?: number
}

export type SourceSystem = 'simple_code_gui' | 'beads' | 'kspec' | 'gsd' | 'rtk' | 'gitnexus' | 'mcp' | 'provider' | 'git' | 'terminal' | 'user'
export type CapabilityKind = 'task_backend' | 'spec_backend' | 'execution_workflow' | 'repo_intelligence' | 'token_optimizer' | 'mcp_server' | 'provider' | 'voice' | 'updater' | 'project_contract'
export type CapabilityMode = 'full' | 'partial' | 'instruction_only' | 'degraded' | 'disabled' | 'unknown'
export type HealthStatus = 'healthy' | 'warning' | 'error' | 'unknown'
export type MarkerKind = 'file' | 'directory' | 'env_var' | 'process' | 'mcp_tool' | 'mcp_resource' | 'generated' | 'logic'
export type MarkerStatus = 'present' | 'missing' | 'partially_present' | 'broken' | 'mismatched'
export type Confidence = 'certain' | 'high' | 'medium' | 'low' | 'guessed'
export type OperationKind = 'create_file' | 'modify_file' | 'create_directory' | 'run_command' | 'preserve' | 'skip'
export type OperationRisk = 'low' | 'medium' | 'high'

export interface DetectedMarker {
  id: string
  kind: MarkerKind
  path?: string
  sourceSystem: SourceSystem
  confidence: Confidence
  status: MarkerStatus
}

export interface CapabilityScanResult {
  id: string
  kind: CapabilityKind
  sourceSystem: SourceSystem
  installed: boolean
  initialized: boolean
  enabled: boolean
  mode: CapabilityMode
  health: HealthStatus
  version?: string
  markerIds: string[]
}

export interface ScanWarning {
  id: string
  severity: 'info' | 'warning'
  title: string
  detail: string
  markerIds: string[]
  capabilityIds: string[]
}

export interface ScanBlocker {
  id: string
  title: string
  detail: string
  markerIds: string[]
  recommendedAction: string
}

export interface UpgradeProposalInput {
  canProposeMinimal: boolean
  canProposeStandard: boolean
  canProposeFull: boolean
  recommendedPreset: string
  createCandidates: string[]
  modifyCandidates: string[]
  preserveCandidates: string[]
  migrationSources: SourceSystem[]
  rollbackNotes: string[]
}

export interface ProjectCapabilityScan {
  rootPath: string
  scannedAt: string
  initializationState: string
  markers: DetectedMarker[]
  capabilities: CapabilityScanResult[]
  warnings: ScanWarning[]
  blockers: ScanBlocker[]
  upgradeInputs: UpgradeProposalInput
  totalFileCount: number
  scanDurationMs: number
  projectHealthScore: number
}

export interface ProposalOperation {
  id: string
  kind: OperationKind
  path?: string
  command?: string
  sourceSystem: SourceSystem
  reason: string
  preview?: string
  risk: OperationRisk
  requiresApproval: boolean
}

export interface InitializationProposal {
  id: string
  rootPath: string
  createdAt: string
  preset: string
  summary: string
  operations: ProposalOperation[]
  warnings: ScanWarning[]
  blockers: ScanBlocker[]
}

export interface ProposalProgress {
  proposalId: string
  totalOperations: number
  completedOperations: number
  currentOperationId: string
  currentOperationName: string
  status: 'running' | 'completed' | 'failed'
  message: string
  error?: string
}

export interface ProjectIntelligence {
  git?: {
    branch: string
    isDirty: boolean
    uncommittedCount: number
    recentCommits: Array<{ hash: string; message: string; author: string; date: string }>
    remote?: string
    ahead: number
    behind: number
  }
  stacks: Array<{ name: string; icon: string; version?: string; configFile: string }>
  health: {
    score: number
    hasGit: boolean
    hasReadme: boolean
    hasCi: boolean
    hasTests: boolean
    hasLinter: boolean
    hasLockfile: boolean
  }
  gitnexus?: {
    symbols: number
    relationships: number
    processes: number
    stale: boolean
  }
}

// ============================================================================
// GSD Engine Types
// ============================================================================

export type GsdStepStatus = 
  | 'Pending' 
  | 'InProgress' 
  | 'Completed' 
  | { Failed: string } 
  | 'Skipped' 
  | { WaitingForUser: string }
  | { AutoFixing: string }
  | { AwaitingFixApproval: [string, string] };

export type UserResponse = 'Approve' | 'ApproveFix' | 'Retry' | 'Abort';

export interface GsdStep {
  id: string
  title: string
  description: string
  status: GsdStepStatus
  result?: string
  attempts: number
  maxRetries: number
  waveIndex?: number
  startedAt?: number
  completedAt?: number
}

export interface GsdPhase {
  id: string
  title: string
  steps: GsdStep[]
  status: GsdStepStatus
  startedAt?: number
  completedAt?: number
}

export interface GsdPlan {
  id: string
  title: string
  taskId: string
  phases: GsdPhase[]
  metadata: Record<string, string>
}

export interface GsdExecutionEvent {
  planId: string
  phaseId?: string
  stepId?: string
  eventType: string
  message: string
  timestamp: number
}

export interface DiagnosticResult {
  bundle_path: string
  created_at: string
}

// ============================================================================
// API Context Type
// ============================================================================

/**
 * API context providing the current API instance and connection state
 */
export interface ApiContext {
  /** The API implementation (Electron or HTTP) */
  api: Api

  /** The type of backend being used */
  backendType: ApiBackendType

  /** Connection state (only relevant for HTTP backend) */
  connectionState: ConnectionState

  /** Error message if connection failed */
  connectionError?: string

  /** Reconnect function for HTTP backend */
  reconnect?: () => void
}
