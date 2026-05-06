import type { DynamicApiValue } from './dynamic-types';
import type {
  ApprovalRequest,
  ApprovalResponse,
  BeadsResult,
  DiagnosticResult,
  GsdApprovalRequest,
  GsdExecutionEvent,
  GsdPhase,
  GsdPlan,
  GsdStep,
  KspecDispatchStatus,
  McpServerConfig,
  ToolInfo,
  UnknownRecord,
  UserResponse,
} from './gsd-types';
import type {
  BrainstormCanvas,
  BrainstormCanvasNode,
  DiscoveryResult,
  GsdSeed,
  InitializationProposal,
  KSpecDraft,
  OptimizationStatsResponse,
  ProjectCapabilityScan,
  ProjectIntelligence,
  ProposalProgress,
  ScanOptions,
  TokenHistoryFilters,
  TokenHistoryResponse,
  TokenTransactionInput,
  VectorChunk,
  VectorIndexStatus,
  VectorSearchResult,
} from './intelligence-types';
import type {
  Settings,
  UpdateNotice,
  VoiceSettingsPayload,
  Workspace,
} from './settings-types';
import type {
  AgentAction,
  AgentMetricsPayload,
  AgentStatus,
  AiLearningPayload,
  DistributedNode,
  NeuralInsight,
  RemoteToolBid,
  SwarmKnowledge,
  SwarmPersona,
  SwarmPolicy,
  SwarmSnapshot,
  SystemTelemetry,
} from './swarm-types';
import type {
  ApiBackendType,
  ApiOpenSessionCallback,
  BackendId,
  ConnectionState,
  Session,
  Unsubscribe,
} from './terminal-types';

/**
 * Core API interface for the renderer
 */
export interface Api {
  [key: string]: DynamicApiValue;
  // Optional: Desktop-only voice catalog and XTTS management
  voiceCheckTTS?: () => Promise<{
    installed: boolean;
    engine: string | null;
    voices: string[];
    currentVoice: string | null;
  }>;
  voiceFetchCatalog?: (forceRefresh?: boolean) => Promise<DynamicApiValue[]>;
  voiceGetInstalled?: () => Promise<DynamicApiValue[]>;
  voiceDownloadFromCatalog?: (
    voiceKey: string
  ) => Promise<{ success: boolean; error?: string }>;
  voiceImportCustom?: () => Promise<{ success: boolean; error?: string }>;
  voiceOpenCustomFolder?: () => Promise<void>;
  voiceSaveSettings?: (settings: VoiceSettingsPayload) => Promise<void>;
  voiceInstallPiper?: () => Promise<{ success: boolean; error?: string }>;
  voiceInstallVoice?: (
    modelId: string
  ) => Promise<{ success: boolean; error?: string }>;
  voiceSpeak?: (
    text: string,
    voice?: string,
    speed?: number
  ) => Promise<{ success: boolean; error?: string }>;
  voiceStopSpeaking?: () => Promise<void>;
  onInstallProgress?: (
    callback: (data: {
      progress?: number;
      message?: string;
      [key: string]: unknown;
    }) => void
  ) => Unsubscribe;

  vectorIndexKnowledge: () => Promise<{ success: boolean; error?: string }>;
  vectorIndexSession: (
    summary: string,
    ptyId: string,
    projectPath?: string
  ) => Promise<{ success: boolean; error?: string }>;
  xttsGetVoices?: () => Promise<DynamicApiValue[]>;
  xttsGetSampleVoices?: () => Promise<DynamicApiValue[]>;
  xttsGetLanguages?: () => Promise<DynamicApiValue[]>;
  xttsCheck?: () => Promise<{ installed: boolean; error?: string }>;
  xttsDownloadSampleVoice?: (
    voiceId: string
  ) => Promise<{ success: boolean; error?: string }>;
  xttsDeleteVoice?: (
    voiceId: string
  ) => Promise<{ success: boolean; error?: string }>;
  xttsInstall?: () => Promise<{ success: boolean; error?: string }>;
  xttsCreateVoice?: (
    audioPath: string,
    name: string,
    language: string
  ) => Promise<{ success: boolean; error?: string }>;

