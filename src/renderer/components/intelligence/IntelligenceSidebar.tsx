import React, { useState, useEffect } from 'react'
import { 
  Activity, 
  GitBranch, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  RefreshCw,
  Box,
  Layers,
  ShieldCheck,
  History,
  FileCode,
  AlertTriangle,
  Search,
  Brain,
  Cpu,
  Users,
  Lightbulb, 
  Sparkles, 
  Wand2
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { SwarmActivityStream } from '../orchestration/SwarmActivityStream'
import type { 
  ProjectIntelligence, 
  ProjectCapabilityScan, 
  InitializationProposal, 
  ProposalOperation, 
  ExtendedApi, 
  ProposalProgress, 
  VectorIndexStatus,
  GsdSeed,
  KSpecDraft
} from '../../api/types'
import { BrainstormTab } from './BrainstormTab'

interface IntelligenceSidebarProps {
  intelligence: ProjectIntelligence | null
  capabilityScan: ProjectCapabilityScan | null
  api: ExtendedApi
  loading: boolean
  onClose: () => void
  onRefresh: () => void
  onDeepScan: () => void
  onReindex: () => void
  onSyncMemory: () => void
  onOpenSearch: () => void
  onWidthChange: (width: number) => void
  vectorStatus: VectorIndexStatus | null
  width: number
}

export function IntelligenceSidebar({ 
  intelligence, 
  capabilityScan,
  api,
  loading, 
  onClose, 
  onRefresh,
  onDeepScan,
  onReindex,
  onSyncMemory,
  onOpenSearch,
  onWidthChange,
  width,
  vectorStatus,
  gitnexus,
  activeTab
}: IntelligenceSidebarProps) {
  const [isResizing, setIsResizing] = useState(false)
  const [showWizard, setShowWizard] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<string>('Standard')
  const [proposal, setProposal] = useState<InitializationProposal | null>(null)
  const [applying, setApplying] = useState(false)
  const [applyResult, setApplyResult] = useState<string[] | null>(null)
  const [progress, setProgress] = useState<ProposalProgress | null>(null)
  const [activeSection, setActiveSection] = useState<'intelligence' | 'brainstorm'>('intelligence')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const healthScore = Math.round(capabilityScan?.projectHealthScore ?? 0)

  useEffect(() => {
    if (!activeTab?.projectPath) {
      setSuggestions([])
      return
    }

    const fetchSuggestions = async () => {
      setIsLoadingSuggestions(true)
      try {
        const results = await api.vectorSearch(activeTab.projectPath, 3)
        setSuggestions(results)
      } catch (err) {
        console.error('Failed to fetch neural suggestions:', err)
      } finally {
        setIsLoadingSuggestions(false)
      }
    }

    fetchSuggestions()
  }, [activeTab?.projectPath, api])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX
      if (newWidth >= 200 && newWidth <= 600) {
        onWidthChange(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, onWidthChange])

  if (!intelligence && !loading) {
    return (
      <div 
        style={{ width }}
        className="h-full glass-sidebar flex flex-col items-center justify-center p-8 text-center"
      >
        <Box className="w-12 h-12 text-white/20 mb-4" />
        <p className="text-white/40 text-sm">No project intelligence available. Select a project to scan.</p>
        <button 
          onClick={onClose}
          className="mt-6 text-xs text-white/60 hover:text-white transition-colors"
        >
          Close Panel
        </button>
      </div>
    )
  }

  const { git, stacks, health } = intelligence || {}

  return (
    <div 
      className={cn(
        "h-full flex flex-col relative transition-all duration-300 ease-in-out",
        "glass-sidebar shadow-2xl z-20",
        isResizing && "transition-none"
      )}
      style={{ width }}
    >
      <div 
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-indigo-500/30 transition-colors z-30",
          isResizing && "bg-indigo-500/50"
        )}
        onMouseDown={handleMouseDown}
      />

      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-indigo-400" />
          <h2 className="font-semibold text-white/90">Intelligence</h2>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={onDeepScan}
            className="p-1.5 rounded-md hover:bg-white/10 text-white/40 hover:text-white/80 transition-all"
            title="Trigger Deep Scan (Background Job)"
          >
            <ShieldCheck size={14} />
          </button>
          <button 
            onClick={onRefresh}
            className="p-1.5 rounded-md hover:bg-white/10 text-white/40 hover:text-white/80 transition-all"
            title="Refresh View"
          >
            <RefreshCw size={14} className={cn(loading && "animate-spin")} />
          </button>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-white/10 text-white/40 hover:text-white/80 transition-all"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Main Section Tabs */}
      <div className="px-4 py-2 border-b border-white/5 flex gap-4">
        <button
          onClick={() => setActiveSection('intelligence')}
          className={cn(
            "pb-2 text-[11px] font-bold uppercase tracking-wider transition-all border-b-2",
            activeSection === 'intelligence' 
              ? "text-white border-indigo-500" 
              : "text-white/30 border-transparent hover:text-white/60"
          )}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveSection('brainstorm')}
          className={cn(
            "pb-2 text-[11px] font-bold uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5",
            activeSection === 'brainstorm' 
              ? "text-white border-purple-500" 
              : "text-white/30 border-transparent hover:text-white/60"
          )}
        >
          Brainstorm
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
        {activeSection === 'brainstorm' ? (
          <BrainstormTab 
            api={api} 
            projectPath={activeTab?.projectPath || ''} 
          />
        ) : (
          <>
        <section className="bg-indigo-500/5 rounded-xl border border-indigo-500/10 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-indigo-400" />
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-white/70">Nerve Center</h3>
            </div>
            {capabilityScan && (
              <div className="flex items-center gap-2">
                <span className={cn(
                  "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-tight",
                  capabilityScan.initializationState === 'FullyInitialized' ? "bg-emerald-500/20 text-emerald-400" :
                  capabilityScan.initializationState === 'MissingContracts' ? "bg-amber-500/20 text-amber-400" :
                  "bg-red-500/20 text-red-400"
                )}>
                  {capabilityScan.initializationState.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <span className={cn(
                  "px-2 py-0.5 rounded text-[9px] font-bold tabular-nums shadow-sm",
                  healthScore > 80 ? "bg-emerald-500/10 text-emerald-300/80" :
                  healthScore > 50 ? "bg-amber-500/10 text-amber-300/80" :
                  "bg-red-500/10 text-red-300/80"
                )}>
                  {healthScore}%
                </span>
              </div>
            )}
          </div>

          {capabilityScan?.initializationState !== 'FullyInitialized' && !showWizard && (
            <button 
              onClick={() => setShowWizard(true)}
              className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw size={14} />
              Initialize Project
            </button>
          )}

          {showWizard && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-1.5 p-1 bg-black/20 rounded-lg">
                {['Minimal', 'Standard', 'Full', 'Guarded'].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setSelectedPreset(preset)}
                    className={cn(
                      "flex-1 py-1 rounded-md text-[10px] font-bold transition-all",
                      selectedPreset === preset 
                        ? "bg-white/10 text-white shadow-sm" 
                        : "text-white/30 hover:text-white/60 hover:bg-white/5"
                    )}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <button
                disabled={loading || applying}
                onClick={async () => {
                  if (!capabilityScan) return
                  try {
                    setApplying(true)
                    const p = await api.projectGenerateProposal(
                      capabilityScan, 
                      selectedPreset, 
                      "Project",
                      "beads"
                    )
                    setProposal(p)
                  } catch (e) {
                    console.error(e)
                  } finally {
                    setApplying(false)
                  }
                }}
                className="w-full py-2 border border-white/10 hover:bg-white/5 text-white/80 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2"
              >
                {applying ? <RefreshCw size={14} className="animate-spin" /> : <Wand2 size={14} />}
                Generate Proposal
              </button>

              {proposal && (
                <div className="space-y-3 pt-2">
                  {progress ? (
                    <div className="space-y-2 p-3 bg-black/40 rounded-xl border border-white/10 animate-in fade-in zoom-in-95 duration-300">
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "text-[10px] font-bold",
                          progress.status === 'completed' ? "text-emerald-400" : progress.status === 'failed' ? "text-red-400" : "text-white/60"
                        )}>
                          {progress.status === 'completed' ? 'Initialization Successful' : progress.status === 'failed' ? 'Initialization Failed' : 'Applying Changes...'}
                        </span>
                        <span className="text-[10px] font-mono text-white/40">
                          {progress.completedOperations} / {progress.totalOperations}
                        </span>
                      </div>
                      
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full transition-all duration-500",
                            progress.status === 'failed' ? "bg-red-500" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                          )}
                          style={{ width: `${progress.totalOperations > 0 ? (progress.completedOperations / progress.totalOperations) * 100 : 0}%` }}
                        />
                      </div>
                      
                      <div className="text-[9px] text-white/80 line-clamp-1 italic">
                        {progress.message}
                      </div>
                      
                      {progress.error && (
                        <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-[9px] text-red-300 break-all font-mono">
                          {progress.error}
                        </div>
                      )}
                      
                      {progress.status === 'completed' && (
                        <div className="flex gap-2 mt-2">
                          <button 
                            onClick={() => {
                              setProgress(null)
                              setShowWizard(false)
                              setProposal(null)
                            }}
                            className="flex-1 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded text-[10px] font-bold transition-all border border-emerald-500/20"
                          >
                            Finish
                          </button>
                        </div>
                      )}

                      {progress.status === 'failed' && (
                        <button 
                          onClick={() => {
                            setProgress(null)
                            setApplying(false)
                          }}
                          className="w-full mt-2 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-[10px] font-bold transition-all border border-red-500/20"
                        >
                          Retry / Back
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                        {proposal.operations.map((op, i) => (
                          <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-black/20 border border-white/5">
                            <OperationIcon kind={op.kind} />
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] font-bold text-white/90 truncate">{op.path || op.command}</div>
                              <div className="text-[9px] text-white/40 leading-tight">{op.reason}</div>
                            </div>
                            <RiskBadge risk={op.risk} />
                          </div>
                        ))}
                      </div>

                      <button
                        disabled={applying}
                        onClick={async () => {
                          if (!proposal) return
                          const confirmApply = confirm('Are you sure you want to apply this initialization? This will create or modify files in your repository.')
                          if (!confirmApply) return

                          try {
                            setApplying(true)
                            setProgress({
                              proposalId: proposal.id,
                              totalOperations: proposal.operations.length,
                              completedOperations: 0,
                              currentOperationId: 'starting',
                              currentOperationName: 'Initializing...',
                              status: 'running',
                              message: 'Starting project initialization...'
                            })

                            const unsubscribe = api.onProjectInitializationProgress?.((p: any) => {
                              setProgress(p)
                            })

                            const results = await api.projectApplyProposal(proposal)
                            
                            if (unsubscribe) unsubscribe()
                            
                            setApplyResult(results)
                            onRefresh()
                          } catch (e) {
                            console.error(e)
                            setProgress(prev => prev ? { ...prev, status: 'failed', error: String(e) } : {
                              proposalId: proposal.id,
                              totalOperations: proposal.operations.length,
                              completedOperations: 0,
                              currentOperationId: 'error',
                              currentOperationName: 'Error',
                              status: 'failed',
                              message: 'An unexpected error occurred',
                              error: String(e)
                            })
                          } finally {
                            setApplying(false)
                          }
                        }}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                      >
                        {applying ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        Apply Initialization
                      </button>
                    </>
                  )}
                </div>
              )}
              
              <button 
                onClick={() => {
                  setShowWizard(false)
                  setProposal(null)
                }}
                className="w-full text-[10px] text-white/30 hover:text-white/60 transition-colors py-1"
              >
                Cancel Wizard
              </button>
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-white/40">Repo Health</h3>
            {health && (
              <span className={cn(
                "px-2.5 py-1 rounded-full text-[10px] font-bold tracking-tight shadow-lg backdrop-blur-md",
                health.score > 80 ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : 
                health.score > 50 ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : 
                "bg-red-500/20 text-red-300 border border-red-500/30"
              )}>
                {health.score}%
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <HealthItem label="Git" active={health?.hasGit} />
            <HealthItem label="README" active={health?.hasReadme} />
            <HealthItem label="CI/CD" active={health?.hasCi} />
            <HealthItem label="Tests" active={health?.hasTests} />
            <HealthItem label="Linter" active={health?.hasLinter} />
            <HealthItem label="Lockfile" active={health?.hasLockfile} />
          </div>
        </section>

        <section>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-3">Detected Stacks</h3>
          <div className="space-y-2">
            {stacks && stacks.length > 0 ? stacks.map((stack: any, i: number) => (
              <div 
                key={i} 
                className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 transition-colors group"
              >
                <div className="w-8 h-8 rounded-md bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                  <Layers size={16} />
                </div>
                <div>
                  <div className="text-xs font-medium text-white/90">{stack.name}</div>
                  <div className="text-[10px] text-white/40 flex items-center gap-1">
                    <FileCode size={10} />
                    {stack.configFile}
                  </div>
                </div>
                {stack.version && (
                  <div className="ml-auto text-[10px] text-white/30 font-mono">v{stack.version}</div>
                )}
              </div>
            )) : (
              <div className="text-xs text-white/30 italic py-2">No specific stacks detected</div>
            )}
          </div>
        </section>

        <section>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-3">Git Context</h3>
          {git ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs">
                <GitBranch size={14} className="text-indigo-400" />
                <span className="font-mono text-white/80">{git.branch}</span>
                {git.isDirty && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[9px] font-bold uppercase tracking-tighter">
                    Modified
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4 bg-white/5 rounded-codex p-3 border border-white/5">
                <div className="space-y-1">
                  <div className="text-[10px] text-white/40 uppercase font-bold">Uncommitted</div>
                  <div className="text-lg font-semibold tabular-nums">{git.uncommittedCount}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] text-white/40 uppercase font-bold">Sync Status</div>
                  <div className="text-xs flex items-center gap-2">
                    <span className="text-emerald-400">↑{git.ahead}</span>
                    <span className="text-rose-400">↓{git.behind}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] text-white/40 uppercase font-bold px-1 flex items-center gap-1">
                  <History size={10} /> Recent Changes
                </div>
                {git.recentCommits.map((commit: any, i: number) => (
                  <div key={i} className="text-[11px] leading-relaxed border-l-2 border-white/10 pl-3 py-1 group hover:border-indigo-500/50 transition-colors">
                    <div className="text-white/80 line-clamp-1 group-hover:text-white">{commit.message}</div>
                    <div className="text-white/30 text-[9px] mt-0.5">{commit.author} • {new Date(commit.date).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-rose-400/60 bg-rose-500/5 p-3 rounded-lg border border-rose-500/10">
              <AlertTriangle size={14} />
              <span>Git repository not detected or accessible</span>
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-white/40">Cognitive Context</h3>
            <div className="flex items-center gap-1.5">
              <Brain size={12} className="text-purple-400" />
              <span className="text-[10px] text-purple-400/80 font-medium">Transwarp</span>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="bg-white/5 border border-white/5 rounded-xl p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu size={14} className="text-purple-400" />
                  <span className="text-xs text-white/90 font-medium">Vector Index</span>
                </div>
                {vectorStatus?.isIndexing && (
                  <span className="flex items-center gap-1 text-[9px] text-purple-400 animate-pulse">
                    <RefreshCw size={10} className="animate-spin" />
                    Indexing...
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] text-white/40">
                  <span>Progress</span>
                  <span>{vectorStatus?.indexedChunks ?? 0} / {vectorStatus?.totalChunks ?? 0}</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)] transition-all duration-500"
                    style={{ 
                      width: `${vectorStatus?.totalChunks ? (vectorStatus.indexedChunks / vectorStatus.totalChunks) * 100 : 0}%` 
                    }}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={onOpenSearch}
                  className="flex-1 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <Search size={12} />
                  Semantic Search
                </button>
                <button 
                  onClick={onReindex}
                  disabled={vectorStatus?.isIndexing}
                  className="px-2 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 border border-white/10 rounded-lg text-[10px] transition-all disabled:opacity-50"
                  title="Re-index Project"
                >
                  <RefreshCw size={12} className={cn(vectorStatus?.isIndexing && "animate-spin")} />
                </button>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/10 flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <Brain size={14} className="text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] font-medium text-purple-400">Long-term Memory</div>
                  <p className="text-[10px] text-white/40 leading-normal">
                    Vector index enables semantic codebase understanding and global knowledge recall.
                  </p>
                </div>
              </div>
              <button 
                onClick={onSyncMemory}
                className="w-full py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 rounded-lg text-[10px] font-medium transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw size={12} className={cn(vectorStatus?.isIndexing && "animate-spin")} />
                Sync Global Knowledge (Borg)
              </button>
            </div>

            {activeTab && (
              <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-pink-400" />
                  <span className="text-xs text-white/90 font-medium">Neural Suggestions</span>
                </div>
                
                {isLoadingSuggestions ? (
                  <div className="space-y-2 py-1">
                    <div className="h-10 bg-white/5 rounded-lg animate-pulse" />
                    <div className="h-10 bg-white/5 rounded-lg animate-pulse" />
                  </div>
                ) : suggestions.length > 0 ? (
                  <div className="space-y-1.5">
                    {suggestions.map((s, i) => (
                      <button 
                        key={i}
                        className="w-full p-2 text-left bg-white/5 hover:bg-white/10 rounded-lg border border-transparent hover:border-white/10 transition-all group"
                      >
                        <div className="text-[10px] text-white/80 font-medium truncate group-hover:text-pink-300 transition-colors">
                          {s.text.length > 40 ? s.text.substring(0, 40) + '...' : s.text}
                        </div>
                        <div className="text-[9px] text-white/25 truncate mt-0.5">
                          {s.metadata?.file_path || 'Borg Knowledge'}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px] text-white/20 italic text-center py-2">
                    No related context found.
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-white/40">Architectural Context</h3>
            <span className="text-[10px] text-indigo-400/80 font-medium">GitNexus</span>
          </div>
          {gitnexus ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <StatCard label="Symbols" value={gitnexus.symbols} />
                <StatCard label="Refs" value={gitnexus.relationships} />
                <StatCard label="Flows" value={gitnexus.processes} />
              </div>
              
              {gitnexus.stale && (
                <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10 flex items-start gap-2">
                  <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[11px] font-medium text-amber-400">Index Stale</div>
                    <p className="text-[10px] text-white/40 leading-normal">The code graph is out of sync with recent changes. Re-index recommended.</p>
                  </div>
                </div>
              )}
              
              <button className="w-full py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-lg text-xs font-medium transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2">
                <ShieldCheck size={14} />
                Run Architectural Audit
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-codex border border-dashed border-white/10 flex flex-col items-center justify-center text-center">
              <Layers className="w-8 h-8 text-white/10 mb-2" />
              <p className="text-[10px] text-white/30 max-w-[140px]">Initialize GitNexus to see architectural insights and blast radius.</p>
            </div>
          )}
        </section>

        <section className="flex-1 min-h-[400px] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-white/40">Swarm Intelligence</h3>
            <div className="flex items-center gap-1.5">
              <Users size={12} className="text-blue-400" />
              <span className="text-[10px] text-blue-400/80 font-medium">Live Stream</span>
            </div>
          </div>
          <SwarmActivityStream />
        </section>
        </>
        )}
      </div>

      <div className="p-4 border-t border-white/10 bg-black/20 text-[10px] text-white/40 flex items-center justify-between">
        <span>
          Last scan: {capabilityScan ? new Date(capabilityScan.scannedAt).toLocaleTimeString() : new Date().toLocaleTimeString()}
        </span>
        <div className="flex items-center gap-1.5 text-emerald-400/80">
          <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          {capabilityScan ? `${capabilityScan.totalFileCount} files | ${capabilityScan.scanDurationMs}ms` : 'Ready'}
        </div>
      </div>
    </div>
  )
}

function HealthItem({ label, active }: { label: string; active?: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-2 p-1.5 rounded-md border text-[10px] font-medium transition-colors",
      active 
        ? "bg-white/5 border-white/10 text-white/70" 
        : "bg-white/[0.02] border-transparent text-white/20"
    )}>
      {active ? (
        <CheckCircle2 size={10} className="text-emerald-400" />
      ) : (
        <X size={10} className="text-white/10" />
      )}
      {label}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white/5 border border-white/5 rounded-codex p-3 flex flex-col items-center justify-center gap-1 hover:bg-white/10 hover:border-white/10 transition-all cursor-default group">
      <div className="text-sm font-bold text-white group-hover:scale-110 transition-transform tabular-nums">
        {typeof value === 'number' && value > 1000 ? `${(value/1000).toFixed(1)}k` : value}
      </div>
      <div className="text-[9px] text-white/30 uppercase tracking-widest font-bold">{label}</div>
    </div>
  )
}

function OperationIcon({ kind }: { kind: string }) {
  switch (kind) {
    case 'create_file': return <FileCode size={12} className="text-emerald-400 mt-0.5" />
    case 'modify_file': return <RefreshCw size={12} className="text-amber-400 mt-0.5" />
    case 'run_command': return <Activity size={12} className="text-indigo-400 mt-0.5" />
    default: return <Box size={12} className="text-white/40 mt-0.5" />
  }
}

function RiskBadge({ risk }: { risk: string }) {
  const colors = {
    low: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    high: "bg-rose-500/10 text-rose-400 border-rose-500/20"
  }
  return (
    <span className={cn(
      "px-1.5 py-0.5 rounded border text-[8px] font-bold uppercase tracking-tighter",
      colors[risk as keyof typeof colors] || colors.low
    )}>
      {risk}
    </span>
  )
}

// Add these to imports at the top
// No longer needed here as they are moved to the top
