import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// Shim to provide window.electronAPI functionality using Tauri
export const setupTauriShim = () => {
  (window as any).electronAPI = {
    // PTY Operations
    spawnPty: (cwd: string, sessionId?: string, model?: string, backend: string = 'claude') => 
      invoke('spawn_session', { 
        cwd, 
        backend, 
        session_id: sessionId, 
        slug: model 
      }),
    writePty: (id: string, data: string) => 
      invoke('write_to_pty', { id, data }),
    resizePty: (id: string, cols: number, rows: number) => 
      invoke('resize_pty', { id, cols, rows }),
    killPty: (id: string) => 
      invoke('kill_session', { id }),
    
    // PTY Events
    onPtyData: (id: string, callback: (data: string) => void) => {
      let unlisten: (() => void) | undefined;
      listen(`pty-data-${id}`, (event: any) => {
        callback(event.payload);
      }).then(u => unlisten = u);
      return () => unlisten?.();
    },
    onPtyExit: (id: string, callback: (code: number) => void) => {
      let unlisten: (() => void) | undefined;
      listen(`pty-exit-${id}`, (event: any) => {
        callback(event.payload);
      }).then(u => unlisten = u);
      return () => unlisten?.();
    },

    // Settings
    getSettings: () => invoke('get_settings'),
    saveSettings: (settings: any) => invoke('save_settings', { settings }),

    // Window Controls
    windowMinimize: () => invoke('window_minimize'),
    windowMaximize: () => invoke('window_maximize'),
    windowClose: () => invoke('window_close'),
    windowIsMaximized: () => invoke('window_is_maximized'),
    
    // Installation Status (Stubs)
    claudeCheck: async () => ({ installed: true, version: '0.29.0' }),
    nodeInstall: async () => ({ success: true }),
    claudeInstall: async () => ({ success: true }),
    gitInstall: async () => ({ success: true }),
    
    // Extensions
    extensionsFetchRegistry: (force: boolean) => invoke('extensions_fetch_registry', { force }),
    extensionsGetInstalled: () => invoke('extensions_get_installed'),
    extensionsInstallSkill: (ext: any, scope: string) => invoke('extensions_install_skill', { ext, scope }),
    extensionsInstallMcp: (ext: any) => invoke('extensions_install_mcp', { ext }),
    extensionsRemove: (id: string) => invoke('extensions_remove', { id }),
    extensionsEnableForProject: (id: string, path: string) => invoke('extensions_enable_for_project', { id, path }),
    extensionsDisableForProject: (id: string, path: string) => invoke('extensions_disable_for_project', { id, path }),
    extensionsGetCustomUrls: () => invoke('extensions_get_custom_urls'),
    extensionsAddCustomUrl: (url: string) => invoke('extensions_add_custom_url', { url }),
    extensionsFetchFromUrl: (url: string) => invoke('extensions_fetch_from_url', { url }),
    extensionsSetConfig: (id: string, config: any) => invoke('extensions_set_config', { id, config }),
    
    // Updater (Stubs)
    onUpdaterStatus: (callback: any) => () => {},
    downloadUpdate: async () => ({ success: true }),
    installUpdate: async () => {},
    
    // Info
    getVersion: async () => '1.3.58-tauri',
    
    // Shell
    openExternal: (url: string) => invoke('plugin:shell|open', { path: url }),
    
    // Voice (Native Rust implementation)
    voiceGetSettings: async () => invoke('get_settings').then((s: any) => ({
      ttsVoice: s.tts_voice,
      ttsEngine: s.tts_engine,
      ttsSpeed: s.tts_speed
    })),
    voiceApplySettings: async (settings: any) => invoke('save_settings', { 
      settings: { ...(await invoke('get_settings') as any), ...settings } 
    }),
    voiceGetInstalled: async () => [],
    voiceSpeak: async (text: string) => invoke('voice_speak', { text }),
    voiceStopSpeaking: async () => invoke('voice_stop'),
    xttsGetVoices: async () => [],
    tadaCheck: async () => ({ installed: false }),

    // Beads (Native Orchestration)
    beadsGetTasks: () => invoke('get_beads_tasks'),
    beadsSyncWorkflow: () => invoke('sync_workflow'),

    // MCP Bridge
    mcpRegisterServer: (config: any) => invoke('register_mcp_server', { config }),
    mcpGetServers: () => invoke('get_registered_mcp_servers'),
    mcpListTools: (serverName: string) => invoke('mcp_list_tools', { serverName }),
    mcpCallTool: (serverName: string, toolName: string, args: any) => invoke('mcp_call_tool', { serverName, toolName, args }),
    mcpListResources: (serverName: string) => invoke('mcp_list_resources', { serverName }),
    mcpReadResource: (serverName: string, uri: string) => invoke('mcp_read_resource', { serverName, uri }),
    mcpLoadConfig: () => invoke('mcp_load_config'),
  };
};