  voiceCheckWhisper?: () => Promise<{
    installed: boolean;
    models: string[];
    currentModel: string | null;
  }>;
  openExternal?: (url: string) => Promise<void>;
  scrollDebugLog?: (message: string) => void;
  activityLogInfo?: (
    source: string,
    message: string,
    details?: string
  ) => Promise<void>;
  aiSaveKey?: (
    provider: string,
    key: string,
    baseUrl?: string
  ) => Promise<void>;
  tadaInstall?: () => Promise<{ success: boolean; error?: string }>;
  voiceInstallWhisper?: (
    model: string
  ) => Promise<{ success: boolean; error?: string }>;
  voiceGetSettings?: () => Promise<{
    ttsVoice?: string;
    ttsEngine?: string;
    ttsSpeed?: number;
    xttsTemperature?: number;
    xttsTopK?: number;
    xttsTopP?: number;
    xttsRepetitionPenalty?: number;
  }>;
  voiceApplySettings?: (settings: {
    ttsVoice?: string;
    ttsEngine?: string;
    ttsSpeed?: number;
    xttsTemperature?: number;
    xttsTopK?: number;
    xttsTopP?: number;
    xttsRepetitionPenalty?: number;
  }) => Promise<{ success: boolean }>;
  voiceSetVoice?: (
    voice: string | { voice: string; engine: 'piper' | 'xtts' }
  ) => Promise<{ success: boolean }>;

  ttsRemoveInstructions?: (
    projectPath: string
  ) => Promise<{ success: boolean }>;
  extensionsGetInstalled?: () => Promise<
    Array<{ id: string; name: string; type: string }>
  >;
  extensionsFetchRegistry?: (forceRefresh: boolean) => Promise<DynamicApiValue>;
  extensionsGetCustomUrls?: () => Promise<string[]>;
  extensionsInstallSkill?: (
    extension: DynamicApiValue,
    scope: string
  ) => Promise<{ success: boolean; error?: string }>;
  extensionsInstallMcp?: (
    extension: DynamicApiValue
  ) => Promise<{ success: boolean; error?: string }>;
  extensionsRemove?: (
    id: string
  ) => Promise<{ success: boolean; error?: string }>;
  extensionsEnableForProject?: (
    id: string,
    projectPath: string
  ) => Promise<void>;
  extensionsDisableForProject?: (
    id: string,
    projectPath: string
  ) => Promise<void>;
  extensionsFetchFromUrl?: (url: string) => Promise<DynamicApiValue | null>;
  extensionsAddCustomUrl?: (url: string) => Promise<void>;
  extensionsSetConfig?: (id: string, config: DynamicApiValue) => Promise<void>;
  extensionsCheckUpdates?: () => Promise<UpdateNotice[]>;
  mcpListTools?: (serverName: string) => Promise<DynamicApiValue>;
  mcpCallTool?: (
    serverName: string,
    toolName: string,
    args: DynamicApiValue
  ) => Promise<DynamicApiValue>;
  mcpListResources?: (serverName: string) => Promise<DynamicApiValue>;
  mcpReadResource?: (
    serverName: string,
    uri: string
  ) => Promise<DynamicApiValue>;
  mcpLoadConfig?: () => Promise<void>;
  mcpGetServers?: () => Promise<DynamicApiValue[]>;

  // Optional: API server control (desktop only)
  apiStart?: (
    projectPath: string,
    port: number
  ) => Promise<{ success: boolean; error?: string }>;
  apiStop?: (projectPath: string) => Promise<{ success: boolean }>;

  // ==========================================================================
  // Workspace Management
  // ==========================================================================

  /**
   * Get the current workspace state
   * @returns Promise resolving to workspace data
   */
  getWorkspace: () => Promise<Workspace>;

