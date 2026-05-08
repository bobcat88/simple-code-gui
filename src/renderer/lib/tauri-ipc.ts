import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type {
  AiLearningPayload,
  ApprovalRequest,
  ApprovalResponse,
  BackendId,
  BeadsResult,
  BeadsTask,
  BrainstormCanvas,
  BrainstormCanvasNode,
  DiagnosticResult,
  DiscoveryResult,
  DistributedNode,
  DynamicApiValue,
  ExtensionDescriptor,
  GsdApprovalRequest,
  GsdExecutionEvent,
  GsdPhase,
  GsdPlan,
  GsdSeed,
  GsdStep,
  KSpecDraft,
  KspecDispatchStatus,
  McpResourceListResponse,
  McpServerConfig,
  McpToolListResponse,
  NeuralInsight,
  ArchitectAuditReport,
  PolicyProposal,
  PersonaEvolutionProposal,
  SynapticMetrics,
  OptimizationStatsResponse,
  RemoteToolBid,
  Session,
  Settings,
  SwarmKnowledge,
  SwarmPersona,
  SwarmPolicy,
  SwarmSnapshot,
  TokenHistoryFilters,
  TokenHistoryResponse,
  TokenTransactionInput,
  ToolArguments,
  ToolInfo,
  UpdateNotice,
  VectorChunk,
  VectorIndexStatus,
  VectorSearchResult,
  VoiceSettingsPayload,
  Workspace,
  XttsSampleVoice,
  XttsVoice,
} from '../api/types';
import type {
  ActivityEvent,
  AgentMessage,
  AgentTask,
  AgentTrace,
  AiModelResponse,
  AiProviderResponse,
  CheckToolResponse,
  CommandResult,
  DiagnosticBundleResponse,
  ExtensionRegistryResponse,
  HealthStatusResponse,
  InitializationProposalResponse,
  JobProgressEvent,
  ProjectIntelligenceResponse,
  ProjectScanResponse,
  RegisteredAgent,
  RtkOptimizationResponse,
  TokenStatsResponse,
  VoiceCheckResponse,
} from './tauri-ipc-types';

export interface SessionInfo {
  id: string;
  cwd: string;
  backend: string;
  session_id?: string;
  nexus_session_id?: string;
  spawned_at: number;
}

