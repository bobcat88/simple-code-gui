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
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

export class TauriBackend implements ExtendedApi {
  // PTY Management
  async spawnPty(cwd: string, sessionId?: string, model?: string, backend?: BackendId): Promise<string> {
    return tauriIpc.spawnSession(cwd, backend || 'claude', sessionId, model);
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
    try {
      return await tauriIpc.getWorkspace();
    } catch (e) {
      console.error('Failed to get workspace from Tauri', e);
      return { projects: [], categories: [], openTabs: [], activeTabId: null };
    }
  }

  async saveWorkspace(workspace: Workspace): Promise<void> {
    try {
      await tauriIpc.saveWorkspace(workspace);
    } catch (e) {
      console.error('Failed to save workspace to Tauri', e);
    }
  }

  // Settings Management
  async getSettings(): Promise<Settings> {
    try {
      return await tauriIpc.getSettings();
    } catch (e) {
      console.error('Failed to get settings from Tauri', e);
      return {} as Settings;
    }
  }

  async saveSettings(settings: Settings): Promise<void> {
    try {
      await tauriIpc.saveSettings(settings);
    } catch (e) {
      console.error('Failed to save settings to Tauri', e);
    }
  }

  // Project Management
  async addProject(): Promise<string | null> {
    return await tauriIpc.selectDirectory();
  }

  async addProjectsFromParent(): Promise<Array<{ path: string; name: string }> | null> {
    const parentPath = await tauriIpc.selectDirectory();
    if (!parentPath) return null;
    return [{ path: parentPath, name: parentPath.split('/').pop() || parentPath }];
  }

  // TTS
  async ttsInstallInstructions(projectPath: string): Promise<{ success: boolean }> { return { success: false }; }
  async ttsSpeak(text: string): Promise<{ success: boolean; error?: string }> { return { success: false }; }
  async ttsStop(): Promise<{ success: boolean }> { return { success: false }; }

  // Events
  onApiOpenSession(callback: ApiOpenSessionCallback): Unsubscribe {
    return () => {};
  }

  onSettingsChanged(callback: (settings: Settings) => void): Unsubscribe {
    let unlisten: (() => void) | undefined;
    tauriIpc.onSettingsChanged(callback).then(fn => unlisten = fn);
    return () => unlisten?.();
  }

  onWorkspaceChanged(callback: (workspace: Workspace) => void): Unsubscribe {
    let unlisten: (() => void) | undefined;
    tauriIpc.onWorkspaceChanged(callback).then(fn => unlisten = fn);
    return () => unlisten?.();
  }

  // Extended API
  async selectDirectory(): Promise<string | null> { return await tauriIpc.selectDirectory(); }
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

  // Updater Implementation
  async checkForUpdate(): Promise<{ available: boolean; version?: string; body?: string }> {
    try {
      const update = await check();
      return {
        available: !!update,
        version: update?.version,
        body: update?.body
      };
    } catch (e) {
      console.error('Failed to check for updates', e);
      return { available: false };
    }
  }

  async downloadUpdate(): Promise<{ success: boolean; error?: string }> {
    try {
      const update = await check();
      if (update) {
        await update.downloadAndInstall();
        return { success: true };
      }
      return { success: false, error: 'No update available' };
    } catch (e) {
      console.error('Failed to download update', e);
      return { success: false, error: String(e) };
    }
  }

  async installUpdate(): Promise<void> {
    try {
      await relaunch();
    } catch (e) {
      console.error('Failed to relaunch after update', e);
    }
  }
}