  /**
   * Save the workspace state
   * @param workspace Workspace data to save
   */
  saveWorkspace: (workspace: Workspace) => Promise<void>;

  // ==========================================================================
  // Settings Management
  // ==========================================================================

  /**
   * Get application settings
   * @returns Promise resolving to settings
   */
  getSettings: () => Promise<Settings>;

  /**
   * Save application settings
   * @param settings Settings to save
   */
  saveSettings: (settings: Settings) => Promise<void>;

  // ==========================================================================
  // Project Management
  // ==========================================================================

  /**
   * Open a directory picker to add a project
   * @returns Promise resolving to selected path or null
   */
  addProject: () => Promise<string | null>;

  /**
   * Open a directory picker to select a parent folder and add all subdirectories as projects
   * @returns Promise resolving to array of projects or null
   */
  addProjectsFromParent: () => Promise<Array<{
    path: string;
    name: string;
  }> | null>;

  // ==========================================================================
  // Session Discovery
  // ==========================================================================

  /**
   * Discover recent sessions for a project
   * @param projectPath Path to the project
   * @param backend Optional backend type ('claude', 'gemini', 'codex', 'opencode', or 'aider')
   */
  discoverSessions: (
    projectPath: string,
    backend?: BackendId
  ) => Promise<Session[]>;

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
  spawnPty: (
    cwd: string,
    sessionId?: string,
    model?: string,
    backend?: BackendId,
    rows?: number,
    cols?: number,
    nexusSessionId?: string
  ) => Promise<string>;

  /**
   * Write data to a PTY
   */
  writePty: (id: string, data: string) => void;

  /**
   * Resize a PTY
   */
  resizePty: (id: string, cols: number, rows: number) => void;

  /**
   * Kill a PTY
   */
  killPty: (id: string) => void;

  /**
   * Subscribe to PTY output
   */
  onPtyData: (id: string, callback: (data: string) => void) => Unsubscribe;

  /**
   * Subscribe to PTY exit
   */
  onPtyExit: (id: string, callback: (code: number) => void) => Unsubscribe;

  /**
   * Switch a PTY backend (desktop only)
   */
  setPtyBackend?: (id: string, backend: BackendId) => Promise<void>;

  /**
   * Subscribe to PTY recreated events (backend switching)
   */
  onPtyRecreated: (
    callback: (data: {
      oldId: string;
      newId: string;
      backend: BackendId;
    }) => void
  ) => Unsubscribe;

  /**
   * Subscribe to PTY title changes
   */
  onPtyTitle: (id: string, callback: (title: string) => void) => Unsubscribe;

  /**
   * Subscribe to PTY path changes
   */
  onPtyPath: (id: string, callback: (path: string) => void) => Unsubscribe;

  /**
   * Subscribe to PTY process ID changes
   */
  onPtyPid: (id: string, callback: (pid: string) => void) => Unsubscribe;

  /**
   * Get auto-accept status for a PTY
   */
  getAutoAcceptStatus?: (ptyId: string) => Promise<boolean>;

  /**
   * Set auto-accept status for a PTY
   */
  setAutoAccept?: (ptyId: string, enabled: boolean) => Promise<void>;

  // ==========================================================================
  // TTS (Text-to-Speech)
  // ==========================================================================

  /**
   * Install TTS instructions (CLAUDE.md markers) for a project
   * @param projectPath Path to the project
   * @returns Promise resolving to success status
   */
  ttsInstallInstructions: (
    projectPath: string
  ) => Promise<{ success: boolean }>;

  /**
   * Speak text using TTS
   * @param text Text to speak
   * @returns Promise resolving to audio data or error
   */
  ttsSpeak: (
    text: string
  ) => Promise<{ success: boolean; audioData?: string; error?: string }>;

  /**
   * Stop current TTS playback
   * @returns Promise resolving to success status
   */
  ttsStop: () => Promise<{ success: boolean }>;