export const tauriIpc = {
  spawnSession: (
    cwd: string,
    backend: string,
    sessionId?: string,
    slug?: string,
    rows?: number,
    cols?: number,
    nexusSessionId?: string
  ) =>
    invoke<string>('spawn_session', {
      cwd,
      backend,
      session_id: sessionId,
      slug,
      rows,
      cols,
      nexus_session_id: nexusSessionId,
    }),

  listen: <T>(
    event: string,
    handler: (event: { payload: T }) => void
  ): Promise<UnlistenFn> => listen<T>(event, handler),

  writeToPty: (id: string, data: string) =>
    invoke<void>('write_to_pty', { id, data }),

  resizePty: (id: string, cols: number, rows: number) =>
    invoke<void>('resize_pty', { id, cols, rows }),

  killSession: (id: string) => invoke<void>('kill_session', { id }),

  setPtyBackend: (id: string, backend: string) =>
    invoke<void>('set_pty_backend', { id, backend }),

  getSettings: () => invoke<Settings>('get_settings'),

  saveSettings: (settings: Partial<Settings>) =>
    invoke<void>('save_settings', { settings }),

  aiSaveKey: (provider: string, key: string, baseUrl?: string) =>
    invoke<void>('ai_save_key', { provider, key, base_url: baseUrl }),

  getWorkspace: () => invoke<Workspace>('get_workspace'),

  saveWorkspace: (workspace: Partial<Workspace>) =>
    invoke<void>('save_workspace', { workspace }),

  onPtyData: (
    id: string,
    callback: (data: string | Uint8Array) => void
  ): Promise<UnlistenFn> =>
    listen<string | Uint8Array>(`pty-data-${id}`, (event) => callback(event.payload)),

  onPtyExit: (
    id: string,
    callback: (code: number) => void
  ): Promise<UnlistenFn> =>
    listen<number>(`pty-exit-${id}`, (event) => callback(event.payload)),

  onPtyRecreated: (
    callback: (data: {
      oldId: string;
      newId: string;
      backend: BackendId;
    }) => void
  ): Promise<UnlistenFn> =>
    listen<{ oldId: string; newId: string; backend: BackendId }>(
      'pty-recreated',
      (event) => callback(event.payload)
    ),

  onPtyTitle: (
    id: string,
    callback: (title: string) => void
  ): Promise<UnlistenFn> =>
    listen<string>(`pty-title-${id}`, (event) => callback(event.payload)),

  onPtyPath: (
    id: string,
    callback: (path: string) => void
  ): Promise<UnlistenFn> =>
    listen<string>(`pty-path-${id}`, (event) => callback(event.payload)),

  onPtyPid: (
    id: string,
    callback: (pid: string) => void
  ): Promise<UnlistenFn> =>
    listen<string>(`pty-pid-${id}`, (event) => callback(event.payload)),

  onSettingsChanged: (
    callback: (settings: Settings) => void
  ): Promise<UnlistenFn> =>
    listen<Settings>('settings-changed', (event) => callback(event.payload)),

  onWorkspaceChanged: (
    callback: (workspace: Workspace) => void
  ): Promise<UnlistenFn> =>
    listen<Workspace>('workspace-changed', (event) => callback(event.payload)),

  selectDirectory: () => invoke<string | null>('select_directory'),

  // Extensions
  extensionsFetchRegistry: (forceRefresh: boolean) =>
    invoke<ExtensionRegistryResponse>('extensions_fetch_registry', {
      forceRefresh,
    }),
  extensionsGetInstalled: () =>
    invoke<ExtensionDescriptor[]>('extensions_get_installed'),
  extensionsGetCustomUrls: () => invoke<string[]>('extensions_get_custom_urls'),
  extensionsInstallSkill: (
    extension: Partial<ExtensionDescriptor>,
    scope: string
  ) => invoke<CommandResult>('extensions_install_skill', { extension, scope }),
  extensionsInstallMcp: (extension: Partial<ExtensionDescriptor>) =>
    invoke<CommandResult>('extensions_install_mcp', { extension }),
  extensionsRemove: (id: string) =>
    invoke<CommandResult>('extensions_remove', { id }),
  extensionsEnableForProject: (id: string, projectPath: string) =>
    invoke<void>('extensions_enable_for_project', { id, projectPath }),
  extensionsDisableForProject: (id: string, projectPath: string) =>
    invoke<void>('extensions_disable_for_project', { id, projectPath }),
  extensionsFetchFromUrl: (url: string) =>
    invoke<ExtensionDescriptor | null>('extensions_fetch_from_url', { url }),
  extensionsAddCustomUrl: (url: string) =>
    invoke<void>('extensions_add_custom_url', { url }),
  extensionsRemoveCustomUrl: (url: string) =>
    invoke<void>('extensions_remove_custom_url', { url }),
  extensionsSetConfig: (id: string, config: DynamicApiValue) =>
    invoke<void>('extensions_set_config', { id, config }),
  extensionsCheckUpdates: () =>
    invoke<UpdateNotice[]>('extensions_check_updates'),

  // MCP Bridge
  mcpListTools: (serverName: string) =>
    invoke<McpToolListResponse>('mcp_list_tools', { serverName }),
  mcpCallTool: (serverName: string, toolName: string, args: ToolArguments) =>
    invoke<DynamicApiValue>('mcp_call_tool', { serverName, toolName, args }),
  mcpListResources: (serverName: string) =>
    invoke<McpResourceListResponse>('mcp_list_resources', { serverName }),
  mcpReadResource: (serverName: string, uri: string) =>
    invoke<DynamicApiValue>('mcp_read_resource', { serverName, uri }),
  mcpLoadConfig: () => invoke<void>('mcp_load_config'),
  mcpGetServers: () => invoke<McpServerConfig[]>('get_registered_mcp_servers'),
  mcpDiscoverServers: () => invoke<McpServerConfig[]>('mcp_discover_servers'),
  registerMcpServer: (config: McpServerConfig) =>
    invoke<void>('register_mcp_server', { config }),
  mcpTrustNode: (name: string) => invoke<void>('mcp_trust_node', { name }),
  mcpIsNodeTrusted: (name: string) =>
    invoke<boolean>('mcp_is_node_trusted', { name }),

  discoverSessions: (projectPath: string, backend?: string) =>
    invoke<Session[]>('discover_sessions', { projectPath, backend }),

  selectFile: () => invoke<string | null>('select_file'),

  listDirs: (path: string) => invoke<string[]>('list_dirs', { path }),

  windowMinimize: () => invoke<void>('window_minimize'),

  windowMaximize: () => invoke<void>('window_maximize'),

  windowClose: () => invoke<void>('window_close'),

  windowIsMaximized: () => invoke<boolean>('window_is_maximized'),

  windowStartDragging: () => invoke<void>('window_start_dragging'),

  logTokenEvent: (
    transaction: TokenTransactionInput | Record<string, unknown>,
    savedTokens?: number
  ) =>
    invoke<void>('log_token_event', { transaction, saved_tokens: savedTokens }),

  getTokenStats: (projectId?: string) =>
    invoke<TokenStatsResponse>('get_token_stats', { projectId }),

  getTokenHistory: (filters?: TokenHistoryFilters) =>
    invoke<TokenHistoryResponse>('get_token_history', { filters }),

  aiGetOptimizationStats: (sessionId?: string) =>
    invoke<OptimizationStatsResponse>('ai_get_optimization_stats', {
      session_id: sessionId,
    }),

  // Voice & XTTS
  voiceCheckTTS: () => invoke<VoiceCheckResponse>('voice_check_tts'),
  voiceFetchCatalog: (forceRefresh?: boolean) =>
    invoke<DynamicApiValue[]>('voice_fetch_catalog', { forceRefresh }),
  voiceGetInstalled: () => invoke<string[]>('voice_get_installed'),
  voiceDownloadFromCatalog: (voiceKey: string) =>
    invoke<CommandResult>('voice_download_from_catalog', { voiceKey }),
  voiceImportCustom: () => invoke<CommandResult>('voice_import_custom'),
  voiceOpenCustomFolder: () => invoke<void>('voice_open_custom_folder'),
  voiceSaveSettings: (settings: VoiceSettingsPayload) =>
    invoke<void>('voice_save_settings', { settings }),
  voiceSpeak: (text: string, voice?: string, speed?: number) =>
    invoke<CommandResult>('voice_speak', { text, voice, speed }),
  voiceStop: () => invoke<void>('voice_stop'),
  voiceInstallPiper: () => invoke<CommandResult>('voice_install_piper'),
  voiceInstallVoice: (modelId: string) =>
    invoke<CommandResult>('voice_install_voice', { model_id: modelId }),

  xttsGetVoices: () => invoke<XttsVoice[]>('xtts_get_voices'),
  xttsGetSampleVoices: () =>
    invoke<XttsSampleVoice[]>('xtts_get_sample_voices'),
  xttsGetLanguages: () => invoke<string[]>('xtts_get_languages'),
  xttsCheck: () =>
    invoke<CommandResult & { installed?: boolean }>('xtts_check'),
  xttsDownloadSampleVoice: (voiceId: string) =>
    invoke<CommandResult>('xtts_download_sample_voice', { voiceId }),
  xttsDeleteVoice: (voiceId: string) =>
    invoke<CommandResult>('xtts_delete_voice', { voiceId }),
  xttsInstall: () => invoke<CommandResult>('xtts_install'),
  xttsCreateVoice: (audioPath: string, name: string, language: string) =>
    invoke<CommandResult>('xtts_create_voice', { audioPath, name, language }),

  // Auto-accept
  getAutoAcceptStatus: (ptyId: string) =>
    invoke<boolean>('get_auto_accept_status', { ptyId }),
  setAutoAccept: (ptyId: string, enabled: boolean) =>
    invoke<void>('set_auto_accept', { ptyId, enabled }),

  projectScan: (path: string, options: Record<string, unknown>) =>
    invoke<ProjectScanResponse>('project_scan', { path, options }),

  projectGenerateProposal: (
    scan: ProjectScanResponse,
    preset: string,
    projectName: string,
    taskBackend: string
  ) =>
    invoke<InitializationProposalResponse>('project_generate_proposal', {
      scan,
      preset,
      project_name: projectName,
      task_backend: taskBackend,
    }),

  projectApplyProposal: (proposal: InitializationProposalResponse) =>
    invoke<string[]>('project_apply_proposal', { proposal }),

  scanProjectIntelligence: (path: string) =>
    invoke<ProjectIntelligenceResponse>('scan_project_intelligence', {
      cwd: path,
    }),

  onProjectInitializationProgress: (
    callback: (progress: DynamicApiValue) => void
  ): Promise<UnlistenFn> =>
    listen<DynamicApiValue>('project-initialization-progress', (event) =>
      callback(event.payload)
    ),

  onInstallProgress: (
    callback: (progress: DynamicApiValue) => void
  ): Promise<UnlistenFn> =>
    listen<DynamicApiValue>('install-progress', (event) =>
      callback(event.payload)
    ),

  // Orchestration (Beads/Kspec)
  kspecDispatchStatus: (cwd: string) =>
    invoke<KspecDispatchStatus>('kspec_dispatch_status', { cwd }),
  kspecDispatchStart: (cwd: string) =>
    invoke<{ success: boolean; job_id?: string; error?: string }>(
      'kspec_dispatch_start',
      { cwd }
    ),
  projectScanAsync: (path: string) =>
    invoke<{ success: boolean; job_id?: string; error?: string }>(
      'project_scan_async',
      { path }
    ),
  setCurrentProject: (path: string | null) =>
    invoke<void>('set_current_project', { path }),
  addActiveProject: (path: string) =>
    invoke<void>('add_active_project', { path }),
  removeActiveProject: (path: string) =>
    invoke<void>('remove_active_project', { path }),
  getActiveProjects: () => invoke<string[]>('get_active_projects'),
  kspecDispatchStop: (cwd: string) =>
    invoke<{ success: boolean; error?: string }>('kspec_dispatch_stop', {
      cwd,
    }),
  beadsList: (cwd: string) => invoke<BeadsTask[]>('beads_list', { cwd }),
  beadsCreate: (
    cwd: string,
    title: string,
    description?: string,
    priority?: number,
    taskType?: string,
    tags?: string
  ) =>
    invoke<BeadsResult>('beads_create', {
      cwd,
      title,
      description,
      priority,
      task_type: taskType,
      tags,
    }),
  beadsStart: (cwd: string, taskId: string) =>
    invoke<BeadsResult>('beads_start', { cwd, task_id: taskId }),
  beadsComplete: (cwd: string, taskId: string) =>
    invoke<BeadsResult>('beads_complete', { cwd, task_id: taskId }),

  // Approval Workflow
  onApprovalRequest: (
    callback: (request: ApprovalRequest) => void
  ): Promise<UnlistenFn> =>
    listen<ApprovalRequest>('approval-request', (event) =>
      callback(event.payload)
    ),
  onApprovalResolved: (
    callback: (actionId: string) => void
  ): Promise<UnlistenFn> =>
    listen<string>('approval-resolved', (event) => callback(event.payload)),
  respondToApproval: (response: ApprovalResponse) =>
    invoke<{ success: boolean }>('respond_to_approval', { response }),
  getPendingApprovals: (cwd: string) =>
    invoke<ApprovalRequest[]>('get_pending_approvals', { cwd }),

  // Background Jobs
  jobsCreate: (jobType: string, payload: DynamicApiValue) =>
    invoke<string>('jobs_create', { job_type: jobType, payload }),
  jobsGet: (id: string) => invoke<DynamicApiValue>('jobs_get', { id }),
  jobsList: (limit?: number) =>
    invoke<DynamicApiValue[]>('jobs_list', { limit }),
  onJobProgress: (callback: (data: JobProgressEvent) => void) =>
    listen<JobProgressEvent>('job-progress', (event) =>
      callback(event.payload)
    ),
  onJobStatusChanged: (callback: (id: string) => void) =>
    listen<string>('job-status-changed', (event) => callback(event.payload)),

  // Activity Feed
  activityGetRecent: (limit?: number) =>
    invoke<ActivityEvent[]>('activity_get_recent', { limit }),
  activityLogInfo: (source: string, message: string, metadata?: string) =>
    invoke<void>('activity_log_info', { source, message, metadata }),
  onActivityEvent: (callback: (event: ActivityEvent) => void) =>
    listen<ActivityEvent>('activity-event', (event) => callback(event.payload)),

  // Agents
  agentRegister: (agent: RegisteredAgent) =>
    invoke<void>('agent_register', { agent }),
  agentList: () => invoke<RegisteredAgent[]>('agent_list'),
  agentUpdateStatus: (id: string, status: string) =>
    invoke<void>('agent_update_status', { id, status }),
  onAgentStatusChanged: (
    callback: (data: { id: string; status: string }) => void
  ) =>
    listen<{ id: string; status: string }>('agent-status-changed', (event) =>
      callback(event.payload)
    ),
  onAgentRegistered: (callback: (agent: RegisteredAgent) => void) =>
    listen<RegisteredAgent>('agent-registered', (event) =>
      callback(event.payload)
    ),
  agentUpdateMetrics: (
    id: string,
    burnRate: number,
    qualityScore: number,
    errorRate: number,
    queueSize: number,
    evolutionConfidence: number,
    evolutionStatus: string,
    activeTask?: string
  ) =>
    invoke<void>('agent_update_metrics', {
      id,
      burn_rate: burnRate,
      quality_score: qualityScore,
      error_rate: errorRate,
      queue_size: queueSize,
      evolution_confidence: evolutionConfidence,
      evolution_status: evolutionStatus,
      active_task: activeTask,
    }),
  onAgentMetricsChanged: (
    callback: (data: {
      id: string;
      burn_rate: number;
      quality_score: number;
      error_rate: number;
      queue_size: number;
      evolution_confidence: number;
      evolution_status: string;
      active_task?: string;
    }) => void
  ) =>
    listen<{
      id: string;
      burn_rate: number;
      quality_score: number;
      error_rate: number;
      queue_size: number;
      evolution_confidence: number;
      evolution_status: string;
      active_task?: string;
    }>('agent-metrics-changed', (event) => callback(event.payload)),
  agentRefreshBurnRates: () => invoke<void>('agent_refresh_burn_rates'),
  agentCancelTask: (id: string) => invoke<void>('agent_cancel_task', { id }),
  agentListTasks: (agentId: string) =>
    invoke<AgentTask[]>('agent_list_tasks', { agent_id: agentId }),
  agentUpdateTaskPriority: (taskId: string, priority: number) =>
    invoke<void>('agent_update_task_priority', { task_id: taskId, priority }),
  agentListTraces: (agentId: string) =>
    invoke<AgentTrace[]>('agent_list_traces', { agent_id: agentId }),
  agentAddTrace: (trace: Partial<AgentTrace>) =>
    invoke<void>('agent_add_trace', { ...trace }),

  // Health & Diagnostics
  healthGetStatus: () => invoke<HealthStatusResponse>('health_get_status'),
  healthLogCheck: (checkType: string, status: string, details?: string) =>
    invoke<void>('health_log_check', { checkType, status, details }),
  diagnosticsGenerateBundle: () =>
    invoke<DiagnosticBundleResponse>('diagnostics_generate_bundle'),

  // CLAUDE.md
  claudeMdRead: (projectPath: string) =>
    invoke<{
      success: boolean;
      content?: string;
      exists?: boolean;
      error?: string;
    }>('claude_md_read', { projectPath }),
  claudeMdSave: (projectPath: string, content: string) =>
    invoke<{ success: boolean; error?: string }>('claude_md_save', {
      projectPath,
      content,
    }),

  // AI Runtime Orchestration
  aiListProviders: () => invoke<AiProviderResponse[]>('ai_list_providers'),
  aiListModels: (provider: string) =>
    invoke<AiModelResponse[]>('ai_list_models', { provider }),
  aiGetHealthStatus: () => invoke<DynamicApiValue>('ai_get_health_status'),

  // Transwarp Nexus & Learning Loop
  rtk_optimize_context: (prompt: string) =>
    invoke<RtkOptimizationResponse>('rtk_optimize_context', { prompt }),
  ai_trigger_evolution: () => invoke<DiscoveryResult[]>('ai_trigger_evolution'),
  aiSwitchModelPlan: (planId: string) =>
    invoke<void>('ai_switch_model_plan', { plan_id: planId }),
  aiRecordFeedback: (feedback: Record<string, unknown>) =>
    invoke<{ success: boolean }>('ai_record_feedback', { ...feedback }),

  onModelPlanSwitched: (
    callback: (event: {
      old_plan: string;
      new_plan: string;
      health_score: number;
    }) => void
  ): Promise<UnlistenFn> =>
    listen<{ old_plan: string; new_plan: string; health_score: number }>(
      'model-plan-switched',
      (event) => callback(event.payload)
    ),

  onAiEvolutionCompleted: (
    callback: (discoveries: DiscoveryResult[]) => void
  ): Promise<UnlistenFn> =>
    listen<DiscoveryResult[]>('ai-evolution-completed', (event) =>
      callback(event.payload)
    ),

  onOptimizationStatsUpdated: (
    callback: (stats: OptimizationStatsResponse) => void
  ): Promise<UnlistenFn> =>
    listen<OptimizationStatsResponse>('optimization-stats-updated', (event) =>
      callback(event.payload)
    ),
  onAiLearningCaptured: (
    callback: (data: AiLearningPayload) => void
  ): Promise<UnlistenFn> =>
    listen<AiLearningPayload>('ai-learning-captured', (event) =>
      callback(event.payload)
    ),

  // GSD Engine
  gsdCreatePlan: (taskId: string, title: string) =>
    invoke<GsdPlan>('gsd_create_plan', { taskId, title }),
  gsdAddPhase: (planId: string, title: string) =>
    invoke<GsdPhase>('gsd_add_phase', { planId, title }),
  gsdAddStep: (
    planId: string,
    phaseId: string,
    title: string,
    description: string
  ) => invoke<GsdStep>('gsd_add_step', { planId, phaseId, title, description }),
  gsdExecutePlan: (planId: string, dryRun?: boolean) =>
    invoke<void>('gsd_execute_plan', { planId, dryRun }),
  gsdRespondToCheckpoint: (stepId: string, response: string) =>
    invoke<void>('gsd_respond_to_checkpoint', { stepId, response }),
  onGsdExecutionEvent: (
    callback: (event: GsdExecutionEvent) => void
  ): Promise<UnlistenFn> =>
    listen<GsdExecutionEvent>('gsd-execution-event', (event) =>
      callback(event.payload)
    ),
  onGsdPhaseUpdated: (
    callback: (phase: GsdPhase) => void
  ): Promise<UnlistenFn> =>
    listen<GsdPhase>('gsd-phase-updated', (event) => callback(event.payload)),
  onGsdStepUpdated: (callback: (step: GsdStep) => void): Promise<UnlistenFn> =>
    listen<GsdStep>('gsd-step-updated', (event) => callback(event.payload)),
  onGsdInsight: (
    callback: (insight: NeuralInsight) => void
  ): Promise<UnlistenFn> =>
    listen<NeuralInsight>('gsd-insight', (event) => callback(event.payload)),
  onGsdApprovalRequested: (
    callback: (approval: GsdApprovalRequest) => void
  ): Promise<UnlistenFn> =>
    listen<GsdApprovalRequest>('gsd-approval-requested', (event) =>
      callback(event.payload)
    ),
  onGsdSyncEvent: (
    callback: (event: DynamicApiValue) => void
  ): Promise<UnlistenFn> =>
    listen<DynamicApiValue>('gsd-sync-event', (event) =>
      callback(event.payload)
    ),
  gsdRespondToApproval: (approvalId: string, response: string) =>
    invoke<void>('gsd_respond_to_approval', { approvalId, response }),
  gsdGetGovernanceStatus: () =>
    invoke<SwarmPolicy>('gsd_get_governance_status'),
  gsdGetPersonas: () => invoke<SwarmPersona[]>('gsd_get_personas'),
  gsdSyncMemory: () => invoke<number>('gsd_sync_memory'),
  gsdUpdatePolicy: (policy: SwarmPolicy) =>
    invoke<void>('gsd_update_policy', { policy }),
  gsdListTools: () => invoke<ToolInfo[]>('gsd_list_tools'),
  gsdIdentifyRefactors: () => invoke<string>('gsd_identify_refactors'),
  gsdApplyRefactor: (finding: DiagnosticResult, dryRun?: boolean) =>
    invoke<string>('gsd_apply_refactor', { finding, dryRun }),
  gsdGetRefactorDetails: (symbolName: string) =>
    invoke<string>('gsd_get_refactor_details', { symbolName }),
  gsdSwarmQueryMemory: (query: string, patternType?: string, limit?: number) =>
    invoke<SwarmKnowledge[]>('gsd_swarm_query_memory', {
      query,
      patternType,
      limit,
    }),
  gsdSwarmRecordPattern: (
    patternType: string,
    patternKey: string,
    content: string,
    metadata?: string
  ) =>
    invoke<void>('gsd_swarm_record_pattern', {
      patternType,
      patternKey,
      content,
      metadata,
    }),
  gsdStartAutomaticSync: () => invoke<void>('gsd_start_automatic_sync'),
  gsdStopAutomaticSync: () => invoke<void>('gsd_stop_automatic_sync'),
  gsdGetSyncStatus: () => invoke<boolean>('gsd_get_sync_status'),
  gsdQuantumSyncStart: () => invoke<void>('gsd_quantum_sync_start'),
  gsdStartDistributedDiscovery: () =>
    invoke<void>('gsd_start_distributed_discovery'),
  gsdStopDistributedDiscovery: () =>
    invoke<void>('gsd_stop_distributed_discovery'),
  gsdGetDistributedNodes: () =>
    invoke<DistributedNode[]>('gsd_get_distributed_nodes'),
  gsdQuoteRemoteToolExecution: (capability: string, baseCostCredits?: number) =>
    invoke<RemoteToolBid[]>('gsd_quote_remote_tool_execution', {
      capability,
      baseCostCredits,
    }),
  gsdApplyDistributedCreditDelta: (
    nodeId: string,
    creditDelta: number,
    utilization?: number
  ) =>
    invoke<DistributedNode>('gsd_apply_distributed_credit_delta', {
      nodeId,
      creditDelta,
      utilization,
    }),

  // Vector Engine
  vectorSearch: (query: string, limit?: number, projectPath?: string) =>
    invoke<VectorSearchResult[]>('vector_search', {
      query,
      limit,
      project_path: projectPath,
    }),
  vectorGetStatus: () => invoke<VectorIndexStatus>('vector_get_status'),
  vectorAddChunks: (chunks: VectorChunk[]) =>
    invoke<{ success: boolean }>('vector_add_chunks', { chunks }),
  vectorIndexProject: (projectPath: string) =>
    invoke<{ success: boolean; error?: string }>('vector_index_project', {
      project_path: projectPath,
    }),
  vectorIndexKnowledge: () =>
    invoke<{ success: boolean; error?: string }>('vector_index_knowledge'),
  vectorIndexSession: (summary: string, ptyId: string, projectPath?: string) =>
    invoke<{ success: boolean; error?: string }>('vector_index_session', {
      summary,
      ptyId,
      projectPath,
    }),

  // Swarm Messaging
  broadcastAgentMessage: (message: AgentMessage) =>
    invoke<void>('broadcast_agent_message', { message }),
  getAgentMessages: (limit?: number) =>
    invoke<AgentMessage[]>('get_agent_messages', { limit }),
  onAgentMessage: (
    callback: (message: AgentMessage) => void
  ): Promise<UnlistenFn> =>
    listen<AgentMessage>('agent-message', (event) => callback(event.payload)),

  createSwarmSnapshot: (_cwd: string, name: string, handoffNotes?: string) =>
    invoke<string>('create_swarm_snapshot_file', { name, handoffNotes }),

  hydrateSwarmFromSnapshots: (projectPath: string) =>
    invoke<number>('hydrate_swarm_from_snapshots', { projectPath }),

  getSwarmSnapshots: (projectPath?: string) =>
    invoke<SwarmSnapshot[]>('get_swarm_snapshots', {
      project_path: projectPath,
    }),

  createSnapshotWorkspace: (snapshotId: string) =>
    invoke<string>('create_snapshot_workspace', { snapshot_id: snapshotId }),

  // Brainstorm Companion
  gsdListSeeds: (cwd: string) => invoke<GsdSeed[]>('gsd_list_seeds', { cwd }),
  gsdPlantSeed: (cwd: string, seed: GsdSeed) =>
    invoke<void>('gsd_plant_seed', { cwd, seed }),
  gsdUpdateSeedStatus: (cwd: string, seedId: string, status: string) =>
    invoke<void>('gsd_update_seed_status', { cwd, seed_id: seedId, status }),
  kspecListDrafts: (cwd: string) =>
    invoke<KSpecDraft[]>('kspec_list_drafts', { cwd }),
  kspecWriteDraft: (cwd: string, moduleId: string, content: string) =>
    invoke<void>('kspec_write_draft', { cwd, module_id: moduleId, content }),
  brainstormLoadCanvas: (cwd: string) =>
    invoke<BrainstormCanvas>('brainstorm_load_canvas', { cwd }),
  brainstormSaveCanvas: (cwd: string, canvas: BrainstormCanvas) =>
    invoke<void>('brainstorm_save_canvas', { cwd, canvas }),
  brainstormAgenticSketch: (
    cwd: string,
    baseId: string,
    baseTitle: string,
    baseContent: string
  ) =>
    invoke<BrainstormCanvasNode>('brainstorm_agentic_sketch', {
      cwd,
      baseId,
      baseTitle,
      baseContent,
    }),
  brainstormArchitectReview: (
    cwd: string,
    baseId: string,
    baseType: string,
    baseTitle: string,
    baseContent: string
  ) =>
    invoke<BrainstormCanvasNode>('brainstorm_architect_review', {
      cwd,
      baseId,
      baseType,
      baseTitle,
      baseContent,
    }),
  brainstormSaveTopology: (cwd: string, content: string) =>
    invoke<{ success: boolean; error?: string }>('brainstorm_save_topology', {
      cwd,
      content,
    }),

  // Health Checks
  claudeCheck: () => invoke<CheckToolResponse>('claude_check'),
  geminiCheck: () => invoke<CheckToolResponse>('gemini_check'),
  codexCheck: () => invoke<CheckToolResponse>('codex_check'),
  opencodeCheck: () => invoke<CheckToolResponse>('opencode_check'),
  aiderCheck: () => invoke<CheckToolResponse>('aider_check'),
  gsdCheck: () => invoke<CheckToolResponse>('gsd_check'),

  // Installations
  claudeInstall: () =>
    invoke<{ success: boolean; error?: string }>('claude_install'),
  geminiInstall: () =>
    invoke<{ success: boolean; error?: string }>('gemini_install'),
  codexInstall: () =>
    invoke<{ success: boolean; error?: string }>('codex_install'),
  opencodeInstall: () =>
    invoke<{ success: boolean; error?: string }>('opencode_install'),
  aiderInstall: () =>
    invoke<{ success: boolean; error?: string }>('aider_install'),
  gsdInstall: () => invoke<{ success: boolean; error?: string }>('gsd_install'),
  beadsInstall: () =>
    invoke<{ success: boolean; error?: string }>('beads_install'),
  gitInstall: () => invoke<{ success: boolean; error?: string }>('git_install'),
  nodeInstall: () =>
    invoke<{ success: boolean; error?: string }>('node_install'),
  pythonInstall: () =>
    invoke<{ success: boolean; error?: string }>('python_install'),

  readClipboardImage: (): Promise<{
    success: boolean;
    hasImage?: boolean;
    path?: string;
    error?: string;
  }> => invoke('read_clipboard_image'),
  gsdGetSynapticMetrics: () =>
    invoke<{ feedbackLoops: number; activeOptimizations: number; cognitiveLoad: number; swarmCohesion: number }>('gsd_get_synaptic_metrics'),
  gsdTriggerExpansionLoop: (loopType: string) =>
    invoke<void>('gsd_trigger_expansion_loop', { loopType }),
  gsdExecuteProactiveAudit: (projectPath: string) =>
    invoke<ArchitectAuditReport>('gsd_execute_proactive_audit', { projectPath }),
  gsdGetArchitectStatus: () =>
    invoke<ArchitectAuditReport>('gsd_get_architect_status'),
  gsdProposePolicyRefinement: (report: ArchitectAuditReport) =>
    invoke<PolicyProposal[]>('gsd_propose_policy_refinement', { report }),
  gsdApplyPolicyProposal: (proposalId: string) =>
    invoke<void>('gsd_apply_policy_proposal', { proposalId }),
  gsdSpawnShadowTest: (personaId: string, mutationType: string, mutationValue: string) =>
    invoke<string>('gsd_spawn_shadow_test', { personaId, mutationType, mutationValue }),
  gsdGetPersonaProposals: () =>
    invoke<PersonaEvolutionProposal[]>('gsd_get_persona_proposals'),
  gsdApplyPersonaEvolution: (proposalId: string) =>
    invoke<void>('gsd_apply_persona_evolution', { proposalId }),
  borgRecordLearning: (projectName: string, title: string, content: string) =>
    invoke<void>('borg_record_learning', { projectName, title, content }),
  borgSyncMemory: () =>
    invoke<number>('borg_sync_memory'),
  gsdSpawnRemoteWorker: (taskDescription: string) =>
    invoke<string>('gsd_spawn_remote_worker', { taskDescription }),
};
