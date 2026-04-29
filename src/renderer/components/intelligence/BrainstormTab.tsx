import React, { useState, useEffect } from 'react'
import { 
  Lightbulb, 
  FileEdit, 
  Network,
  RefreshCw,
  Brain
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type { BrainstormCanvas, BrainstormCanvasNode, ExtendedApi, GsdSeed, KSpecDraft } from '../../api/types'
import { IdeaInbox } from './IdeaInbox'
import { SpecDraftEditor } from './SpecDraftEditor'
import { BrainstormCanvas } from './BrainstormCanvas'

interface BrainstormTabProps {
  api: ExtendedApi
  projectPath: string
}

type BrainstormView = 'inbox' | 'drafts' | 'canvas'

export function BrainstormTab({ api, projectPath }: BrainstormTabProps) {
  const [activeView, setActiveView] = useState<BrainstormView>('inbox')
  const [seeds, setSeeds] = useState<GsdSeed[]>([])
  const [drafts, setDrafts] = useState<KSpecDraft[]>([])
  const [loading, setLoading] = useState(false)
  const [canvas, setCanvas] = useState<BrainstormCanvas>({ nodes: [], edges: [] })
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSavingCanvas, setIsSavingCanvas] = useState(false)
  const [selectedCanvasNodeId, setSelectedCanvasNodeId] = useState<string | null>(null)
  const [promotionLoading, setPromotionLoading] = useState<string | null>(null)

  useEffect(() => {
    refresh()
  }, [projectPath, api])

  const refresh = async () => {
    if (!projectPath) return
    setLoading(true)
    try {
      const [s, d, loadedCanvas] = await Promise.all([
        api.gsdListSeeds(projectPath),
        api.kspecListDrafts(projectPath),
        api.brainstormLoadCanvas(projectPath)
      ])
      setSeeds(s)
      setDrafts(d)
      setCanvas({
        nodes: loadedCanvas.nodes || [],
        edges: loadedCanvas.edges || [],
        updatedAt: loadedCanvas.updatedAt,
      })
    } catch (err) {
      console.error('Failed to refresh brainstorm data:', err)
      setErrorMessage('Failed to load brainstorm data.')
    } finally {
      setLoading(false)
    }
  }

  const handleSeedToDraft = async (seed: GsdSeed) => {
    const seedId = seed.id || seed.slug || seed.title
    setPromotionLoading(seedId)
    try {
      const moduleId = (seed.slug || seed.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'brainstorm-seed'
      const content = `title: ${seed.title}\ntype: module\nstatus:\n  maturity: draft\ndescription: ${seed.why || 'Draft created from a brainstorm seed.'}\nacceptance_criteria:\n  - id: ac-1\n    given: ${seed.title}\n    when: this seed is promoted into implementation work\n    then: the desired outcome is specified and testable\n`
      await api.kspecWriteDraft(projectPath, moduleId, content)
      setActiveView('drafts')
      await refresh()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to promote seed to KSpec draft.')
    } finally {
      setPromotionLoading(null)
    }
  }

  const handleSeedToTask = async (seed: GsdSeed) => {
    const seedId = seed.id || seed.slug || seed.title
    setPromotionLoading(seedId)
    try {
      const description = [
        seed.why ? `Seed rationale: ${seed.why}` : 'Created from a Brainstorm Companion seed.',
        `When to surface: ${seed.whenToSurface || 'Next Milestone'}`,
        `Source seed: ${seed.slug || seed.id || seed.title}`
      ].filter(Boolean).join('\n\n')

      await api.beadsCreate(projectPath, seed.title, description, 2, 'task', 'brainstorm,seed')
      await refresh()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to promote seed to Beads task.')
    } finally {
      setPromotionLoading(null)
    }
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 p-1 bg-white/5 rounded-lg border border-white/5 shadow-inner">
        <button
          onClick={() => setActiveView('inbox')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-[10px] font-bold transition-all",
            activeView === 'inbox' 
              ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-sm" 
              : "text-white/30 hover:text-white/60 hover:bg-white/5 border border-transparent"
          )}
        >
          <Lightbulb size={12} />
          Idea Inbox
        </button>
        <button
          onClick={() => setActiveView('drafts')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-[10px] font-bold transition-all",
            activeView === 'drafts' 
              ? "bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-sm" 
              : "text-white/30 hover:text-white/60 hover:bg-white/5 border border-transparent"
          )}
        >
          <FileEdit size={12} />
          Spec Drafts
        </button>
        <button
          onClick={() => setActiveView('canvas')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-[10px] font-bold transition-all",
            activeView === 'canvas' 
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm" 
              : "text-white/30 hover:text-white/60 hover:bg-white/5 border border-transparent"
          )}
        >
          <Network size={12} />
          Canvas
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1 pb-4">
        {errorMessage && (
          <div className="text-[10px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-2 animate-in slide-in-from-top-1 duration-200">
            {errorMessage}
          </div>
        )}

        {activeView === 'inbox' && (
          <IdeaInbox 
            api={api}
            projectPath={projectPath}
            seeds={seeds}
            loading={loading}
            onRefresh={refresh}
            onSeedToDraft={handleSeedToDraft}
            onSeedToTask={handleSeedToTask}
          />
        )}

        {activeView === 'drafts' && (
          <SpecDraftEditor 
            api={api}
            projectPath={projectPath}
            drafts={drafts}
            loading={loading}
            onRefresh={refresh}
          />
        )}

        {activeView === 'canvas' && (
          <BrainstormCanvas 
            api={api}
            projectPath={projectPath}
            canvas={canvas}
            seeds={seeds}
            drafts={drafts}
            onRefresh={refresh}
          />
        )}
      </div>

      {/* Footer / Status */}
      <div className="pt-2 border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-1.5 h-1.5 rounded-full",
            loading ? "bg-white/20 animate-pulse" : "bg-emerald-500/40"
          )} />
          <span className="text-[9px] text-white/20 uppercase tracking-widest font-bold">
            {loading ? 'Syncing...' : 'Connected'}
          </span>
        </div>
        <button 
          onClick={refresh}
          className="p-1 hover:bg-white/5 rounded-md text-white/20 hover:text-white/40 transition-colors"
        >
          <RefreshCw size={12} className={cn(loading && "animate-spin")} />
        </button>
      </div>
    </div>
  )
}