  // ==========================================================================
  // Events
  // ==========================================================================

  /**
   * Subscribe to API open session events (triggered by external API calls)
   * @param callback Function called when session should be opened
   * @returns Unsubscribe function
   */
  onApiOpenSession: (callback: ApiOpenSessionCallback) => Unsubscribe;

  /**
   * Subscribe to settings change events
   */
  onSettingsChanged?: (callback: (settings: Settings) => void) => Unsubscribe;

  /**
   * Subscribe to workspace change events
   */
  onWorkspaceChanged?: (
    callback: (workspace: Workspace) => void
  ) => Unsubscribe;

  /**
   * Get connection info for external components (HTTP backend only)
   * @returns Connection info or undefined if not applicable
   */
  getConnectionInfo?: () => { host: string; port: number; token: string };

  // ==========================================================================
  // Approval Workflow
  // ==========================================================================

  onApprovalRequest?: (
    callback: (request: ApprovalRequest) => void
  ) => Unsubscribe;
  onApprovalResolved?: (callback: (actionId: string) => void) => Unsubscribe;
  respondToApproval?: (
    response: ApprovalResponse
  ) => Promise<{ success: boolean }>;
  getPendingApprovals?: (cwd: string) => Promise<ApprovalRequest[]>;

  // ==========================================================================
  // Project Initialization
  // ==========================================================================
  onProjectInitializationProgress?: (
    callback: (progress: ProposalProgress) => void
  ) => Unsubscribe;

  /**
   * Subscribe to model plan switched events (Dynamic Plan Switching)
   */
  onModelPlanSwitched?: (
    callback: (event: {
      old_plan: string;
      new_plan: string;
      health_score: number;
    }) => void
  ) => Unsubscribe;

  // ==========================================================================
  // GSD Engine
  // ==========================================================================
  gsdCreatePlan?: (taskId: string, title: string) => Promise<GsdPlan>;
  gsdListPlans?: (projectPath: string) => Promise<GsdPlan[]>;
  gsdAddPhase?: (planId: string, title: string) => Promise<GsdPhase>;
  gsdAddStep?: (
    planId: string,
    phaseId: string,
    title: string,
    description: string
  ) => Promise<GsdStep>;
  gsdExecutePlan?: (planId: string) => Promise<void>;
  gsdRespondToCheckpoint?: (
    stepId: string,
    response: UserResponse
  ) => Promise<void>;
  gsdRespondToApproval?: (
    approvalId: string,
    response: string
  ) => Promise<void>;
  gsdGetGovernanceStatus?: () => Promise<SwarmPolicy>;
  gsdGetPersonas?: () => Promise<SwarmPersona[]>;
  gsdSyncMemory?: () => Promise<number>;
  gsdQuantumSyncStart?: () => Promise<void>;

  gsdUpdatePolicy?: (policy: SwarmPolicy) => Promise<void>;
  gsdStartAutomaticSync?: () => Promise<void>;
  gsdStopAutomaticSync?: () => Promise<void>;
  gsdGetSyncStatus?: () => Promise<boolean>;
  gsdListTools?: () => Promise<ToolInfo[]>;
  onGsdExecutionEvent?: (
    callback: (event: GsdExecutionEvent) => void
  ) => Unsubscribe;
  onGsdSyncEvent?: (callback: (event: UnknownRecord) => void) => Unsubscribe;

  onGsdInsight?: (callback: (insight: NeuralInsight) => void) => Unsubscribe;
  onGsdApprovalRequested?: (
    callback: (approval: GsdApprovalRequest) => void
  ) => Unsubscribe;
  onGsdPhaseUpdated?: (callback: (phase: GsdPhase) => void) => Unsubscribe;
  onGsdStepUpdated?: (callback: (step: GsdStep) => void) => Unsubscribe;
  gsdSwarmQueryMemory?: (
    query: string,
    patternType?: string,
    limit?: number
  ) => Promise<SwarmKnowledge[]>;
  gsdSwarmRecordPattern?: (
    patternType: string,
    patternKey: string,
    content: string,
    metadata?: string
  ) => Promise<void>;
  gsdIdentifyRefactors?: () => Promise<string>;
  gsdApplyRefactor?: (
    finding: UnknownRecord,
    dryRun?: boolean
  ) => Promise<string>;
  gsdGetRefactorDetails?: (symbolName: string) => Promise<string>;

