import React, { createContext, useContext, ReactNode } from 'react'
import type { Api, ApiContext as ApiContextType, ApiBackendType, ConnectionState } from '../api/types'

const ApiContext = createContext<ApiContextType | null>(null)

interface ApiProviderProps {
  api: Api
  backendType: ApiBackendType
  connectionState: ConnectionState
  connectionError?: string
  reconnect?: () => void
  children: ReactNode
}

export function ApiProvider({
  api,
  backendType,
  connectionState,
  connectionError,
  reconnect,
  children
}: ApiProviderProps) {
  const value: ApiContextType = {
    api,
    backendType,
    connectionState,
    connectionError,
    reconnect
  }

  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>
}

export function useApi(): Api {
  const context = useContext(ApiContext)
  if (!context) {
    throw new Error('useApi must be used within an ApiProvider')
  }
  return context.api
}

/**
 * Hook to access the full API context including connection state
 */
export function useApiContext(): ApiContextType {
  const context = useContext(ApiContext)
  if (!context) {
    throw new Error('useApiContext must be used within an ApiProvider')
  }
  return context
}
