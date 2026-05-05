import React, { useState } from 'react'
import { Sparkles, X, FlaskConical } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { ExtendedApi } from '../../api/types'

interface RefactoringSectionProps {
  api: ExtendedApi
}

export function RefactoringSection({ api }: RefactoringSectionProps) {
  const [refactoringResults, setRefactoringResults] = useState<any[] | null>(null)
  const [isIdentifyingRefactors, setIsIdentifyingRefactors] = useState(false)
  const [refactorDetail, setRefactorDetail] = useState<{ finding: any; details: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleIdentifyRefactors = async () => {
    setIsIdentifyingRefactors(true)
    setError(null)
    if (!api.gsdIdentifyRefactors) return
    try {
      const result = await api.gsdIdentifyRefactors()
      try {
        const parsed = JSON.parse(result)
        setRefactoringResults(Array.isArray(parsed) ? parsed : [parsed])
      } catch {
        if (result && result.trim()) {
          setRefactoringResults([{ title: "Proactive Findings", description: result }])
        }
      }
    } catch (err) {
      console.error('Failed to identify refactors:', err)
      setError(String(err))
    } finally {
      setIsIdentifyingRefactors(false)
    }
  }

  const handleApplyRefactor = async (finding: any, dryRun: boolean = false) => {
    if (!api.gsdApplyRefactor) return
    try {
      await api.gsdApplyRefactor(finding, dryRun)
    } catch (err) {
      console.error(`Failed to ${dryRun ? 'simulate' : 'apply'} refactor:`, err)
    }
  }

  const handleViewRefactorDetails = async (finding: any) => {
    const symbolName = finding.symbolName || finding.title || ""
    if (!symbolName || !api.gsdGetRefactorDetails) return
    try {
      const details = await api.gsdGetRefactorDetails(symbolName)
      setRefactorDetail({ finding, details })
    } catch (err) {
      console.error('Failed to get refactor details:', err)
    }
  }

  return (
    <>
      <div className="intelligence-sidebar-section mb-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/40 flex items-center gap-2">
            <Sparkles size={12} className="text-indigo-400" />
            Refactoring Opportunities
          </h3>
          <button
            onClick={handleIdentifyRefactors}
            disabled={isIdentifyingRefactors}
            className={cn(
              "px-2 py-0.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded text-[9px] font-bold transition-all",
              isIdentifyingRefactors && "animate-pulse"
            )}
          >
            {isIdentifyingRefactors ? 'ANALYZING' : 'SCAN'}
          </button>
        </div>

        {error && (
          <div className="mb-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-[9px] text-red-300 break-all font-mono">
            {error}
          </div>
        )}

        <div className="space-y-2">
          {!refactoringResults && !isIdentifyingRefactors && (
            <div className="p-4 bg-white/5 border border-dashed border-white/10 rounded-xl text-center space-y-2">
              <p className="text-[10px] text-white/40 leading-relaxed">
                Analyze codebase for structural improvements and architectural debt.
              </p>
              <button
                onClick={handleIdentifyRefactors}
                className="text-[10px] text-indigo-400 font-bold hover:text-indigo-300 transition-colors"
              >
                Run Proactive Audit
              </button>
            </div>
          )}

          {isIdentifyingRefactors && (
            <div className="space-y-2">
              {[1, 2].map(i => (
                <div key={i} className="h-16 bg-white/5 rounded-xl border border-white/5 animate-pulse" />
              ))}
            </div>
          )}

          {refactoringResults && refactoringResults.length === 0 && (
            <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-center">
              <p className="text-[10px] text-emerald-400 font-medium">No major architectural debt detected.</p>
            </div>
          )}

          {refactoringResults && refactoringResults.map((finding, idx) => (
            <div key={idx} className="group bg-white/5 border border-white/5 hover:border-indigo-500/30 rounded-xl p-3 space-y-2 transition-all">
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs font-bold text-white/90 line-clamp-1">
                  {finding.title || finding.symbolName || 'Architectural Debt'}
                </div>
                <div className={cn(
                  "text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider",
                  finding.risk === 'HIGH' ? "bg-rose-500/20 text-rose-400" :
                  finding.risk === 'MEDIUM' ? "bg-amber-500/20 text-amber-400" :
                  "bg-indigo-500/20 text-indigo-400"
                )}>
                  {finding.risk || 'Normal'}
                </div>
              </div>
              <p className="text-[10px] text-white/50 leading-relaxed line-clamp-2">
                {finding.description || finding.reason || (typeof finding === 'string' ? finding : 'Potential refactoring opportunity detected.')}
              </p>
              <div className="flex items-center gap-2 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleViewRefactorDetails(finding)}
                  className="flex-1 py-1 bg-white/5 hover:bg-white/10 text-white/60 rounded text-[9px] font-bold transition-all"
                >
                  DETAILS
                </button>
                <button
                  onClick={() => handleApplyRefactor(finding, true)}
                  className="flex-1 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400/80 rounded text-[9px] font-bold transition-all flex items-center justify-center gap-1"
                  title="Simulate in dry-run mode"
                >
                  <FlaskConical size={10} />
                  SIMULATE
                </button>
                <button
                  onClick={() => handleApplyRefactor(finding)}
                  className="flex-1 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded text-[9px] font-bold transition-all"
                >
                  APPLY
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {refactorDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-[#0a0a0c] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                  <span className="text-indigo-400 font-bold">R</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Refactor Context</h3>
                  <p className="text-[10px] text-white/40">{refactorDetail.finding.title || refactorDetail.finding.symbolName}</p>
                </div>
              </div>
              <button
                onClick={() => setRefactorDetail(null)}
                className="w-8 h-8 rounded-full hover:bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Analysis</h4>
                <p className="text-xs text-white/70 leading-relaxed">
                  {refactorDetail.finding.description || refactorDetail.finding.reason}
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Knowledge Graph Context</h4>
                <div className="bg-black/40 border border-white/5 rounded-xl p-4 font-mono text-[10px] text-white/60 overflow-x-auto whitespace-pre">
                  {refactorDetail.details}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-white/5 bg-white/5 flex items-center justify-end gap-3">
              <button
                onClick={() => setRefactorDetail(null)}
                className="px-4 py-2 text-xs font-bold text-white/40 hover:text-white transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={() => { handleApplyRefactor(refactorDetail.finding, true); setRefactorDetail(null) }}
                className="px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-bold rounded-lg border border-emerald-600/20 transition-all flex items-center gap-2"
              >
                <FlaskConical size={14} />
                SIMULATE
              </button>
              <button
                onClick={() => { handleApplyRefactor(refactorDetail.finding); setRefactorDetail(null) }}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-indigo-500/20 transition-all"
              >
                APPLY REFACTOR
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
