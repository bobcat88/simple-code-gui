import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, 
  AlertTriangle, 
  Info, 
  Terminal, 
  Layers, 
  Activity, 
  ChevronRight, 
  X,
  ExternalLink,
  Sparkles,
  Brain
} from 'lucide-react';
import { useApi } from '../../contexts/ApiContext';
import { useWorkspaceStore } from '../../stores/workspace';
import { cn } from '../../lib/utils';
import type { NeuralInsight, GsdApprovalRequest } from '../../api/types';
import { ForensicReport } from './ForensicReport';
import { PermissionGuard } from './PermissionGuard';

export function NeuralHUD() {
  const { api } = useApi();
  const { activeTabId } = useWorkspaceStore();
  const [insights, setInsights] = useState<NeuralInsight[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeInsight, setActiveInsight] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'insights' | 'forensics' | 'swarm'>('insights');
  const [healedSteps, setHealedSteps] = useState<Set<string>>(new Set());
  const [pendingApprovals, setPendingApprovals] = useState<GsdApprovalRequest[]>([]);
  const [personas, setPersonas] = useState<SwarmPersona[]>([]);

  useEffect(() => {
    if (!api?.onGsdInsight) return;

    const unsubscribe = api.onGsdInsight((insight: NeuralInsight) => {
      setInsights(prev => [insight, ...prev].slice(0, 10)); // Keep last 10
      // Auto-expand if high severity
      if (insight.severity === 'high') {
        setIsMinimized(false);
        setViewMode('insights');
      }
    });

    const unsubscribeEvents = api.onGsdExecutionEvent ? api.onGsdExecutionEvent((event) => {
      if (event.eventType === 'memory_injected' && event.stepId) {
        setHealedSteps(prev => new Set(prev).add(event.stepId));
        
        // Add a "Healing" insight
        const healingInsight: NeuralInsight = {
          id: `healing-${event.stepId}-${Date.now()}`,
          severity: 'low',
          insightType: 'optimization',
          message: 'Collective Memory Active',
          details: event.message,
          timestamp: Date.now(),
        };
        setInsights(prev => [healingInsight, ...prev].slice(0, 10));
        
        // Auto-expand if high value
        setIsMinimized(false);
      }
    }) : () => {};

    const unsubscribeApprovals = api.onGsdApprovalRequested ? api.onGsdApprovalRequested((approval) => {
      setPendingApprovals(prev => [...prev, approval]);
      setIsMinimized(false);
      setViewMode('insights');
    }) : () => {};

    return () => {
      unsubscribe();
      unsubscribeEvents();
      unsubscribeApprovals();
    };
  }, [api]);

  useEffect(() => {
    if (viewMode === 'swarm' && api?.gsdGetPersonas) {
      api.gsdGetPersonas().then(setPersonas);
    }
  }, [viewMode, api]);

  const removeInsight = useCallback((id: string) => {
    setInsights(prev => prev.filter(i => i.id !== id));
    if (activeInsight === id) setActiveInsight(null);
  }, [activeInsight]);

  const handleAction = useCallback((insight: NeuralInsight) => {
    if (!insight.actionCommand) return;

    if (activeTabId) {
      api.writePty(activeTabId, `${insight.actionCommand}\n`);
      if (api.activityLogInfo) {
        api.activityLogInfo('NeuralHUD', `Executing insight action: ${insight.actionLabel}`, JSON.stringify(insight));
      }
      // Auto-dismiss after action
      removeInsight(insight.id || '');
    } else {
      console.warn('No active terminal to execute insight action');
    }
  }, [activeTabId, api, removeInsight]);

  const handleApprovalResolve = useCallback(async (approvalId: string, decision: 'approve' | 'reject') => {
    if (!api.gsdRespondToApproval) return;
    
    try {
      await api.gsdRespondToApproval(approvalId, decision);
      setPendingApprovals(prev => prev.filter(a => a.approvalId !== approvalId));
      if (api.activityLogInfo) {
        api.activityLogInfo('NeuralHUD', `Resolved approval ${approvalId}: ${decision}`, '');
      }
    } catch (err) {
      console.error('Failed to resolve approval:', err);
    }
  }, [api]);

  const showHud = insights.length > 0 || viewMode === 'forensics';

  if (!showHud && isMinimized) return null;

  return (
    <div className="fixed top-24 right-6 z-50 flex flex-col items-end gap-3 pointer-events-none">
      <AnimatePresence>
        {!isMinimized && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex flex-col items-end gap-4"
          >
            {/* View Switcher */}
            <div className="flex bg-black/40 backdrop-blur-md rounded-lg border border-white/10 p-1 pointer-events-auto">
              <div className="flex items-center gap-2 px-1">
                <button 
                  onClick={() => setViewMode('insights')}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    viewMode === 'insights' ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                  )}
                  title="Intelligence Feed"
                >
                  <Activity className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setViewMode('swarm')}
                  className={cn(
                    "p-2 rounded-lg transition-colors relative",
                    viewMode === 'swarm' ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                  )}
                  title="Swarm Personas"
                >
                  <Brain className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setViewMode('forensics')}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    viewMode === 'forensics' ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                  )}
                  title="Forensic Audit"
                >
                  <Layers className="w-4 h-4" />
                </button>
              </div>
            </div>

            {viewMode === 'insights' ? (
              <div className="flex flex-col items-end gap-3">
                {/* Governance Approvals - Priority 1 */}
                <AnimatePresence mode="popLayout">
                  {pendingApprovals.map((approval) => (
                    <PermissionGuard 
                      key={approval.approvalId}
                      approval={approval}
                      onResolve={(decision) => handleApprovalResolve(approval.approvalId, decision)}
                    />
                  ))}
                </AnimatePresence>

                {/* Insights - Priority 2 */}
                {insights.slice(0, 3).map((insight, idx) => (
                  <motion.div
                    key={insight.id || idx}
                    initial={{ opacity: 0, x: 50, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 20, scale: 0.95 }}
                    className={cn(
                      "w-80 pointer-events-auto rounded-xl border border-white/10 shadow-2xl backdrop-blur-xl p-4 transition-all duration-300",
                      insight.severity === 'high' 
                        ? "bg-red-500/10 border-red-500/30 ring-1 ring-red-500/20" 
                        : insight.severity === 'medium'
                        ? "bg-amber-500/10 border-amber-500/30"
                        : "bg-indigo-500/10 border-indigo-500/30"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "p-2 rounded-lg shrink-0",
                        insight.severity === 'high' ? "bg-red-500/20 text-red-400" :
                        insight.severity === 'medium' ? "bg-amber-500/20 text-amber-400" :
                        "bg-indigo-500/20 text-indigo-400"
                      )}>
                        {insight.message.includes('Collective Memory') ? <Brain size={18} /> :
                         insight.insightType === 'architectural' ? <Layers size={18} /> :
                         insight.insightType === 'optimization' ? <Zap size={18} /> :
                         <Terminal size={18} />}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[10px] uppercase tracking-wider font-bold opacity-50">
                            {insight.insightType} Insight
                          </span>
                          <button 
                            onClick={() => removeInsight(insight.id || '')}
                            className="p-1 hover:bg-white/10 rounded-md transition-colors"
                          >
                            <X size={12} className="opacity-40" />
                          </button>
                        </div>
                        
                        <h4 className="text-sm font-semibold text-white/90 leading-tight mb-1">
                          {insight.message}
                        </h4>
                        
                        {insight.details && (
                          <p className="text-xs text-white/60 line-clamp-2 mb-3 leading-relaxed">
                            {insight.details}
                          </p>
                        )}

                        {insight.actionLabel && (
                          <button 
                            className="w-full py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/15 border border-white/5 text-[11px] font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                            onClick={() => handleAction(insight)}
                          >
                            {insight.actionLabel}
                            <ChevronRight size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* HUD Status Line */}
                    <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[10px] text-white/40">
                        <Activity size={10} className="animate-pulse" />
                        <span>Swarm Consensus: 94%</span>
                      </div>
                      <span className="text-[9px] text-white/30 font-mono">
                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : viewMode === 'swarm' ? (
              <div className="flex flex-col items-end gap-3 max-h-[60vh] overflow-y-auto no-scrollbar pr-2 pointer-events-auto">
                <AnimatePresence mode="popLayout">
                  {personas.map((persona) => (
                    <motion.div
                      key={persona.id}
                      initial={{ opacity: 0, x: 50, scale: 0.9 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: 20, scale: 0.95 }}
                      className="w-80 rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-4 shadow-2xl"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                          <Brain size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <h4 className="text-sm font-semibold text-white/90 truncate">{persona.name}</h4>
                            <span className={cn(
                              "text-[8px] px-1.5 py-0.5 rounded-full border uppercase tracking-widest font-bold",
                              persona.governanceTier === 'elevated' ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : 
                              persona.governanceTier === 'restricted' ? "bg-red-500/10 border-red-500/30 text-red-400" : 
                              "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                            )}>
                              {persona.governanceTier}
                            </span>
                          </div>
                          <p className="text-[10px] text-white/40 mb-3 uppercase tracking-wider font-medium">{persona.role}</p>
                          
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {persona.expertise.map(skill => (
                              <span key={skill} className="px-2 py-0.5 rounded-md bg-white/5 text-[9px] text-white/60 border border-white/5">
                                {skill}
                              </span>
                            ))}
                          </div>

                          <div className="pt-2 border-t border-white/5">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-white/40">Tool Access</span>
                              <span className="text-white/80 font-mono">{persona.tools.length} Tools</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {personas.length === 0 && (
                  <div className="w-80 text-center py-8 text-white/40 text-xs italic">
                    Initializing Swarm Collective...
                  </div>
                )}
              </div>
            ) : (
              <ForensicReport />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* HUD Control Bar */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsMinimized(!isMinimized)}
        className="pointer-events-auto mt-2 px-4 py-2 rounded-full bg-black/40 border border-white/10 backdrop-blur-md text-[11px] font-bold text-white/80 flex items-center gap-2 shadow-lg ring-1 ring-white/5 hover:bg-black/60 transition-all"
      >
        {healedSteps.size > 0 && (
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-500 rounded-full blur-[4px] opacity-50 animate-pulse" />
            <Sparkles size={14} className="relative text-emerald-400" />
          </div>
        )}
        NEURAL HUD: {insights.length + pendingApprovals.length} ACTIVE
        {isMinimized ? <ChevronRight size={14} /> : <X size={14} />}
      </motion.button>
    </div>
  );
}
