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
    
  logTokenEvent: (projectId: string | null, input: number, output: number, saved: number, model: string) =>
    invoke<void>('log_token_event', { projectId, input, output, saved, model }),

  getTokenStats: (projectId?: string) =>
    invoke<any>('get_token_stats', { projectId }),

  projectScan: (path: string, options: any) =>
    invoke<any>('project_scan', { path, options }),

  projectGenerateProposal: (scan: any, preset: string, projectName: string, taskBackend: string) =>
    invoke<any>('project_generate_proposal', { scan, preset, project_name: projectName, task_backend: taskBackend }),

  projectApplyProposal: (proposal: any) =>
    invoke<string[]>('project_apply_proposal', { proposal }),

  scanProjectIntelligence: (path: string) =>
    invoke<any>('scan_project_intelligence', { cwd: path }),

  // Orchestration (Beads/Kspec)
  kspecDispatchStatus: (cwd: string) =>
    invoke<any>('kspec_dispatch_status', { cwd }),
  kspecDispatchStart: (cwd: string) =>
    invoke<{ success: boolean; error?: string }>('kspec_dispatch_start', { cwd }),
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

  // Voice
  voiceCheckTts: () =>
    invoke<any>('voice_check_tts'),
  voiceInstallPiper: () =>
    invoke<any>('voice_install_piper'),
  voiceInstallVoice: (modelId: string) =>
    invoke<any>('voice_install_voice', { model_id: modelId }),
  voiceGetInstalled: () =>
    invoke<string[]>('voice_get_installed'),
  voiceSpeak: (text: string, voice?: string, speed?: number) =>
    invoke<any>('voice_speak', { text, voice, speed }),
  voiceStop: () =>
    invoke<void>('voice_stop'),

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

  // Health & Diagnostics
  healthGetStatus: () =>
    invoke<any>('health_get_status'),
  healthLogCheck: (checkType: string, status: string, details?: string) =>
    invoke<void>('health_log_check', { checkType, status, details }),
  diagnosticsGenerateBundle: () =>
    invoke<any>('diagnostics_generate_bundle'),
};
