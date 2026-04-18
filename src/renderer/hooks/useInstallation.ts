import { useState, useCallback } from 'react'
import type { Api } from '../api'

type InstallingType = 'node' | 'git' | 'claude' | null

interface UseInstallationReturn {
  claudeInstalled: boolean | null
  npmInstalled: boolean | null
  gitBashInstalled: boolean | null
  installing: InstallingType
  installError: string | null
  installMessage: string | null
  checkInstallation: () => Promise<void>
  handleInstallNode: () => Promise<void>
  handleInstallGit: () => Promise<void>
  handleInstallClaude: () => Promise<void>
}

export function useInstallation(api: Api): UseInstallationReturn {
  const [claudeInstalled, setClaudeInstalled] = useState<boolean | null>(null)
  const [npmInstalled, setNpmInstalled] = useState<boolean | null>(null)
  const [gitBashInstalled, setGitBashInstalled] = useState<boolean | null>(null)
  const [installing, setInstalling] = useState<InstallingType>(null)
  const [installError, setInstallError] = useState<string | null>(null)
  const [installMessage, setInstallMessage] = useState<string | null>(null)

  const checkInstallation = useCallback(async () => {
    try {
      // For Tauri, we assume installed or check via version
      await api.getVersion()
      setClaudeInstalled(true)
      setNpmInstalled(true)
      setGitBashInstalled(true)
    } catch (e) {
      console.error('Check installation failed', e)
    }
  }, [api])

  const handleInstallNode = useCallback(async () => {
    setInstalling('node')
    setInstalling(null)
  }, [])

  const handleInstallClaude = useCallback(async () => {
    setInstalling('claude')
    setInstalling(null)
  }, [])

  const handleInstallGit = useCallback(async () => {
    setInstalling('git')
    setInstalling(null)
  }, [])

  return {
    claudeInstalled,
    npmInstalled,
    gitBashInstalled,
    installing,
    installError,
    installMessage,
    checkInstallation,
    handleInstallNode,
    handleInstallGit,
    handleInstallClaude
  }
}
