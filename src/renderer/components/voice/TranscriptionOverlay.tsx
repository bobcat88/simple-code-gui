import React from 'react'
import { useVoice } from '../../contexts/VoiceContext'
import { cn } from '../../lib/utils'
import { Mic, Activity } from 'lucide-react'

export function TranscriptionOverlay() {
  const { isRecording, currentTranscription, audioLevel, silenceThreshold } = useVoice()

  if (!isRecording) return null

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999] animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center gap-4 min-w-[320px] max-w-[80vw]">
        <div className="relative">
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300",
            audioLevel > silenceThreshold ? "bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]" : "bg-white/10"
          )}>
            <Mic size={20} className="text-white" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-black/80 rounded-full flex items-center justify-center border border-white/10">
            <Activity size={10} className="text-primary animate-pulse" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">
            Listening...
          </div>
          <div className="text-sm text-white/90 font-medium truncate italic h-5">
            {currentTranscription || '...'}
          </div>
        </div>

        <div className="flex flex-col gap-1 items-end">
          <div className="h-12 w-1.5 bg-white/5 rounded-full overflow-hidden">
            <div 
              className={cn(
                "w-full transition-all duration-75 rounded-full",
                audioLevel > silenceThreshold ? "bg-red-500" : "bg-white/20"
              )}
              style={{ height: `${audioLevel}%`, marginTop: `${100 - audioLevel}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
