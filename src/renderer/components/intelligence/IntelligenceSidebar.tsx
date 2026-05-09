import React, { useState, useEffect, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  Play,
  ChevronRight,
  Plus,
  Settings,
  Sparkles,
  Trash2,
  User
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { SwarmActivityStream } from '../orchestration/SwarmActivityStream'
const QuantumSwarmGraph = lazy(() => import('../gsd/QuantumSwarmGraph').then(m => ({ default: m.QuantumSwarmGraph })))
import type {
  ProjectIntelligence,
  ProjectCapabilityScan,
  ExtendedApi,
  VectorIndexStatus,
  OpenTab
} from '../../api/types'
import { BrainstormTab } from './BrainstormTab'
import { GovernanceTab } from './GovernanceTab'
const SwarmCognitiveHub = lazy(() => import('./SwarmCognitiveHub').then(m => ({ default: m.SwarmCognitiveHub })))
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

interface CollapsibleSectionProps {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  badge?: string | number;
}

function CollapsibleSection({ title, icon: Icon, children, isOpen, onToggle, badge }: CollapsibleSectionProps) {
  return (
    <div className="flex flex-col border-b border-white/5 last:border-none">
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center justify-between p-4 hover:bg-white/5 transition-all group",
          isOpen ? "bg-white/5" : "bg-transparent"
        )}
      >
        <div className="flex items-center gap-3">
          <Icon size={16} className={cn(isOpen ? "text-primary" : "text-white/40 group-hover:text-white/60")} />
          <span className={cn("text-xs font-bold uppercase tracking-widest", isOpen ? "text-white" : "text-white/30 group-hover:text-white/60")}>
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {badge !== undefined && (
            <span className="px-2 py-0.5 rounded-full bg-white/5 text-[9px] font-bold text-white/40">
              {badge}
            </span>
          )}
          <ChevronRight 
            size={14} 
            className={cn("text-white/20 group-hover:text-white/40 transition-transform duration-300", isOpen && "rotate-90 text-primary")} 
          />
        </div>
      </button>
      
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 space-y-6">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
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
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['overview', 'git']))

  const toggleSection = (id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX
      if (newWidth >= 250 && newWidth <= 800) {
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
          className="mt-6 text-xs text-white/60 hover:text-white transition-colors underline"
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
        "glass-sidebar shadow-2xl z-20 overflow-hidden",
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

      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-primary" />
          <h2 className="font-bold text-white/90 uppercase tracking-tighter">Nerve Center</h2>
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

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {capabilityScan ? (
          <div className="px-4 py-2 border-b border-white/5 flex flex-wrap items-center gap-2 text-[11px] text-white/50">
            <span className="text-white/70 font-medium">{capabilityScan.initializationState.replace(/([A-Z])/g, ' $1').trim()}</span>
            <span>·</span>
            <span>{capabilityScan.totalFileCount} files | {capabilityScan.scanDurationMs}ms</span>
            <span>·</span>
            <span>{Math.round(capabilityScan.projectHealthScore)}%</span>
            <span>·</span>
            <span>Last scan: {new Date(capabilityScan.scannedAt).toLocaleTimeString()}</span>
          </div>
        ) : (
          <div className="px-4 py-2 border-b border-white/5 text-[11px] text-white/40">
            <span>Ready</span>
          </div>
        )}
        <CollapsibleSection
          title="Repo Health"
          icon={ShieldCheck} 
          isOpen={openSections.has('health')} 
          onToggle={() => toggleSection('health')}
          badge={health ? `${health.score}%` : undefined}
        >
          <div className="grid grid-cols-2 gap-2 mt-4">
            <HealthItem label="Git" active={health?.hasGit} />
            <HealthItem label="README" active={health?.hasReadme} />
            <HealthItem label="CI/CD" active={health?.hasCi} />
            <HealthItem label="Tests" active={health?.hasTests} />
            <HealthItem label="Linter" active={health?.hasLinter} />
            <HealthItem label="Lockfile" active={health?.hasLockfile} />
          </div>
          <p className="text-[10px] text-white/30 italic leading-relaxed mt-4">
            Health score is a heuristic based on project hygiene: Git tracking, documentation, automation gates, and test presence.
          </p>
        </CollapsibleSection>

        <CollapsibleSection 
          title="Project Stacks" 
          icon={Layers} 
          isOpen={openSections.has('stacks')} 
          onToggle={() => toggleSection('stacks')}
          badge={stacks?.length}
        >
          <div className="space-y-2 mt-4">
            {stacks && stacks.length > 0 ? stacks.map((stack, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <Layers size={16} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white/90">{stack.name}</div>
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
        </CollapsibleSection>

        <CollapsibleSection 
          title="Git Context" 
          icon={Activity} 
          isOpen={openSections.has('git')} 
          onToggle={() => toggleSection('git')}
        >
          <div className="mt-4">
            <GitContextSection git={git} />
          </div>
        </CollapsibleSection>

        <CollapsibleSection 
          title="Semantic Cache" 
          icon={Brain} 
          isOpen={openSections.has('vector')} 
          onToggle={() => toggleSection('vector')}
        >
          <div className="mt-4">
            <VectorIndexSection
              vectorStatus={vectorStatus}
              api={api}
              activeTab={activeTab}
              onOpenSearch={onOpenSearch}
              onReindex={onReindex}
              onSyncMemory={onSyncMemory}
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection 
          title="Refactoring" 
          icon={Sparkles} 
          isOpen={openSections.has('refactor')} 
          onToggle={() => toggleSection('refactor')}
        >
          <div className="mt-4">
            <RefactoringSection api={api} />
          </div>
        </CollapsibleSection>

        <CollapsibleSection 
          title="Swarm Intelligence" 
          icon={Users} 
          isOpen={openSections.has('swarm')} 
          onToggle={() => toggleSection('swarm')}
        >
          <div className="mt-4 min-h-[300px]">
            <SwarmActivityStream
              api={api}
              projectPath={activeTab?.projectPath || ''}
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection 
          title="Cognitive Topology" 
          icon={Users} 
          isOpen={openSections.has('topology')} 
          onToggle={() => toggleSection('topology')}
        >
          <div className="mt-4 h-[400px]">
            <Suspense fallback={<div className="h-full flex items-center justify-center text-[10px] text-white/20 animate-pulse uppercase tracking-widest font-black">Loading Topology...</div>}>
              <QuantumSwarmGraph />
            </Suspense>
          </div>
        </CollapsibleSection>
      </div>

      <div className="p-4 border-t border-white/10 bg-black/20 text-[10px] text-white/40 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="uppercase font-bold tracking-tighter">Intelligence Active</span>
        </div>
        <span className="opacity-50">Transwarp v2.0</span>
      </div>
    </div>
  )
}
