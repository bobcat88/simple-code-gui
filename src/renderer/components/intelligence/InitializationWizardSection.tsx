import React, { useState, useRef, useEffect } from 'react'
import { RefreshCw, Wand2, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { ExtendedApi, ProjectCapabilityScan, InitializationProposal, ProposalProgress } from '../../api/types'
import { OperationIcon, RiskBadge } from './sidebar-components'
import { useDialog } from '../../contexts/DialogContext'

interface InitializationWizardSectionProps {
  capabilityScan: ProjectCapabilityScan | null
  api: ExtendedApi
  loading: boolean
  onRefresh: () => void
}

export function InitializationWizardSection({
  capabilityScan,
  api,
  loading,
  onRefresh,
}: InitializationWizardSectionProps) {
  const { showConfirm } = useDialog()
  const [showWizard, setShowWizard] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<string>('Standard')
  const [proposal, setProposal] = useState<InitializationProposal | null>(null)
  const [applying, setApplying] = useState(false)
  const [progress, setProgress] = useState<ProposalProgress | null>(null)
  const [proposalError, setProposalError] = useState<string | null>(null)
  const progressUnsubscribeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => {
      if (progressUnsubscribeRef.current) {
        progressUnsubscribeRef.current()
        progressUnsubscribeRef.current = null
      }
    }
  }, [])

  const healthScore = Math.round(capabilityScan?.projectHealthScore ?? 0)

  return (
    <section className="bg-indigo-500/5 rounded-xl border border-indigo-500/10 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-indigo-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/70">Nerve Center</h3>
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
              setProposalError(null)
              try {
                setApplying(true)
                const p = await api.projectGenerateProposal(
                  capabilityScan,
                  selectedPreset,
                  "Project",
                  "beads"
                )
                setProposal(p as unknown as InitializationProposal)
              } catch (e) {
                console.error(e)
                setProposalError(String(e))
              } finally {
                setApplying(false)
              }
            }}
            className="w-full py-2 border border-white/10 hover:bg-white/5 text-white/80 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2"
          >
            {applying ? <RefreshCw size={14} className="animate-spin" /> : <Wand2 size={14} />}
            Generate Proposal
          </button>

          {proposalError && (
            <div className="flex items-start gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle size={12} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-[9px] text-red-300 break-all font-mono">{proposalError}</p>
            </div>
          )}

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
                        onClick={() => { setProgress(null); setShowWizard(false); setProposal(null) }}
                        className="flex-1 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded text-[10px] font-bold transition-all border border-emerald-500/20"
                      >
                        Finish
                      </button>
                    </div>
                  )}

                  {progress.status === 'failed' && (
                    <button
                      onClick={() => { setProgress(null); setApplying(false) }}
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
                      const confirmApply = await showConfirm('Apply this initialization? This will create or modify files in your repository. This cannot be undone.')
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

                        progressUnsubscribeRef.current = api.onProjectInitializationProgress?.((p: any) => {
                          setProgress(p)
                        }) ?? null

                        await api.projectApplyProposal(proposal)

                        if (progressUnsubscribeRef.current) {
                          progressUnsubscribeRef.current()
                          progressUnsubscribeRef.current = null
                        }

                        onRefresh()
                      } catch (e) {
                        if (progressUnsubscribeRef.current) {
                          progressUnsubscribeRef.current()
                          progressUnsubscribeRef.current = null
                        }
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
            onClick={() => { setShowWizard(false); setProposal(null); setProposalError(null) }}
            className="w-full text-[10px] text-white/30 hover:text-white/60 transition-colors py-1"
          >
            Cancel Wizard
          </button>
        </div>
      )}
    </section>
  )
}
