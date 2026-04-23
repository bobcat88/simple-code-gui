import { useState, useEffect, useCallback } from 'react'
import { useApi } from '../contexts/ApiContext'
import type { ExtendedApi } from '../api/types'
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
  const api = useApi() as ExtendedApi
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ status: 'idle' })

  // Load app version on mount
  useEffect(() => {
    if (api && 'getVersion' in api) {
      api.getVersion().then(setAppVersion).catch(console.error)
    }
  }, [api])

  const checkForUpdate = useCallback(async () => {
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
  }, [api])

  const downloadUpdate = useCallback(async () => {
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
    if (api && 'installUpdate' in api) {
      api.installUpdate()
    }
  }, [api])

  return {
    appVersion,
    updateStatus,
    checkForUpdate,
    downloadUpdate,
    installUpdate
  }
}
