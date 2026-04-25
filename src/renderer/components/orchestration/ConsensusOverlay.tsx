import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GitCompare, 
  Users, 
  CheckCircle2, 
  XCircle, 
  ChevronRight, 
  AlertCircle,
  ArrowRightLeft,
  ShieldCheck,
  Zap,
  Info
} from 'lucide-react';
import { useApi } from '../../contexts/ApiContext';
import { cn } from '../../lib/utils';
import type { GsdStep, GsdStepStatus, UserResponse } from '../../api/types';

interface ConsensusRequest {
  step: GsdStep;
  type: 'conflict' | 'delegation' | 'fix';
}

export function ConsensusOverlay() {
  const { api } = useApi();
  const [requests, setRequests] = useState<ConsensusRequest[]>([]);
  const [activeRequest, setActiveRequest] = useState<ConsensusRequest | null>(null);

  useEffect(() => {
    if (!api?.onGsdStepUpdated) return;

    const unsubscribe = api.onGsdStepUpdated((step: GsdStep) => {
      const status = step.status;
      
      // Check for actionable statuses
      const isConflict = typeof status === 'object' && 'Conflict' in status;
      const isDelegation = typeof status === 'object' && 'AwaitingDelegationApproval' in status;
      const isFix = typeof status === 'object' && 'AwaitingFixApproval' in status;

      if (isConflict || isDelegation || isFix) {
        setRequests(prev => {
          // Remove existing if any (update)
          const filtered = prev.filter(r => r.step.id !== step.id);
          const type = isConflict ? 'conflict' : isDelegation ? 'delegation' : 'fix';
          return [...filtered, { step, type }];
        });
      } else {
        // Remove if resolved or no longer actionable
        setRequests(prev => prev.filter(r => r.step.id !== step.id));
      }
    });

    return () => unsubscribe();
  }, [api]);

  const handleRespond = useCallback(async (stepId: string, response: UserResponse) => {
    try {
      await api.gsdRespondToCheckpoint(stepId, response);
      // Backend will trigger step update which will remove it from our list
    } catch (err) {
      console.error('Failed to respond to consensus:', err);
    }
  }, [api]);

  if (requests.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-6 z-[60] flex flex-col items-end gap-4 pointer-events-none">
      <AnimatePresence>
        {requests.map(({ step, type }) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 50, scale: 0.9, rotate: -2 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            className={cn(
              "w-[400px] pointer-events-auto rounded-2xl border shadow-2xl backdrop-blur-2xl p-5 flex flex-col gap-4 transition-all duration-500",
              "bg-zinc-900/80 border-white/10 ring-1 ring-white/5",
              type === 'conflict' ? "border-amber-500/30 ring-amber-500/10" : 
              type === 'delegation' ? "border-indigo-500/30 ring-indigo-500/10" :
              "border-emerald-500/30 ring-emerald-500/10"
            )}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2.5 rounded-xl shadow-lg",
                  type === 'conflict' ? "bg-amber-500/20 text-amber-400" :
                  type === 'delegation' ? "bg-indigo-500/20 text-indigo-400" :
                  "bg-emerald-500/20 text-emerald-400"
                )}>
                  {type === 'conflict' ? <ArrowRightLeft size={20} /> :
                   type === 'delegation' ? <Users size={20} /> :
                   <ShieldCheck size={20} />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    {type === 'conflict' ? 'Consensus Conflict' : 
                     type === 'delegation' ? 'Delegation Approval' :
                     'Verification Required'}
                  </h3>
                  <p className="text-[10px] uppercase font-bold tracking-widest opacity-40">
                    Step ID: {step.id.slice(0, 8)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-bold text-white/50">
                  ACTION REQUIRED
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-white/90 leading-snug">
                {step.title}
              </h4>
              <p className="text-[11px] text-white/50 leading-relaxed">
                {step.description}
              </p>

              {type === 'conflict' && (
                <ConflictDetails status={step.status} onResolveR1={() => handleRespond(step.id, 'ResolveR1')} onResolveR2={() => handleRespond(step.id, 'ResolveR2')} />
              )}

              {type === 'delegation' && (
                <DelegationDetails status={step.status} onApprove={() => handleRespond(step.id, 'ApproveDelegation')} onReject={() => handleRespond(step.id, 'RejectDelegation')} />
              )}
            </div>

            {/* Actions Bar (Fallback if not handled by inner components) */}
            {type === 'fix' && (
              <div className="flex items-center gap-2 mt-2">
                <button 
                  onClick={() => handleRespond(step.id, 'ApproveFix')}
                  className="flex-1 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/20 text-[11px] font-bold text-emerald-400 transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={14} />
                  APPROVE FIX
                </button>
                <button 
                  onClick={() => handleRespond(step.id, 'Retry')}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-white/60 transition-all"
                >
                  RETRY
                </button>
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function ConflictDetails({ status, onResolveR1, onResolveR2 }: { status: GsdStepStatus, onResolveR1: () => void, onResolveR2: () => void }) {
  if (typeof status !== 'object' || !('Conflict' in status)) return null;
  const [r1, r2, diff] = status.Conflict;

  return (
    <div className="space-y-4 pt-2">
      <div className="grid grid-cols-2 gap-2">
        <button 
          onClick={onResolveR1}
          className="group relative flex flex-col gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-left overflow-hidden"
        >
          <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-400">Reviewer 1</span>
            <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-4px] group-hover:translate-x-0" />
          </div>
          <div className="text-[10px] text-white/70 line-clamp-3 font-mono leading-relaxed bg-black/20 p-1.5 rounded-md border border-white/5">
            {r1}
          </div>
          <div className="mt-1 py-1 px-2 rounded-md bg-indigo-500/20 text-[9px] font-bold text-indigo-300 text-center uppercase tracking-tighter">
            Adopt R1
          </div>
        </button>

        <button 
          onClick={onResolveR2}
          className="group relative flex flex-col gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-left overflow-hidden"
        >
          <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400">Reviewer 2</span>
            <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-4px] group-hover:translate-x-0" />
          </div>
          <div className="text-[10px] text-white/70 line-clamp-3 font-mono leading-relaxed bg-black/20 p-1.5 rounded-md border border-white/5">
            {r2}
          </div>
          <div className="mt-1 py-1 px-2 rounded-md bg-emerald-500/20 text-[9px] font-bold text-emerald-300 text-center uppercase tracking-tighter">
            Adopt R2
          </div>
        </button>
      </div>

      <div className="p-3 rounded-xl bg-black/40 border border-white/5">
        <div className="flex items-center gap-2 mb-2 text-[10px] font-bold text-white/40 uppercase tracking-widest">
          <GitCompare size={12} />
          Structural Diff Preview
        </div>
        <div className="max-h-32 overflow-y-auto font-mono text-[9px] text-white/60 whitespace-pre scrollbar-hide">
          {diff || "No structural diff available. Review side-by-side versions above."}
        </div>
      </div>
    </div>
  );
}

function DelegationDetails({ status, onApprove, onReject }: { status: GsdStepStatus, onApprove: () => void, onReject: () => void }) {
  if (typeof status !== 'object' || !('AwaitingDelegationApproval' in status)) return null;
  const [role, task] = status.AwaitingDelegationApproval;

  return (
    <div className="space-y-4 pt-2">
      <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
          <Users size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-0.5">Proposed Supervisor</div>
          <div className="text-xs font-semibold text-white/90 truncate capitalize">{role}</div>
        </div>
      </div>

      <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-2">
        <div className="flex items-center gap-2 text-[10px] font-bold text-white/40 uppercase tracking-widest">
          <Zap size={12} />
          Delegated Task
        </div>
        <div className="text-[11px] text-white/70 leading-relaxed italic">
          "{task}"
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <button 
          onClick={onApprove}
          className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-[11px] font-bold text-white shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
        >
          <CheckCircle2 size={14} />
          AUTHORIZE DELEGATION
        </button>
        <button 
          onClick={onReject}
          className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-[11px] font-bold text-white/60 hover:text-red-400 transition-all flex items-center justify-center gap-2"
        >
          <XCircle size={14} />
          REJECT
        </button>
      </div>
    </div>
  );
}
