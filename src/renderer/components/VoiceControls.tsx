import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useVoice } from '../contexts/VoiceContext'
import { Mic, MicOff, Volume2, Search, Activity, Loader2 } from 'lucide-react'
import { cn } from '../lib/utils'

interface VoiceControlsProps {
  activeTabId: string | null
  onTranscription: (text: string) => void
  isVertical?: boolean
}

export function VoiceControls({
  activeTabId,
  onTranscription,
  isVertical = false
}: VoiceControlsProps) {
  const {
    // Voice Output
    voiceOutputEnabled, setVoiceOutputEnabled, isSpeaking, stopSpeaking, volume, speakText,
    // Voice Input
    isRecording, isModelLoading, isModelLoaded, modelLoadProgress, modelLoadStatus,
    currentTranscription, startRecording, stopRecording,
    audioLevel, silenceThreshold, setSilenceThreshold,
    // Push-to-Talk
    pushToTalkEnabled, setPushToTalkEnabled
  } = useVoice()

  const [ttsInstalled, setTtsInstalled] = useState(false)
  const [installingTTS, setInstallingTTS] = useState(false)
  const [showLevelMeter, setShowLevelMeter] = useState(false)

  // Use ref to always have latest activeTabId for transcription callback
  const activeTabIdRef = useRef(activeTabId)
  useEffect(() => {
    activeTabIdRef.current = activeTabId
  }, [activeTabId])

  // Refs for PTT state to avoid stale closures in event listeners
  const pttEnabledRef = useRef(pushToTalkEnabled)
  const isRecordingRef = useRef(isRecording)
  const isModelLoadingRef = useRef(isModelLoading)
  const pttActiveRef = useRef(false) // true while PTT key is held

  useEffect(() => { pttEnabledRef.current = pushToTalkEnabled }, [pushToTalkEnabled])
  useEffect(() => { isRecordingRef.current = isRecording }, [isRecording])
  useEffect(() => { isModelLoadingRef.current = isModelLoading }, [isModelLoading])

  useEffect(() => {
    checkInstallation()

    const cleanup = window.electronAPI?.onInstallProgress?.((data: any) => {
      if ((data.type === 'piper' || data.type === 'piper-voice') && data.percent === 100) {
        setInstallingTTS(false)
        checkInstallation()
      }
    })
    return cleanup
  }, [])

  // Show level meter while recording
  useEffect(() => {
    if (isRecording) {
      setShowLevelMeter(true)
    } else {
      // Delay hiding to avoid flicker
      const timer = setTimeout(() => setShowLevelMeter(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isRecording])

  const checkInstallation = async () => {
    try {
      const ttsStatus = await window.electronAPI?.voiceCheckTTS?.()
      setTtsInstalled(ttsStatus?.installed ?? false)
    } catch (e) {
      // Voice features not available
    }
  }

  // Handle transcription callback - accumulate text while recording
  const handleTranscription = useCallback((text: string) => {
    onTranscription(text)
  }, [onTranscription])

  // Stable ref for transcription callback used by PTT
  const handleTranscriptionRef = useRef(handleTranscription)
  useEffect(() => { handleTranscriptionRef.current = handleTranscription }, [handleTranscription])

  // Push-to-Talk keyboard handler (Ctrl+Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!pttEnabledRef.current) return
      if (e.code !== 'Space' || !e.ctrlKey) return
      if (e.repeat) return // Ignore key repeat
      if (isModelLoadingRef.current) return

      e.preventDefault()
      e.stopPropagation()

      if (!isRecordingRef.current && !pttActiveRef.current) {
        pttActiveRef.current = true
        startRecording(handleTranscriptionRef.current)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!pttEnabledRef.current) return
      if (e.code !== 'Space') return
      if (!pttActiveRef.current) return

      e.preventDefault()
      e.stopPropagation()

      pttActiveRef.current = false
      if (isRecordingRef.current) {
        stopRecording()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyUp, true)

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp, true)
    }
  }, [startRecording, stopRecording])

  const handleVoiceInput = async () => {
    if (isModelLoading) return

    if (isRecording) {
      stopRecording()
    } else {
      await startRecording(handleTranscription)
    }
  }

  const handleVoiceOutput = async () => {
    if (installingTTS) return

    if (!ttsInstalled) {
      setInstallingTTS(true)
      try {
        const result = await window.electronAPI?.voiceInstallPiper?.()
        if (result?.success) {
          await window.electronAPI?.voiceInstallVoice?.('en_US-libritts_r-medium')
        }
        await checkInstallation()
      } catch (e) {
        console.error('Failed to install Piper:', e)
      }
      setInstallingTTS(false)
    } else {
      // If currently speaking, stop; otherwise toggle
      if (isSpeaking) {
        stopSpeaking()
      }
      const newState = !voiceOutputEnabled
      setVoiceOutputEnabled(newState)

      // Test TTS when enabling
      if (newState) {
        // Use the context's speakText for consistency
        speakText('Voice output enabled. Hello!')
      }
    }
  }

  const getVoiceInputTitle = () => {
    if (isModelLoading) return `Loading Whisper... ${modelLoadProgress}%`
    if (isRecording) {
      if (pushToTalkEnabled) {
        return pttActiveRef.current ? 'Held - Speak now' : 'Push Ctrl+Space'
      }
      return 'Recording...'
    }
    return pushToTalkEnabled ? 'Push-to-Talk (Ctrl+Space)' : 'Click to start voice'
  }

  const buttonClass = "p-3 rounded-2xl transition-all duration-300 group relative flex items-center justify-center w-full text-muted-foreground hover:bg-muted/80 hover:text-foreground scale-95 hover:scale-100"

  return (
    <div className={cn("flex gap-2", isVertical ? "flex-col w-full" : "flex-row")}>
      <button
        className={cn(buttonClass, isRecording && "bg-red-500/20 text-red-500 animate-pulse scale-100")}
        onClick={handleVoiceInput}
        disabled={isModelLoading}
        title={getVoiceInputTitle()}
      >
        {isModelLoading ? <Loader2 size={20} className="animate-spin" /> : isRecording ? <MicOff size={20} /> : <Mic size={20} />}
        
        {showLevelMeter && isVertical && (
          <div className="absolute left-full ml-3 h-10 w-1 bg-muted rounded-full overflow-hidden">
            <div 
              className={cn("w-full transition-all duration-75", audioLevel > silenceThreshold ? "bg-primary" : "bg-muted-foreground/30")}
              style={{ height: `${audioLevel}%`, marginTop: `${100 - audioLevel}%` }}
            />
          </div>
        )}
      </button>

      <button
        className={cn(buttonClass, pushToTalkEnabled && "bg-primary/20 text-primary scale-100")}
        onClick={() => setPushToTalkEnabled(!pushToTalkEnabled)}
        title={pushToTalkEnabled ? 'PTT Active (Ctrl+Space)' : 'Auto-detect Mode'}
      >
        {pushToTalkEnabled ? <Activity size={20} /> : <Search size={20} />}
      </button>

      <button
        className={cn(buttonClass, voiceOutputEnabled && "bg-primary/20 text-primary scale-100", installingTTS && "animate-spin")}
        onClick={handleVoiceOutput}
        disabled={installingTTS}
        title={installingTTS ? 'Installing Piper...' : 'Toggle Voice Output'}
      >
        {installingTTS ? <Loader2 size={20} /> : <Volume2 size={20} />}
      </button>
    </div>
  )
}
