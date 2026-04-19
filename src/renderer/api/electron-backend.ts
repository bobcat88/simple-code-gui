/**
 * Electron Backend Implementation
 *
 * This module provides the Electron IPC implementation of the Api interface.
 * It delegates all calls to window.electronAPI which communicates with the
 * Electron main process via IPC.
 */

import {
  Api,
  ExtendedApi,
  Settings,
  Workspace,
  Session,
  PtyDataCallback,
  PtyExitCallback,
  PtyRecreatedCallback,
  ApiOpenSessionCallback,
  Unsubscribe
} from './types'
import type { BackendId } from './types'



/**
 * Electron backend implementation that delegates to window.electronAPI
 */
export class ElectronBackend implements ExtendedApi {
  /**
   * Check if the Electron API is available
   * @throws Error if electronAPI is not available
   */
  private checkApi(): void {
    if (!window.electronAPI) {
      throw new Error('Electron API not available. Are you running in Electron?')
    }
  }

  // ==========================================================================
  // PTY Management
  // ==========================================================================

  async spawnPty(cwd: string, sessionId?: string, model?: string, backend?: BackendId, rows?: number, cols?: number): Promise<string> {
    this.checkApi()
    return window.electronAPI!.spawnPty(cwd, sessionId, model, backend, rows, cols)
  }

  killPty(id: string): void {
    this.checkApi()
    window.electronAPI!.killPty(id)
  }

  writePty(id: string, data: string): void {
    this.checkApi()
    window.electronAPI!.writePty(id, data)
  }

  resizePty(id: string, cols: number, rows: number): void {
    this.checkApi()
    window.electronAPI!.resizePty(id, cols, rows)
  }

  onPtyData(id: string, callback: PtyDataCallback): Unsubscribe {
    this.checkApi()
    return window.electronAPI!.onPtyData(id, callback)
  }

  onPtyExit(id: string, callback: PtyExitCallback): Unsubscribe {
    this.checkApi()
    return window.electronAPI!.onPtyExit(id, callback)
  }

  onPtyRecreated(callback: PtyRecreatedCallback): Unsubscribe {
    this.checkApi()
    return window.electronAPI!.onPtyRecreated(callback)
  }

  setPtyBackend(id: string, backend: BackendId): Promise<void> {
    this.checkApi()
    if (window.electronAPI!.setPtyBackend) {
      return window.electronAPI!.setPtyBackend(id, backend)
    }
    return Promise.resolve()
  }

  setAutoAccept(id: string, enabled: boolean): void {
    window.electronAPI?.setAutoAccept?.(id, enabled)
  }

  getAutoAcceptStatus(id: string): Promise<boolean> {
    return window.electronAPI?.getAutoAcceptStatus?.(id) ?? Promise.resolve(false)
  }

  // ==========================================================================
  // Session Management
  // ==========================================================================

  async discoverSessions(projectPath: string, backend?: BackendId): Promise<Session[]> {
    this.checkApi()
    return window.electronAPI!.discoverSessions(projectPath, backend)
  }

  // ==========================================================================
  // Workspace Management
  // ==========================================================================

  async getWorkspace(): Promise<Workspace> {
    this.checkApi()
    return window.electronAPI!.getWorkspace()
  }

  async saveWorkspace(workspace: Workspace): Promise<void> {
    this.checkApi()
    return window.electronAPI!.saveWorkspace(workspace)
  }

  // ==========================================================================
  // Settings Management
  // ==========================================================================

  async getSettings(): Promise<Settings> {
    this.checkApi()
    return window.electronAPI!.getSettings()
  }

  async saveSettings(settings: Settings): Promise<void> {
    this.checkApi()
    return window.electronAPI!.saveSettings(settings)
  }

  // ==========================================================================
  // Project Management
  // ==========================================================================

  async addProject(): Promise<string | null> {
    this.checkApi()
    return window.electronAPI!.addProject()
  }

