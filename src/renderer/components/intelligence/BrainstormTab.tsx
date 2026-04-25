import React, { useState, useEffect } from 'react'
import { 
  Lightbulb, 
  Plus, 
  FileEdit, 
  Send, 
  Search, 
  ChevronRight, 
  History,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Zap
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type { ExtendedApi, GsdSeed, KSpecDraft } from '../../api/types'

interface BrainstormTabProps {
  api: ExtendedApi
  projectPath: string
}

type BrainstormView = 'inbox' | 'drafts'

export function BrainstormTab({ api, projectPath }: BrainstormTabProps) {
  const [activeView, setActiveView] = useState<BrainstormView>('inbox')
  const [seeds, setSeeds] = useState<GsdSeed[]>([])
  const [drafts, setDrafts] = useState<KSpecDraft[]>([])
  const [loading, setLoading] = useState(false)
  const [isPlanting, setIsPlanting] = useState(false)
  
  // Spec Editor State
  const [selectedDraft, setSelectedDraft] = useState<KSpecDraft | null>(null)
  const [draftContent, setDraftContent] = useState('')
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [showDraftForm, setShowDraftForm] = useState(false)
  const [newDraftModuleId, setNewDraftModuleId] = useState('')
  
  // New Seed Form
  const [newSeedTitle, setNewSeedTitle] = useState('')
  const [newSeedWhy, setNewSeedWhy] = useState('')

  useEffect(() => {
    refresh()
  }, [projectPath, api])

  const refresh = async () => {
    if (!projectPath) return
    setLoading(true)
    try {
      const [s, d] = await Promise.all([
        api.gsdListSeeds(projectPath),
        api.kspecListDrafts(projectPath)
      ])
      setSeeds(s)
      setDrafts(d)
    } catch (err) {
      console.error('Failed to refresh brainstorm data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handlePlantSeed = async () => {
    if (!newSeedTitle.trim()) return
    setIsPlanting(true)
    try {
      await api.gsdPlantSeed(projectPath, {
        title: newSeedTitle,
        why: newSeedWhy,
        slug: newSeedTitle.toLowerCase().replace(/\s+/g, '-'),
        createdAt: new Date().toISOString(),
        whenToSurface: 'Next Milestone'
      } as GsdSeed)
      setNewSeedTitle('')
      setNewSeedWhy('')
      setShowSeedForm(false)
      refresh()
    } catch (err) {
      console.error('Failed to plant seed:', err)
    } finally {
      setIsPlanting(false)
    }
  }

  const [showSeedForm, setShowSeedForm] = useState(false)

  const handleOpenDraft = (draft: KSpecDraft) => {
    setSelectedDraft(draft)
    setDraftContent(draft.content || '')
  }

  const handleSaveDraft = async () => {
    if (!selectedDraft) return
    setIsSavingDraft(true)
    try {
      await api.kspecWriteDraft(projectPath, selectedDraft.moduleId, draftContent)
      refresh()
      setSelectedDraft(null)
    } catch (err) {
      console.error('Failed to save draft:', err)
    } finally {
      setIsSavingDraft(false)
    }
  }

  const handleCreateDraft = async () => {
    if (!newDraftModuleId.trim()) return
    setIsSavingDraft(true)
    try {
      const initialContent = `module: ${newDraftModuleId}\nrequirements:\n  - title: Initial Requirement\n    description: Drafting in progress...`
      await api.kspecWriteDraft(projectPath, newDraftModuleId, initialContent)
      setNewDraftModuleId('')
      setShowDraftForm(false)
      refresh()
    } catch (err) {
      console.error('Failed to create draft:', err)
    } finally {
      setIsSavingDraft(false)
    }
  }

  if (selectedDraft) {
    return (
      <div className="flex flex-col h-full space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setSelectedDraft(null)}
              className="p-1 hover:bg-white/10 rounded-md text-white/40 hover:text-white"
            >
              <ArrowLeft size={16} />
            </button>
            <h3 className="text-sm font-bold text-white/90">{selectedDraft.moduleId}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setSelectedDraft(null)}
              className="px-2 py-1 text-[10px] text-white/40 hover:text-white/60 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleSaveDraft}
              disabled={isSavingDraft}
              className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-[10px] font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-purple-500/10"
            >
              {isSavingDraft ? <RefreshCw size={10} className="animate-spin" /> : <Save size={10} />}
              Save Changes
            </button>
          </div>
        </div>
        
        <div className="flex-1 min-h-0 flex flex-col gap-2">
          <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest">YAML Specification</label>
          <div className="flex-1 brainstorm-card p-4">
            <textarea
              autoFocus
              className="spec-editor-textarea custom-scrollbar"
              value={draftContent}
              onChange={e => setDraftContent(e.target.value)}
            />
          </div>
        </div>
        
        <div className="p-3 bg-purple-500/5 rounded-xl border border-purple-500/10 flex items-start gap-2">
          <AlertCircle size={14} className="text-purple-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-white/40 leading-normal">
            Saving this draft updates the local <code className="text-purple-300/60">.kspec/modules/drafts/</code> file. 
            Use <code className="text-purple-300/60">kspec agent dispatch</code> to finalize.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 p-1 bg-white/5 rounded-lg">
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
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
        {activeView === 'inbox' ? (
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
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:bg-indigo-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all"
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
                        {new Date(seed.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 text-[8px] font-bold uppercase tracking-tight border border-indigo-500/10">
                        {seed.whenToSurface}
                      </span>
                      <button className="ml-auto text-[9px] text-white/30 hover:text-white/60 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        Promote to Task <ChevronRight size={10} />
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
        ) : (
          <div className="space-y-4">
             {/* Spec Drafts List */}
             <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-white/30 flex items-center gap-1.5">
                  <Zap size={10} />
                  KSpec Drafts
                </h4>
                {!showDraftForm && (
                  <button 
                    onClick={() => setShowDraftForm(true)}
                    className="p-1 rounded bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-all"
                  >
                    <Plus size={12} />
                  </button>
                )}
              </div>

              {showDraftForm && (
                <div className="p-3 rounded-xl bg-black/40 border border-purple-500/30 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-purple-400">New Module Spec</h4>
                    <button onClick={() => setShowDraftForm(false)} className="text-white/20 hover:text-white/60">
                      <X size={14} />
                    </button>
                  </div>
                  <input 
                    autoFocus
                    placeholder="Module ID (e.g. auth-provider)"
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/50"
                    value={newDraftModuleId}
                    onChange={e => setNewDraftModuleId(e.target.value)}
                  />
                  <button 
                    disabled={!newDraftModuleId.trim() || isSavingDraft}
                    onClick={handleCreateDraft}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all"
                  >
                    {isSavingDraft ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                    Create Draft
                  </button>
                </div>
              )}

              {loading ? (
                <div className="space-y-2 py-4">
                  <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
                  <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
                </div>
              ) : drafts.length > 0 ? (
                drafts.map((draft, i) => (
                  <div 
                    key={i} 
                    onClick={() => handleOpenDraft(draft)}
                    className="p-3 brainstorm-card group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                        <FileCode size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-white/90 truncate group-hover:text-purple-300 transition-colors">
                          {draft.moduleId}
                        </div>
                        <div className="text-[9px] text-white/30 flex items-center gap-2">
                          <span>{new Date(draft.updatedAt).toLocaleTimeString()}</span>
                          <span className="w-1 h-1 rounded-full bg-white/10" />
                          <span>YAML Spec</span>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-white/10 group-hover:text-white/40 transition-colors" />
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center bg-white/[0.02] rounded-2xl border border-dashed border-white/5">
                  <FileEdit size={24} className="text-white/10 mb-2" />
                  <p className="text-[10px] text-white/30 leading-relaxed">
                    No active drafts.<br />Start drafting requirements to sync with KSpec.
                  </p>
                </div>
              )}
            </div>

            {/* AI Assistant Hook */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/20 space-y-2 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-2 opacity-10">
                 <Brain size={48} />
               </div>
               <h4 className="text-xs font-bold text-white/90 flex items-center gap-2">
                 <Sparkles size={14} className="text-purple-400" />
                 Draft with AI
               </h4>
               <p className="text-[10px] text-white/60 leading-relaxed">
                 Use the Neural Assistant to generate KSpec YAML drafts from natural language descriptions.
               </p>
               <button className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-bold text-white/80 transition-all">
                 Launch Drafting Agent
               </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Sub-components
import { X, RefreshCw, FileCode, Brain, ArrowLeft, Save, Check } from 'lucide-react'
