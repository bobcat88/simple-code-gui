import React, { useState } from 'react';
import {
  Brain,
  Zap,
  History,
  Shield,
  Activity,
  Share2,
  Layers,
  ChevronRight,
  ChevronDown,
  Download,
  Camera,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ExtendedApi, SwarmSnapshot } from '../../api/types';
import { SwarmActivityStream } from '../orchestration/SwarmActivityStream';
import { NeuralHUDTab } from './NeuralHUDTab';
import { OrchestrationPanel } from './OrchestrationPanel';
import { useSwarmSnapshots } from '../../hooks/useSwarmSnapshots';
import { formatDistanceToNow } from 'date-fns';

interface SwarmCognitiveHubProps {
  api: ExtendedApi;
  projectPath: string;
}

export const SwarmCognitiveHub: React.FC<SwarmCognitiveHubProps> = ({ api, projectPath }) => {
  const [activeLayer, setActiveLayer] = useState<'neural' | 'stream' | 'memory'>('neural');
  const { snapshots, refresh: refreshSnapshots } = useSwarmSnapshots(projectPath);

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-500">
      {/* Header with Glassmorphism */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-codex-neon/10 border border-codex-neon/20 shadow-[0_0_15px_rgba(204,255,0,0.1)]">
            <Brain size={20} className="text-codex-neon" />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-tighter text-white">Cognitive Hub</h2>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-codex-neon animate-pulse shadow-[0_0_8px_#ccff00]" />
              <span className="text-[9px] font-bold text-codex-neon/60 uppercase tracking-widest">Synaptic Link Active</span>
            </div>
          </div>
        </div>
        
        <div className="flex bg-black/40 p-1 rounded-lg border border-white/5 shadow-inner">
          <NavButton 
            active={activeLayer === 'neural'} 
            onClick={() => setActiveLayer('neural')}
            icon={<Activity size={14} />}
            label="Pulse"
          />
          <NavButton 
            active={activeLayer === 'stream'} 
            onClick={() => setActiveLayer('stream')}
            icon={<Zap size={14} />}
            label="Stream"
          />
          <NavButton 
            active={activeLayer === 'memory'} 
            onClick={() => setActiveLayer('memory')}
            icon={<History size={14} />}
            label="Vault"
          />
        </div>
      </div>

      {/* Main Viewport */}
      <div className="flex-1 relative min-h-0 bg-black/20 rounded-2xl border border-white/5 overflow-hidden shadow-inner group/hub">
        <div className="absolute inset-0 bg-gradient-to-br from-codex-neon/5 to-transparent opacity-30 pointer-events-none" />
        
        {activeLayer === 'neural' && (
          <div className="absolute inset-0 animate-in zoom-in-95 duration-500">
             <NeuralHUDTab api={api} projectPath={projectPath} embedded />
          </div>
        )}
        {activeLayer === 'stream' && (
          <div className="absolute inset-0 p-4 animate-in slide-in-from-right-4 duration-500">
            <SwarmActivityStream api={api} projectPath={projectPath} />
          </div>
        )}
        {activeLayer === 'memory' && (
          <div className="absolute inset-0 p-4 animate-in slide-in-from-right-4 duration-500 overflow-y-auto custom-scrollbar">
            <MemoryVault snapshots={snapshots} onRefresh={refreshSnapshots} api={api} projectPath={projectPath} />
          </div>
        )}

        {/* Orchestration Controls */}
        <OrchestrationPanel />

        {/* Global Controls Overlay */}
        <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover/hub:opacity-100 transition-opacity duration-300">
          <ControlButton 
            icon={<Camera size={14} />} 
            label="Snapshot" 
            onClick={() => {/* Trigger snapshot */}}
          />
          <ControlButton 
            icon={<Share2 size={14} />} 
            label="Handoff" 
            onClick={() => {/* Generate handoff */}}
          />
        </div>
      </div>

      {/* Orchestration Footer Telemetry */}
      <div className="grid grid-cols-3 gap-3">
        <TelemetryCard label="Synaptic Load" value="42%" trend="up" />
        <TelemetryCard label="Collective IQ" value="184" trend="stable" />
        <TelemetryCard label="Error Rate" value="0.02%" trend="down" />
      </div>
    </div>
  );
};

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

const NavButton: React.FC<NavButtonProps> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-tighter transition-all",
      active 
        ? "bg-codex-neon text-black shadow-[0_0_15px_rgba(204,255,0,0.3)]" 
        : "text-white/40 hover:text-white/70 hover:bg-white/5"
    )}
  >
    {icon}
    {label}
  </button>
);

const ControlButton: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 px-3 py-2 bg-black/80 backdrop-blur-md border border-white/10 rounded-xl text-white/60 hover:text-codex-neon hover:border-codex-neon/50 transition-all shadow-2xl group"
  >
    {icon}
    <span className="text-[10px] font-bold uppercase tracking-widest hidden group-hover:block animate-in fade-in slide-in-from-right-2 duration-200">
      {label}
    </span>
  </button>
);

