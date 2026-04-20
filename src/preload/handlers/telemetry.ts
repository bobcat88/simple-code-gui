import { ipcRenderer } from 'electron'

export const telemetryHandlers = {
  telemetry: {
    addRecord: (record: any) => ipcRenderer.invoke('telemetry:add-record', record),
    getStats: (projectPath?: string) => ipcRenderer.invoke('telemetry:get-stats', projectPath),
    getHistory: (limit?: number) => ipcRenderer.invoke('telemetry:get-history', limit),
    clear: () => ipcRenderer.invoke('telemetry:clear'),
    checkBudget: (projectPath?: string) => ipcRenderer.invoke('telemetry:check-budget', projectPath),
  }
}
