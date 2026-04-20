import { ipcMain } from 'electron'
import { telemetryDb, TelemetryRecord } from '../telemetry-db'
import { SessionStore } from '../session-store'
import { BudgetService } from '../budget-service'

export function registerTelemetryHandlers(sessionStore: SessionStore, budgetService: BudgetService) {
  ipcMain.handle('telemetry:add-record', async (_event, record: TelemetryRecord) => {
    try {
      return telemetryDb.addRecord(record)
    } catch (err) {
      console.error('[Telemetry] Failed to add record:', err)
      throw err
    }
  })

  ipcMain.handle('telemetry:get-stats', async (_event, projectPath?: string) => {
    try {
      return telemetryDb.getStats(projectPath)
    } catch (err) {
      console.error('[Telemetry] Failed to get stats:', err)
      throw err
    }
  })

  ipcMain.handle('telemetry:get-history', async (_event, limit?: number) => {
    try {
      return telemetryDb.getHistory(limit)
    } catch (err) {
      console.error('[Telemetry] Failed to get history:', err)
      throw err
    }
  })

  ipcMain.handle('telemetry:clear', async () => {
    try {
      return telemetryDb.clear()
    } catch (err) {
      console.error('[Telemetry] Failed to clear history:', err)
      throw err
    }
  })

  ipcMain.handle('telemetry:check-budget', async (_event, projectPath?: string) => {
    try {
      return await budgetService.checkBudget(projectPath)
    } catch (err) {
      console.error('[Telemetry] Failed to check budget:', err)
      throw err
    }
  })
}
