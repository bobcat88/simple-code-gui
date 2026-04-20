import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { tauriIpc } from './tauri-ipc';

// Shim to provide window.electronAPI functionality using Tauri
export const setupTauriShim = () => {
  (window as any).electronAPI = {
    // PTY Operations
    spawnPty: (cwd: string, sessionId?: string, model?: string, backend: string = 'claude', rows?: number, cols?: number) => 
      tauriIpc.spawnSession(cwd, backend, sessionId, model, rows, cols),
    writePty: (id: string, data: string) => 
      tauriIpc.writeToPty(id, data),
    resizePty: (id: string, cols: number, rows: number) => 
      tauriIpc.resizePty(id, cols, rows),
    killPty: (id: string) => 
      tauriIpc.killSession(id),
    
    // PTY Events
    onPtyData: (id: string, callback: (data: string) => void) => {
      let unlisten: (() => void) | undefined;
      tauriIpc.onPtyData(id, callback).then(u => unlisten = u);
      return () => unlisten?.();
    },
    onPtyExit: (id: string, callback: (code: number) => void) => {
      let unlisten: (() => void) | undefined;
      tauriIpc.onPtyExit(id, callback).then(u => unlisten = u);
      return () => unlisten?.();
    },
    onPtyRecreated: (callback: any) => () => {},
    onApiOpenSession: (callback: any) => () => {},

    // Settings
    getSettings: () => tauriIpc.getSettings(),
    saveSettings: (settings: any) => tauriIpc.saveSettings(settings),
    onSettingsChanged: (callback: (settings: any) => void) => {
      let unlisten: (() => void) | undefined;
      tauriIpc.onSettingsChanged(callback).then(u => unlisten = u);
      return () => unlisten?.();
    },

    // Workspace
    getWorkspace: () => tauriIpc.getWorkspace(),
    saveWorkspace: (workspace: any) => tauriIpc.saveWorkspace(workspace),
    onWorkspaceChanged: (callback: (workspace: any) => void) => {
      let unlisten: (() => void) | undefined;
      tauriIpc.onWorkspaceChanged(callback).then(u => unlisten = u);
      return () => unlisten?.();
    },

    // Window Controls
    windowMinimize: () => tauriIpc.windowMinimize(),
    windowMaximize: () => tauriIpc.windowMaximize(),
    windowClose: () => tauriIpc.windowClose(),
    windowIsMaximized: () => tauriIpc.windowIsMaximized(),
    
    // Dialogs
    selectDirectory: () => tauriIpc.selectDirectory(),
    selectExecutable: () => tauriIpc.selectFile(),
    getPathForFile: (file: File) => (file as any).path || file.name,
    addProject: () => tauriIpc.selectDirectory(),
    addProjectsFromParent: async () => {
      const parentPath = await tauriIpc.selectDirectory();
      if (!parentPath) return null;
      try {
        const dirs = await tauriIpc.listDirs(parentPath);
        return dirs.map(dir => ({
          path: `${parentPath}/${dir}`,
          name: dir
        }));
      } catch (e) {
        console.error('Failed to list directories', e);
        return [{ path: parentPath, name: parentPath.split('/').pop() || parentPath }];
      }
    },
    
    // Installation Status (Stubs)
    claudeCheck: async () => ({ installed: true, version: '0.29.0' }),
    nodeInstall: async () => ({ success: true }),
    claudeInstall: async () => ({ success: true }),
    gitInstall: async () => ({ success: true }),
    
    // Extensions
    extensionsFetchRegistry: (force: boolean) => tauriIpc.extensionsFetchRegistry(force),
    extensionsGetInstalled: () => tauriIpc.extensionsGetInstalled(),
    extensionsInstallSkill: (ext: any, scope: string) => tauriIpc.extensionsInstallSkill(ext, scope),
    extensionsInstallMcp: (ext: any) => tauriIpc.extensionsInstallMcp(ext),
    extensionsRemove: (id: string) => tauriIpc.extensionsRemove(id),
    extensionsEnableForProject: (id: string, path: string) => tauriIpc.extensionsEnableForProject(id, path),
    extensionsDisableForProject: (id: string, path: string) => tauriIpc.extensionsDisableForProject(id, path),
    extensionsGetCustomUrls: () => tauriIpc.extensionsGetCustomUrls(),
    extensionsAddCustomUrl: (url: string) => tauriIpc.extensionsAddCustomUrl(url),
    extensionsRemoveCustomUrl: (url: string) => tauriIpc.extensionsRemoveCustomUrl(url),
    extensionsFetchFromUrl: (url: string) => tauriIpc.extensionsFetchFromUrl(url),
    extensionsSetConfig: (id: string, config: any) => tauriIpc.extensionsSetConfig(id, config),
    
    // Updater (Stubs)
    onUpdaterStatus: (callback: any) => () => {},
    downloadUpdate: async () => ({ success: true }),
    installUpdate: async () => {},
    
    // Info
    getVersion: async () => '1.3.58-tauri',
    isDebugMode: async () => false,
    refresh: async () => window.location.reload(),
    
    // Shell
    openExternal: (url: string) => invoke('plugin:shell|open', { path: url }),
    
    // Voice (Native Rust implementation)
    voiceGetSettings: async () => invoke('get_settings').then((s: any) => ({
      ttsVoice: s.ttsVoice,
      ttsEngine: s.ttsEngine,
      ttsSpeed: s.ttsSpeed
    })),
    voiceSaveSettings: (settings: any) => invoke('voice_save_settings', { settings }),
    voiceApplySettings: async (settings: any) => invoke('save_settings', { 
      settings: { ...(await invoke('get_settings') as any), ...settings } 
    }),
    voiceCheckTTS: async () => invoke('voice_check_tts'),
    voiceInstallPiper: async () => invoke('voice_install_piper'),
    voiceInstallVoice: async (voice: string) => invoke('voice_install_voice', { voice }),
    voiceGetInstalled: async () => invoke('voice_get_installed'),
    voiceSpeak: async (text: string, voice?: string, speed?: number) => invoke('voice_speak', { text, voice, speed }),
    voiceStopSpeaking: async () => invoke('voice_stop'),
    xttsGetVoices: async () => [],
    xttsSpeak: async (text: string, voice: string, language: string) => ({ success: false, error: 'XTTS not implemented' }),
    tadaCheck: async () => ({ installed: false }),
    tadaSpeak: async (text: string) => ({ success: false, error: 'TADA not implemented' }),

    // Beads (Native Orchestration)
    beadsCheck: (cwd: string) => invoke('beads_check', { cwd }),
    beadsInit: (cwd: string) => invoke('beads_init', { cwd }),
    beadsList: (cwd: string) => invoke('beads_list', { cwd }),
    beadsShow: (cwd: string, taskId: string) => invoke('beads_show', { cwd, taskId }),
    beadsCreate: (cwd: string, title: string, description?: string, priority?: number, type?: string, tags?: string) => 
      invoke('beads_create', { cwd, title, description, priority, task_type: type, tags }),
    beadsStart: (cwd: string, taskId: string) => invoke('beads_start', { cwd, taskId }),
    beadsComplete: (cwd: string, taskId: string) => invoke('beads_complete', { cwd, taskId }),
    beadsDelete: (cwd: string, taskId: string) => invoke('beads_delete', { cwd, taskId }),
    beadsUpdate: (cwd: string, taskId: string, status?: string, title?: string, description?: string, priority?: number, acceptance_criteria?: any[], traits?: any[]) => 
      invoke('beads_update', { cwd, taskId, status, title, description, priority, acceptance_criteria, traits }),
    beadsWatch: (cwd: string) => invoke('beads_watch', { cwd }),
    beadsUnwatch: (cwd: string) => invoke('beads_unwatch', { cwd }),
    onBeadsTasksChanged: (callback: (data: { cwd: string }) => void) => {
      const unlisten = listen('beads-tasks-changed', (event: any) => callback(event.payload));
      return () => { unlisten.then(fn => fn()); };
    },
    beadsGetTasks: () => invoke('get_beads_tasks'),
    beadsSyncWorkflow: () => invoke('sync_workflow'),

    // Kspec (Native Orchestration)
    kspecCheck: (cwd: string) => invoke('kspec_check', { cwd }),
    kspecInit: (cwd: string) => invoke('kspec_init', { cwd }),
    kspecList: (cwd: string) => invoke('kspec_list', { cwd }),
    kspecShow: (cwd: string, taskId: string) => invoke('kspec_show', { cwd, taskId }),
    kspecCreate: (cwd: string, title: string, description?: string, priority?: number, type?: string, tags?: string[]) => 
      invoke('kspec_create', { cwd, title, description, priority, task_type: type, tags }),
    kspecStart: (cwd: string, taskId: string) => invoke('kspec_start', { cwd, taskId }),
    kspecComplete: (cwd: string, taskId: string) => invoke('kspec_complete', { cwd, taskId }),
    kspecDelete: (cwd: string, taskId: string) => invoke('kspec_delete', { cwd, taskId }),
    kspecUpdate: (cwd: string, taskId: string, status?: string, title?: string, description?: string, priority?: number, acceptance_criteria?: any[], traits?: any[]) => 
      invoke('kspec_update', { cwd, taskId, status, title, description, priority, acceptance_criteria, traits }),
    kspecWatch: (cwd: string) => invoke('kspec_watch', { cwd }),
    kspecUnwatch: (cwd: string) => invoke('kspec_unwatch', { cwd }),
    onKspecTasksChanged: (callback: (data: { cwd: string }) => void) => {
      let unlisten: (() => void) | undefined;
      listen('kspec-tasks-changed', (event: any) => {
        callback(event.payload);
      }).then(u => unlisten = u);
      return () => unlisten?.();
    },
    kspecEnsureDaemon: (cwd: string) => invoke('kspec_ensure_daemon', { cwd }),
    kspecDispatchStatus: (cwd: string) => invoke('kspec_dispatch_status', { cwd }),
    kspecDispatchStart: (cwd: string) => invoke('kspec_dispatch_start', { cwd }),
    kspecDispatchStop: (cwd: string) => invoke('kspec_dispatch_stop', { cwd }),

    // MCP Bridge
    mcpRegisterServer: (config: any) => invoke('register_mcp_server', { config }),
    mcpGetServers: () => invoke('get_registered_mcp_servers'),
    mcpListTools: (serverName: string) => invoke('mcp_list_tools', { serverName }),
    mcpCallTool: (serverName: string, toolName: string, args: any) => invoke('mcp_call_tool', { serverName, toolName, args }),
    mcpListResources: (serverName: string) => invoke('mcp_list_resources', { serverName }),
    mcpReadResource: (serverName: string, uri: string) => invoke('mcp_read_resource', { serverName, uri }),
    mcpLoadConfig: () => invoke('mcp_load_config'),
    discoverSessions: (projectPath: string, backend?: string) => invoke('discover_sessions', { projectPath, backend }),
    onInstallProgress: (callback: (data: any) => void) => {
      let unlisten: (() => void) | undefined;
      listen('install-progress', (event: any) => {
        callback(event.payload);
      }).then(u => unlisten = u);
      return () => unlisten?.();
    },
  };
};
