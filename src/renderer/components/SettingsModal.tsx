import React, { useState, useEffect } from 'react'
import type { Theme } from '../themes'
import { VoiceBrowserModal } from './VoiceBrowserModal'
import { useVoice } from '../contexts/VoiceContext'
import { useFocusTrap } from '../hooks/useFocusTrap'
import {
  ThemeSettings,
  ProjectDirectorySettings,
  PermissionsSettings,
  BackendSettings,
  ExtensionsSettings,
  VoiceInputSettings,
  VoiceOutputSettings,
  UninstallTTSSection,
  VersionSettings,
  McpSettings,
  DEFAULT_GENERAL,
  DEFAULT_VOICE,
  DEFAULT_XTTS,
  DEFAULT_UI,
  DEFAULT_THEME_CUSTOMIZATION,
} from './settings'
import type {
  GeneralSettings,
  VoiceSettings,
  XttsSettings,
  UIState,
  SettingsModalProps,
  ThemeCustomization,
} from './settings/settingsTypes'
import { Settings, Palette, Cpu, Volume2, Info, ChevronRight, Save } from 'lucide-react'
import { cn } from '../lib/utils'

// Migrate old slider-based customization to new color-based format
function migrateThemeCustomization(saved: unknown): ThemeCustomization {
  if (!saved || typeof saved !== 'object') return DEFAULT_THEME_CUSTOMIZATION
  const obj = saved as Record<string, unknown>
  // Old format had terminalSaturation/backgroundBrightness — discard and use defaults
  if ('terminalSaturation' in obj || 'backgroundBrightness' in obj) {
    return {
      accentColor: (typeof obj.accentColor === 'string' ? obj.accentColor : null),
      backgroundColor: null,
      textColor: null,
      terminalColors: null
    }
  }
  return {
    accentColor: (typeof obj.accentColor === 'string' ? obj.accentColor : null),
    backgroundColor: (typeof obj.backgroundColor === 'string' ? obj.backgroundColor : null),
    textColor: (typeof obj.textColor === 'string' ? obj.textColor : null),
    terminalColors: (obj.terminalColors && typeof obj.terminalColors === 'object' ? obj.terminalColors as ThemeCustomization['terminalColors'] : null)
  }
}

