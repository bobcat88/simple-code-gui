import React, { useState } from 'react'
import { 
  X, 
  Send, 
  FileEdit, 
  CheckCircle2, 
  Target,
  Sparkles,
  Info
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type { GsdSeed } from '../../api/types'

interface PromotionDialogProps {
  seed: GsdSeed
  onClose: () => void
  onPromote: (type: 'draft' | 'task', title: string, why: string) => Promise<void>
  isPromoting: boolean
}

export function PromotionDialog({ seed, onClose, onPromote, isPromoting }: PromotionDialogProps) {
  const [title, setTitle] = useState(seed.title)
  const [why, setWhy] = useState(seed.why || '')
  const [targetType, setTargetType] = useState<'draft' | 'task'>('draft')

  const handlePromote = () => {
    onPromote(targetType, title, why)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-[#111111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative h-24 bg-gradient-to-br from-indigo-600/20 to-purple-600/20 flex items-end p-6 border-b border-white/5">
          <div className="absolute top-4 right-4">
            <button 
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Promote Seed to Work</h3>
              <p className="text-[10px] text-white/40 font-medium uppercase tracking-widest mt-0.5">Finalize your flash of genius</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Promotion Type Selector */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setTargetType('draft')}
              className={cn(
                "p-3 rounded-xl border flex flex-col items-center gap-2 transition-all text-center",
                targetType === 'draft'
                  ? "bg-purple-500/10 border-purple-500/40 text-purple-300"
                  : "bg-white/[0.02] border-white/5 text-white/30 hover:border-white/10 hover:bg-white/[0.04]"
              )}
            >
              <FileEdit size={18} className={targetType === 'draft' ? "text-purple-400" : ""} />
              <div className="text-[10px] font-bold">KSpec Draft</div>
            </button>
            <button
              onClick={() => setTargetType('task')}
              className={cn(
                "p-3 rounded-xl border flex flex-col items-center gap-2 transition-all text-center",
                targetType === 'task'
                  ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-300"
                  : "bg-white/[0.02] border-white/5 text-white/30 hover:border-white/10 hover:bg-white/[0.04]"
              )}
            >
              <Target size={18} className={targetType === 'task' ? "text-indigo-400" : ""} />
              <div className="text-[10px] font-bold">Beads Task</div>
            </button>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider px-1">Refined Title</label>
              <input 
                autoFocus
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white placeholder:text-white/10 focus:outline-none focus:border-indigo-500/50 transition-colors shadow-inner"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="What should we call this?"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider px-1">Implementation Rationale</label>
              <textarea 
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white/80 placeholder:text-white/10 focus:outline-none focus:border-indigo-500/50 transition-colors resize-none shadow-inner"
                value={why}
                onChange={e => setWhy(e.target.value)}
                placeholder="Why are we building this now?"
              />
            </div>
          </div>

          {/* Context Note */}
          <div className="p-3 rounded-xl bg-indigo-500/[0.03] border border-indigo-500/10 flex gap-3">
            <Info size={14} className="text-indigo-400/60 shrink-0 mt-0.5" />
            <p className="text-[10px] text-white/40 leading-relaxed">
              {targetType === 'draft' 
                ? "This will create a new KSpec module draft in your shadow branch for detailed specification."
                : "This will create a new high-priority task in your Beads issue tracker for immediate action."}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 pt-0 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-white/40 hover:text-white hover:bg-white/5 transition-all"
          >
            Cancel
          </button>
          <button 
            disabled={!title.trim() || isPromoting}
            onClick={handlePromote}
            className={cn(
              "flex-[2] py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg",
              targetType === 'draft' 
                ? "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-500/10"
                : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/10",
              isPromoting && "opacity-50 cursor-not-allowed"
            )}
          >
            {isPromoting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <CheckCircle2 size={16} />
            )}
            {targetType === 'draft' ? 'Create KSpec Draft' : 'Create Beads Task'}
          </button>
        </div>
      </div>
    </div>
  )
}
