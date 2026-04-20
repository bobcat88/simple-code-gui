import React, { useState, useRef, useEffect } from 'react'
import { 
  Send, 
  Zap, 
  Shield, 
  ShieldCheck, 
  Command, 
  Sparkles,
  ChevronUp,
  Globe,
  Mic
} from 'lucide-react'
import { cn } from '../lib/utils'
import { VoiceControls } from './VoiceControls.js'

interface FloatingInputProps {
  onInput: (data: string) => void
  currentBackend: string
  onBackendChange: (backend: any) => void
  autoAccept: boolean
  onToggleAutoAccept: () => void
  isMobile?: boolean
  activeTabId?: string | null
}

export function FloatingInput({ 
  onInput, 
  currentBackend, 
  onBackendChange, 
  autoAccept, 
  onToggleAutoAccept,
  activeTabId = null
}: FloatingInputProps) {
  const [value, setValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [showVoice, setShowVoice] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (value.trim()) {
      onInput(value + '\r')
      setValue('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const adjustHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }

  const handleTranscription = useCallback((text: string) => {
    const cleaned = text.trim()
    if (!cleaned) return

    // Special case: short confirmations or cancellations
    const lower = cleaned.toLowerCase().replace(/[.!?]/g, '')
    
    // Positive confirmations
    const positiveKeywords = ['yes', 'approve', 'y', 'do it', 'yep', 'sure', 'confirm', 'go ahead', 'proceed']
    if (positiveKeywords.includes(lower)) {
      onInput('y\r')
      return
    }

    // Negative responses / Cancellations
    const negativeKeywords = ['no', 'cancel', 'stop', 'nope', 'negative', 'dont', "don't"]
    if (negativeKeywords.includes(lower)) {
      onInput('n\r') // Send 'n' to unblock prompts that expect y/n
      return
    }

    setValue(prev => {
      const space = prev && !prev.endsWith(' ') ? ' ' : ''
      return prev + space + cleaned
    })
    
    // Auto-focus after transcription
    textareaRef.current?.focus()
  }, [onInput])

  useEffect(() => {
    adjustHeight()
  }, [value])

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-3xl px-4 z-20">
      <div className={cn(
        "glass-panel rounded-xl shadow-2xl transition-all duration-300",
        "relative overflow-hidden",
        isFocused ? "border-primary/40 ring-1 ring-primary/10 shadow-primary/5" : "border-white/5"
      )}>
        <form onSubmit={handleSubmit} className="p-2 flex flex-col gap-2">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative flex items-center">
              <textarea
                ref={textareaRef}
                rows={1}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="Ask anything or run a command..."
                className="w-full bg-transparent border-none focus:ring-0 text-sm py-2.5 pl-3 pr-20 resize-none min-h-[40px] max-h-[200px] overflow-y-auto"
                style={{ height: 'auto' }}
              />
              <div className="absolute right-2 bottom-1.5 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowVoice(!showVoice)}
                  className={cn(
                    "p-2 rounded-lg transition-all duration-300",
                    showVoice ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-white/5"
                  )}
                  title="Voice Controls"
                >
                  <Mic size={16} />
                </button>
                <button
                  type="submit"
                  disabled={!value.trim()}
                  className={cn(
                    "p-2 rounded-lg transition-all duration-300",
                    value.trim() 
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:scale-105 active:scale-95" 
                      : "text-muted-foreground opacity-20 cursor-not-allowed"
                  )}
                >
                  <Send size={16} className={cn(value.trim() && "animate-in fade-in zoom-in duration-300")} />
                </button>
              </div>
            </div>
          </div>

          {showVoice && (
            <div className="px-1 pt-1 pb-2 border-t border-white/5 flex items-center justify-center" style={{ animation: 'slide-down 0.3s ease-out' }}>
              <VoiceControls 
                activeTabId={activeTabId}
                onTranscription={handleTranscription}
              />
            </div>
          )}

          <div className="flex items-center justify-between px-1 py-0.5 border-t border-border/50 mt-1">
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-muted text-[11px] font-medium text-muted-foreground transition-colors"
              >
                <Command size={12} />
                <span>Commands</span>
              </button>
              <div className="w-[1px] h-3 bg-border mx-1" />
              <button
                type="button"
                className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-muted text-[11px] font-medium text-muted-foreground transition-colors"
              >
                <Sparkles size={12} />
                <span>Auto Work</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleAutoAccept}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-all",
                  autoAccept 
                    ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20" 
                    : "hover:bg-muted text-muted-foreground"
                )}
                title={autoAccept ? "Auto-accept ON" : "Auto-accept OFF"}
              >
                {autoAccept ? <ShieldCheck size={12} /> : <Shield size={12} />}
                <span>{autoAccept ? "Accepting" : "Permissions"}</span>
              </button>

              <div className="w-[1px] h-3 bg-border mx-1" />

              <button
                type="button"
                className="flex items-center gap-1.5 px-2 py-1 rounded-sm bg-muted/50 hover:bg-muted text-[11px] font-medium text-foreground border border-border/50 transition-colors capitalize"
              >
                <Globe size={12} className="text-primary" />
                <span>{currentBackend}</span>
                <ChevronUp size={12} className="text-muted-foreground" />
              </button>
            </div>
          </div>
        </form>
      </div>
      
      <div className="mt-2 text-[10px] text-center text-muted-foreground/50 font-medium tracking-wide flex items-center justify-center gap-2">
        <span className="flex items-center gap-1"><Zap size={10} /> Shift+Enter for newline</span>
        <span>•</span>
        <span className="flex items-center gap-1"><Command size={10} /> K for shortcuts</span>
        <span>•</span>
        <span className="flex items-center gap-1"><Command size={10} /> Space for Voice</span>
      </div>
    </div>
  )
}
