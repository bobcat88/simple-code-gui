import { useState, useEffect, useCallback } from 'react'
import { getApi } from '../api'

export type UpdateStatusType = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'

export interface UpdateStatus {
  status: UpdateStatusType
  version?: string
  progress?: number
  error?: string
}

interface UseUpdaterReturn {
  appVersion: string
  updateStatus: UpdateStatus
  checkForUpdate: () => void
  downloadUpdate: () => void
  installUpdate: () => void
}

export function useUpdater(): UseUpdaterReturn {
  const [appVersion, setAppVersion] = useState<string>('')
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ status: 'idle' })

  // Load app version on mount
  useEffect(() => {
    const api = getApi()
    if (api && 'getVersion' in api) {
      api.getVersion().then(setAppVersion).catch(console.error)
    }
  }, [])

  const checkForUpdate = useCallback(async () => {
    const api = getApi()
    if (!api || !('checkForUpdate' in api)) return

    setUpdateStatus({ status: 'checking' })
    try {
      const result = await api.checkForUpdate()
      if (result.available) {
        setUpdateStatus({
          status: 'available',
          version: result.version
        })
      } else {
        setUpdateStatus({ status: 'idle' })
      }
    } catch (e) {
      setUpdateStatus({ status: 'error', error: String(e) })
    }
  }, [])

  const downloadUpdate = useCallback(async () => {
    const api = getApi()
    if (!api || !('downloadUpdate' in api)) return

    setUpdateStatus(prev => ({
      status: 'downloading',
      version: prev.version,
      progress: 0
    }))

    try {
      const result = await api.downloadUpdate()
      if (result.success) {
        setUpdateStatus({ status: 'downloaded' })
      } else {
        setUpdateStatus({ status: 'error', error: result.error })
      }
    } catch (e) {
      setUpdateStatus({ status: 'error', error: String(e) })
    }
  }, [])

  const installUpdate = useCallback(() => {
    const api = getApi()
    if (api && 'installUpdate' in api) {
      api.installUpdate()
    }
  }, [])

  return {
    appVersion,
    updateStatus,
    checkForUpdate,
    downloadUpdate,
    installUpdate
  }
}
