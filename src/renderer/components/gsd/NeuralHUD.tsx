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
  Brain,
  RefreshCw,
  Settings,
  Shield,
  User,
  Plus,
  Trash2
} from 'lucide-react';
import { useApi } from '../../contexts/ApiContext';
import { useWorkspaceStore } from '../../stores/workspace';
import { cn } from '../../lib/utils';
import type { NeuralInsight, GsdApprovalRequest, SwarmPolicy, SwarmPersona } from '../../api/types';
import { ForensicReport } from './ForensicReport';
import { PermissionGuard } from './PermissionGuard';

export function NeuralHUD() {
  const { api } = useApi();
  const { activeTabId } = useWorkspaceStore();
  const [insights, setInsights] = useState<NeuralInsight[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeInsight, setActiveInsight] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'insights' | 'forensics' | 'swarm' | 'governance' | 'workspace'>('insights');
  const [healedSteps, setHealedSteps] = useState<Set<string>>(new Set());
  const [pendingApprovals, setPendingApprovals] = useState<GsdApprovalRequest[]>([]);
  const [personas, setPersonas] = useState<SwarmPersona[]>([]);
  const [policy, setPolicy] = useState<SwarmPolicy | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeProjects, setActiveProjects] = useState<string[]>([]);
  const { projects } = useWorkspaceStore();

  const fetchActiveProjects = useCallback(async () => {
    if (api?.getActiveProjects) {
      const paths = await api.getActiveProjects();
      setActiveProjects(paths);
    }
  }, [api]);

  useEffect(() => {
    fetchActiveProjects();
  }, [fetchActiveProjects]);

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
    if (viewMode === 'governance' && api?.gsdGetGovernanceStatus) {
      api.gsdGetGovernanceStatus().then(setPolicy);
    }
  }, [viewMode, api]);

  const handleSyncMemory = async () => {
    if (!api?.gsdSyncMemory) return;
    setIsSyncing(true);
    try {
      const imported = await api.gsdSyncMemory();
      console.log(`Synced memory. Imported ${imported} new patterns.`);
      if (api.gsdGetPersonas) {
        const p = await api.gsdGetPersonas();
        setPersonas(p);
      }
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddActiveProject = async (path: string) => {
    if (api?.addActiveProject) {
      await api.addActiveProject(path);
      fetchActiveProjects();
    }
  };

  const handleRemoveActiveProject = async (path: string) => {
    if (api?.removeActiveProject) {
      await api.removeActiveProject(path);
      fetchActiveProjects();
    }
  };

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
                <button 
                  onClick={() => setViewMode('workspace')}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    viewMode === 'workspace' ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                  )}
                  title="Multi-Repo Workspace"
                >
                  <Settings className="w-4 h-4" />
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
            ) : viewMode === 'governance' ? (
              <div className="flex flex-col items-end gap-3 max-h-[70vh] overflow-y-auto no-scrollbar pr-2 pointer-events-auto">
                <div className="w-96 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-xl p-6 shadow-2xl">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white/50 flex items-center gap-2">
                      <Shield size={16} className="text-amber-400" />
                      Governance Policy
                    </h3>
                    <button 
                      onClick={() => setViewMode('swarm')}
                      className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <X size={16} className="text-white/40" />
                    </button>
                  </div>

                  {policy && (
                    <div className="space-y-6">
                      <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                        <label className="text-[10px] uppercase font-bold text-white/30 block mb-2">Operational Mode</label>
                        <div className="grid grid-cols-2 gap-2">
                          {['permissive', 'watchful', 'strict', 'locked'].map(mode => (
                            <button
                              key={mode}
                              onClick={() => {
                                const newPolicy = { ...policy, defaultMode: mode as any };
                                setPolicy(newPolicy);
                                api.gsdUpdatePolicy(newPolicy);
                              }}
                              className={cn(
                                "py-1.5 px-2 rounded-md text-[10px] font-bold uppercase transition-all border",
                                policy.defaultMode === mode 
                                  ? "bg-amber-500/20 border-amber-500/50 text-amber-400" 
                                  : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                              )}
                            >
                              {mode}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[10px] uppercase font-bold text-white/30">Active Personas</h4>
                          <button className="p-1 hover:bg-white/10 rounded text-indigo-400 transition-colors">
                            <Plus size={14} />
                          </button>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar">
                          {policy.personas.map((p) => (
                            <div key={p.id} className="p-3 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between group">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                  <User size={14} />
                                </div>
                                <div>
                                  <div className="text-xs font-semibold text-white/90">{p.name}</div>
                                  <div className="text-[9px] text-white/40">{p.role}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="p-1.5 hover:bg-white/10 rounded text-white/40 hover:text-white transition-colors">
                                  <Settings size={12} />
                                </button>
                                <button className="p-1.5 hover:bg-red-500/20 rounded text-white/40 hover:text-red-400 transition-colors">
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : viewMode === 'swarm' ? (
              <div className="flex flex-col items-end gap-3 max-h-[60vh] overflow-y-auto no-scrollbar pr-2 pointer-events-auto">
                <div className="w-80 bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-4 shadow-2xl mb-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white/50 flex items-center gap-2">
                      <Layers size={14} className="text-indigo-400" />
                      Active Swarm
                    </h3>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={handleSyncMemory}
                        disabled={isSyncing}
                        className={cn(
                          "p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all active:scale-95 group",
                          isSyncing && "opacity-50 pointer-events-none"
                        )}
                        title="Sync with Borg Knowledge Vault"
                      >
                        <RefreshCw size={14} className={cn("text-white/60 group-hover:text-white", isSyncing && "animate-spin")} />
                      </button>
                      <button 
                        onClick={() => setViewMode('governance')}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all active:scale-95 group"
                        title="Governance Policy"
                      >
                        <Shield size={14} className="text-white/60 group-hover:text-white" />
                      </button>
                    </div>
                  </div>
                </div>
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
            ) : viewMode === 'workspace' ? (
              <div className="flex flex-col items-end gap-3 max-h-[70vh] overflow-y-auto no-scrollbar pr-2 pointer-events-auto">
                <div className="w-96 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-xl p-6 shadow-2xl">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white/50 flex items-center gap-2">
                      <Settings size={16} className="text-indigo-400" />
                      Swarm Workspace
                    </h3>
                    <button 
                      onClick={() => setViewMode('insights')}
                      className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <X size={16} className="text-white/40" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-3">
                      <h4 className="text-[10px] uppercase font-bold text-white/30">Active Project Contexts</h4>
                      <div className="space-y-2">
                        {activeProjects.map((path) => {
                          const project = projects.find(p => p.path === path);
                          return (
                            <div key={path} className="p-3 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between group">
                              <div className="flex items-center gap-3 overflow-hidden">
                                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                                  <Layers size={14} />
                                </div>
                                <div className="overflow-hidden">
                                  <div className="text-xs font-semibold text-white/90 truncate">{project?.name || path.split('/').pop()}</div>
                                  <div className="text-[9px] text-white/40 truncate font-mono">{path}</div>
                                </div>
                              </div>
                              <button 
                                onClick={() => handleRemoveActiveProject(path)}
                                className="p-1.5 hover:bg-red-500/20 rounded text-white/40 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          );
                        })}
                        {activeProjects.length === 0 && (
                          <div className="text-center py-4 text-white/20 text-[10px] italic">No active external contexts</div>
                        )}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/5">
                      <h4 className="text-[10px] uppercase font-bold text-white/30 mb-3">Available Projects</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar pr-1">
                        {projects
                          .filter(p => !activeProjects.includes(p.path))
                          .map((p) => (
                            <button
                              key={p.path}
                              onClick={() => handleAddActiveProject(p.path)}
                              className="w-full p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-between group transition-all"
                            >
                              <div className="flex items-center gap-2 overflow-hidden text-left">
                                <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center text-white/40">
                                  <Plus size={12} />
                                </div>
                                <div className="overflow-hidden">
                                  <div className="text-[11px] font-medium text-white/70 truncate">{p.name}</div>
                                </div>
                              </div>
                            </button>
                          ))}
                      </div>
                    </div>

                    <div className="mt-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                      <div className="flex gap-2">
                        <Info size={14} className="text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-amber-500/80 leading-relaxed">
                          Active projects define the search boundaries for the Swarm. Cross-repo reasoning allows agents to understand dependencies and patterns across all linked repositories.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
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
