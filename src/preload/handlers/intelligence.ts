import { ipcRenderer } from 'electron'

export const intelligenceHandlers = {
  getProjectIntelligence: (projectPath: string) => ipcRenderer.invoke('get-project-intelligence', projectPath)
}
