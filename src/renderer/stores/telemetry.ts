import { create } from 'zustand'

export interface TokenUsage {
  prompt: number
  completion: number
  total: number
}

export interface TelemetryData {
  tokens: TokenUsage
  cost: number
  savings: number
  tokensSaved: number
  cacheHits: number
}

export interface BudgetStatus {
  exceeded: boolean
  reason?: string
}

interface TelemetryState {
  global: TelemetryData
  session: Record<string, TelemetryData> // ptyId -> data
  budgetStatus: Record<string, BudgetStatus> // projectPath -> status
  projectStats: Record<string, TelemetryData> // projectPath -> stats
  addUsage: (ptyId: string, usage: Partial<TelemetryData>, context?: { projectPath: string; backend: string }) => void
  resetSession: (ptyId: string) => void
  resetGlobal: () => void
  initialize: () => Promise<void>
  checkBudget: (projectPath?: string) => Promise<BudgetStatus>
  fetchProjectStats: (projectPath: string) => Promise<void>
}

const createEmptyData = (): TelemetryData => ({
  tokens: { prompt: 0, completion: 0, total: 0 },
  cost: 0,
  savings: 0,
  tokensSaved: 0,
  cacheHits: 0,
})

export const useTelemetryStore = create<TelemetryState>((set, get) => ({
  global: createEmptyData(),
  session: {},
  budgetStatus: {},
  projectStats: {},

  initialize: async () => {
    if (window.electronAPI?.telemetry) {
      try {
        const stats = await window.electronAPI.telemetry.getStats()
        if (stats) {
          set({
            global: {
              tokens: { 
                prompt: stats.prompt || 0, 
                completion: stats.completion || 0, 
                total: stats.total || 0 
              },
              cost: stats.cost || 0,
              savings: stats.savings || 0,
              tokensSaved: stats.tokensSaved || 0,
              cacheHits: stats.cacheHits || 0,
            }
          })
        }
      } catch (err) {
        console.error('[TelemetryStore] Failed to initialize persistent stats:', err)
      }
    }
  },

  addUsage: (ptyId, usage, context) => {
    set((state) => {
      const currentSession = state.session[ptyId] || createEmptyData()
      
      const newSession = {
        tokens: {
          prompt: currentSession.tokens.prompt + (usage.tokens?.prompt || 0),
          completion: currentSession.tokens.completion + (usage.tokens?.completion || 0),
          total: currentSession.tokens.total + (usage.tokens?.total || 0),
        },
        cost: currentSession.cost + (usage.cost || 0),
        savings: currentSession.savings + (usage.savings || 0),
        tokensSaved: currentSession.tokensSaved + (usage.tokensSaved || 0),
        cacheHits: currentSession.cacheHits + (usage.cacheHits || 0),
      }

      const newGlobal = {
        tokens: {
          prompt: state.global.tokens.prompt + (usage.tokens?.prompt || 0),
          completion: state.global.tokens.completion + (usage.tokens?.completion || 0),
          total: state.global.tokens.total + (usage.tokens?.total || 0),
        },
        cost: state.global.cost + (usage.cost || 0),
        savings: state.global.savings + (usage.savings || 0),
        tokensSaved: state.global.tokensSaved + (usage.tokensSaved || 0),
        cacheHits: state.global.cacheHits + (usage.cacheHits || 0),
      }

      return {
        global: newGlobal,
        session: {
          ...state.session,
          [ptyId]: newSession,
        },
      }
    })

    // Persistence
    if (context && window.electronAPI?.telemetry) {
      window.electronAPI.telemetry.addRecord({
        ptyId,
        projectPath: context.projectPath,
        backend: context.backend,
        promptTokens: usage.tokens?.prompt || 0,
        completionTokens: usage.tokens?.completion || 0,
        totalTokens: usage.tokens?.total || 0,
        cost: usage.cost || 0,
        savings: usage.savings || 0,
        tokensSaved: usage.tokensSaved || 0,
        cacheHits: usage.cacheHits || 0,
      }).then(() => {
        get().checkBudget(context.projectPath)
        get().checkBudget() // Also check global
      }).catch(err => {
        console.error('[TelemetryStore] Failed to persist usage:', err)
      })
    }
  },

  resetSession: (ptyId) => {
    set((state) => {
      const { [ptyId]: _, ...rest } = state.session
      return { session: rest }
    })
  },

  resetGlobal: () => set({ global: createEmptyData() }),

  checkBudget: async (projectPath) => {
    if (window.electronAPI?.telemetry) {
      try {
        const status = await window.electronAPI.telemetry.checkBudget(projectPath)
        set((state) => ({
          budgetStatus: {
            ...state.budgetStatus,
            [projectPath || 'global']: status,
          }
        }))
        return status
      } catch (err) {
        console.error('[TelemetryStore] Failed to check budget:', err)
      }
    }
    return { exceeded: false }
  },

  fetchProjectStats: async (projectPath) => {
    if (window.electronAPI?.telemetry) {
      try {
        const stats = await window.electronAPI.telemetry.getStats(projectPath)
        if (stats) {
          set((state) => ({
            projectStats: {
              ...state.projectStats,
              [projectPath]: {
                tokens: { 
                  prompt: stats.prompt || 0, 
                  completion: stats.completion || 0, 
                  total: stats.total || 0 
                },
                cost: stats.cost || 0,
                savings: stats.savings || 0,
                tokensSaved: stats.tokensSaved || 0,
                cacheHits: stats.cacheHits || 0,
              }
            }
          }))
        }
      } catch (err) {
        console.error('[TelemetryStore] Failed to fetch project stats:', err)
      }
    }
  },
}))
