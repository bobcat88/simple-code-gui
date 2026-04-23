import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

export interface SessionInfo {
  id: String;
  cwd: String;
  backend: String;
  session_id?: String;
  spawned_at: number;
}

export const tauriIpc = {
  spawnSession: (cwd: string, backend: string, sessionId?: string, slug?: string, rows?: number, cols?: number) => 
    invoke<string>('spawn_session', { cwd, backend, session_id: sessionId, slug, rows, cols }),
    
  writeToPty: (id: string, data: string) => 
    invoke<void>('write_to_pty', { id, data }),
    
  resizePty: (id: string, cols: number, rows: number) => 
    invoke<void>('resize_pty', { id, cols, rows }),
    
  killSession: (id: string) => 
    invoke<void>('kill_session', { id }),
    
  setPtyBackend: (id: string, backend: string) => 
    invoke<void>('set_pty_backend', { id, backend }),
    
  getSettings: () => 
    invoke<any>('get_settings'),
    
  saveSettings: (settings: any) => 
    invoke<void>('save_settings', { settings }),
    
  getWorkspace: () => 
    invoke<any>('get_workspace'),
    
  saveWorkspace: (workspace: any) => 
    invoke<void>('save_workspace', { workspace }),
    
  onPtyData: (id: string, callback: (data: string) => void): Promise<UnlistenFn> => 
    listen<string>(`pty-data-${id}`, (event) => callback(event.payload)),
    
  onPtyExit: (id: string, callback: (code: number) => void): Promise<UnlistenFn> => 
    listen<number>(`pty-exit-${id}`, (event) => callback(event.payload)),
    
  onPtyRecreated: (callback: (data: { oldId: string, newId: string, backend: string }) => void): Promise<UnlistenFn> => 
    listen<{ oldId: string, newId: string, backend: string }>('pty-recreated', (event) => callback(event.payload)),
    
  onPtyTitle: (id: string, callback: (title: string) => void): Promise<UnlistenFn> => 
    listen<string>(`pty-title-${id}`, (event) => callback(event.payload)),
    
  onPtyPath: (id: string, callback: (path: string) => void): Promise<UnlistenFn> => 
    listen<string>(`pty-path-${id}`, (event) => callback(event.payload)),
    
  onPtyPid: (id: string, callback: (pid: string) => void): Promise<UnlistenFn> => 
    listen<string>(`pty-pid-${id}`, (event) => callback(event.payload)),
    
  onSettingsChanged: (callback: (settings: any) => void): Promise<UnlistenFn> =>
    listen<any>('settings-changed', (event) => callback(event.payload)),
    
  onWorkspaceChanged: (callback: (workspace: any) => void): Promise<UnlistenFn> =>
    listen<any>('workspace-changed', (event) => callback(event.payload)),

  selectDirectory: () =>
    invoke<string | null>('select_directory'),

  // Extensions
  extensionsFetchRegistry: (forceRefresh: boolean) =>
    invoke<any>('extensions_fetch_registry', { forceRefresh }),
  extensionsGetInstalled: () =>
    invoke<any[]>('extensions_get_installed'),
  extensionsGetCustomUrls: () =>
    invoke<string[]>('extensions_get_custom_urls'),
  extensionsInstallSkill: (extension: any, scope: string) =>
    invoke<any>('extensions_install_skill', { extension, scope }),
  extensionsInstallMcp: (extension: any) =>
    invoke<any>('extensions_install_mcp', { extension }),
  extensionsRemove: (id: string) =>
    invoke<any>('extensions_remove', { id }),
  extensionsEnableForProject: (id: string, projectPath: string) =>
    invoke<void>('extensions_enable_for_project', { id, projectPath }),
  extensionsDisableForProject: (id: string, projectPath: string) =>
    invoke<void>('extensions_disable_for_project', { id, projectPath }),
  extensionsFetchFromUrl: (url: string) =>
    invoke<any | null>('extensions_fetch_from_url', { url }),
  extensionsAddCustomUrl: (url: string) =>
    invoke<void>('extensions_add_custom_url', { url }),
  extensionsRemoveCustomUrl: (url: string) =>
    invoke<void>('extensions_remove_custom_url', { url }),
  extensionsSetConfig: (id: string, config: any) =>
    invoke<void>('extensions_set_config', { id, config }),
  extensionsCheckUpdates: () =>
    invoke<any[]>('extensions_check_updates'),

  // MCP Bridge
  mcpListTools: (serverName: string) =>
    invoke<any>('mcp_list_tools', { serverName }),
  mcpCallTool: (serverName: string, toolName: string, args: any) =>
    invoke<any>('mcp_call_tool', { serverName, toolName, args }),
  mcpListResources: (serverName: string) =>
    invoke<any>('mcp_list_resources', { serverName }),
  mcpReadResource: (serverName: string, uri: string) =>
    invoke<any>('mcp_read_resource', { serverName, uri }),
  mcpLoadConfig: () =>
    invoke<void>('mcp_load_config'),
  mcpGetServers: () =>
    invoke<any[]>('get_registered_mcp_servers'),

  discoverSessions: (projectPath: string, backend?: string) =>
    invoke<any[]>('discover_sessions', { projectPath, backend }),

  selectFile: () =>
    invoke<string | null>('select_file'),

  listDirs: (path: string) =>
    invoke<string[]>('list_dirs', { path }),

  windowMinimize: () =>
    invoke<void>('window_minimize'),

  windowMaximize: () =>
    invoke<void>('window_maximize'),

  windowClose: () =>
    invoke<void>('window_close'),

  windowIsMaximized: () =>
    invoke<boolean>('window_is_maximized'),
    
  logTokenEvent: (transaction: any, savedTokens?: number) =>
    invoke<void>('log_token_event', { transaction, saved_tokens: savedTokens }),

  getTokenStats: (projectId?: string) =>
    invoke<any>('get_token_stats', { projectId }),

  getTokenHistory: (filters?: any) =>
    invoke<any>('get_token_history', { filters }),

  // Voice & XTTS
  voiceCheckTTS: () => invoke<any>('voice_check_tts'),
  voiceFetchCatalog: (forceRefresh?: boolean) => invoke<any[]>('voice_fetch_catalog', { forceRefresh }),
  voiceGetInstalled: () => invoke<string[]>('voice_get_installed'),
  voiceDownloadFromCatalog: (voiceKey: string) => invoke<any>('voice_download_from_catalog', { voiceKey }),
  voiceImportCustom: () => invoke<any>('voice_import_custom'),
  voiceOpenCustomFolder: () => invoke<void>('voice_open_custom_folder'),
  voiceSaveSettings: (settings: any) => invoke<void>('voice_save_settings', { settings }),
  voiceSpeak: (text: string, voice?: string, speed?: number) => invoke<any>('voice_speak', { text, voice, speed }),
  voiceStop: () => invoke<void>('voice_stop'),
  voiceInstallPiper: () => invoke<any>('voice_install_piper'),
  voiceInstallVoice: (modelId: string) => invoke<any>('voice_install_voice', { model_id: modelId }),
  
  xttsGetVoices: () => invoke<any[]>('xtts_get_voices'),
  xttsGetSampleVoices: () => invoke<any[]>('xtts_get_sample_voices'),
  xttsGetLanguages: () => invoke<any[]>('xtts_get_languages'),
  xttsCheck: () => invoke<any>('xtts_check'),
  xttsDownloadSampleVoice: (voiceId: string) => invoke<any>('xtts_download_sample_voice', { voiceId }),
  xttsDeleteVoice: (voiceId: string) => invoke<any>('xtts_delete_voice', { voiceId }),
  xttsInstall: () => invoke<any>('xtts_install'),
  xttsCreateVoice: (audioPath: string, name: string, language: string) => invoke<any>('xtts_create_voice', { audioPath, name, language }),

  // Auto-accept
  getAutoAcceptStatus: (ptyId: string) => invoke<boolean>('get_auto_accept_status', { ptyId }),
  setAutoAccept: (ptyId: string, enabled: boolean) => invoke<void>('set_auto_accept', { ptyId, enabled }),

  projectScan: (path: string, options: any) =>
    invoke<any>('project_scan', { path, options }),

  projectGenerateProposal: (scan: any, preset: string, projectName: string, taskBackend: string) =>
    invoke<any>('project_generate_proposal', { scan, preset, project_name: projectName, task_backend: taskBackend }),

  projectApplyProposal: (proposal: any) =>
    invoke<string[]>('project_apply_proposal', { proposal }),

  scanProjectIntelligence: (path: string) =>
    invoke<any>('scan_project_intelligence', { cwd: path }),

  onProjectInitializationProgress: (callback: (progress: any) => void): Promise<UnlistenFn> =>
    listen<any>('project-initialization-progress', (event) => callback(event.payload)),

  onInstallProgress: (callback: (progress: any) => void): Promise<UnlistenFn> =>
    listen<any>('install-progress', (event) => callback(event.payload)),

  // Orchestration (Beads/Kspec)
  kspecDispatchStatus: (cwd: string) =>
    invoke<any>('kspec_dispatch_status', { cwd }),
  kspecDispatchStart: (cwd: string) =>
    invoke<{ success: boolean; job_id?: string; error?: string }>('kspec_dispatch_start', { cwd }),
  projectScanAsync: (path: string) =>
    invoke<{ success: boolean; job_id?: string; error?: string }>('project_scan_async', { path }),
  setCurrentProject: (path: string | null) =>
    invoke<void>('set_current_project', { path }),
  kspecDispatchStop: (cwd: string) =>
    invoke<{ success: boolean; error?: string }>('kspec_dispatch_stop', { cwd }),
  beadsList: (cwd: string) =>
    invoke<any>('beads_list', { cwd }),
  beadsStart: (cwd: string, taskId: string) =>
    invoke<any>('beads_start', { cwd, task_id: taskId }),
  beadsComplete: (cwd: string, taskId: string) =>
    invoke<any>('beads_complete', { cwd, task_id: taskId }),

  // Approval Workflow
  onApprovalRequest: (callback: (request: any) => void): Promise<UnlistenFn> =>
    listen('approval-request', (event: any) => callback(event.payload)),
  onApprovalResolved: (callback: (actionId: string) => void): Promise<UnlistenFn> =>
    listen('approval-resolved', (event: any) => callback(event.payload)),
  respondToApproval: (response: any) =>
    invoke<{ success: boolean }>('respond_to_approval', { response }),
  getPendingApprovals: (cwd: string) =>
    invoke<any[]>('get_pending_approvals', { cwd }),

  // Background Jobs
  jobsCreate: (jobType: string, payload: any) =>
    invoke<string>('jobs_create', { job_type: jobType, payload }),
  jobsGet: (id: string) =>
    invoke<any>('jobs_get', { id }),
  jobsList: (limit?: number) =>
    invoke<any[]>('jobs_list', { limit }),
  onJobProgress: (callback: (data: { id: string, progress: number, message: string }) => void) =>
    listen<{ id: string, progress: number, message: string }>('job-progress', (event) => callback(event.payload)),
  onJobStatusChanged: (callback: (id: string) => void) =>
    listen<string>('job-status-changed', (event) => callback(event.payload)),

  // Activity Feed
  activityGetRecent: (limit?: number) =>
    invoke<any[]>('activity_get_recent', { limit }),
  activityLogInfo: (source: string, message: string, metadata?: string) =>
    invoke<void>('activity_log_info', { source, message, metadata }),
  onActivityEvent: (callback: (event: any) => void) =>
    listen<any>('activity-event', (event) => callback(event.payload)),

  // Agents
  agentRegister: (agent: any) =>
    invoke<void>('agent_register', { agent }),
  agentList: () =>
    invoke<any[]>('agent_list'),
  agentUpdateStatus: (id: string, status: string) =>
    invoke<void>('agent_update_status', { id, status }),
  onAgentStatusChanged: (callback: (data: { id: string, status: string }) => void) =>
    listen<{ id: string, status: string }>('agent-status-changed', (event) => callback(event.payload)),
  onAgentRegistered: (callback: (agent: any) => void) =>
    listen<any>('agent-registered', (event) => callback(event.payload)),

  // Health & Diagnostics
  healthGetStatus: () =>
    invoke<any>('health_get_status'),
  healthLogCheck: (checkType: string, status: string, details?: string) =>
    invoke<void>('health_log_check', { checkType, status, details }),
  diagnosticsGenerateBundle: () =>
    invoke<any>('diagnostics_generate_bundle'),

  // CLAUDE.md
  claudeMdRead: (projectPath: string) =>
    invoke<{ success: boolean; content?: string; exists?: boolean; error?: string }>('claude_md_read', { projectPath }),
  claudeMdSave: (projectPath: string, content: string) =>
    invoke<{ success: boolean; error?: string }>('claude_md_save', { projectPath, content }),
};
