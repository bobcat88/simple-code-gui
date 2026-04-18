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
};
