import { ipcMain } from 'electron'
import { getProjectIntelligence } from '../intelligence-discovery'

export function registerIntelligenceHandlers(): void {
  ipcMain.handle('get-project-intelligence', async (_event, projectPath: string) => {
    try {
      return await getProjectIntelligence(projectPath)
    } catch (e) {
      console.error('IPC get-project-intelligence error:', e)
      throw e
    }
  })
}