  async addProjectsFromParent(): Promise<Array<{ path: string; name: string }> | null> {
    this.checkApi()
    return window.electronAPI!.addProjectsFromParent()
  }

  // ==========================================================================
  // TTS (Text-to-Speech)
  // ==========================================================================

  async ttsInstallInstructions(projectPath: string): Promise<{ success: boolean }> {
    this.checkApi()
    return window.electronAPI!.ttsInstallInstructions(projectPath)
  }

  async ttsSpeak(text: string): Promise<{ success: boolean; audioData?: string; error?: string }> {
    this.checkApi()
    return window.electronAPI!.voiceSpeak(text)
  }

  async ttsStop(): Promise<{ success: boolean }> {
    this.checkApi()
    return window.electronAPI!.voiceStopSpeaking()
  }

  // ==========================================================================
  // Events
  // ==========================================================================

  onApiOpenSession(callback: ApiOpenSessionCallback): Unsubscribe {
    this.checkApi()
    return window.electronAPI!.onApiOpenSession(callback)
  }

  onSettingsChanged(callback: (settings: Settings) => void): Unsubscribe {
    return () => {}
  }

  onWorkspaceChanged(callback: (workspace: Workspace) => void): Unsubscribe {
    return () => {}
  }

  // ==========================================================================
  // Extended API (Desktop-only features)
  // ==========================================================================

  async selectDirectory(): Promise<string | null> {
    this.checkApi()
    return window.electronAPI!.selectDirectory()
  }

  async selectExecutable(): Promise<string | null> {
    this.checkApi()
    return window.electronAPI!.selectExecutable()
  }

  windowMinimize(): void {
    this.checkApi()
    window.electronAPI!.windowMinimize()
  }

  windowMaximize(): void {
    this.checkApi()
    window.electronAPI!.windowMaximize()
  }

  windowClose(): void {
    this.checkApi()
    window.electronAPI!.windowClose()
  }

  async windowIsMaximized(): Promise<boolean> {
    this.checkApi()
    return window.electronAPI!.windowIsMaximized()
  }

  getPathForFile(file: File): string {
    this.checkApi()
    return window.electronAPI!.getPathForFile(file)
  }

  async readClipboardImage(): Promise<{ success: boolean; hasImage?: boolean; path?: string; error?: string }> {
    this.checkApi()
    return window.electronAPI!.readClipboardImage()
  }

  async getVersion(): Promise<string> {
    this.checkApi()
    return window.electronAPI!.getVersion()
  }

  async isDebugMode(): Promise<boolean> {
    this.checkApi()
    return window.electronAPI!.isDebugMode()
  }

  async refresh(): Promise<void> {
    this.checkApi()
    return window.electronAPI!.refresh()
  }

  async openExternal(url: string): Promise<void> {
    this.checkApi()
    return window.electronAPI!.openExternal(url)
  }

  debugLog(message: string): void {
    this.checkApi()
    window.electronAPI!.debugLog(message)
  }

  // Updater
  async checkForUpdate(): Promise<{ available: boolean; version?: string; body?: string }> {
    if (window.electronAPI?.checkForUpdate) {
      return window.electronAPI.checkForUpdate()
    }
    return { available: false }
  }

  async downloadUpdate(): Promise<{ success: boolean; error?: string }> {
    if (window.electronAPI?.downloadUpdate) {
      return window.electronAPI.downloadUpdate()
    }
    return { success: false, error: 'Updater not implemented in Electron' }
  }

  async installUpdate(): Promise<void> {
    window.electronAPI?.installUpdate?.()
  }
}

/**
 * Singleton instance of the Electron backend
 */
let instance: ElectronBackend | null = null

/**
 * Get the singleton instance of the Electron backend
 */
export function getElectronBackend(): ElectronBackend {
  if (!instance) {
    instance = new ElectronBackend()
  }
  return instance
}

/**
 * Check if the Electron API is available
 */
export function isElectronAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI
}
