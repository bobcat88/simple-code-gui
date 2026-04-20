import React, { createContext, useEffect, useState, useMemo, useCallback } from 'react'
import type { VoiceContextValue } from './types.js'
import { useTTSHandlers } from './ttsHandlers.js'
import { useSTTHandlers } from './sttHandlers.js'

export const VoiceContext = createContext<VoiceContextValue | null>(null)

export function VoiceProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [autoListenEnabled, setAutoListenEnabledState] = useState(false)

  // Initialize TTS handlers
  const tts = useTTSHandlers({ settingsLoaded })

  // Create save function for STT handlers
  const saveVoiceSetting = useCallback(async (key: string, value: boolean | number | string) => {
    if (!settingsLoaded || !window.electronAPI) return
    const settings = await window.electronAPI?.getSettings()
    await window.electronAPI?.saveSettings({ ...settings, [key]: value })
  }, [settingsLoaded])

  const setAutoListenEnabled = useCallback((enabled: boolean) => {
    setAutoListenEnabledState(enabled)
    saveVoiceSetting('voiceAutoListen', enabled)
  }, [saveVoiceSetting])

  // Initialize STT handlers
  const stt = useSTTHandlers({ saveVoiceSetting })

  // Transcription handlers registry
  const handlersRef = useRef<Map<string, (text: string) => void>>(new Map())

  const registerTranscriptionHandler = useCallback((id: string, handler: (text: string) => void) => {
    handlersRef.current.set(id, handler)
  }, [])

  const unregisterTranscriptionHandler = useCallback((id: string) => {
    handlersRef.current.delete(id)
  }, [])

  const handleGlobalTranscription = useCallback((text: string) => {
    // Call all registered handlers (usually only one)
    handlersRef.current.forEach(handler => handler(text))
  }, [])

  // Global PTT listener
  useEffect(() => {
    let pttActive = false

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!stt.pushToTalkEnabled) return
      if (e.code !== 'Space' || !e.ctrlKey) return
      if (e.repeat) return
      if (stt.isModelLoading) return

      e.preventDefault()
      if (!pttActive) {
        pttActive = true
        tts.stopSpeaking()
        stt.startRecording(handleGlobalTranscription)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!stt.pushToTalkEnabled) return
      if (e.code !== 'Space') return // Note: ctrl might have been released first

      if (pttActive) {
        pttActive = false
        stt.stopRecording()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [stt.pushToTalkEnabled, stt.isModelLoading, stt.startRecording, stt.stopRecording, handleGlobalTranscription, tts])

  // GAP 3: Auto-listen after TTS logic
  const lastSpeakingRef = useRef(false)
  useEffect(() => {
    if (lastSpeakingRef.current && !tts.isSpeaking && autoListenEnabled) {
      // Small delay to ensure audio system is ready
      const timer = setTimeout(() => {
        if (!stt.isRecording) {
          stt.startRecording(handleGlobalTranscription)
        }
      }, 500)
      return () => clearTimeout(timer)
    }
    lastSpeakingRef.current = tts.isSpeaking
  }, [tts.isSpeaking, autoListenEnabled, stt.isRecording, stt.startRecording, handleGlobalTranscription])

  // Load settings on mount
  useEffect(() => {
    if (!window.electronAPI) {
      setSettingsLoaded(true)
      return
    }
    window.electronAPI?.getSettings().then((settings) => {
      if (settings.voiceOutputEnabled !== undefined) tts.setVoiceOutputEnabledState(settings.voiceOutputEnabled)
      if (settings.voiceSilenceThreshold !== undefined) stt.setSilenceThresholdState(settings.voiceSilenceThreshold)
      if (settings.voiceVolume !== undefined) tts.setVolumeState(settings.voiceVolume)
      if (settings.voiceSpeed !== undefined) {
        tts.setSpeedState(settings.voiceSpeed)
        window.electronAPI?.voiceApplySettings?.({ ttsSpeed: settings.voiceSpeed })
      }
      if (settings.voiceSkipOnNew !== undefined) tts.setSkipOnNewState(settings.voiceSkipOnNew)
      if (settings.voicePushToTalk !== undefined) stt.setPushToTalkEnabledState(settings.voicePushToTalk)
      if (settings.voiceAutoListen !== undefined) setAutoListenEnabledState(settings.voiceAutoListen)
      setSettingsLoaded(true)
    }).catch(() => setSettingsLoaded(true))

    // Load global voice settings for project override feature
    window.electronAPI?.voiceGetSettings?.()?.then((voiceSettings) => {
      if (voiceSettings) {
        tts.refs.globalVoiceRef.current = {
          voice: voiceSettings.ttsVoice || '',
          engine: voiceSettings.ttsEngine || 'piper'
        }
      }
    })?.catch(e => console.error('Failed to load global voice settings:', e))
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cancel any running processQueue
      tts.refs.processingGenerationRef.current++
      // Unblock any hung audio promise
      if (tts.refs.audioResolveRef.current) {
        tts.refs.audioResolveRef.current()
        tts.refs.audioResolveRef.current = null
      }
      // Clean up audio element and blob URL
      if (tts.refs.audioRef.current) {
        tts.refs.audioRef.current.pause()
        tts.refs.audioRef.current = null
      }
      if (tts.refs.audioUrlRef.current) {
        URL.revokeObjectURL(tts.refs.audioUrlRef.current)
        tts.refs.audioUrlRef.current = null
      }
      if (stt.refs.silenceTimerRef.current) {
        clearTimeout(stt.refs.silenceTimerRef.current)
      }
      if (stt.refs.whisperRef.current) {
        stt.refs.whisperRef.current.destroy()
        stt.refs.whisperRef.current = null
      }
    }
  }, [])

  const value = useMemo((): VoiceContextValue => ({
    // Voice Output
    voiceOutputEnabled: tts.voiceOutputEnabled,
    setVoiceOutputEnabled: tts.setVoiceOutputEnabled,
    speakText: tts.speakText,
    stopSpeaking: tts.stopSpeaking,
    isSpeaking: tts.isSpeaking,
    volume: tts.volume,
    setVolume: tts.setVolume,
    speed: tts.speed,
    setSpeed: tts.setSpeed,
    skipOnNew: tts.skipOnNew,
    setSkipOnNew: tts.setSkipOnNew,
    setProjectVoice: tts.setProjectVoice,
    // Voice Input
    isRecording: stt.isRecording,
    isModelLoading: stt.isModelLoading,
    isModelLoaded: stt.isModelLoaded,
    modelLoadProgress: stt.modelLoadProgress,
    modelLoadStatus: stt.modelLoadStatus,
    currentTranscription: stt.currentTranscription,
    whisperModel: stt.whisperModel,
    setWhisperModel: stt.setWhisperModel,
    audioLevel: stt.audioLevel,
    silenceThreshold: stt.silenceThreshold,
    setSilenceThreshold: stt.setSilenceThreshold,
    startRecording: stt.startRecording,
    stopRecording: stt.stopRecording,
    // Push-to-Talk
    pushToTalkEnabled: stt.pushToTalkEnabled,
    setPushToTalkEnabled: stt.setPushToTalkEnabled,
    // Auto-listen
    autoListenEnabled,
    setAutoListenEnabled,
    // Transcription handlers
    registerTranscriptionHandler,
    unregisterTranscriptionHandler
  }), [
    tts.voiceOutputEnabled,
    tts.setVoiceOutputEnabled,
    tts.speakText,
    tts.stopSpeaking,
    tts.isSpeaking,
    tts.volume,
    tts.setVolume,
    tts.speed,
    tts.setSpeed,
    tts.skipOnNew,
    tts.setSkipOnNew,
    tts.setProjectVoice,
    stt.isRecording,
    stt.isModelLoading,
    stt.isModelLoaded,
    stt.modelLoadProgress,
    stt.modelLoadStatus,
    stt.currentTranscription,
    stt.whisperModel,
    stt.setWhisperModel,
    stt.audioLevel,
    stt.silenceThreshold,
    stt.setSilenceThreshold,
    stt.startRecording,
    stt.stopRecording,
    stt.pushToTalkEnabled,
    stt.setPushToTalkEnabled,
    autoListenEnabled,
    setAutoListenEnabled,
    registerTranscriptionHandler,
    unregisterTranscriptionHandler
  ])

  return (
    <VoiceContext.Provider value={value}>
      {children}
    </VoiceContext.Provider>
  )
}
