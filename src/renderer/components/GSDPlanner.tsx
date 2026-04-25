import React, { useState, useEffect, useCallback } from 'react';
import { 
  Milestone, 
  Plus, 
  Trash2, 
  Play, 
  CheckCircle2, 
  Circle, 
  Clock, 
  ChevronDown, 
  ChevronRight,
  GripVertical,
  X,
  PlusCircle,
  AlertCircle,
  Wand2,
  Users,
  Scale,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Api, GsdPlan, GsdPhase, GsdStep, GsdExecutionEvent, UserResponse } from '../api/types';

interface GSDPlannerProps {
  projectPath: string | null;
  api: Api;
}

function formatDuration(start?: number, end?: number) {
  if (!start) return '';
  const durationMs = (end || Date.now()) - start;
  const seconds = Math.floor(durationMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

export function GSDPlanner({ projectPath, api }: GSDPlannerProps) {
  const [plan, setPlan] = useState<GsdPlan | null>(null);
  const [availablePlans, setAvailablePlans] = useState<GsdPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({});
  const [showPlanSelector, setShowPlanSelector] = useState(false);

  // Initialize/Load plans
  const refreshPlans = useCallback(async (autoSelectId?: string) => {
    if (!projectPath || !api.gsdListPlans) return;
    setLoading(true);
    try {
      const plans = await api.gsdListPlans(projectPath);
      setAvailablePlans(plans);
      
      if (plans.length > 0) {
        // Auto-select the requested plan, or the first one
        const selected = autoSelectId 
          ? plans.find(p => p.id === autoSelectId) || plans[0]
          : plans[0];
        setPlan(selected);
      } else {
        setPlan(null);
      }
      setError(null);
    } catch (err) {
      console.error('Failed to list GSD plans:', err);
      setError('Failed to fetch project plans.');
    } finally {
      setLoading(false);
    }
  }, [api, projectPath]);

  useEffect(() => {
    refreshPlans();
  }, [refreshPlans]);

  // Listen for execution events
  useEffect(() => {
    if (!api.onGsdExecutionEvent) return;

    const unsubscribe = api.onGsdExecutionEvent((event: any) => {
      if (event.type === 'gsd-execution-started') {
        setExecuting(true);
      } else if (event.type === 'gsd-execution-completed' || event.type === 'gsd-execution-failed') {
        setExecuting(false);
      }
    });

    const unsubscribePhase = api.onGsdPhaseUpdated?.((updatedPhase: GsdPhase) => {
      setPlan(prev => {
        if (!prev) return null;
        return {
          ...prev,
          phases: prev.phases.map(p => p.id === updatedPhase.id ? updatedPhase : p)
        };
      });
    });

    const unsubscribeStep = api.onGsdStepUpdated?.((updatedStep: GsdStep) => {
      setPlan(prev => {
        if (!prev) return null;
        return {
          ...prev,
          phases: prev.phases.map(p => ({
            ...p,
            steps: p.steps.map(s => s.id === updatedStep.id ? updatedStep : s)
          }))
        };
      });
    });

    return () => {
      unsubscribe?.();
      unsubscribePhase?.();
      unsubscribeStep?.();
    };
  }, [api]);

  const handleCreateNewPlan = async () => {
    if (!projectPath || !api.gsdCreatePlan) return;
    const title = prompt('Plan Title:', 'New GSD Plan');
    if (!title) return;

    try {
      setLoading(true);
      const newPlan = await api.gsdCreatePlan(projectPath, title);
      await refreshPlans(newPlan.id);
      setShowPlanSelector(false);
    } catch (err) {
      setError('Failed to create new plan.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPhase = async () => {
    if (!plan || !projectPath || !api.gsdAddPhase) return;
    const name = prompt('Phase Name:');
    if (!name) return;

    try {
      const newPhase = await api.gsdAddPhase(plan.id, name);
      setPlan(prev => {
        if (!prev) return null;
        return {
          ...prev,
          phases: [...prev.phases, newPhase]
        };
      });
      setExpandedPhases(prev => ({ ...prev, [newPhase.id]: true }));
    } catch (err) {
      setError('Failed to add phase.');
    }
  };

  const handleAddStep = async (phaseId: string) => {
    if (!plan || !projectPath) return;
    const title = prompt('Step Title:');
    if (!title) return;
    const description = prompt('Step Description (Command):');
    if (!description) return;

    try {
      const newStep = await api.gsdAddStep(plan.id, phaseId, title, description);
      setPlan(prev => {
        if (!prev) return null;
        return {
          ...prev,
          phases: prev.phases.map(p => {
            if (p.id === phaseId) {
              return { ...p, steps: [...p.steps, newStep] };
            }
            return p;
          })
        };
      });
    } catch (err) {
      setError('Failed to add step.');
    }
  };

  const handleExecute = async () => {
    if (!plan || !projectPath || executing) return;
    try {
      setExecuting(true);
      await api.gsdExecutePlan(plan.id);
    } catch (err) {
      setError('Execution failed to start.');
      setExecuting(false);
    }
  };

  const handleRespondToCheckpoint = async (stepId: string, response: UserResponse) => {
    try {
      await api.gsdRespondToCheckpoint(stepId, response);
    } catch (err) {
      console.error('Failed to respond to checkpoint:', err);
      setError('Failed to send response to engine.');
    }
  };

  const togglePhase = (phaseId: string) => {
    setExpandedPhases(prev => ({ ...prev, [phaseId]: !prev[phaseId] }));
  };

  if (!projectPath) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertCircle size={48} className="text-muted-foreground/20 mb-4" />
        <h3 className="text-lg font-semibold text-muted-foreground">No Project Selected</h3>
        <p className="text-sm text-muted-foreground/60 max-w-xs mt-2">
          Select a project in the sidebar to use the GSD Planner.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <span className="text-sm font-medium text-muted-foreground">Initializing Deep Engine...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      {/* Header */}
      <div className="p-6 border-b border-white/5 bg-white/5 backdrop-blur-xl flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-primary shadow-lg shadow-primary/10">
            <Milestone size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">Transwarp Planner</h2>
              <div className="relative">
                <button 
                  onClick={() => setShowPlanSelector(!showPlanSelector)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-white transition-colors text-xs font-semibold border border-transparent hover:border-white/10"
                >
                  {plan?.title || 'Select Plan'}
                  <ChevronDown size={14} className={cn("transition-transform", showPlanSelector && "rotate-180")} />
                </button>

                {showPlanSelector && (
                  <div className="absolute top-full left-0 mt-2 w-64 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-2 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-2">Available Plans</span>
                      <button 
                        onClick={handleCreateNewPlan}
                        className="p-1.5 rounded-lg hover:bg-primary/20 text-primary transition-colors"
                        title="Create New Plan"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto p-1">
                      {availablePlans.length === 0 ? (
                        <div className="p-4 text-center">
                          <p className="text-xs text-muted-foreground">No plans found.</p>
                        </div>
                      ) : (
                        availablePlans.map(p => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setPlan(p);
                              setShowPlanSelector(false);
                            }}
                            className={cn(
                              "w-full flex flex-col items-start p-3 rounded-lg text-left transition-all hover:bg-white/5 group",
                              plan?.id === p.id ? "bg-primary/10 border border-primary/20" : "border border-transparent"
                            )}
                          >
                            <span className={cn("text-sm font-semibold", plan?.id === p.id ? "text-primary" : "text-white/80")}>
                              {p.title}
                            </span>
                            <span className="text-[10px] text-muted-foreground mt-1">
                              {p.phases.length} Phases • {p.phases.reduce((acc, ph) => acc + ph.steps.length, 0)} Steps
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Phase 17 Deep Execution Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {executing && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest animate-pulse">
              <Milestone size={12} />
              Active Wave
            </div>
          )}
          <button
            onClick={handleExecute}
            disabled={executing || !plan || plan.phases.length === 0}
            className={cn(
              "px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-lg",
              executing 
                ? "bg-orange-500/20 text-orange-400 border border-orange-500/30 cursor-not-allowed"
                : "bg-primary text-primary-foreground shadow-primary/20 hover:scale-105 active:scale-95"
            )}
          >
            {executing ? (
              <>
                <div className="w-4 h-4 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <Play size={16} fill="currentColor" />
                Execute Plan
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
            <AlertCircle size={18} />
            {error}
            <button onClick={() => setError(null)} className="ml-auto hover:text-red-300">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Phases List */}
        <div className="relative">
          {/* Vertical line connecting phases */}
          <div className="absolute left-[23px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-primary/50 via-primary/20 to-transparent" />

          <div className="space-y-6">
            {plan?.phases.map((phase, idx) => (
              <div key={phase.id} className="relative pl-12">
                {/* Phase Marker */}
                <div 
                  className={cn(
                    "absolute left-0 top-0 w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all duration-300 z-10 cursor-pointer",
                    phase.status === 'Completed' ? "bg-green-500/20 border-green-500 text-green-500 shadow-lg shadow-green-500/20" :
                    phase.status === 'InProgress' ? "bg-primary/20 border-primary text-primary shadow-lg shadow-primary/20 animate-pulse" :
                    "bg-white/5 border-white/10 text-muted-foreground hover:border-primary/50"
                  )}
                  onClick={() => togglePhase(phase.id)}
                >
                  <span className="text-lg font-bold">{idx + 1}</span>
                </div>

                {/* Phase Card */}
                <div className="group rounded-3xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all overflow-hidden shadow-sm hover:shadow-md">
                  <div className="p-5 flex items-center justify-between cursor-pointer" onClick={() => togglePhase(phase.id)}>
                    <div className="flex items-center gap-4">
                      <h3 className="text-lg font-bold text-white/90">{phase.title}</h3>
                      <div className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        phase.status === 'Completed' ? "bg-green-500/20 text-green-400" :
                        phase.status === 'InProgress' ? "bg-primary/20 text-primary" :
                        "bg-white/5 text-muted-foreground"
                      )}>
                        {typeof phase.status === 'string' ? (phase.status === 'InProgress' ? 'In Progress' : phase.status) : 'Failed'}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleAddStep(phase.id); }}
                        className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-primary transition-colors"
                      >
                        <PlusCircle size={18} />
                      </button>
                      {expandedPhases[phase.id] ? <ChevronDown size={20} className="text-muted-foreground" /> : <ChevronRight size={20} className="text-muted-foreground" />}
                    </div>
                  </div>

                  {expandedPhases[phase.id] && (
                    <div className="px-5 pb-5 animate-in slide-in-from-top-2 duration-200">
                      <div className="space-y-4 pt-2">
                        {phase.steps.length === 0 ? (
                          <div className="py-4 text-center border-2 border-dashed border-white/5 rounded-2xl">
                            <p className="text-sm text-muted-foreground italic">No steps defined for this phase.</p>
                          </div>
                        ) : (
                          (() => {
                            const waves: Record<number, GsdStep[]> = {};
                            phase.steps.forEach(s => {
                              const w = s.waveIndex || 0;
                              if (!waves[w]) waves[w] = [];
                              waves[w].push(s);
                            });
                            
                            return Object.entries(waves).sort(([a], [b]) => Number(a) - Number(b)).map(([waveId, steps]) => (
                              <div key={waveId} className="space-y-2 relative">
                                {waveId !== '0' && (
                                  <div className="flex items-center justify-between gap-4 mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-bold text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-md">Wave {waveId}</span>
                                      <span className="text-[10px] font-medium text-muted-foreground/60 tabular-nums">
                                        {formatDuration(
                                          steps.reduce((min, s) => Math.min(min, s.startedAt || Infinity), Infinity),
                                          steps.every(s => s.completedAt) ? steps.reduce((max, s) => Math.max(max, s.completedAt || 0), 0) : undefined
                                        )}
                                      </span>
                                    </div>
                                    <div className="flex-1 h-px bg-gradient-to-r from-primary/20 to-transparent" />
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                                      {steps.filter(s => s.status === 'Completed').length} / {steps.length} Complete
                                    </div>
                                  </div>
                                )}
                                {/* Wave Progress Bar */}
                                {waveId !== '0' && steps.some(s => s.status === 'InProgress') && (
                                  <div className="h-0.5 w-full bg-white/5 rounded-full overflow-hidden mb-3">
                                    <div 
                                      className="h-full bg-primary transition-all duration-500" 
                                      style={{ width: `${(steps.filter(s => s.status === 'Completed').length / steps.length) * 100}%` }}
                                    />
                                  </div>
                                )}
                                <div className={cn(
                                  "grid gap-3",
                                  steps.length > 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
                                )}>
                                  {steps.map((step) => {
                                    const isWaiting = typeof step.status === 'object' && 'WaitingForUser' in step.status;
                                    const isFailed = typeof step.status === 'object' && 'Failed' in step.status;
                                    const isAutoFixing = typeof step.status === 'object' && 'AutoFixing' in step.status;
                                    const isAwaitingFix = typeof step.status === 'object' && 'AwaitingFixApproval' in step.status;
                                    const isConflict = typeof step.status === 'object' && 'Conflict' in step.status;
                                    const isAwaitingDelegation = typeof step.status === 'object' && 'AwaitingDelegationApproval' in step.status;
                                    
                                    return (
                                      <div 
                                        key={step.id}
                                        className={cn(
                                          "p-4 rounded-2xl border transition-all relative group/step",
                                          step.status === 'Completed' ? "bg-green-500/5 border-green-500/20" :
                                          step.status === 'InProgress' ? "bg-primary/5 border-primary/30 shadow-lg shadow-primary/5" :
                                          isWaiting ? "bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-500/10 animate-pulse" :
                                          isAutoFixing ? "bg-blue-500/10 border-blue-500/40 shadow-lg shadow-blue-500/10" :
                                          isAwaitingFix ? "bg-indigo-500/10 border-indigo-500/40 shadow-lg shadow-indigo-500/10 animate-pulse" :
                                          isConflict ? "bg-purple-500/10 border-purple-500/40 shadow-lg shadow-purple-500/10 animate-pulse" :
                                          isAwaitingDelegation ? "bg-cyan-500/10 border-cyan-500/40 shadow-lg shadow-cyan-500/10 animate-pulse" :
                                          isFailed ? "bg-red-500/5 border-red-500/20" :
                                          "bg-white/[0.02] border-white/5 hover:bg-white/[0.04]"
                                        )}
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                              {step.status === 'Completed' ? (
                                                <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                                              ) : step.status === 'InProgress' || isAutoFixing ? (
                                                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin shrink-0" />
                                              ) : isWaiting || isAwaitingFix || isConflict || isAwaitingDelegation ? (
                                                <AlertCircle size={16} className="text-amber-500 shrink-0" />
                                              ) : isFailed ? (
                                                <X size={16} className="text-red-500 shrink-0" />
                                              ) : (
                                                <Circle size={16} className="text-muted-foreground/30 shrink-0" />
                                              )}
                                              <h4 className="text-sm font-semibold truncate text-white/80">{step.title}</h4>
                                            </div>
                                            <p className="text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed">{step.description}</p>
                                            
                                            {step.result && (
                                              <div className="mt-2 p-2 rounded-lg bg-black/20 border border-white/5 text-[10px] font-mono text-muted-foreground/70 break-all max-h-20 overflow-y-auto">
                                                {step.result}
                                              </div>
                                            )}

                                            {/* Checkpoint UI */}
                                            {isWaiting && (
                                              <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-3">
                                                <p className="text-[11px] font-medium text-amber-200/80 leading-snug">
                                                  {(step.status as any).WaitingForUser}
                                                </p>
                                                <div className="flex flex-wrap gap-2">
                                                  <button
                                                    onClick={() => handleRespondToCheckpoint(step.id, 'Approve')}
                                                    className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-green-600 transition-colors shadow-sm"
                                                  >
                                                    Approve
                                                  </button>
                                                  <button
                                                    onClick={() => handleRespondToCheckpoint(step.id, 'Retry')}
                                                    className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-white/20 transition-colors border border-white/10"
                                                  >
                                                    Retry
                                                  </button>
                                                  <button
                                                    onClick={() => handleRespondToCheckpoint(step.id, 'Abort')}
                                                    className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-wider hover:bg-red-500/30 transition-colors border border-red-500/30"
                                                  >
                                                    Abort
                                                  </button>
                                                </div>
                                              </div>
                                            )}

                                            {/* Auto-Fix Loading UI */}
                                            {isAutoFixing && (
                                              <div className="mt-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center gap-3">
                                                <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin shrink-0" />
                                                <p className="text-[11px] font-medium text-blue-200/80">
                                                  {(step.status as any).AutoFixing}
                                                </p>
                                              </div>
                                            )}

                                            {/* Fix Approval UI */}
                                            {isAwaitingFix && (
                                              <div className="mt-4 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 space-y-3">
                                                <div className="flex items-center gap-2 mb-1">
                                                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Proposed Auto-Fix</span>
                                                </div>
                                                <p className="text-[11px] font-medium text-white/90 leading-relaxed italic">
                                                  "{(step.status as any).AwaitingFixApproval[1]}"
                                                </p>
                                                <div className="flex flex-wrap gap-2 pt-1">
                                                  <button
                                                    onClick={() => handleRespondToCheckpoint(step.id, 'ApproveFix')}
                                                    className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20 flex items-center gap-1.5"
                                                  >
                                                    <Wand2 size={12} />
                                                    Apply Fix
                                                  </button>
                                                  <button
                                                    onClick={() => handleRespondToCheckpoint(step.id, 'Retry')}
                                                    className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-white/20 transition-colors border border-white/10"
                                                  >
                                                    Manual Retry
                                                  </button>
                                                  <button
                                                    onClick={() => handleRespondToCheckpoint(step.id, 'Abort')}
                                                    className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-wider hover:bg-red-500/30 transition-colors border border-red-500/30"
                                                  >
                                                    Abort
                                                  </button>
                                                </div>
                                              </div>
                                            )}

                                            {/* Conflict Resolution UI */}
                                            {isConflict && (
                                              <div className="mt-4 p-3 rounded-xl bg-purple-500/10 border border-purple-500/40 shadow-lg shadow-purple-500/10 animate-pulse space-y-3">
                                                <div className="flex items-center gap-2 mb-1">
                                                  <Scale size={14} className="text-purple-400" />
                                                  <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Consensus Conflict</span>
                                                </div>
                                                <p className="text-[11px] font-medium text-white/90 leading-relaxed italic">
                                                  "{(step.status as any).Conflict[0]}"
                                                </p>
                                                <div className="grid grid-cols-2 gap-2">
                                                  <div className="p-2 rounded-lg bg-black/30 border border-white/5 space-y-2">
                                                    <div className="text-[9px] font-bold text-muted-foreground/60 uppercase">Reviewer 1 Findings</div>
                                                    <div className="text-[10px] text-muted-foreground/80 line-clamp-3 leading-snug">
                                                      {(step.status as any).Conflict[1]}
                                                    </div>
                                                    <button
                                                      onClick={() => handleRespondToCheckpoint(step.id, 'ResolveR1')}
                                                      className="w-full py-1.5 rounded-md bg-purple-600/20 text-purple-300 text-[9px] font-bold uppercase hover:bg-purple-600/40 transition-colors border border-purple-500/30"
                                                    >
                                                      Pick R1 Findings
                                                    </button>
                                                  </div>
                                                  <div className="p-2 rounded-lg bg-black/30 border border-white/5 space-y-2">
                                                    <div className="text-[9px] font-bold text-muted-foreground/60 uppercase">Reviewer 2 Findings</div>
                                                    <div className="text-[10px] text-muted-foreground/80 line-clamp-3 leading-snug">
                                                      {(step.status as any).Conflict[2]}
                                                    </div>
                                                    <button
                                                      onClick={() => handleRespondToCheckpoint(step.id, 'ResolveR2')}
                                                      className="w-full py-1.5 rounded-md bg-purple-600/20 text-purple-300 text-[9px] font-bold uppercase hover:bg-purple-600/40 transition-colors border border-purple-500/30"
                                                    >
                                                      Pick R2 Findings
                                                    </button>
                                                  </div>
                                                </div>
                                                <div className="flex justify-end gap-2 pt-1 border-t border-white/5 mt-2">
                                                   <button
                                                     onClick={() => handleRespondToCheckpoint(step.id, 'Retry')}
                                                     className="px-3 py-1 text-white/40 text-[9px] font-bold uppercase hover:text-white transition-colors"
                                                   >
                                                     Manual Retry
                                                   </button>
                                                   <button
                                                     onClick={() => handleRespondToCheckpoint(step.id, 'Abort')}
                                                     className="px-3 py-1 text-red-500/40 text-[9px] font-bold uppercase hover:text-red-500 transition-colors"
                                                   >
                                                     Abort
                                                   </button>
                                                </div>
                                              </div>
                                            )}

                                            {/* Delegation Approval UI */}
                                            {isAwaitingDelegation && (
                                              <div className="mt-4 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/40 shadow-lg shadow-cyan-500/10 animate-pulse space-y-3">
                                                <div className="flex items-center gap-2 mb-1">
                                                  <UserCheck size={14} className="text-cyan-400" />
                                                  <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Delegation Request</span>
                                                </div>
                                                <div className="p-3 rounded-lg bg-black/30 border border-white/5">
                                                  <div className="text-[9px] font-bold text-cyan-400/60 uppercase mb-1">Target Specialist</div>
                                                  <div className="text-[11px] font-bold text-white mb-2 flex items-center gap-2">
                                                    <Users size={12} className="text-cyan-500" />
                                                    {(step.status as any).AwaitingDelegationApproval[1]}
                                                  </div>
                                                  <div className="text-[9px] font-bold text-muted-foreground/60 uppercase mb-1">Delegated Task</div>
                                                  <p className="text-[11px] text-white/90 leading-relaxed font-mono">
                                                    {(step.status as any).AwaitingDelegationApproval[0]}
                                                  </p>
                                                </div>
                                                <div className="flex gap-2">
                                                  <button
                                                    onClick={() => handleRespondToCheckpoint(step.id, 'ApproveDelegation')}
                                                    className="flex-1 py-2 rounded-lg bg-cyan-600 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-cyan-700 transition-colors shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
                                                  >
                                                    <ShieldCheck size={12} />
                                                    Approve Swarm
                                                  </button>
                                                  <button
                                                    onClick={() => handleRespondToCheckpoint(step.id, 'RejectDelegation')}
                                                    className="px-4 py-2 rounded-lg bg-white/5 text-white/60 text-[10px] font-bold uppercase tracking-wider hover:bg-white/10 transition-colors border border-white/10"
                                                  >
                                                    Reject
                                                  </button>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                          {step.attempts > 0 && (
                                            <div className="flex flex-col items-end gap-1.5">
                                              <div className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-bold text-muted-foreground uppercase">
                                                {step.attempts}x
                                              </div>
                                              {step.startedAt && (
                                                <div className="text-[9px] font-medium text-muted-foreground/40 tabular-nums">
                                                  {formatDuration(step.startedAt, step.completedAt)}
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ));
                          })()
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Add Phase Button */}
            <div className="pl-12">
              <button
                onClick={handleAddPhase}
                className="w-full p-4 rounded-2xl border-2 border-dashed border-white/5 hover:border-primary/30 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all flex items-center justify-center gap-2 group"
              >
                <Plus size={20} className="group-hover:scale-110 transition-transform" />
                <span className="font-bold text-sm uppercase tracking-widest">Add Next Phase</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-white/5 bg-black/20 backdrop-blur-md flex items-center justify-between text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Deep Engine Online
          </span>
          <span className="flex items-center gap-1.5">
            Git Persistence: Enabled
          </span>
        </div>
        <div>
          GSD v2.0-ALFA
        </div>
      </div>
    </div>
  );
}
