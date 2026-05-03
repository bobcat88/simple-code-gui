import React from 'react';
import { motion } from 'framer-motion';
import { 
  ShieldAlert, 
  Check, 
  X, 
  Info,
  Terminal,
  AlertTriangle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { GsdApprovalRequest } from '../../api/types';

interface PermissionGuardProps {
  approval: GsdApprovalRequest;
  onResolve: (decision: 'approve' | 'reject') => void;
}

export function PermissionGuard({ approval, onResolve }: PermissionGuardProps) {
  const riskColors = {
    low: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    medium: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    high: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    critical: 'text-red-400 bg-red-500/10 border-red-500/30'
  };

  const riskIcons = {
    low: <Info size={16} />,
    medium: <ShieldAlert size={16} />,
    high: <AlertTriangle size={16} />,
    critical: <ShieldAlert size={16} />
  };

  const argsString = typeof approval.arguments === 'string' 
    ? approval.arguments 
    : JSON.stringify(approval.arguments, null, 2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={cn(
        "w-80 pointer-events-auto rounded-xl border shadow-2xl backdrop-blur-xl p-4 overflow-hidden",
        "bg-black/60 border-white/10"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className={cn(
          "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5",
          riskColors[approval.risk]
        )}>
          {riskIcons[approval.risk]}
          {approval.risk} Risk Tool
        </div>
        <span className="text-[10px] text-white/30 font-mono">#{approval.approvalId.slice(0, 8)}</span>
      </div>

      {/* Content */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-white/90 mb-1 flex items-center gap-2">
          <Terminal size={14} className="text-indigo-400" />
          {approval.tool}
        </h3>
        <p className="text-xs text-white/60 leading-relaxed italic mb-3">
          "{approval.reason}"
        </p>
        
        <div className="bg-black/40 rounded-lg p-2 border border-white/5 max-h-32 overflow-y-auto custom-scrollbar">
          <pre className="text-[9px] font-mono text-indigo-300/80 whitespace-pre-wrap">
            {argsString}
          </pre>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onResolve('reject')}
          className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-red-500/20 border border-white/5 hover:border-red-500/30 text-white/60 hover:text-red-400 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          <X size={14} />
          REJECT
        </button>
        <button
          onClick={() => onResolve('approve')}
          className="flex-2 px-6 py-2 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 hover:border-indigo-500/50 text-indigo-300 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          <Check size={14} />
          APPROVE
        </button>
      </div>
      
      {/* Footer Decal */}
      <div className="absolute -bottom-6 -right-6 opacity-[0.03] pointer-events-none">
        <ShieldAlert size={80} />
      </div>
    </motion.div>
  );
}
