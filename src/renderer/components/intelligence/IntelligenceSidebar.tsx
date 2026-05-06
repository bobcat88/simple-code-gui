import React, { useState, useEffect, lazy, Suspense } from 'react'
import {
  Activity,
  AlertCircle,
  X,
  RefreshCw,
  Layers,
  ShieldCheck,
  FileCode,
  Brain,
  Users,
  Lightbulb,
  Play
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { SwarmActivityStream } from '../orchestration/SwarmActivityStream'
import type {
  ProjectIntelligence,
  ProjectCapabilityScan,
  ExtendedApi,
  VectorIndexStatus,
  OpenTab
} from '../../api/types'
import { BrainstormTab } from './BrainstormTab'
import { GovernanceTab } from './GovernanceTab'
import { SwarmCognitiveHub } from './SwarmCognitiveHub'
const NeuralHUDTab = lazy(() => import('./NeuralHUDTab').then(m => ({ default: m.NeuralHUDTab })))
import { InitializationWizardSection } from './InitializationWizardSection'
import { RefactoringSection } from './RefactoringSection'
import { VectorIndexSection } from './VectorIndexSection'
import { GitContextSection } from './GitContextSection'
import { HealthItem, StatCard } from './sidebar-components'

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
  gitnexus?: ProjectIntelligence['gitnexus']
  activeTab?: OpenTab | null
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
  const [activeSection, setActiveSection] = useState<'intelligence' | 'swarmhub' | 'brainstorm'>('intelligence')

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

    const handleMouseUp = () => setIsResizing(false)

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
        <Layers className="w-12 h-12 text-white/20 mb-4" />
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

      <div className="px-4 py-2 border-b border-white/5 flex gap-4">
        <button
          onClick={() => setActiveSection('intelligence')}
          className={cn(
            "pb-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2",
            activeSection === 'intelligence'
              ? "text-white border-indigo-500"
              : "text-white/30 border-transparent hover:text-white/60"
          )}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveSection('swarmhub')}
          className={cn(
            "pb-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5",
            activeSection === 'swarmhub'
              ? "text-white border-codex-neon"
              : "text-white/30 border-transparent hover:text-white/60"
          )}
        >
          Cognitive Hub
          <Brain size={12} className={cn(activeSection === 'swarmhub' ? "text-codex-neon" : "text-white/20")} />
        </button>
        <button
          onClick={() => setActiveSection('brainstorm')}
          className={cn(
            "pb-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5",
            activeSection === 'brainstorm'
              ? "text-white border-codex-blue"
              : "text-white/30 border-transparent hover:text-white/60"
          )}
        >
          Brainstorm
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
        {activeSection === 'brainstorm' ? (
          <BrainstormTab
            api={api}
            projectPath={activeTab?.projectPath || ''}
          />
        ) : activeSection === 'swarmhub' ? (
          <SwarmCognitiveHub
            api={api}
            projectPath={activeTab?.projectPath || ''}
          />
        ) : (
          <>
            <InitializationWizardSection
              capabilityScan={capabilityScan}
              api={api}
              loading={loading}
              onRefresh={onRefresh}
            />

            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white/40">Repo Health</h3>
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
              <h3 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-3">Detected Stacks</h3>
              <div className="space-y-2">
                {stacks && stacks.length > 0 ? stacks.map((stack, i) => (
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

            <GitContextSection git={git} />

            <VectorIndexSection
              vectorStatus={vectorStatus}
              api={api}
              activeTab={activeTab}
              onOpenSearch={onOpenSearch}
              onReindex={onReindex}
              onSyncMemory={onSyncMemory}
            />

            <RefactoringSection api={api} />

            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white/40">Architectural Context</h3>
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
                        <div className="text-xs font-medium text-amber-400">Index Stale</div>
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
                <h3 className="text-xs font-bold uppercase tracking-wider text-white/40">Swarm Intelligence</h3>
                <div className="flex items-center gap-1.5">
                  <Users size={12} className="text-blue-400" />
                  <span className="text-[10px] text-blue-400/80 font-medium">Live Stream</span>
                </div>
              </div>
              <SwarmActivityStream
                api={api}
                projectPath={activeTab?.projectPath || ''}
              />
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