export function SettingsModal({
  isOpen,
  onClose,
  onThemeChange,
  onSaved,
  appVersion,
  updateStatus,
  onDownloadUpdate,
  onInstallUpdate,
  projectPath,
  focusedTabPtyId,
  onOpenSession,
  initialCategory = 'general',
  api
}: SettingsModalProps): React.ReactElement | null {
  const [activeCategory, setActiveCategory] = useState(initialCategory)
  const [general, setGeneral] = useState<GeneralSettings>(DEFAULT_GENERAL)
  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen)
  const { whisperModel: activeWhisperModel, setWhisperModel: setActiveWhisperModel, volume: voiceVolume } = useVoice()
  const [installedExtensions, setInstalledExtensions] = useState<Array<{ id: string; name: string; type: string }>>([])
  const [voice, setVoice] = useState<VoiceSettings>(DEFAULT_VOICE)
  const [xtts, setXtts] = useState<XttsSettings>(DEFAULT_XTTS)
  const [ui, setUI] = useState<UIState>(DEFAULT_UI)

  const [tadaSampleVoices, setTadaSampleVoices] = useState<Array<{ id: string; name: string; description: string; available: boolean }>>([])
  const [tadaHfAuthenticated, setTadaHfAuthenticated] = useState<boolean | null>(null)
  const [tadaInstalled, setTadaInstalled] = useState<boolean | null>(null)
  const [tadaInstalling, setTadaInstalling] = useState(false)
  const [tadaInstallError, setTadaInstallError] = useState<string | null>(null)

  const categories = [
    { id: 'general', label: 'General', icon: Settings, desc: 'Core settings & backend' },
    { id: 'appearance', label: 'Appearance', icon: Palette, desc: 'Themes & styling' },
    { id: 'mcp', label: 'MCP & Agents', icon: Cpu, desc: 'Beads, GSD & tools' },
    { id: 'voice', label: 'Voice', icon: Volume2, desc: 'Speech & AI audio' },
    { id: 'about', label: 'About', icon: Info, desc: 'Version & info' },
  ]

  // Load initial settings
  useEffect(() => {
    if (isOpen) {
      api?.getSettings?.()?.then((settings) => {
        setGeneral(prev => ({
          ...prev,
          defaultProjectDir: settings.defaultProjectDir || '',
          selectedTheme: settings.theme || 'default',
          themeCustomization: migrateThemeCustomization(settings.themeCustomization),
          autoAcceptTools: settings.autoAcceptTools || [],
          permissionMode: settings.permissionMode || 'default',
          backend: settings.backend || 'default',
          glowEnabled: settings.themeCustomization?.accentColor ? true : true, // Keeping it simple
          accentColor: settings.themeCustomization?.accentColor || '#3b82f6'
        }))
      })

      // Load voice settings
      api?.voiceGetSettings?.()?.then((voiceSettings: any) => {
        if (voiceSettings) {
          setVoice(prev => ({
            ...prev,
            selectedVoice: voiceSettings.ttsVoice || 'en_US-libritts_r-medium',
            selectedEngine: voiceSettings.ttsEngine || 'piper',
            ttsSpeed: voiceSettings.ttsSpeed || 1.0,
            tadaVoiceSample: voiceSettings.tadaVoiceSample || null
          }))
          setXtts({
            temperature: voiceSettings.xttsTemperature ?? 0.65,
            topK: voiceSettings.xttsTopK ?? 50,
            topP: voiceSettings.xttsTopP ?? 0.85,
            repetitionPenalty: voiceSettings.xttsRepetitionPenalty ?? 2.0
          })
        }
      })

      refreshInstalledVoices()
    }
  }, [isOpen])

  async function refreshInstalledVoices() {
    try {
      const [piperVoices, xttsVoices, tadaStatus] = await Promise.all([
        api?.voiceGetInstalled?.(),
        api?.xttsGetVoices?.(),
        api?.tadaCheck?.()
      ])
      const combined: any[] = []
      if (piperVoices) combined.push(...piperVoices)
      if (xttsVoices) combined.push(...xttsVoices.map((v: any) => ({ key: v.id, displayName: v.name, source: 'xtts' })))
      if (tadaStatus?.installed) {
        setTadaInstalled(true)
        setTadaHfAuthenticated(tadaStatus.hfAuthenticated ?? null)
        combined.push({ key: 'tada', displayName: 'TADA (Neural Voice Clone)', source: 'tada' })
      }
      setVoice(prev => ({ ...prev, installedVoices: combined }))
    } catch (e) {
      console.error(e)
    }
  }

  const handleSave = () => {
    const updatedThemeCustomization = {
      ...general.themeCustomization,
      accentColor: general.accentColor || general.themeCustomization?.accentColor || null
    };

    api?.saveSettings?.({
      defaultProjectDir: general.defaultProjectDir,
      theme: general.selectedTheme,
      themeCustomization: updatedThemeCustomization,
      autoAcceptTools: general.autoAcceptTools,
      permissionMode: general.permissionMode,
      backend: general.backend
    })
    api?.voiceSaveSettings?.({
      ttsVoice: voice.selectedVoice,
      ttsEngine: voice.selectedEngine,
      ttsSpeed: voice.ttsSpeed,
      xttsTemperature: xtts.temperature,
      xttsTopK: xtts.topK,
      xttsTopP: xtts.topP,
      xttsRepetitionPenalty: xtts.repetitionPenalty,
      tadaVoiceSample: voice.tadaVoiceSample
    })
    onSaved?.({
      defaultProjectDir: general.defaultProjectDir,
      theme: general.selectedTheme,
      themeCustomization: updatedThemeCustomization,
      autoAcceptTools: general.autoAcceptTools,
      permissionMode: general.permissionMode,
      backend: general.backend
    })
    onClose()
  }

  const handlePlayVoicePreview = async (voiceKey: string, engine: string) => {
    setUI(prev => ({ ...prev, playingPreview: voiceKey, previewLoading: voiceKey }))
    try {
      await api?.voicePreview?.({ voice: voiceKey, engine })
    } finally {
      setUI(prev => ({ ...prev, playingPreview: null, previewLoading: null }))
    }
  }

  const handleTadaInstall = async () => {
    setTadaInstalling(true)
    setTadaInstallError(null)
    try {
      const res = await api?.tadaInstall?.()
      if (res?.success) {
        setTadaInstalled(true)
        refreshInstalledVoices()
      } else {
        setTadaInstallError(res?.error || 'Install failed')
      }
    } catch (e) {
      setTadaInstallError('Unexpected error')
    }
    setTadaInstalling(false)
  }


  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        ref={focusTrapRef}
        className="codex-modal-content w-full max-w-4xl h-[650px] rounded-[var(--radius-modal)] flex overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Sidebar */}
        <div className="w-64 border-r border-white/10 bg-black/20 flex flex-col">
          <div className="p-6">
            <h2 className="text-xl font-bold bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">Config</h2>
            <p className="text-xs text-white/40 mt-1">Manage your environment</p>
          </div>
          
          <nav className="flex-1 px-3 space-y-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                  activeCategory === cat.id 
                    ? "bg-white/10 text-white shadow-sm" 
                    : "text-white/40 hover:text-white/80 hover:bg-white/5"
                )}
              >
                <cat.icon className={cn(
                  "w-4 h-4 transition-transform duration-200",
                  activeCategory === cat.id ? "scale-110" : "group-hover:scale-110"
                )} />
                <div className="flex flex-col items-start text-left">
                  <span className="text-sm font-medium">{cat.label}</span>
                </div>
                {activeCategory === cat.id && (
                  <ChevronRight className="w-3 h-3 ml-auto opacity-40" />
                )}
              </button>
            ))}
          </nav>

          <div className="p-4 mt-auto border-t border-white/5 space-y-2">
             <button 
              onClick={handleSave}
              className="w-full flex items-center justify-center gap-2 bg-white text-black hover:bg-white/90 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all active:scale-95 shadow-lg shadow-white/5"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
            <button 
              onClick={onClose}
              className="w-full text-white/40 hover:text-white/60 text-xs py-2 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col h-full bg-black/10">
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <div className="max-w-2xl mx-auto space-y-8">
              {activeCategory === 'general' && (
                <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-300">
                  <section>
                    <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-4">Workspace</h3>
                    <ProjectDirectorySettings 
                      defaultProjectDir={general.defaultProjectDir}
                      onChange={(dir) => setGeneral(prev => ({ ...prev, defaultProjectDir: dir }))}
                    />
                  </section>
                  
                  <section>
                    <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-4">Security</h3>
                    <PermissionsSettings 
                      permissionMode={general.permissionMode}
                      autoAcceptTools={general.autoAcceptTools}
                      customTool={general.customTool}
                      onPermissionModeChange={(mode) => setGeneral(prev => ({ ...prev, permissionMode: mode }))}
                      onCustomToolChange={(tool) => setGeneral(prev => ({ ...prev, customTool: tool }))}
                      onToggleTool={(tool) => {
                        setGeneral(prev => {
                          const tools = prev.autoAcceptTools.includes(tool)
                            ? prev.autoAcceptTools.filter(t => t !== tool)
                            : [...prev.autoAcceptTools, tool]
                          return { ...prev, autoAcceptTools: tools }
                        })
                      }}
                      onAddCustomTool={() => {}} // Legacy
                      onRemoveCustomTool={() => {}} // Legacy
                    />
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-4">AI Backend</h3>
                    <BackendSettings 
                      backend={general.backend}
                      onChange={(backend) => setGeneral(prev => ({ ...prev, backend }))}
                    />
                  </section>
                </div>
              )}

              {activeCategory === 'appearance' && (
                <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-300">
                  <section>
                    <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-4">Global Styling</h3>
                    <div className="bg-white/5 border border-white/10 rounded-lg p-6 space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium text-white/80">Glow Effect</label>
                          <p className="text-xs text-white/40 mt-0.5">Enable soft accent glow behind panels</p>
                        </div>
                        <button
                          onClick={() => setGeneral(prev => ({ ...prev, glowEnabled: !prev.glowEnabled }))}
                          className={cn(
                            "w-9 h-5 rounded-full transition-colors relative",
                            general.glowEnabled ? "bg-white" : "bg-white/10"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-3 h-3 rounded-full transition-all",
                            general.glowEnabled ? "right-1 bg-black" : "left-1 bg-white/40"
                          )} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium text-white/80">Accent Color</label>
                          <p className="text-xs text-white/40 mt-0.5">Primary brand color for the interface</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={general.accentColor}
                            onChange={(e) => setGeneral(prev => ({ ...prev, accentColor: e.target.value }))}
                            className="w-8 h-8 bg-transparent border-0 cursor-pointer rounded-lg overflow-hidden"
                          />
                          <span className="text-xs font-mono text-white/40 uppercase">{general.accentColor}</span>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-4">Visual Theme</h3>
                    <ThemeSettings 
                      selectedTheme={general.selectedTheme}
                      onSelect={(themeId) => {
                        setGeneral(prev => ({ ...prev, selectedTheme: themeId }))
                      }}
                      onThemeChange={(themeObj) => {
                        if (themeObj && onThemeChange) onThemeChange(themeObj)
                      }}
                      customization={general.themeCustomization}
                      onCustomizationChange={(c) => setGeneral(prev => ({ ...prev, themeCustomization: c }))}
                    />
                  </section>
                </div>
              )}

              {activeCategory === 'mcp' && (
                <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-300">
                   <McpSettings 
                      projectPath={projectPath}
                      focusedTabPtyId={focusedTabPtyId}
                      onOpenSession={onOpenSession}
                    />
                </div>
              )}

              {activeCategory === 'voice' && (
                <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-300">
                  <section>
                    <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-4">Voice Input</h3>
                    <VoiceInputSettings 
                      whisperStatus={voice.whisperStatus}
                      activeWhisperModel={activeWhisperModel}
                      installingModel={ui.installingModel}
                      onSetActiveModel={setActiveWhisperModel}
                      onInstallModel={(model) => {
                        setUI(prev => ({ ...prev, installingModel: model }))
                        api?.voiceInstallWhisper?.(model)
                      }}
                    />
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-4">Voice Output</h3>
                    <VoiceOutputSettings 
                      voice={voice}
                      xtts={xtts}
                      playingPreview={ui.playingPreview}
                      previewLoading={ui.previewLoading}
                      voiceVolume={voiceVolume}
                      onVoiceSelect={(voiceKey, source) => setVoice(prev => ({ ...prev, selectedVoice: voiceKey, selectedEngine: source as any }))}
                      onSpeedChange={(s) => setVoice(prev => ({ ...prev, ttsSpeed: s }))}
                      onXttsChange={(newXtts) => setXtts(prev => ({ ...prev, ...newXtts }))}
                      onShowVoiceBrowser={() => setUI(prev => ({ ...prev, showVoiceBrowser: true }))}
                      onPreviewStateChange={(state) => setUI(prev => ({ ...prev, ...state }))}
                      tadaVoiceSample={voice.tadaVoiceSample}
                      tadaSampleVoices={tadaSampleVoices}
                      tadaInstalled={tadaInstalled}
                      tadaHfAuthenticated={tadaHfAuthenticated}
                      tadaInstalling={tadaInstalling}
                      tadaInstallError={tadaInstallError}
                      onTadaInstall={handleTadaInstall}
                      onTadaHfLogin={async (token) => {
                        const res = await api?.tadaLogin?.(token)
                        return res || { success: false, error: 'Login failed' }
                      }}
                    />
                  </section>
                  
                  <section className="pt-8 border-t border-white/5">
                    <UninstallTTSSection 
                      onRemove={async () => {
                        setUI(prev => ({ ...prev, removingTTS: true }))
                      }}
                      removingTTS={ui.removingTTS}
                      ttsRemovalResult={ui.ttsRemovalResult}
                    />
                  </section>
                </div>
              )}

              {activeCategory === 'about' && (
                <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-300">
                  <section>
                    <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-4">System Information</h3>
                    <VersionSettings 
                      appVersion={appVersion}
                      updateStatus={updateStatus}
                      onDownloadUpdate={onDownloadUpdate}
                      onInstallUpdate={onInstallUpdate}
                    />
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <VoiceBrowserModal 
        isOpen={ui.showVoiceBrowser}
        onClose={() => setUI(prev => ({ ...prev, showVoiceBrowser: false }))}
        onVoiceSelect={(voiceKey, engine) => {
          setUI(prev => ({ ...prev, installingVoice: voiceKey }))
          api?.voiceInstallVoice?.(voiceKey)
        }}
      />
    </div>
  )
}
