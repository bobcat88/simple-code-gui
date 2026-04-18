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
  spawnSession: (cwd: string, backend: string, sessionId?: string, slug?: string) => 
    invoke<string>('spawn_session', { cwd, backend, session_id: sessionId, slug }),
    
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
  extensionsSetConfig: (id: string, config: any) =>
    invoke<void>('extensions_set_config', { id, config }),
};
