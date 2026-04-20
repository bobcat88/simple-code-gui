import { telemetryDb } from './telemetry-db'
import { SessionStore } from './session-store'

export class BudgetService {
  constructor(private sessionStore: SessionStore) {}

  async checkBudget(projectPath?: string): Promise<{ exceeded: boolean; reason?: string }> {
    const settings = this.sessionStore.getSettings()
    const globalBudget = settings.globalBudget

    // 1. Check Global Budget
    if (globalBudget && (globalBudget.maxCost || globalBudget.maxTokens)) {
      const stats = telemetryDb.getStatsForPeriod(undefined, globalBudget.period)
      if (globalBudget.maxCost && stats.cost >= globalBudget.maxCost) {
        return { 
          exceeded: true, 
          reason: `Global ${globalBudget.period || 'total'} budget exceeded ($${stats.cost.toFixed(2)} / $${globalBudget.maxCost.toFixed(2)})` 
        }
      }
      if (globalBudget.maxTokens && stats.total >= globalBudget.maxTokens) {
        return { 
          exceeded: true, 
          reason: `Global ${globalBudget.period || 'total'} token limit exceeded (${stats.total.toLocaleString()} / ${globalBudget.maxTokens.toLocaleString()})` 
        }
      }
    }

    // 2. Check Project Budget
    if (projectPath) {
      const project = this.sessionStore.getWorkspace().projects.find(p => p.path === projectPath)
      const projectBudget = project?.budget
      if (projectBudget && (projectBudget.maxCost || projectBudget.maxTokens)) {
        const stats = telemetryDb.getStatsForPeriod(projectPath, projectBudget.period)
        if (projectBudget.maxCost && stats.cost >= projectBudget.maxCost) {
          return { 
            exceeded: true, 
            reason: `Project ${projectBudget.period || 'total'} budget exceeded ($${stats.cost.toFixed(2)} / $${projectBudget.maxCost.toFixed(2)})` 
          }
        }
        if (projectBudget.maxTokens && stats.total >= projectBudget.maxTokens) {
          return { 
            exceeded: true, 
            reason: `Project ${projectBudget.period || 'total'} token limit exceeded (${stats.total.toLocaleString()} / ${projectBudget.maxTokens.toLocaleString()})` 
          }
        }
      }
    }

    return { exceeded: false }
  }
}
