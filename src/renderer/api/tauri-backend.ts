/**
 * Tauri Backend Implementation
 */

import {
  ExtendedApi,
  Settings,
  Workspace,
  Session,
  PtyDataCallback,
  PtyExitCallback,
  PtyRecreatedCallback,
  ApiOpenSessionCallback,
  Unsubscribe,
  BackendId
} from './types'
import { tauriIpc } from '../lib/tauri-ipc'

export class TauriBackend implements ExtendedApi {
  // PTY Management
  async spawnPty(cwd: string, sessionId?: string, model?: string, backend?: BackendId): Promise<string> {
    // Note: Rust backend expects backend as a string, sessionId and model are ignored for now or can be passed as args
    const args: string[] = [];
    if (sessionId) args.push('--session', sessionId);
    if (model) args.push('--model', model);
    
    return tauriIpc.spawnSession(cwd, backend || 'aider', args);
  }

  killPty(id: string): void {
    tauriIpc.killSession(id);
  }

  writePty(id: string, data: string): void {
    tauriIpc.writeToPty(id, data);
  }

  resizePty(id: string, cols: number, rows: number): void {
    tauriIpc.resizePty(id, cols, rows);
  }

  onPtyData(id: string, callback: PtyDataCallback): Unsubscribe {
    let unlisten: (() => void) | undefined;
    tauriIpc.onPtyData(id, callback).then(fn => unlisten = fn);
    return () => unlisten?.();
  }

  onPtyExit(id: string, callback: PtyExitCallback): Unsubscribe {
    let unlisten: (() => void) | undefined;
    tauriIpc.onPtyExit(id, callback).then(fn => unlisten = fn);
    return () => unlisten?.();
  }

  onPtyRecreated(callback: PtyRecreatedCallback): Unsubscribe {
    // Not implemented in Rust yet
    return () => {};
  }

  async setPtyBackend(id: string, backend: BackendId): Promise<void> {
    // Not implemented in Rust yet
  }

  setAutoAccept(id: string, enabled: boolean): void {}
  async getAutoAcceptStatus(id: string): Promise<boolean> { return false; }

  // Session Management
  async discoverSessions(projectPath: string, backend?: BackendId): Promise<Session[]> {
    // TODO: Implement in Rust
    return [];
  }

  // Workspace Management
  async getWorkspace(): Promise<Workspace> {
    // For now, return a default workspace or fetch from localStorage
    const saved = localStorage.getItem('tauri-workspace');
    if (saved) return JSON.parse(saved);
    return { projects: [], categories: [] };
  }

  async saveWorkspace(workspace: Workspace): Promise<void> {
    localStorage.setItem('tauri-workspace', JSON.stringify(workspace));
  }

  // Settings Management
  async getSettings(): Promise<Settings> {
    const saved = localStorage.getItem('tauri-settings');
    if (saved) return JSON.parse(saved);
    return {} as Settings;
  }

  async saveSettings(settings: Settings): Promise<void> {
    localStorage.setItem('tauri-settings', JSON.stringify(settings));
  }

  // Project Management
  async addProject(): Promise<string | null> {
    // TODO: Use Tauri dialog
    return null;
  }

  async addProjectsFromParent(): Promise<Array<{ path: string; name: string }> | null> {
    return null;
  }

  // TTS
  async ttsInstallInstructions(projectPath: string): Promise<{ success: boolean }> { return { success: false }; }
  async ttsSpeak(text: string): Promise<{ success: boolean; error?: string }> { return { success: false }; }
  async ttsStop(): Promise<{ success: boolean }> { return { success: false }; }

  // Events
  onApiOpenSession(callback: ApiOpenSessionCallback): Unsubscribe {
    return () => {};
  }

  // Extended API
  async selectDirectory(): Promise<string | null> { return null; }
  async selectExecutable(): Promise<string | null> { return null; }
  windowMinimize(): void {}
  windowMaximize(): void {}
  windowClose(): void {}
  async windowIsMaximized(): Promise<boolean> { return false; }
  getPathForFile(file: File): string { return (file as any).path || ''; }
  async readClipboardImage(): Promise<{ success: boolean; hasImage?: boolean; path?: string; error?: string }> { return { success: false }; }
  async getVersion(): Promise<string> { return '2.0.0-tauri'; }
  async isDebugMode(): Promise<boolean> { return true; }
  async refresh(): Promise<void> { window.location.reload(); }
  async openExternal(url: string): Promise<void> { window.open(url, '_blank'); }
  debugLog(message: string): void { console.log('[Tauri]', message); }
}