  // Phase 40: Synaptic Expansion
  gsdStartDistributedDiscovery?: () => Promise<void>;
  gsdStopDistributedDiscovery?: () => Promise<void>;
  gsdGetDistributedNodes?: () => Promise<DistributedNode[]>;
  gsdQuoteRemoteToolExecution?: (
    capability: string,
    baseCostCredits?: number
  ) => Promise<RemoteToolBid[]>;
  gsdApplyDistributedCreditDelta?: (
    nodeId: string,
    creditDelta: number,
    utilization?: number
  ) => Promise<DistributedNode>;
  gsdExecuteProactiveAudit?: (
    projectPath: string,
    scope?: string
  ) => Promise<string>;
  gsdGetSynapticMetrics?: () => Promise<{
    feedbackLoops: number;
    activeOptimizations: number;
    cognitiveLoad: number;
    swarmCohesion: number;
  }>;
  gsdTriggerExpansionLoop?: (loopType: string) => Promise<void>;
  borgRecordLearning?: (projectName: string, title: string, content: string) => Promise<void>;
  borgSyncMemory?: () => Promise<number>;
  gsdSpawnRemoteWorker?: (taskDescription: string) => Promise<string>;

  // ==========================================================================
  // Vector Engine
  // ==========================================================================
  vectorSearch?: (
    query: string,
    limit?: number,
    projectPath?: string
  ) => Promise<VectorSearchResult[]>;
  vectorGetStatus?: () => Promise<VectorIndexStatus>;
  vectorAddChunks?: (chunks: VectorChunk[]) => Promise<{ success: boolean }>;
  vectorIndexProject?: (
    projectPath: string
  ) => Promise<{ success: boolean; error?: string }>;
  openFile?: (path: string) => void | Promise<void>;

  // Brainstorm Companion
  gsdListSeeds?: (cwd: string) => Promise<GsdSeed[]>;
  gsdPlantSeed?: (cwd: string, seed: GsdSeed) => Promise<void>;
  gsdUpdateSeedStatus?: (
    cwd: string,
    seedId: string,
    status: string
  ) => Promise<void>;
  kspecListDrafts?: (cwd: string) => Promise<KSpecDraft[]>;
  kspecWriteDraft?: (
    cwd: string,
    moduleId: string,
    content: string
  ) => Promise<void>;
  brainstormLoadCanvas?: (cwd: string) => Promise<BrainstormCanvas>;
  brainstormSaveCanvas?: (
    cwd: string,
    canvas: BrainstormCanvas
  ) => Promise<void>;
  brainstormAgenticSketch?: (
    cwd: string,
    baseId: string,
    baseTitle: string,
    baseContent: string
  ) => Promise<BrainstormCanvasNode>;
  brainstormArchitectReview?: (
    cwd: string,
    baseId: string,
    baseType: string,
    baseTitle: string,
    baseContent: string
  ) => Promise<BrainstormCanvasNode>;

  // AI Evolution
  aiTriggerEvolution?: () => Promise<DiscoveryResult[]>;
  onAiEvolutionCompleted?: (
    callback: (discoveries: DiscoveryResult[]) => void
  ) => Unsubscribe;
  onOptimizationStatsUpdated?: (
    callback: (stats: OptimizationStatsResponse) => void
  ) => Unsubscribe;

  // ==========================================================================
  // Orchestration
  // ==========================================================================

