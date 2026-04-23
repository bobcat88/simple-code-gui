import { useState, useEffect, useCallback } from 'react'
import { Theme, getThemeById, applyTheme, themes } from '../themes'
import { useApi } from '../contexts/ApiContext'

export interface TerminalColorsCustomization {
  black?: string
  red?: string
  green?: string
  yellow?: string
  blue?: string
  magenta?: string
  cyan?: string
  white?: string
}

export interface ThemeCustomization {
  accentColor: string | null
  backgroundColor: string | null
  textColor: string | null
  terminalColors: TerminalColorsCustomization | null
}

export interface AppSettings {
  defaultProjectDir: string
  theme: string
  themeCustomization?: ThemeCustomization | null
  autoAcceptTools?: string[]
  permissionMode?: string
  backend?: 'default' | 'claude' | 'gemini' | 'codex' | 'opencode' | 'aider'
  voiceOutputEnabled?: boolean
  voiceSilenceThreshold?: number
  voiceVolume?: number
  voiceSpeed?: number
  voiceSkipOnNew?: boolean
  voicePushToTalk?: boolean
  voiceAutoListen?: boolean
  terminal?: {
    fontSize: number
    fontFamily: string
    cursorStyle: 'block' | 'underline' | 'bar'
    cursorBlink: boolean
    theme: string
    opacity: number
    lineHeight: number
    letterSpacing: number
    padding: number
  }
}

interface UseSettingsReturn {
  settings: AppSettings | null
  currentTheme: Theme
  loading: boolean
  updateSettings: (newSettings: AppSettings) => void
  updateTheme: (theme: Theme) => void
}

export function useSettings(): UseSettingsReturn {
  const api = useApi()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [currentTheme, setCurrentTheme] = useState<Theme>(themes[0])
  const [loading, setLoading] = useState(true)

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loadedSettings = await api.getSettings()
        if (!loadedSettings) {
          return
        }
        setSettings(loadedSettings)

        // Apply theme with customization
        const theme = getThemeById(loadedSettings.theme || 'default')
        applyTheme(theme, loadedSettings.themeCustomization)
        setCurrentTheme(theme)
      } catch (e) {
        console.error('Failed to load settings:', e)
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [api])

  const updateSettings = useCallback((newSettings: AppSettings) => {
    setSettings(newSettings)
  }, [])

  const updateTheme = useCallback((theme: Theme) => {
    applyTheme(theme, settings?.themeCustomization)
    setCurrentTheme(theme)
  }, [settings?.themeCustomization])

  return {
    settings,
    currentTheme,
    loading,
    updateSettings,
    updateTheme
  }
}
