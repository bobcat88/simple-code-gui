import React, { useRef, useEffect, useState } from 'react'
import { getSampleUrl } from '../../utils/voiceUtils'
import type { VoiceSettings, XttsSettings } from './settingsTypes'

interface InstalledVoice {
  key: string
  displayName: string
  source: string
}

interface TadaSampleVoice {
  id: string
  name: string
  description: string
  available: boolean
}

interface VoiceOutputSettingsProps {
  voice: VoiceSettings
  xtts: XttsSettings
  playingPreview: string | null
  previewLoading: string | null
  voiceVolume: number
  onVoiceSelect: (voiceKey: string, source: string) => void
  onSpeedChange: (speed: number) => void
  onXttsChange: (settings: XttsSettings) => void
  onShowVoiceBrowser: () => void
  onPreviewStateChange: (state: { playingPreview: string | null; previewLoading: string | null }) => void
  onTadaSelectSample?: () => void
  onTadaUseSample?: (sampleId: string) => void
  tadaVoiceSample?: string | null
  tadaSampleVoices?: TadaSampleVoice[]
  tadaInstalled?: boolean | null
  tadaInstalling?: boolean
  tadaInstallError?: string | null
  onTadaInstall?: () => void
  tadaHfAuthenticated?: boolean | null
  onTadaHfLogin?: (token: string) => Promise<{ success: boolean; error?: string }>
}

