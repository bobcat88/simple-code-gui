/**
 * IPC handlers for telemetry — bridges main process telemetry to renderer.
 */

import { BrowserWindow, ipcMain } from 'electron'
import type { TelemetryStore } from './telemetry-store'
import { fetchRtkSavings, isRtkAvailable } from './rtk-integration'

export function registerTelemetryHandlers(
  telemetryStore: TelemetryStore,
  getMainWindow: () => BrowserWindow | null
): void {
  // Get full telemetry summary
  ipcMain.handle('telemetry:get-summary', () => {
    return telemetryStore.getSummary()
  })

  // Get single session telemetry
  ipcMain.handle('telemetry:get-session', (_, ptyId: string) => {
    return telemetryStore.getSessionTelemetry(ptyId) ?? null
  })

  // Check if RTK is available
  ipcMain.handle('telemetry:rtk-available', async () => {
    return isRtkAvailable()
  })

  // Refresh RTK savings data
  ipcMain.handle('telemetry:rtk-refresh', async () => {
    const savings = await fetchRtkSavings()
    if (savings) {
      telemetryStore.updateRtkSavings(savings)
    }
    return savings
  })

  // Push updates to renderer when telemetry changes
  telemetryStore.onUpdate((summary) => {
    const mainWindow = getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        mainWindow.webContents.send('telemetry:updated', summary)
      } catch { /* window closing */ }
    }
  })
}
