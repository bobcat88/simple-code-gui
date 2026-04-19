import React from 'react'
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
  AlertTriangle
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type { ProjectIntelligence } from '../../api/types'

interface IntelligenceSidebarProps {
  intelligence: ProjectIntelligence | null
  loading: boolean
  onClose: () => void
  onRefresh: () => void
  onWidthChange: (width: number) => void
  width: number
}

export function IntelligenceSidebar({ 
  intelligence, 
  loading, 
  onClose, 
  onRefresh,
  onWidthChange,
  width 
}: IntelligenceSidebarProps) {
  const [isResizing, setIsResizing] = React.useState(false)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }

  React.useEffect(() => {
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
        className="h-full border-l border-white/10 bg-black/20 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center"
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

  const { git, stacks, health, gitnexus } = intelligence || {}

  return (
    <div 
      className={cn(
        "h-full flex flex-col relative transition-all duration-300 ease-in-out",
        "glass-sidebar shadow-2xl z-20",
        isResizing && "transition-none"
      )}
      style={{ width }}
    >
      {/* Resize Handle */}
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
            onClick={onRefresh}
            className="p-1.5 rounded-md hover:bg-white/10 text-white/40 hover:text-white/80 transition-all"
            title="Refresh Intelligence"
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

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
        {/* Repo Health Score */}
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

        {/* Detected Stacks */}
        <section>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-3">Detected Stacks</h3>
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

        {/* Git State */}
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
                {git.recentCommits.map((commit, i) => (
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

        {/* GitNexus context */}
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
      </div>

      {/* Footer / Summary */}
      <div className="p-4 border-t border-white/10 bg-black/20 text-[10px] text-white/40 flex items-center justify-between">
        <span>Last scan: {new Date().toLocaleTimeString()}</span>
        <div className="flex items-center gap-1.5 text-emerald-400/80">
          <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          Ready
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white/5 border border-white/5 rounded-codex p-3 flex flex-col items-center justify-center gap-1 hover:bg-white/10 hover:border-white/10 transition-all cursor-default group">
      <div className="text-sm font-bold text-white group-hover:scale-110 transition-transform tabular-nums">
        {value > 1000 ? `${(value/1000).toFixed(1)}k` : value}
      </div>
      <div className="text-[9px] text-white/30 uppercase tracking-widest font-bold">{label}</div>
    </div>
  )
}