  /**
   * Subscribe to agent actions
   */
  onAgentAction?: (callback: (action: AgentAction) => void) => Unsubscribe;

  /**
   * Subscribe to agent status updates
   */
  onAgentStatus?: (callback: (status: AgentStatus) => void) => Unsubscribe;

  /**
   * Subscribe to system telemetry updates
   */
  onTelemetry?: (callback: (telemetry: SystemTelemetry) => void) => Unsubscribe;

  /**
   * Approve a pending action
   */
  approveAction?: (actionId: string) => Promise<{ success: boolean }>;

  /**
   * Reject a pending action
   */
  rejectAction?: (actionId: string) => Promise<{ success: boolean }>;
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
  selectDirectory: () => Promise<string | null>;
  selectExecutable: () => Promise<string | null>;
  runExecutable?: (
    executable: string,
    cwd: string
  ) => Promise<{ success: boolean; error?: string }>;
  getCategoryMetaPath?: (categoryName: string) => Promise<string>;
  getMetaProjectsPath?: () => Promise<string>;

  // NeuralHUD Telemetry
  onJobProgress?: (
    callback: (data: {
      jobId: string;
      progress: number;
      message?: string;
    }) => void
  ) => Unsubscribe;
  onJobStatusChanged?: (
    callback: (data: { jobId: string; status: string }) => void
  ) => Unsubscribe;
  onAgentStatusChanged?: (
    callback: (data: { agentId: string; status: string }) => void
  ) => Unsubscribe;
  onAgentMetricsChanged?: (
    callback: (data: { agentId: string; metrics: AgentMetricsPayload }) => void
  ) => Unsubscribe;
  onAiLearningCaptured?: (
    callback: (data: AiLearningPayload) => void
  ) => Unsubscribe;

  // Window controls (Desktop-only)
  windowMinimize: () => void;
  windowMaximize: () => void;
  windowClose: () => void;
  windowIsMaximized: () => Promise<boolean>;
  windowStartDragging: () => void;

  // File utilities
  getPathForFile: (file: File) => string;

  // Clipboard operations
  readClipboardImage: () => Promise<{
    success: boolean;
    hasImage?: boolean;
    path?: string;
    error?: string;
  }>;

  // App utilities
  getVersion: () => Promise<string>;
  isDebugMode: () => Promise<boolean>;
  refresh: () => Promise<void>;
  openExternal: (url: string) => Promise<void>;

  // Updater (Tauri/Electron)
  checkForUpdate: () => Promise<{
    available: boolean;
    version?: string;
    body?: string;
  }>;
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  installUpdate: () => Promise<void>;

  // Debug
  debugLog: (message: string) => void;

  // Token Metering
  logTokenEvent: (
    transaction: TokenTransactionInput,
    savedTokens?: number
  ) => Promise<void>;
  getTokenStats: (projectId?: string) => Promise<{
    totalInput: number;
    totalOutput: number;
    totalSaved: number;
    totalCost: number;
  }>;
  getTokenHistory: (
    filters?: TokenHistoryFilters
  ) => Promise<TokenHistoryResponse>;

  // Project Initialization Wizard
  projectScan: (
    path: string,
    options?: ScanOptions
  ) => Promise<ProjectCapabilityScan>;
  projectScanAsync: (
    path: string
  ) => Promise<{ success: boolean; job_id: string }>;
  setCurrentProject: (path: string | null) => Promise<void>;
  addActiveProject: (path: string) => Promise<void>;
  removeActiveProject: (path: string) => Promise<void>;
  getActiveProjects: () => Promise<string[]>;
  projectGenerateProposal: (
    scan: ProjectCapabilityScan,
    preset: string,
    projectName: string,
    taskBackend: string
  ) => Promise<InitializationProposal>;
  projectApplyProposal: (proposal: InitializationProposal) => Promise<string[]>;
  scanProjectIntelligence: (path: string) => Promise<ProjectIntelligence>;

