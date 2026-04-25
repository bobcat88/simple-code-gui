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
  BackendId,
  ApprovalRequest,
  ApprovalResponse,
  TokenHistoryFilters,
  TokenHistoryResponse,
  TokenTransactionInput,
  GsdSeed,
  KSpecDraft
} from './types'
import { tauriIpc } from '../lib/tauri-ipc'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

export class TauriBackend implements ExtendedApi {
  // PTY Management
  async spawnPty(cwd: string, sessionId?: string, model?: string, backend?: BackendId, rows?: number, cols?: number, nexusSessionId?: string): Promise<string> {
    return tauriIpc.spawnSession(cwd, backend || 'claude', sessionId, model, rows, cols, nexusSessionId);
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
    let unlisten: (() => void) | undefined;
    tauriIpc.onPtyRecreated(callback).then(fn => unlisten = fn);
    return () => unlisten?.();
  }

  onPtyTitle(id: string, callback: (title: string) => void): Unsubscribe {
    let unlisten: (() => void) | undefined;
    tauriIpc.onPtyTitle(id, callback).then(fn => unlisten = fn);
    return () => unlisten?.();
  }

  onPtyPath(id: string, callback: (path: string) => void): Unsubscribe {
    let unlisten: (() => void) | undefined;
    tauriIpc.onPtyPath(id, callback).then(fn => unlisten = fn);
    return () => unlisten?.();
  }

  onPtyPid(id: string, callback: (pid: string) => void): Unsubscribe {
    let unlisten: (() => void) | undefined;
    tauriIpc.onPtyPid(id, callback).then(fn => unlisten = fn);
    return () => unlisten?.();
  }

  async setPtyBackend(id: string, backend: BackendId): Promise<void> {
    await tauriIpc.setPtyBackend(id, backend);
  }

  setAutoAccept(id: string, enabled: boolean): void {
    tauriIpc.setAutoAccept(id, enabled);
  }

  async getAutoAcceptStatus(id: string): Promise<boolean> {
    return await tauriIpc.getAutoAcceptStatus(id);
  }

