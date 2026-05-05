import { beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { tauriIpc } from './tauri-ipc'

const callback = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(invoke).mockResolvedValue([])
  vi.mocked(listen).mockImplementation((_event, handler) => {
    handler({ event: String(_event), id: 1, payload: 'payload' })
    return Promise.resolve(vi.fn())
  })
  callback.mockClear()
})

describe('tauriIpc', () => {
  it('maps core command wrappers to Tauri invoke', async () => {
    await tauriIpc.spawnSession('/repo', 'claude', 'session-1', 'sonnet', 24, 80, 'nexus-1')
    await tauriIpc.writeToPty('pty-1', 'ls')
    await tauriIpc.resizePty('pty-1', 120, 40)
    await tauriIpc.killSession('pty-1')
    await tauriIpc.setPtyBackend('pty-1', 'codex')
    await tauriIpc.saveSettings({ theme: 'dark' })
    await tauriIpc.aiSaveKey('openai', 'sk-test', 'https://api.test')
    await tauriIpc.saveWorkspace({ projects: [] })
    await tauriIpc.extensionsInstallSkill({ id: 'skill' }, 'project')
    await tauriIpc.mcpCallTool('server', 'tool', { arg: true })
    await tauriIpc.logTokenEvent({ tokens: 100 }, 25)
    await tauriIpc.projectGenerateProposal({} as never, 'balanced', 'App', 'claude')
    await tauriIpc.beadsCreate('/repo', 'Task', 'Desc', 2, 'task', 'coverage')
    await tauriIpc.agentUpdateMetrics('a1', 1, 0.8, 0.1, 3, 0.9, 'learning', 'Fix tests')
    await tauriIpc.vectorSearch('query', 5, '/repo')
    await tauriIpc.gsdApplyDistributedCreditDelta('node-1', 10, 0.5)

    expect(invoke).toHaveBeenCalledWith('spawn_session', {
      cwd: '/repo',
      backend: 'claude',
      session_id: 'session-1',
      slug: 'sonnet',
      rows: 24,
      cols: 80,
      nexus_session_id: 'nexus-1',
    })
    expect(invoke).toHaveBeenCalledWith('write_to_pty', { id: 'pty-1', data: 'ls' })
    expect(invoke).toHaveBeenCalledWith('resize_pty', { id: 'pty-1', cols: 120, rows: 40 })
    expect(invoke).toHaveBeenCalledWith('save_settings', { settings: { theme: 'dark' } })
    expect(invoke).toHaveBeenCalledWith('agent_update_metrics', {
      id: 'a1',
      burn_rate: 1,
      quality_score: 0.8,
      error_rate: 0.1,
      queue_size: 3,
      evolution_confidence: 0.9,
      evolution_status: 'learning',
      active_task: 'Fix tests',
    })
  })

  it('covers remaining invoke-only wrappers with smoke calls', async () => {
    const listenerNames = new Set([
      'listen',
      'onPtyData',
      'onPtyExit',
      'onPtyRecreated',
      'onPtyTitle',
      'onPtyPath',
      'onPtyPid',
      'onSettingsChanged',
      'onWorkspaceChanged',
      'onProjectInitializationProgress',
      'onInstallProgress',
      'onApprovalRequest',
      'onApprovalResolved',
      'onJobProgress',
      'onJobStatusChanged',
      'onActivityEvent',
      'onAgentStatusChanged',
      'onAgentRegistered',
      'onAgentMetricsChanged',
      'onModelPlanSwitched',
      'onAiEvolutionCompleted',
      'onOptimizationStatsUpdated',
      'onAiLearningCaptured',
      'onGsdExecutionEvent',
      'onGsdPhaseUpdated',
      'onGsdStepUpdated',
      'onGsdInsight',
      'onGsdApprovalRequested',
      'onGsdSyncEvent',
      'onAgentMessage',
    ])
    const args = ['/repo', 'id-1', 'title', 'description', 2, 'claude', { value: true }, ['chunk'], callback]

    for (const [name, fn] of Object.entries(tauriIpc)) {
      if (listenerNames.has(name)) continue
      await (fn as (...callArgs: unknown[]) => unknown)(...args)
    }

    expect(invoke).toHaveBeenCalledWith('get_settings')
    expect(invoke).toHaveBeenCalledWith('get_workspace')
    expect(invoke).toHaveBeenCalledWith('mobile_regenerate_token')
    expect(invoke).toHaveBeenCalledTimes(178)
  })

  it('maps event listeners and forwards payloads to callbacks', async () => {
    await tauriIpc.onPtyData('pty-1', callback)
    await tauriIpc.onPtyExit('pty-1', callback)
    await tauriIpc.onAgentStatusChanged(callback)
    await tauriIpc.onAiEvolutionCompleted(callback)
    await tauriIpc.onGsdExecutionEvent(callback)
    await tauriIpc.onAgentMessage(callback)

    expect(listen).toHaveBeenCalledWith('pty-data-pty-1', expect.any(Function))
    expect(listen).toHaveBeenCalledWith('pty-exit-pty-1', expect.any(Function))
    expect(listen).toHaveBeenCalledWith('agent-status-changed', expect.any(Function))
    expect(callback).toHaveBeenCalledWith('payload')
  })
})