  // Orchestration (Beads/Kspec)
  kspecDispatchStatus: (cwd: string) => Promise<KspecDispatchStatus>;
  kspecDispatchStart: (
    cwd: string
  ) => Promise<{ success: boolean; error?: string }>;
  kspecDispatchStop: (
    cwd: string
  ) => Promise<{ success: boolean; error?: string }>;
  apiStatus?: (
    projectPath: string
  ) => Promise<{ running: boolean; port?: number }>;
  beadsCheck?: (
    cwd: string
  ) => Promise<{ installed: boolean; initialized: boolean }>;
  beadsInit?: (cwd: string) => Promise<DynamicApiValue>;
  beadsList: (cwd: string) => Promise<BeadsResult>;
  beadsShow?: (cwd: string, task_id: string) => Promise<DynamicApiValue>;
  beadsCreate: (
    cwd: string,
    title: string,
    description?: string,
    priority?: number,
    type?: string,
    labels?: string
  ) => Promise<BeadsResult>;
  beadsStart: (cwd: string, task_id: string) => Promise<BeadsResult>;
  beadsComplete: (cwd: string, task_id: string) => Promise<BeadsResult>;

  // Approval Workflow
  onApprovalRequest: (
    callback: (request: ApprovalRequest) => void
  ) => Unsubscribe;
  onApprovalResolved: (callback: (actionId: string) => void) => Unsubscribe;
  respondToApproval: (
    response: ApprovalResponse
  ) => Promise<{ success: boolean }>;
  getPendingApprovals: (cwd: string) => Promise<ApprovalRequest[]>;

  // Project Initialization
  onProjectInitializationProgress: (
    callback: (progress: ProposalProgress) => void
  ) => Unsubscribe;

  // Diagnostics
  diagnosticsGenerateBundle: () => Promise<DiagnosticResult>;

  // Custom Commands
  commandsSave?: (
    name: string,
    content: string,
    scopePath: string | null
  ) => Promise<{ success: boolean; error?: string }>;
  aiSaveKey?: (
    provider: string,
    key: string,
    baseUrl?: string
  ) => Promise<void>;

  // Voice (Extended/Desktop)
  voiceGetInstalled?: () => Promise<DynamicApiValue[]>;
  voiceGetSettings?: () => Promise<DynamicApiValue>;
  voiceApplySettings?: (
    settings: DynamicApiValue
  ) => Promise<{ success: boolean }>;
  voiceSpeak?: (
    text: string,
    voice?: string,
    speed?: number
  ) => Promise<DynamicApiValue>;
  voiceStopSpeaking?: () => Promise<void>;
  voiceStartListening?: () => Promise<void>;
  voiceStopListening?: () => Promise<void>;
  onVoiceTranscription?: (callback: (text: string) => void) => Unsubscribe;
  xttsGetVoices?: () => Promise<DynamicApiValue[]>;

  // Updater
  onUpdateProgress?: (callback: (progress: number) => void) => Unsubscribe;

  // Vector Engine (Desktop-specific overrides/extensions if needed)
  vectorSearch: (
    query: string,
    limit?: number,
    projectPath?: string
  ) => Promise<VectorSearchResult[]>;
  vectorGetStatus: () => Promise<VectorIndexStatus>;
  vectorAddChunks: (chunks: VectorChunk[]) => Promise<{ success: boolean }>;
  vectorIndexProject: (
    projectPath: string
  ) => Promise<{ success: boolean; error?: string }>;
  vectorIndexKnowledge: () => Promise<{ success: boolean; error?: string }>;