  // Session Management
  async discoverSessions(projectPath: string, backend?: BackendId): Promise<Session[]> {
    try {
      return await tauriIpc.discoverSessions(projectPath, backend);
    } catch (e) {
      console.error('Failed to discover sessions', e);
      return [];
    }
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

  async aiSaveKey(provider: string, key: string, baseUrl?: string): Promise<void> {
    try {
      await tauriIpc.aiSaveKey(provider, key, baseUrl);
    } catch (e) {
      console.error('Failed to save AI key to Tauri', e);
    }
  }

  // Project Management
  async addProject(): Promise<string | null> {
    return await tauriIpc.selectDirectory();
  }

  async addProjectsFromParent(): Promise<Array<{ path: string; name: string }> | null> {
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
  }

  // Voice & TTS
  async ttsInstallInstructions(projectPath: string): Promise<{ success: boolean }> { 
    return await tauriIpc.voiceInstallPiper(); 
  }
  async ttsSpeak(text: string, voice?: string, speed?: number): Promise<{ success: boolean; error?: string }> { 
    return await tauriIpc.voiceSpeak(text, voice, speed); 
  }
  async ttsStop(): Promise<{ success: boolean }> { 
    await tauriIpc.voiceStop();
    return { success: true };
  }

  async voiceCheckTTS(): Promise<any> { return await tauriIpc.voiceCheckTTS(); }
  async voiceFetchCatalog(forceRefresh?: boolean): Promise<any[]> { return await tauriIpc.voiceFetchCatalog(forceRefresh); }
  async voiceGetInstalled(): Promise<string[]> { return await tauriIpc.voiceGetInstalled(); }
  async voiceDownloadFromCatalog(voiceKey: string): Promise<any> { return await tauriIpc.voiceDownloadFromCatalog(voiceKey); }
  async voiceImportCustom(): Promise<any> { return await tauriIpc.voiceImportCustom(); }
  async voiceOpenCustomFolder(): Promise<void> { return await tauriIpc.voiceOpenCustomFolder(); }
  async voiceSaveSettings(settings: any): Promise<void> { return await tauriIpc.voiceSaveSettings(settings); }
  async voiceInstallPiper(): Promise<any> { return await tauriIpc.voiceInstallPiper(); }
  async voiceInstallVoice(modelId: string): Promise<any> { return await tauriIpc.voiceInstallVoice(modelId); }
  
  async xttsGetVoices(): Promise<any[]> { return await tauriIpc.xttsGetVoices(); }
  async xttsGetSampleVoices(): Promise<any[]> { return await tauriIpc.xttsGetSampleVoices(); }
  async xttsGetLanguages(): Promise<any[]> { return await tauriIpc.xttsGetLanguages(); }
  async xttsCheck(): Promise<any> { return await tauriIpc.xttsCheck(); }
  async xttsDownloadSampleVoice(voiceId: string): Promise<any> { return await tauriIpc.xttsDownloadSampleVoice(voiceId); }
  async xttsDeleteVoice(voiceId: string): Promise<any> { return await tauriIpc.xttsDeleteVoice(voiceId); }
  async xttsInstall(): Promise<any> { return await tauriIpc.xttsInstall(); }
  async xttsCreateVoice(audioPath: string, name: string, language: string): Promise<any> { return await tauriIpc.xttsCreateVoice(audioPath, name, language); }

  onInstallProgress(callback: (progress: any) => void): Unsubscribe {
    let unlisten: (() => void) | undefined;
    tauriIpc.onInstallProgress(callback).then(fn => unlisten = fn);
    return () => unlisten?.();
  }

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
  async selectExecutable(): Promise<string | null> { return await tauriIpc.selectFile(); }
  windowMinimize(): void { tauriIpc.windowMinimize(); }
  windowMaximize(): void { tauriIpc.windowMaximize(); }
  windowClose(): void { tauriIpc.windowClose(); }
  async windowIsMaximized(): Promise<boolean> { return await tauriIpc.windowIsMaximized(); }
  getPathForFile(file: File): string { return (file as any).path || ''; }
  async readClipboardImage(): Promise<{ success: boolean; hasImage?: boolean; path?: string; error?: string }> { return { success: false }; }
  async getVersion(): Promise<string> { return '2.0.0-tauri'; }
  async isDebugMode(): Promise<boolean> { return true; }
  async refresh(): Promise<void> { window.location.reload(); }
  async openExternal(url: string): Promise<void> { 
    // In Tauri, use the shell plugin or just window.open if it works
    window.open(url, '_blank'); 
  }
  debugLog(message: string): void { console.log('[Tauri]', message); }
  
  // Extension Management
  async extensionsGetInstalled(): Promise<any[]> { return await tauriIpc.extensionsGetInstalled(); }
  async extensionsFetchRegistry(forceRefresh: boolean): Promise<any> { return await tauriIpc.extensionsFetchRegistry(forceRefresh); }
  async extensionsGetCustomUrls(): Promise<string[]> { return await tauriIpc.extensionsGetCustomUrls(); }
  async extensionsInstallSkill(extension: any, scope: string): Promise<{ success: boolean; error?: string }> { return await tauriIpc.extensionsInstallSkill(extension, scope); }
  async extensionsInstallMcp(extension: any): Promise<{ success: boolean; error?: string }> { return await tauriIpc.extensionsInstallMcp(extension); }
  async extensionsRemove(id: string): Promise<{ success: boolean; error?: string }> { return await tauriIpc.extensionsRemove(id); }
  async extensionsEnableForProject(id: string, projectPath: string): Promise<void> { await tauriIpc.extensionsEnableForProject(id, projectPath); }
  async extensionsDisableForProject(id: string, projectPath: string): Promise<void> { await tauriIpc.extensionsDisableForProject(id, projectPath); }
  async extensionsFetchFromUrl(url: string): Promise<any | null> { return await tauriIpc.extensionsFetchFromUrl(url); }
  async extensionsAddCustomUrl(url: string): Promise<void> { await tauriIpc.extensionsAddCustomUrl(url); }
  async extensionsSetConfig(id: string, config: any): Promise<void> { await tauriIpc.extensionsSetConfig(id, config); }
  async extensionsCheckUpdates(): Promise<any[]> { return await tauriIpc.extensionsCheckUpdates(); }
  
  // MCP Bridge
  async mcpListTools(serverName: string): Promise<any> { return await tauriIpc.mcpListTools(serverName); }
  async mcpCallTool(serverName: string, toolName: string, args: any): Promise<any> { return await tauriIpc.mcpCallTool(serverName, toolName, args); }
  async mcpListResources(serverName: string): Promise<any> { return await tauriIpc.mcpListResources(serverName); }
  async mcpReadResource(serverName: string, uri: string): Promise<any> { return await tauriIpc.mcpReadResource(serverName, uri); }
  async mcpLoadConfig(): Promise<void> { await tauriIpc.mcpLoadConfig(); }
  async mcpGetServers(): Promise<any[]> { return await tauriIpc.mcpGetServers(); }

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

  // Token Metering Implementation
  async logTokenEvent(transaction: TokenTransactionInput, savedTokens?: number): Promise<void> {
    await tauriIpc.logTokenEvent(transaction, savedTokens);
  }

  async getTokenStats(projectId?: string): Promise<{ totalInput: number; totalOutput: number; totalSaved: number; totalCost: number }> {
    return await tauriIpc.getTokenStats(projectId);
  }

  async getTokenHistory(filters?: TokenHistoryFilters): Promise<TokenHistoryResponse> {
    return await tauriIpc.getTokenHistory(filters);
  }

  // Project Initialization Wizard
  async projectScan(path: string, options?: any): Promise<any> {
    return await tauriIpc.projectScan(path, options || {});
  }

  async projectGenerateProposal(scan: any, preset: string, projectName: string, taskBackend: string): Promise<any> {
    return await tauriIpc.projectGenerateProposal(scan, preset, projectName, taskBackend);
  }

  async projectApplyProposal(proposal: any): Promise<string[]> {
    return await tauriIpc.projectApplyProposal(proposal);
  }

  async scanProjectIntelligence(path: string): Promise<any> {
    return await tauriIpc.scanProjectIntelligence(path);
  }

  async projectScanAsync(path: string): Promise<{ success: boolean; job_id: string }> {
    return await tauriIpc.projectScanAsync(path) as any;
  }

  async setCurrentProject(path: string | null): Promise<void> {
    await tauriIpc.setCurrentProject(path);
  }

  async vectorIndexSession(summary: string, ptyId: string, projectPath?: string): Promise<{ success: boolean }> {
    return await tauriIpc.vectorIndexSession(summary, ptyId, projectPath);
  }

  onProjectInitializationProgress(callback: (progress: any) => void): Unsubscribe {
    let unlisten: (() => void) | undefined;
    tauriIpc.onProjectInitializationProgress(callback).then(fn => unlisten = fn);
    return () => unlisten?.();
  }

  // Orchestration (Beads/Kspec)
  async kspecDispatchStatus(cwd: string): Promise<any> {
    return await tauriIpc.kspecDispatchStatus(cwd);
  }
  async kspecDispatchStart(cwd: string): Promise<{ success: boolean; error?: string }> {
    return await tauriIpc.kspecDispatchStart(cwd);
  }
  async kspecDispatchStop(cwd: string): Promise<{ success: boolean; error?: string }> {
    return await tauriIpc.kspecDispatchStop(cwd);
  }
  async beadsList(cwd: string): Promise<any> {
    return await tauriIpc.beadsList(cwd);
  }
  async beadsStart(cwd: string, taskId: string): Promise<any> {
    return await tauriIpc.beadsStart(cwd, taskId);
  }
  async beadsComplete(cwd: string, taskId: string): Promise<any> {
    return await tauriIpc.beadsComplete(cwd, taskId);
  }

  // Approval Workflow
  onApprovalRequest(callback: (request: ApprovalRequest) => void): Unsubscribe {
    let unlisten: (() => void) | undefined;
    tauriIpc.onApprovalRequest(callback).then(fn => unlisten = fn);
    return () => unlisten?.();
  }

  onApprovalResolved(callback: (actionId: string) => void): Unsubscribe {
    let unlisten: (() => void) | undefined;
    tauriIpc.onApprovalResolved(callback).then(fn => unlisten = fn);
    return () => unlisten?.();
  }

  async respondToApproval(response: ApprovalResponse): Promise<{ success: boolean }> {
    return await tauriIpc.respondToApproval(response);
  }

  async getPendingApprovals(cwd: string): Promise<ApprovalRequest[]> {
    return await tauriIpc.getPendingApprovals(cwd);
  }

  // GSD Engine Implementation
  async gsdCreatePlan(taskId: string, title: string): Promise<any> {
    return await tauriIpc.gsdCreatePlan(taskId, title);
  }

  async gsdAddPhase(planId: string, title: string): Promise<any> {
    return await tauriIpc.gsdAddPhase(planId, title);
  }

  async gsdAddStep(planId: string, phaseId: string, title: string, description: string): Promise<GsdStep> {
    return await tauriIpc.gsdAddStep(planId, phaseId, title, description);
  }

  async gsdExecutePlan(planId: string): Promise<void> {
    await tauriIpc.gsdExecutePlan(planId);
  }

  async gsdRespondToCheckpoint(stepId: string, response: UserResponse): Promise<void> {
    await tauriIpc.gsdRespondToCheckpoint(stepId, response);
  }

  onGsdExecutionEvent(callback: (event: any) => void): Unsubscribe {
    let unlisten: (() => void) | undefined;
    tauriIpc.onGsdExecutionEvent(callback).then(fn => unlisten = fn);
    return () => unlisten?.();
  }

  onGsdPhaseUpdated(callback: (phase: any) => void): Unsubscribe {
    let unlisten: (() => void) | undefined;
    tauriIpc.onGsdPhaseUpdated(callback).then(fn => unlisten = fn);
    return () => unlisten?.();
  }

  onGsdStepUpdated(callback: (step: any) => void): Unsubscribe {
    let unlisten: (() => void) | undefined;
    tauriIpc.onGsdStepUpdated(callback).then(fn => unlisten = fn);
    return () => unlisten?.();
  }
  
  onGsdInsight(callback: (insight: any) => void): Unsubscribe {
    let unlisten: (() => void) | undefined;
    tauriIpc.onGsdInsight(callback).then(fn => unlisten = fn);
    return () => unlisten?.();
  }

  async gsdListTools(): Promise<any[]> {
    return await tauriIpc.gsdListTools();
  }

  // Background Jobs
  async jobsCreate(jobType: string, payload: any): Promise<string> { return await tauriIpc.jobsCreate(jobType, payload); }
  async jobsGet(id: string): Promise<any> { return await tauriIpc.jobsGet(id); }
  async jobsList(limit?: number): Promise<any[]> { return await tauriIpc.jobsList(limit); }
  onJobProgress(callback: (data: { id: string, progress: number, message: string }) => void): Unsubscribe {
    let unlisten: (() => void) | undefined;
    tauriIpc.onJobProgress(callback).then(fn => unlisten = fn);
    return () => unlisten?.();
  }
  onAgentStatusChanged(callback: (data: { id: string, status: string }) => void): Unsubscribe {
    let unlisten: (() => void) | undefined;
    tauriIpc.onAgentStatusChanged(callback).then(fn => unlisten = fn);
    return () => unlisten?.();
  }

  onAgentRegistered(callback: (agent: any) => void): Unsubscribe {
    let unlisten: (() => void) | undefined;
    tauriIpc.onAgentRegistered(callback).then(fn => unlisten = fn);
    return () => unlisten?.();
  }

  onJobStatusChanged(callback: (id: string) => void): Unsubscribe {
    let unlisten: (() => void) | undefined;
    tauriIpc.onJobStatusChanged(callback).then(fn => unlisten = fn);
    return () => unlisten?.();
  }

  // Activity Feed
  async activityGetRecent(limit?: number): Promise<any[]> { return await tauriIpc.activityGetRecent(limit); }
  async activityLogInfo(source: string, message: string, metadata?: string): Promise<void> { return await tauriIpc.activityLogInfo(source, message, metadata); }
  onActivityEvent(callback: (event: any) => void): Unsubscribe {
    let unlisten: (() => void) | undefined;
    tauriIpc.onActivityEvent(callback).then(fn => unlisten = fn);
    return () => unlisten?.();
  }

  // Agents
  async agentRegister(agent: any): Promise<void> { return await tauriIpc.agentRegister(agent); }
  async agentList(): Promise<any[]> { return await tauriIpc.agentList(); }
  async agentUpdateStatus(id: string, status: string): Promise<void> { return await tauriIpc.agentUpdateStatus(id, status); }

  // Health & Diagnostics
  async healthGetStatus(): Promise<any> { return await tauriIpc.healthGetStatus(); }
  async healthLogCheck(checkType: string, status: string, details?: string): Promise<void> { return await tauriIpc.healthLogCheck(checkType, status, details); }
  async diagnosticsGenerateBundle(): Promise<any> {
    return await tauriIpc.diagnosticsGenerateBundle();
  }

  // CLAUDE.md Editor
  async claudeMdRead(projectPath: string): Promise<{ success: boolean; content?: string; exists?: boolean; error?: string }> {
    return await tauriIpc.claudeMdRead(projectPath);
  }

  async claudeMdSave(projectPath: string, content: string): Promise<{ success: boolean; error?: string }> {
    return await tauriIpc.claudeMdSave(projectPath, content);
  }

  onModelPlanSwitched(callback: (event: { old_plan: string; new_plan: string; health_score: number }) => void): Unsubscribe {
    let unlisten: (() => void) | undefined;
    tauriIpc.onModelPlanSwitched(callback).then(fn => unlisten = fn);
    return () => unlisten?.();
  }

  // Vector Engine
  async vectorSearch(query: string, limit?: number, projectPath?: string): Promise<VectorSearchResult[]> {
    return await tauriIpc.vectorSearch(query, limit, projectPath);
  }

  async vectorGetStatus(): Promise<VectorIndexStatus> {
    return await tauriIpc.vectorGetStatus();
  }

  async vectorAddChunks(chunks: VectorChunk[]): Promise<{ success: boolean }> {
    return await tauriIpc.vectorAddChunks(chunks);
  }

  async vectorIndexProject(projectPath: string): Promise<{ success: boolean; error?: string }> {
    return await tauriIpc.vectorIndexProject(projectPath);
  }
  async vectorIndexKnowledge(): Promise<{ success: boolean; error?: string }> {
    return await tauriIpc.vectorIndexKnowledge();
  }

  // Brainstorm Companion
  async gsdListSeeds(cwd: string): Promise<GsdSeed[]> {
    return await tauriIpc.gsdListSeeds(cwd);
  }

  async gsdPlantSeed(cwd: string, seed: GsdSeed): Promise<void> {
    await tauriIpc.gsdPlantSeed(cwd, seed);
  }

  async kspecListDrafts(cwd: string): Promise<KSpecDraft[]> {
    return await tauriIpc.kspecListDrafts(cwd);
  }

  async kspecWriteDraft(cwd: string, moduleId: string, content: string): Promise<void> {
    await tauriIpc.kspecWriteDraft(cwd, moduleId, content);
  }
}