export function VoiceOutputSettings({
  voice,
  xtts,
  playingPreview,
  previewLoading,
  voiceVolume,
  onVoiceSelect,
  onSpeedChange,
  onXttsChange,
  onShowVoiceBrowser,
  onPreviewStateChange,
  onTadaSelectSample,
  onTadaUseSample,
  tadaVoiceSample,
  tadaSampleVoices,
  tadaInstalled,
  tadaInstalling,
  tadaInstallError,
  onTadaInstall,
  tadaHfAuthenticated,
  onTadaHfLogin,
}: VoiceOutputSettingsProps): React.ReactElement {
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const [hfToken, setHfToken] = useState('')
  const [hfLoginLoading, setHfLoginLoading] = useState(false)
  const [hfLoginError, setHfLoginError] = useState<string | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause()
        previewAudioRef.current.src = ''
        previewAudioRef.current = null
      }
    }
  }, [])

  function stopPreview(): void {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause()
      previewAudioRef.current.src = ''
      previewAudioRef.current = null
    }
    onPreviewStateChange({ playingPreview: null, previewLoading: null })
  }

  async function handlePreview(voiceKey: string, source: string): Promise<void> {
    stopPreview()

    // If clicking the same voice, just stop
    if (playingPreview === voiceKey) {
      return
    }

    // For TADA voices, synthesize sample text
    if (source === 'tada') {
      onPreviewStateChange({ playingPreview: null, previewLoading: voiceKey })
      try {
        const result = await window.electronAPI?.tadaSpeak?.(
          'Hello! This is a preview of my voice.'
        )
        if (result?.success && result.audioData) {
          const audio = new Audio(`data:audio/wav;base64,${result.audioData}`)
          audio.volume = voiceVolume
          audio.onended = () => {
            onPreviewStateChange({ playingPreview: null, previewLoading: null })
            previewAudioRef.current = null
          }
          audio.onerror = () => {
            onPreviewStateChange({ playingPreview: null, previewLoading: null })
            previewAudioRef.current = null
          }
          previewAudioRef.current = audio
          onPreviewStateChange({ previewLoading: null, playingPreview: voiceKey })
          audio.play()
        } else {
          onPreviewStateChange({ playingPreview: null, previewLoading: null })
          console.error('Failed to preview TADA voice:', result?.error)
        }
      } catch (e) {
        onPreviewStateChange({ playingPreview: null, previewLoading: null })
        console.error('Failed to preview TADA voice:', e)
      }
      return
    }

    // For XTTS voices, synthesize sample text
    if (source === 'xtts') {
      onPreviewStateChange({ playingPreview: null, previewLoading: voiceKey })
      try {
        const result = await window.electronAPI?.xttsSpeak?.(
          'Hello! This is a preview of my voice.',
          voiceKey,
          'en'
        )
        if (result?.success && result.audioData) {
          const audio = new Audio(`data:audio/wav;base64,${result.audioData}`)
          audio.volume = voiceVolume
          audio.onended = () => {
            onPreviewStateChange({ playingPreview: null, previewLoading: null })
            previewAudioRef.current = null
          }
          audio.onerror = () => {
            onPreviewStateChange({ playingPreview: null, previewLoading: null })
            previewAudioRef.current = null
          }
          previewAudioRef.current = audio
          onPreviewStateChange({ previewLoading: null, playingPreview: voiceKey })
          audio.play()
        } else {
          onPreviewStateChange({ playingPreview: null, previewLoading: null })
          console.error('Failed to preview XTTS voice:', result?.error)
        }
      } catch (e) {
        onPreviewStateChange({ playingPreview: null, previewLoading: null })
        console.error('Failed to preview XTTS voice:', e)
      }
      return
    }

    // For Piper voices, try Hugging Face sample first
    const sampleUrl = getSampleUrl(voiceKey)
    if (sampleUrl) {
      const audio = new Audio(sampleUrl)
      audio.volume = voiceVolume
      audio.onended = () => {
        onPreviewStateChange({ playingPreview: null, previewLoading: null })
        previewAudioRef.current = null
      }
      audio.onerror = () => {
        onPreviewStateChange({ playingPreview: null, previewLoading: null })
        previewAudioRef.current = null
      }
      previewAudioRef.current = audio
      onPreviewStateChange({ playingPreview: voiceKey, previewLoading: null })
      audio.play()
      return
    }

    // For built-in/custom Piper voices, synthesize sample text
    onPreviewStateChange({ playingPreview: null, previewLoading: voiceKey })
    try {
      // Temporarily set the voice, speak, then restore
      const originalVoice = voice.selectedVoice
      const originalEngine = voice.selectedEngine
      await window.electronAPI?.voiceApplySettings?.({
        ttsVoice: voiceKey,
        ttsEngine: 'piper',
        ttsSpeed: 1.0
      })
      const result = await window.electronAPI?.voiceSpeak?.(
        'Hello! This is a preview of my voice.'
      )
      // Restore original settings
      await window.electronAPI?.voiceApplySettings?.({
        ttsVoice: originalVoice,
        ttsEngine: originalEngine,
        ttsSpeed: voice.ttsSpeed
      })

      if (result?.success && result.audioData) {
        const audio = new Audio(`data:audio/wav;base64,${result.audioData}`)
        audio.volume = voiceVolume
        audio.onended = () => {
          onPreviewStateChange({ playingPreview: null, previewLoading: null })
          previewAudioRef.current = null
        }
        audio.onerror = () => {
          onPreviewStateChange({ playingPreview: null, previewLoading: null })
          previewAudioRef.current = null
        }
        previewAudioRef.current = audio
        onPreviewStateChange({ previewLoading: null, playingPreview: voiceKey })
        audio.play()
      } else {
        onPreviewStateChange({ playingPreview: null, previewLoading: null })
        console.error('Failed to preview voice:', result?.error)
      }
    } catch (e) {
      onPreviewStateChange({ playingPreview: null, previewLoading: null })
      console.error('Failed to preview voice:', e)
    }
  }

  function getVoiceSourceLabel(source: string): string {
    switch (source) {
      case 'builtin': return 'Built-in'
      case 'custom': return 'Custom'
      case 'xtts': return 'XTTS Clone'
      case 'tada': return 'TADA Neural'
      default: return 'Downloaded'
    }
  }

  return (
    <div className="form-group">
      <label>Voice Output (Text-to-Speech)</label>
      <p className="form-hint">
        Piper voices, XTTS clones, and TADA neural voices for Claude to speak responses aloud.
      </p>
      <div className="voice-options">
        {voice.installedVoices.length > 0 ? (
          voice.installedVoices.map((v) => {
            const isSelected = voice.selectedVoice === v.key
            const isPlaying = playingPreview === v.key
            const isLoading = previewLoading === v.key
            return (
              <div
                key={v.key}
                className={`voice-option installed ${isSelected ? 'selected' : ''}`}
                onClick={() => onVoiceSelect(v.key, v.source)}
                style={{ cursor: 'pointer' }}
              >
                <div className="voice-info">
                  <span className="voice-label">{v.displayName}</span>
                  <span className="voice-desc">{getVoiceSourceLabel(v.source)}</span>
                </div>
                <button
                  className={`voice-preview-btn ${isPlaying ? 'playing' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    handlePreview(v.key, v.source)
                  }}
                  disabled={isLoading}
                  title={isPlaying ? 'Stop preview' : 'Play preview'}
                >
                  {isLoading ? '...' : isPlaying ? '⏹' : '▶'}
                </button>
                <span className={`voice-status ${isSelected ? 'active' : 'installed'}`}>
                  {isSelected ? 'Active' : 'Installed'}
                </span>
              </div>
            )
          })
        ) : (
          <div className="voice-option">
            <div className="voice-info">
              <span className="voice-label">No voices installed</span>
              <span className="voice-desc">Browse and download voices to get started</span>
            </div>
          </div>
        )}
      </div>
      <button
        className="btn-secondary"
        onClick={onShowVoiceBrowser}
        style={{ marginTop: '8px' }}
      >
        Browse Voices...
      </button>

      {/* TADA Engine Install */}
      {tadaInstalled === false && (
        <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <label style={{ marginBottom: '4px', display: 'block', fontWeight: 600 }}>TADA Neural Voice Cloning</label>
          <p className="form-hint" style={{ marginBottom: '8px' }}>
            High-quality neural TTS using HumeAI/tada-1b. Clones any voice from a short audio sample. Requires Python 3.10+ and ~2GB disk space.
          </p>
          <button
            className="btn-primary"
            disabled={tadaInstalling}
            onClick={onTadaInstall}
          >
            {tadaInstalling ? 'Installing TADA (this may take several minutes)...' : 'Install TADA'}
          </button>
          {tadaInstallError && (
            <p style={{ color: 'var(--error, #f44)', fontSize: '12px', marginTop: '6px' }}>{tadaInstallError}</p>
          )}
        </div>
      )}

      {/* Voice Speed */}
      <div className="slider-group" style={{ marginTop: '16px' }}>
        <div className="slider-header">
          <label>Speed</label>
          <span className="slider-value">{voice.ttsSpeed.toFixed(1)}x</span>
        </div>
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.1"
          value={voice.ttsSpeed}
          onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
          className="slider"
        />
        <div className="slider-labels">
          <span>Slow</span>
          <span>Fast</span>
        </div>
      </div>

      {/* XTTS Quality Settings - only show when XTTS voice selected */}
      {voice.selectedEngine === 'xtts' && (
        <div className="xtts-settings" style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
          <label style={{ marginBottom: '12px', display: 'block', fontWeight: 600 }}>XTTS Quality Settings</label>

          <div className="slider-group">
            <div className="slider-header">
              <label>Temperature</label>
              <span className="slider-value">{xtts.temperature.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={xtts.temperature}
              onChange={(e) => onXttsChange({ ...xtts, temperature: parseFloat(e.target.value) })}
              className="slider"
            />
            <div className="slider-labels">
              <span>Consistent</span>
              <span>Expressive</span>
            </div>
          </div>

          <div className="slider-group" style={{ marginTop: '12px' }}>
            <div className="slider-header">
              <label>Top-P</label>
              <span className="slider-value">{xtts.topP.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={xtts.topP}
              onChange={(e) => onXttsChange({ ...xtts, topP: parseFloat(e.target.value) })}
              className="slider"
            />
            <div className="slider-labels">
              <span>Focused</span>
              <span>Diverse</span>
            </div>
          </div>

          <div className="slider-group" style={{ marginTop: '12px' }}>
            <div className="slider-header">
              <label>Repetition Penalty</label>
              <span className="slider-value">{xtts.repetitionPenalty.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="5.0"
              step="0.5"
              value={xtts.repetitionPenalty}
              onChange={(e) => onXttsChange({ ...xtts, repetitionPenalty: parseFloat(e.target.value) })}
              className="slider"
            />
            <div className="slider-labels">
              <span>Allow</span>
              <span>Penalize</span>
            </div>
          </div>
        </div>
      )}

      {/* TADA Settings - only show when TADA engine selected */}
      {voice.selectedEngine === 'tada' && (
        <div className="tada-settings" style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
          {/* HuggingFace login prompt */}
          {tadaHfAuthenticated === false && (
            <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-warning, rgba(255,200,50,0.1))', borderRadius: '8px', border: '1px solid var(--border-warning, rgba(255,200,50,0.3))' }}>
              <label style={{ marginBottom: '4px', display: 'block', fontWeight: 600 }}>HuggingFace Login Required</label>
              <p className="form-hint" style={{ marginBottom: '8px' }}>
                TADA uses Meta's Llama 3.2 tokenizer which requires HuggingFace access.
                Accept access at{' '}
                <a href="https://huggingface.co/meta-llama/Llama-3.2-1B" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                  meta-llama/Llama-3.2-1B
                </a>
                , then paste your{' '}
                <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                  HF token
                </a>
                {' '}below.
              </p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="password"
                  value={hfToken}
                  onChange={(e) => { setHfToken(e.target.value); setHfLoginError(null) }}
                  placeholder="hf_..."
                  style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text)', fontSize: '13px' }}
                />
                <button
                  className="btn-primary"
                  disabled={!hfToken.trim() || hfLoginLoading}
                  onClick={async () => {
                    setHfLoginLoading(true)
                    setHfLoginError(null)
                    const result = await onTadaHfLogin?.(hfToken.trim())
                    setHfLoginLoading(false)
                    if (result?.success) {
                      setHfToken('')
                    } else {
                      setHfLoginError(result?.error || 'Login failed')
                    }
                  }}
                >
                  {hfLoginLoading ? 'Logging in...' : 'Login'}
                </button>
              </div>
              {hfLoginError && (
                <p style={{ color: 'var(--error, #f44)', fontSize: '12px', marginTop: '4px' }}>{hfLoginError}</p>
              )}
            </div>
          )}

          <label style={{ marginBottom: '8px', display: 'block', fontWeight: 600 }}>TADA Voice Sample</label>
          <p className="form-hint" style={{ marginBottom: '12px' }}>
            TADA clones voice characteristics from a reference audio sample. Pick a bundled sample or select your own WAV file.
          </p>

          {/* Bundled sample voices */}
          {tadaSampleVoices && tadaSampleVoices.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
              {tadaSampleVoices.filter(s => s.available).map(sample => {
                const isSelected = tadaVoiceSample?.includes(sample.id.replace(/-/g, '-'))
                return (
                  <div
                    key={sample.id}
                    className={`voice-option installed ${isSelected ? 'selected' : ''}`}
                    onClick={() => onTadaUseSample?.(sample.id)}
                    style={{ cursor: 'pointer', padding: '8px 12px' }}
                  >
                    <div className="voice-info">
                      <span className="voice-label">{sample.name}</span>
                      <span className="voice-desc">{sample.description}</span>
                    </div>
                    <span className={`voice-status ${isSelected ? 'active' : 'installed'}`}>
                      {isSelected ? 'Active' : 'Select'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn-secondary"
              onClick={onTadaSelectSample}
              style={{ whiteSpace: 'nowrap' }}
            >
              Custom Audio Sample...
            </button>
            <span style={{ fontSize: '12px', opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tadaVoiceSample
                ? tadaVoiceSample.split(/[/\\]/).pop()
                : 'No sample selected'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
