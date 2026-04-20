import { ipcRenderer } from 'electron'

export const orchestrationHandlers = {
  onAgentAction: (callback: (action: any) => void) => {
    const subscription = (_event: any, action: any) => callback(action)
    ipcRenderer.on('orchestration:action', subscription)
    return () => ipcRenderer.removeListener('orchestration:action', subscription)
  },

  onAgentStatus: (callback: (status: any) => void) => {
    const subscription = (_event: any, status: any) => callback(status)
    ipcRenderer.on('orchestration:status', subscription)
    return () => ipcRenderer.removeListener('orchestration:status', subscription)
  },

  approveAction: (actionId: string) => ipcRenderer.invoke('orchestration:approve', actionId),
  rejectAction: (actionId: string) => ipcRenderer.invoke('orchestration:reject', actionId)
}
