import { ipcRenderer, IpcRendererEvent } from 'electron'

export const telemetryHandlers = {
  telemetryGetSummary: (): Promise<any> =>
    ipcRenderer.invoke('telemetry:get-summary'),

  telemetryGetSession: (ptyId: string): Promise<any> =>
    ipcRenderer.invoke('telemetry:get-session', ptyId),

  telemetryRtkAvailable: (): Promise<boolean> =>
    ipcRenderer.invoke('telemetry:rtk-available'),

  telemetryRtkRefresh: (): Promise<any> =>
    ipcRenderer.invoke('telemetry:rtk-refresh'),

  onTelemetryUpdated: (callback: (data: any) => void): (() => void) => {
    const handler = (_: IpcRendererEvent, data: any) => callback(data)
    ipcRenderer.on('telemetry:updated', handler)
    return () => ipcRenderer.removeListener('telemetry:updated', handler)
  },
}
