import React, { useState, useEffect } from 'react'
import { 
  ArrowLeft,
  Brain,
  Check,
  Lightbulb, 
  Plus, 
  FileEdit, 
  Send, 
  ChevronRight, 
  History,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Network,
  Palette,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  X,
  Zap
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type { BrainstormCanvas, BrainstormCanvasNode, ExtendedApi, GsdSeed, KSpecDraft } from '../../api/types'

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
  const [isPlanting, setIsPlanting] = useState(false)
  const [promotionSeedId, setPromotionSeedId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [canvas, setCanvas] = useState<BrainstormCanvas>({ nodes: [], edges: [] })
  const [isSavingCanvas, setIsSavingCanvas] = useState(false)
  const [selectedCanvasNodeId, setSelectedCanvasNodeId] = useState<string | null>(null)
  
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
      const loadedCanvas = await api.brainstormLoadCanvas(projectPath)
      setSeeds(s)
      setDrafts(d)
      setCanvas({
        nodes: loadedCanvas.nodes || [],
        edges: loadedCanvas.edges || [],
        updatedAt: loadedCanvas.updatedAt || loadedCanvas.updated_at,
      })
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

  const getDraftModuleId = (draft: KSpecDraft) => draft.moduleId || draft.id
  const getDraftUpdatedAt = (draft: KSpecDraft) => draft.updatedAt || draft.lastModified || draft.last_modified || Date.now()
  const getSeedCreatedAt = (seed: GsdSeed) => seed.createdAt || seed.timestamp * 1000 || Date.now()
  const getSeedSurface = (seed: GsdSeed) => seed.whenToSurface || seed.when_to_surface || 'Next Milestone'
  const getSeedId = (seed: GsdSeed) => seed.id || seed.slug || seed.title
  const getCanvasNodeType = (node: BrainstormCanvasNode) => node.nodeType || node.node_type || 'seed'
  const getCanvasNodeSourceId = (node: BrainstormCanvasNode) => node.sourceId || node.source_id
  const selectedCanvasNode = canvas.nodes.find(node => node.id === selectedCanvasNodeId) || null
  const latestSeed = seeds.reduce<GsdSeed | null>((latest, seed) => {
    if (!latest) return seed
    return getSeedCreatedAt(seed) > getSeedCreatedAt(latest) ? seed : latest
  }, null)

  const validateDraftContent = (content: string): string[] => {
    const trimmed = content.trim()
    const errors: string[] = []
    if (!trimmed) errors.push('Draft content is empty.')
    if (!/^title:\s+\S+/m.test(trimmed)) errors.push('Missing top-level title.')
    if (!/^type:\s+\S+/m.test(trimmed)) errors.push('Missing top-level type.')
    if (!/^status:\s*$/m.test(trimmed) && !/^status:\s+\S+/m.test(trimmed)) errors.push('Missing status block.')
    if (!/acceptance_criteria:/m.test(trimmed)) errors.push('Missing acceptance_criteria section.')
    return errors
  }

  const draftValidation = validateDraftContent(draftContent)

  const handleSaveDraft = async () => {
    if (!selectedDraft) return
    if (draftValidation.length > 0) {
      setErrorMessage(draftValidation[0])
      return
    }
    setErrorMessage(null)
    setIsSavingDraft(true)
    try {
      await api.kspecWriteDraft(projectPath, getDraftModuleId(selectedDraft), draftContent)
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
      const moduleId = newDraftModuleId.trim()
      const initialContent = `slugs:\n  - ${moduleId}\ntitle: ${moduleId.replace(/[-_]/g, ' ')}\ntype: module\ndescription: Drafting in progress.\nstatus:\n  maturity: draft\n  implementation: not_started\nacceptance_criteria:\n  - id: ac-1\n    given: the feature is implemented\n    when: the user exercises the workflow\n    then: the expected outcome is observable\n`
      await api.kspecWriteDraft(projectPath, moduleId, initialContent)
      setNewDraftModuleId('')
      setShowDraftForm(false)
      await refresh()
      handleOpenDraft({
        id: moduleId,
        title: moduleId,
        content: initialContent,
        lastModified: Date.now(),
      })
    } catch (err) {
      console.error('Failed to create draft:', err)
    } finally {
      setIsSavingDraft(false)
    }
  }

  const handleSeedToDraft = async (seed: GsdSeed) => {
    const moduleId = (seed.slug || seed.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'brainstorm-seed'
    setPromotionSeedId(getSeedId(seed))
    setErrorMessage(null)
    try {
      const content = `slugs:\n  - ${moduleId}\ntitle: ${seed.title}\ntype: module\ndescription: ${seed.why || 'Draft created from a brainstorm seed.'}\nstatus:\n  maturity: draft\n  implementation: not_started\nacceptance_criteria:\n  - id: ac-1\n    given: ${seed.title}\n    when: this seed is promoted into implementation work\n    then: the desired outcome is specified and testable\n`
      await api.kspecWriteDraft(projectPath, moduleId, content)
      setActiveView('drafts')
      await refresh()
      handleOpenDraft({
        id: moduleId,
        title: seed.title,
        content,
        lastModified: Date.now(),
      })
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to promote seed to KSpec draft.')
    } finally {
      setPromotionSeedId(null)
    }
  }

  const handleSeedToTask = async (seed: GsdSeed) => {
    setPromotionSeedId(getSeedId(seed))
    setErrorMessage(null)
    try {
      const description = [
        seed.why ? `Seed rationale: ${seed.why}` : 'Created from a Brainstorm Companion seed.',
        `When to surface: ${getSeedSurface(seed)}`,
        `Source seed: ${seed.slug || seed.id || seed.title}`,
      ].join('\n\n')
      const result = await api.beadsCreate(projectPath, seed.title, description, 2, 'task', 'brainstorm,seed')
      if (result?.success === false) {
        throw new Error(result.error || 'Beads task creation failed.')
      }
      await refresh()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to promote seed to Beads task.')
    } finally {
      setPromotionSeedId(null)
    }
  }

  const buildCanvasFromCurrentData = (): BrainstormCanvas => {
    const savedNodesById = new Map(canvas.nodes.map(node => [node.id, node]))
    const withSavedLayout = (node: BrainstormCanvasNode): BrainstormCanvasNode => {
      const savedNode = savedNodesById.get(node.id)
      if (!savedNode) return node

      return {
        ...node,
        x: savedNode.x,
        y: savedNode.y,
        width: savedNode.width || node.width,
        height: savedNode.height || node.height,
      }
    }

    const seedNodes: BrainstormCanvasNode[] = seeds.map((seed, index) => ({
      id: `seed-${getSeedId(seed)}`,
      nodeType: 'seed',
      title: seed.title,
      content: seed.why || 'Captured brainstorm seed.',
      x: 16 + (index % 2) * 180,
      y: 16 + Math.floor(index / 2) * 118,
      width: 156,
      height: 88,
      sourceId: getSeedId(seed),
    })).map(withSavedLayout)

    const draftNodes: BrainstormCanvasNode[] = drafts.map((draft, index) => ({
      id: `draft-${getDraftModuleId(draft)}`,
      nodeType: 'draft',
      title: getDraftModuleId(draft),
      content: draft.content.split('\n').slice(0, 4).join('\n'),
      x: 384,
      y: 16 + index * 118,
      width: 164,
      height: 88,
      sourceId: getDraftModuleId(draft),
    })).map(withSavedLayout)

    const promoteEdges = seedNodes.flatMap(seedNode => {
      const draft = draftNodes.find(draftNode => draftNode.sourceId === seedNode.sourceId)
      return draft ? [{
        id: `${seedNode.id}-${draft.id}`,
        fromNode: seedNode.id,
        toNode: draft.id,
        label: 'promotes',
      }] : []
    })

    const extraNodes = canvas.nodes.filter(node => ['sketch', 'review'].includes(getCanvasNodeType(node)))
    const nextNodes = [...seedNodes, ...draftNodes, ...extraNodes]
    const nextNodeIds = new Set(nextNodes.map(node => node.id))
    const promoteEdgeIds = new Set(promoteEdges.map(edge => edge.id))
    const preservedEdges = canvas.edges
      .map(edge => ({
        id: edge.id,
        fromNode: edge.fromNode || edge.from_node || '',
        toNode: edge.toNode || edge.to_node || '',
        label: edge.label,
      }))
      .filter(edge =>
        edge.fromNode &&
        edge.toNode &&
        nextNodeIds.has(edge.fromNode) &&
        nextNodeIds.has(edge.toNode) &&
        !promoteEdgeIds.has(edge.id)
      )

    return { nodes: nextNodes, edges: [...promoteEdges, ...preservedEdges] }
  }

  const saveCanvas = async (nextCanvas: BrainstormCanvas) => {
    setIsSavingCanvas(true)
    setErrorMessage(null)
    try {
      await api.brainstormSaveCanvas(projectPath, nextCanvas)
      setCanvas(nextCanvas)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save brainstorm canvas.')
    } finally {
      setIsSavingCanvas(false)
    }
  }

  const handleGenerateCanvas = async () => {
    await saveCanvas(buildCanvasFromCurrentData())
  }

  const handleGenerateSketch = async () => {
    if (!selectedCanvasNode) return
    const baseId = selectedCanvasNode.id
    const sketchNode: BrainstormCanvasNode = {
      id: `sketch-${baseId}`,
      nodeType: 'sketch',
      title: `Sketch: ${selectedCanvasNode.title}`,
      content: [
        `Primary surface: ${selectedCanvasNode.title}`,
        'Layout: compact sidebar workflow with visible state, source artifact, and one primary action.',
        'Interaction: select a node, inspect rationale, then promote or review without leaving the Brainstorm tab.',
      ].join('\n'),
      x: selectedCanvasNode.x,
      y: selectedCanvasNode.y + 108,
      width: 178,
      height: 96,
      sourceId: baseId,
    }
    const nextCanvas = {
      nodes: [...canvas.nodes.filter(node => node.id !== sketchNode.id), sketchNode],
      edges: [
        ...canvas.edges.filter(edge => edge.toNode !== sketchNode.id),
        { id: `${baseId}-${sketchNode.id}`, fromNode: baseId, toNode: sketchNode.id, label: 'sketches' },
      ],
    }
    await saveCanvas(nextCanvas)
    setSelectedCanvasNodeId(sketchNode.id)
  }

  const handleArchitectReview = async () => {
    if (!selectedCanvasNode) return
    const baseId = selectedCanvasNode.id
    const type = getCanvasNodeType(selectedCanvasNode)
    const reviewNode: BrainstormCanvasNode = {
      id: `review-${baseId}`,
      nodeType: 'review',
      title: `Review: ${selectedCanvasNode.title}`,
      content: [
        `Architect verdict: ${type === 'draft' ? 'ready for KSpec hardening' : 'needs acceptance criteria before implementation'}.`,
        `Debt check: keep source artifact linked as ${getCanvasNodeSourceId(selectedCanvasNode) || baseId}.`,
        'Next action: either draft spec details or promote to tracked Beads work with validation evidence.',
      ].join('\n'),
      x: selectedCanvasNode.x + 190,
      y: selectedCanvasNode.y + 108,
      width: 190,
      height: 106,
      sourceId: baseId,
    }
    const nextCanvas = {
      nodes: [...canvas.nodes.filter(node => node.id !== reviewNode.id), reviewNode],
      edges: [
        ...canvas.edges.filter(edge => edge.toNode !== reviewNode.id),
        { id: `${baseId}-${reviewNode.id}`, fromNode: baseId, toNode: reviewNode.id, label: 'reviews' },
      ],
    }
    await saveCanvas(nextCanvas)
    setSelectedCanvasNodeId(reviewNode.id)
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
            <h3 className="text-sm font-bold text-white/90">{getDraftModuleId(selectedDraft)}</h3>
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
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest">YAML Specification</label>
            <span className={cn(
              "text-[9px] font-bold uppercase tracking-wider",
              draftValidation.length === 0 ? "text-emerald-400" : "text-amber-400"
            )}>
              {draftValidation.length === 0 ? 'Valid draft shape' : `${draftValidation.length} validation issue${draftValidation.length === 1 ? '' : 's'}`}
            </span>
          </div>
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
          {draftValidation.length === 0 ? (
            <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
          )}
          <p className="text-[10px] text-white/40 leading-normal">
            {draftValidation.length === 0
              ? 'Saving this draft updates the local .kspec/modules/drafts/ file.'
              : draftValidation.join(' ')}
          </p>
        </div>
        {errorMessage && (
          <div className="text-[10px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-2">
            {errorMessage}
          </div>
        )}
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

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
        {errorMessage && (
          <div className="text-[10px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-2">
            {errorMessage}
          </div>
        )}
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
                        {new Date(getSeedCreatedAt(seed)).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 text-[8px] font-bold uppercase tracking-tight border border-indigo-500/10">
                        {getSeedSurface(seed)}
                      </span>
                      <button
                        onClick={() => handleSeedToDraft(seed)}
                        disabled={promotionSeedId === getSeedId(seed)}
                        className="ml-auto text-[9px] text-white/30 hover:text-purple-300 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                      >
                        Draft Spec <FileEdit size={10} />
                      </button>
                      <button
                        onClick={() => handleSeedToTask(seed)}
                        disabled={promotionSeedId === getSeedId(seed)}
                        className="text-[9px] text-white/30 hover:text-indigo-300 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                      >
                        Promote <ChevronRight size={10} />
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
        ) : activeView === 'drafts' ? (
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
                          {getDraftModuleId(draft)}
                        </div>
                        <div className="text-[9px] text-white/30 flex items-center gap-2">
                          <span>{new Date(getDraftUpdatedAt(draft)).toLocaleTimeString()}</span>
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

            {/* Draft starter */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/20 space-y-2 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-2 opacity-10">
                 <Brain size={48} />
               </div>
               <h4 className="text-xs font-bold text-white/90 flex items-center gap-2">
                 <Sparkles size={14} className="text-purple-400" />
                 Draft from latest seed
               </h4>
               <p className="text-[10px] text-white/60 leading-relaxed">
                 Start a KSpec module from the newest captured idea, then refine its acceptance criteria.
               </p>
               <button
                 onClick={() => latestSeed ? handleSeedToDraft(latestSeed) : setShowDraftForm(true)}
                 disabled={Boolean(latestSeed && promotionSeedId === getSeedId(latestSeed))}
                 className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-bold text-white/80 transition-all disabled:opacity-50"
               >
                 {latestSeed ? 'Use Latest Seed' : 'Create Blank Draft'}
               </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-white/30 flex items-center gap-1.5">
                <Network size={10} />
                Node Workspace
              </h4>
              <button
                onClick={handleGenerateCanvas}
                disabled={isSavingCanvas}
                className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 text-[9px] font-bold transition-all disabled:opacity-50"
              >
                {isSavingCanvas ? 'Saving...' : 'Sync Canvas'}
              </button>
            </div>

            <div className="brainstorm-canvas">
              {canvas.edges.map(edge => {
                const from = canvas.nodes.find(node => node.id === edge.fromNode || node.id === edge.from_node)
                const to = canvas.nodes.find(node => node.id === edge.toNode || node.id === edge.to_node)
                if (!from || !to) return null
                return (
                  <div
                    key={edge.id}
                    className="brainstorm-edge"
                    style={{
                      left: Math.min(from.x + from.width, to.x) - 4,
                      top: Math.min(from.y + 38, to.y + 38),
                      width: Math.max(Math.abs(to.x - from.x - from.width), 24),
                    }}
                  />
                )
              })}
              {canvas.nodes.length > 0 ? (
                canvas.nodes.map(node => {
                  const type = getCanvasNodeType(node)
                  return (
                    <button
                      key={node.id}
                      onClick={() => setSelectedCanvasNodeId(node.id)}
                      className={cn(
                        "brainstorm-node",
                        selectedCanvasNodeId === node.id && "brainstorm-node-selected",
                        type === 'draft' && "brainstorm-node-draft",
                        type === 'sketch' && "brainstorm-node-sketch",
                        type === 'review' && "brainstorm-node-review"
                      )}
                      style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
                    >
                      <span className="brainstorm-node-type">{type}</span>
                      <span className="brainstorm-node-title">{node.title}</span>
                      <span className="brainstorm-node-body">{node.content}</span>
                    </button>
                  )
                })
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <Network size={28} className="text-white/10 mb-2" />
                  <p className="text-[10px] text-white/30 leading-relaxed">
                    No canvas nodes yet.<br />Sync seeds and drafts into a file-backed workspace.
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleGenerateSketch}
                disabled={!selectedCanvasNode || isSavingCanvas}
                className="py-2 px-2 bg-cyan-500/10 hover:bg-cyan-500/20 disabled:opacity-40 border border-cyan-500/20 rounded-lg text-[10px] font-bold text-cyan-300 flex items-center justify-center gap-1.5"
              >
                <Palette size={12} />
                Sketch Brief
              </button>
              <button
                onClick={handleArchitectReview}
                disabled={!selectedCanvasNode || isSavingCanvas}
                className="py-2 px-2 bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-40 border border-amber-500/20 rounded-lg text-[10px] font-bold text-amber-300 flex items-center justify-center gap-1.5"
              >
                <ShieldCheck size={12} />
                Architect Review
              </button>
            </div>

            {selectedCanvasNode && (
              <div className="p-3 brainstorm-card space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] uppercase tracking-wider text-white/30 font-bold">{getCanvasNodeType(selectedCanvasNode)}</span>
                  <span className="text-[9px] text-white/20">{getCanvasNodeSourceId(selectedCanvasNode) || selectedCanvasNode.id}</span>
                </div>
                <div className="text-xs font-bold text-white/90">{selectedCanvasNode.title}</div>
                <pre className="whitespace-pre-wrap text-[10px] leading-relaxed text-white/50 font-sans">{selectedCanvasNode.content}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
