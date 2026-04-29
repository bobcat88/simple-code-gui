import React, { useState } from 'react'
import { 
  Plus, 
  History, 
  Send, 
  RefreshCw, 
  X, 
  Sparkles, 
  Lightbulb,
  FileEdit,
  ChevronRight,
  Loader2
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type { GsdSeed, ExtendedApi } from '../../api/types'

interface IdeaInboxProps {
  api: ExtendedApi
  projectPath: string
  seeds: GsdSeed[]
  loading: boolean
  onRefresh: () => void
  onSeedToDraft: (seed: GsdSeed) => void
  onSeedToTask: (seed: GsdSeed) => void
}

export function IdeaInbox({ 
  api, 
  projectPath, 
  seeds, 
  loading, 
  onRefresh,
  onSeedToDraft,
  onSeedToTask
}: IdeaInboxProps) {
  const [showSeedForm, setShowSeedForm] = useState(false)
  const [newSeedTitle, setNewSeedTitle] = useState('')
  const [newSeedWhy, setNewSeedWhy] = useState('')
  const [isPlanting, setIsPlanting] = useState(false)
  const [promotionSeedId, setPromotionSeedId] = useState<string | null>(null)

  const getSeedCreatedAt = (seed: GsdSeed) => seed.createdAt || seed.timestamp * 1000 || Date.now()
  const getSeedSurface = (seed: GsdSeed) => seed.whenToSurface || 'Next Milestone'
  const getSeedId = (seed: GsdSeed) => seed.id || seed.slug || seed.title

  const handlePlantSeed = async () => {
    if (!newSeedTitle.trim()) return
    setIsPlanting(true)
    try {
      await api.gsdPlantSeed(projectPath, {
        title: newSeedTitle,
        why: newSeedWhy,
        slug: newSeedTitle.toLowerCase().replace(/\s+/g, '-'),
        createdAt: new Date().toISOString(),
        whenToSurface: 'Next Milestone',
        status: 'planted'
      } as GsdSeed)
      setNewSeedTitle('')
      setNewSeedWhy('')
      setShowSeedForm(false)
      onRefresh()
    } catch (err) {
      console.error('Failed to plant seed:', err)
    } finally {
      setIsPlanting(false)
    }
  }

  const handlePromoteToTask = async (seed: GsdSeed) => {
    const id = getSeedId(seed)
    setPromotionSeedId(id)
    try {
      await onSeedToTask(seed)
    } finally {
      setPromotionSeedId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Quick Capture */}
      {!showSeedForm ? (
        <button 
          onClick={() => setShowSeedForm(true)}
          className="w-full p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-3 group hover:bg-indigo-500/20 transition-all text-left"
        >
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
            <Plus size={16} />
          </div>
          <div>
            <div className="text-xs font-bold text-indigo-300">Plant a new Seed</div>
            <div className="text-[10px] text-white/40">Capture an idea for the future...</div>
          </div>
        </button>
      ) : (
        <div className="p-4 rounded-xl bg-black/40 border border-indigo-500/30 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">New Idea</h4>
            <button onClick={() => setShowSeedForm(false)} className="text-white/20 hover:text-white/60">
              <X size={14} />
            </button>
          </div>
          <input 
            autoFocus
            placeholder="What's the idea?"
            className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50"
            value={newSeedTitle}
            onChange={e => setNewSeedTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handlePlantSeed()}
          />
          <textarea 
            placeholder="Why is this important? (Optional)"
            rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-[11px] text-white/80 placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 resize-none"
            value={newSeedWhy}
            onChange={e => setNewSeedWhy(e.target.value)}
          />
          <button 
            disabled={!newSeedTitle.trim() || isPlanting}
            onClick={handlePlantSeed}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all"
          >
            {isPlanting ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
            Plant Seed
          </button>
        </div>
      )}

      {/* List of Seeds */}
      <div className="space-y-2">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-white/30 px-1 flex items-center gap-1.5">
          <History size={10} />
          Recent Seeds
        </h4>
        {loading ? (
          <div className="space-y-2 py-4">
            <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
            <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
          </div>
        ) : seeds.length > 0 ? (
          seeds.map((seed, i) => (
            <div 
              key={i} 
              className="p-3 brainstorm-card group cursor-default"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white/90 truncate group-hover:text-indigo-300 transition-colors">
                    {seed.title}
                  </div>
                  {seed.why && (
                    <div className="text-[10px] text-white/40 line-clamp-2 mt-1 italic">
                      "{seed.why}"
                    </div>
                  )}
                </div>
                <div className="text-[9px] font-mono text-white/20 shrink-0">
                  {new Date(getSeedCreatedAt(seed)).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 text-[8px] font-bold uppercase tracking-tight border border-indigo-500/10">
                  {getSeedSurface(seed)}
                </span>
                <button
                  onClick={() => onSeedToDraft(seed)}
                  className="ml-auto text-[9px] text-white/30 hover:text-purple-300 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all"
                >
                  Draft Spec <FileEdit size={10} />
                </button>
                <button
                  onClick={() => handlePromoteToTask(seed)}
                  disabled={promotionSeedId === getSeedId(seed)}
                  className="text-[9px] text-indigo-400/80 hover:text-indigo-300 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                >
                  {promotionSeedId === getSeedId(seed) ? <Loader2 size={10} className="animate-spin" /> : 'Promote to Beads'} <ChevronRight size={10} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center bg-white/[0.02] rounded-2xl border border-dashed border-white/5">
            <Sparkles size={24} className="text-white/10 mb-2" />
            <p className="text-[10px] text-white/30 leading-relaxed">
              No seeds planted yet.<br />Capture your flashes of genius here.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