  // Brainstorm Companion
  gsdListSeeds: (cwd: string) => Promise<GsdSeed[]>;
  gsdPlantSeed: (cwd: string, seed: GsdSeed) => Promise<void>;
  kspecListDrafts: (cwd: string) => Promise<KSpecDraft[]>;
  kspecWriteDraft: (
    cwd: string,
    moduleId: string,
    content: string
  ) => Promise<void>;
  brainstormLoadCanvas: (cwd: string) => Promise<BrainstormCanvas>;
  brainstormSaveCanvas: (
    cwd: string,
    canvas: BrainstormCanvas
  ) => Promise<void>;
  brainstormSaveTopology: (
    cwd: string,
    content: string
  ) => Promise<{ success: boolean; error?: string }>;
  gsdSwarmQueryMemory: (
    query: string,
    patternType?: string,
    limit?: number
  ) => Promise<SwarmKnowledge[]>;
  gsdSwarmRecordPattern: (
    patternType: string,
    patternKey: string,
    content: string,
    metadata?: string
  ) => Promise<void>;
  aiRecordFeedback: (feedback: {
    context_id: string;
    action: string;
    feedback: string;
    is_positive: boolean;
  }) => Promise<{ success: boolean }>;

  // Swarm Snapshotting
  gsdCreateSwarmSnapshot(
    cwd: string,
    name: string,
    handoffNotes?: string
  ): Promise<{ success: boolean; snapshotId?: string; error?: string }>;
  gsdHydrateSwarm(
    cwd: string
  ): Promise<{ success: boolean; count: number; error?: string }>;
  gsdGetSwarmSnapshots: (projectPath: string) => Promise<SwarmSnapshot[]>;
  gsdCreateSnapshotWorkspace: (
    snapshotId: string
  ) => Promise<{ success: boolean; path?: string; error?: string }>;

  // CLI Status & Health (Parity with Legacy)
  claudeCheck(): Promise<{
    installed: boolean;
    npmInstalled: boolean;
    gitBashInstalled: boolean;
  }>;
  geminiCheck(): Promise<{ installed: boolean; npmInstalled: boolean }>;
  codexCheck(): Promise<{ installed: boolean; npmInstalled: boolean }>;
  opencodeCheck(): Promise<{ installed: boolean; npmInstalled: boolean }>;
  aiderCheck(): Promise<{ installed: boolean; pipInstalled: boolean }>;
  gsdCheck(): Promise<{ installed: boolean; npmInstalled: boolean }>;

  // Installation Handlers
  claudeInstall(): Promise<{ success: boolean; error?: string }>;
  geminiInstall(): Promise<{ success: boolean; error?: string }>;
  codexInstall(): Promise<{ success: boolean; error?: string }>;
  opencodeInstall(): Promise<{ success: boolean; error?: string }>;
  aiderInstall(): Promise<{ success: boolean; error?: string }>;
  gsdInstall(): Promise<{ success: boolean; error?: string }>;
  beadsInstall(): Promise<{ success: boolean; error?: string }>;
  gitInstall(): Promise<{ success: boolean; error?: string }>;
  nodeInstall(): Promise<{ success: boolean; error?: string }>;
  pythonInstall(): Promise<{ success: boolean; error?: string }>;

  // Distributed MCP Orchestration
  mcpGetServers: () => Promise<McpServerConfig[]>;
  mcpDiscoverServers: () => Promise<McpServerConfig[]>;
  registerMcpServer: (config: McpServerConfig) => Promise<void>;
  mcpLoadConfig: () => Promise<void>;
  mcpTrustNode: (name: string) => Promise<void>;
  mcpIsNodeTrusted: (name: string) => Promise<boolean>;
  borgRecordLearning: (projectName: string, title: string, content: string) => Promise<void>;
  borgSyncMemory: () => Promise<number>;
}

// ============================================================================
// API Context Type
// ============================================================================

/**
 * API context providing the current API instance and connection state
 */
export interface ApiContext {
  /** The API implementation (Electron or HTTP) */
  api: Api;

  /** The type of backend being used */
  backendType: ApiBackendType;

  /** Connection state (only relevant for HTTP backend) */
  connectionState: ConnectionState;

  /** Error message if connection failed */
  connectionError?: string;

  /** Reconnect function for HTTP backend */
  reconnect?: () => void;
}