const TelemetryCard: React.FC<{ label: string; value: string; trend: 'up' | 'down' | 'stable' }> = ({ label, value, trend }) => (
  <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-1">
    <div className="flex items-center justify-between">
      <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">{label}</span>
      {trend === 'up' && <TrendingUp size={10} className="text-amber-400" />}
      {trend === 'down' && <TrendingDown size={10} className="text-codex-neon" />}
      {trend === 'stable' && <Minus size={10} className="text-white/20" />}
    </div>
    <div className="text-lg font-black text-white/90 tabular-nums leading-none">{value}</div>
  </div>
);

export const MemoryVault: React.FC<{
  snapshots: SwarmSnapshot[];
  onRefresh: () => void;
  api: ExtendedApi;
  projectPath: string;
}> = ({ snapshots, onRefresh, api, projectPath }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionState, setActionState] = useState<
    Record<string, { loading: 'restore' | 'branch' | null; message: string | null; isError: boolean }>
  >({});

  const getState = (id: string) =>
    actionState[id] ?? { loading: null, message: null, isError: false };

  const setLoading = (id: string, loading: 'restore' | 'branch' | null) =>
    setActionState((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { loading: null, message: null, isError: false }), loading } }));

  const setMessage = (id: string, message: string | null, isError = false) => {
    setActionState((prev) => ({ ...prev, [id]: { ...getState(id), loading: null, message, isError } }));
    if (message) setTimeout(() => setActionState((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { loading: null, message: null, isError: false }), message: null, isError: false } })), 3000);
  };

  const handleRestore = async (snapshot: SwarmSnapshot) => {
    setLoading(snapshot.id, 'restore');
    try {
      const result = await api.gsdHydrateSwarm(projectPath);
      if (result.success) setMessage(snapshot.id, `Restored ${result.count} messages`);
      else setMessage(snapshot.id, result.error ?? 'Restore failed', true);
    } catch (err) {
      setMessage(snapshot.id, err instanceof Error ? err.message : String(err), true);
    }
  };

  const handleBranch = async (snapshot: SwarmSnapshot) => {
    setLoading(snapshot.id, 'branch');
    try {
      const result = await api.gsdCreateSnapshotWorkspace(snapshot.id);
      if (result.success) setMessage(snapshot.id, `Workspace isolated at: ${result.path}`);
      else setMessage(snapshot.id, result.error ?? 'Branch failed', true);
    } catch (err) {
      setMessage(snapshot.id, err instanceof Error ? err.message : String(err), true);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-codex-neon" />
          <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Cognitive Backups</span>
        </div>
        <button onClick={onRefresh} className="text-[9px] font-bold text-codex-neon/60 hover:text-codex-neon uppercase">
          Refresh Vault
        </button>
      </div>

      <div className="space-y-2">
        {snapshots.length === 0 ? (
          <div className="py-20 text-center opacity-20 space-y-4">
            <History size={48} className="mx-auto" />
            <p className="text-[10px] font-bold uppercase tracking-widest">No neural footprints detected</p>
          </div>
        ) : (
          snapshots.map((snapshot) => {
            const isExpanded = expandedId === snapshot.id;
            const state = getState(snapshot.id);
            return (
              <div
                key={snapshot.id}
                className={cn(
                  'rounded-xl border transition-all relative overflow-hidden',
                  isExpanded
                    ? 'bg-codex-neon/5 border-codex-neon/20'
                    : 'bg-white/5 border-white/5 hover:border-codex-neon/30'
                )}
              >
                {/* Row header — clickable */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : snapshot.id)}
                  className="w-full flex items-center justify-between p-3 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-codex-neon/10 border border-codex-neon/20">
                      <Layers size={14} className="text-codex-neon" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white/90 uppercase tracking-tight">{snapshot.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] text-white/30 font-mono">@{snapshot.commit_sha?.substring(0, 7)}</span>
                        <span className="text-white/10">•</span>
                        <span className="text-[9px] text-white/30 italic">
                          {formatDistanceToNow(new Date(snapshot.timestamp), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                  {isExpanded
                    ? <ChevronDown size={16} className="text-codex-neon/60 transition-transform duration-200" />
                    : <ChevronRight size={16} className="text-white/40 transition-transform duration-200" />
                  }
                </button>

                {/* Expanded actions */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
                    {state.message && (
                      <p className={cn('text-[8px] px-1', state.isError ? 'text-red-400' : 'text-codex-neon/60')}>
                        {state.message}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        aria-label="Restore Messages"
                        onClick={() => handleRestore(snapshot)}
                        disabled={state.loading !== null}
                        className={cn(
                          'flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all',
                          'bg-codex-neon/10 text-codex-neon border-codex-neon/30 hover:bg-codex-neon/20',
                          state.loading !== null && 'opacity-40 cursor-not-allowed'
                        )}
                      >
                        {state.loading === 'restore' ? '…' : '⬇ Restore Messages'}
                      </button>
                      <button
                        aria-label="Branch Workspace"
                        onClick={() => handleBranch(snapshot)}
                        disabled={state.loading !== null}
                        className={cn(
                          'flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all',
                          'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20',
                          state.loading !== null && 'opacity-40 cursor-not-allowed'
                        )}
                      >
                        {state.loading === 'branch' ? '…' : '⎇ Branch Workspace'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
