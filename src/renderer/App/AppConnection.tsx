import React, { useEffect, useState, useCallback } from 'react'
import { ConnectionScreen } from '../components/ConnectionScreen'
import { MainApp } from './MainApp'
import type { Api, HttpBackend } from '../api'
import { isTauriEnvironment, initializeApi } from '../api'

// Check if running in Capacitor native app
export function isCapacitorApp(): boolean {
  return typeof window !== 'undefined' &&
         typeof (window as any).Capacitor !== 'undefined' &&
         (window as any).Capacitor?.isNativePlatform?.() === true
}

// Helper to validate port
function isValidPort(port: number): boolean {
  return typeof port === 'number' && Number.isInteger(port) && port >= 1 && port <= 65535
}

export function AppConnection(): React.ReactElement | null {
  // Check if we're running in Tauri or browser/Capacitor
  const isTauri = isTauriEnvironment()
  const isDesktop = isTauri
  const isCapacitor = isCapacitorApp()

  // Add mobile class to body for CSS targeting
  useEffect(() => {
    if (isCapacitor || !isDesktop) {
      document.body.classList.add('is-mobile-app')
    }
    return () => {
      document.body.classList.remove('is-mobile-app')
    }
  }, [isCapacitor, isDesktop])

  // Connection state for browser/Capacitor mode
  const [isConnected, setIsConnected] = useState(isDesktop)
  const [api, setApiState] = useState<Api | null>(isDesktop ? initializeApi() : null)

  // Handle successful connection from ConnectionScreen
  const handleConnected = useCallback((connectedApi: HttpBackend) => {
    setApiState(connectedApi)
    setIsConnected(true)
  }, [])

  // Handle disconnect - return to connection screen but keep saved hosts
  const handleDisconnect = useCallback(() => {
    console.log('[App] Disconnecting...')
    // Only clear the active connection, keep saved hosts for easy reconnect
    localStorage.removeItem('claude-terminal-connection')
    // Set flag to prevent auto-reconnect (cleared on next app launch)
    sessionStorage.setItem('claude-terminal-manual-disconnect', 'true')
    setApiState(null)
    setIsConnected(false)
  }, [])

  // Try to restore saved connection on mount (browser/Capacitor only)
  useEffect(() => {
    if (isConnected) return

    // Check for token in URL (from server redirect)
    const urlParams = new URLSearchParams(window.location.search)
    const urlToken = urlParams.get('token')

    if (urlToken) {
      // We have a token from URL - extract host/port from current location
      const host = window.location.hostname
      const port = parseInt(window.location.port) || 38470

      if (!isValidPort(port)) {
        console.error('[App] Invalid port from URL:', port)
        return
      }

      const config = { host, port, token: urlToken }
      localStorage.setItem('claude-terminal-connection', JSON.stringify(config))
      window.history.replaceState({}, document.title, window.location.pathname)
      console.log('[App] Connecting with URL token:', { host, port, tokenLength: urlToken.length })
    }

    try {
      const saved = localStorage.getItem('claude-terminal-connection')
      if (saved) {
        const config = JSON.parse(saved)
        if (config.host && config.token && isValidPort(config.port)) {
          // Valid saved config
        } else if (config.port && !isValidPort(config.port)) {
          localStorage.removeItem('claude-terminal-connection')
        }
      }
    } catch (e) {
      // Ignore
    }
  }, [isConnected])

  if (!isConnected || !api) {
    let savedConfig: { host: string; port: number; token: string } | null = null
    try {
      const saved = localStorage.getItem('claude-terminal-connection')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && isValidPort(parsed.port)) {
          savedConfig = parsed
        }
      }
    } catch {
      // Ignore
    }

    return <ConnectionScreen onConnected={handleConnected} savedConfig={savedConfig} />
  }

  // Render the main app with the connected API
  return <MainApp api={api} isElectron={false} isTauri={isTauri} onDisconnect={handleDisconnect} />
}
