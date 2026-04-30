import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwarmEvents } from '../../hooks/useSwarmEvents';
import { SwarmEvent } from '../../api/types';
import { Zap, Heart, Shield, Cpu, Activity, AlertCircle, X } from 'lucide-react';
import { clsx } from 'clsx';
import { getApi } from '../../api';

interface Node {
  id: string;
  x: number;
  y: number;
  label: string;
  type: 'supervisor' | 'agent';
}

export const NeuralSwarmHUD: React.FC = () => {
  const { events, status } = useSwarmEvents();
  const [activeNodes, setActiveNodes] = useState<Record<string, number>>({});
  const [isOpen, setIsOpen] = useState(false);

  // Fixed positions for nodes in the HUD
  const nodes = useMemo<Node[]>(() => [
    { id: 'supervisor', x: 50, y: 50, label: 'Orchestrator', type: 'supervisor' },
    { id: 'worker-1', x: 20, y: 30, label: 'Aider', type: 'agent' },
    { id: 'worker-2', x: 20, y: 70, label: 'Coder', type: 'agent' },
    { id: 'worker-3', x: 80, y: 30, label: 'Linter', type: 'agent' },
    { id: 'worker-4', x: 80, y: 70, label: 'Tester', type: 'agent' },
  ], []);

  const handleStop = async () => {
    if (status.activeWaveId) {
      const api = getApi();
      if (api && 'gsdStopPlan' in api) {
        try {
          await (api as any).gsdStopPlan(status.activeWaveId);
        } catch (err) {
          console.error("Failed to stop swarm:", err);
        }
      }
    }
  };

  const handleOverride = async () => {
    // Override can either skip a checkpoint or force a path.
    // For now, let's assume it attempts to signal a 'Retry' or 'Approve' to a pending step.
    const api = getApi();
    if (api && 'gsdRespondToCheckpoint' in api) {
      // Find the most recent step that might be waiting
      // This is a simplification; a real implementation would track pending step IDs.
    }
  };

  useEffect(() => {
    if (events.length > 0) {
      const lastEvent = events[0];
      const source = lastEvent.source.toLowerCase();
      const target = lastEvent.target?.toLowerCase();

      // Trigger pulsation for source and target
      setActiveNodes(prev => ({
        ...prev,
        [source]: Date.now(),
        ...(target ? { [target]: Date.now() } : {})
      }));

      // Auto-open on important activity
      if (lastEvent.type === 'WAVE_STATUS' && !isOpen) {
        setIsOpen(true);
      }
    }
  }, [events, isOpen]);

  const activeConnections = useMemo(() => {
    return events
      .filter(e => e.type === 'COLLABORATION' && e.target && (Date.now() - e.timestamp < 2000))
      .map(e => ({
        id: `${e.source}-${e.target}-${e.timestamp}`,
        from: e.source.toLowerCase(),
        to: e.target!.toLowerCase()
      }));
  }, [events]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 pointer-events-none">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-[450px] h-[550px] bg-zinc-950/80 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden p-6 flex flex-col gap-6 pointer-events-auto shadow-[0_0_50px_rgba(0,0,0,0.5)]"
          >
            {/* Header with HP and Wave Info */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-blue-400 animate-pulse" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-widest">Neural Swarm</h3>
                </div>
                <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    WAVE: {status.activeWaveId || 'STANDBY'}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                    RETRY: {status.retryCount}
                  </span>
                </div>
              </div>

              {/* Project Health (HP Bar) */}
              <div className="flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-2">
                  <Heart size={14} className={clsx("transition-colors", status.projectIntegrity < 30 ? "text-red-500 animate-bounce" : "text-emerald-400")} />
                  <span className="text-xs font-bold text-white font-mono">{status.projectIntegrity}%</span>
                </div>
                <div className="w-32 h-2 bg-zinc-900 rounded-full overflow-hidden border border-white/5 relative">
                  <motion.div 
                    className={clsx(
                      "h-full rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]",
                      status.projectIntegrity > 70 ? "bg-emerald-500" : 
                      status.projectIntegrity > 30 ? "bg-amber-500" : "bg-red-500"
                    )}
                    initial={{ width: '100%' }}
                    animate={{ width: `${status.projectIntegrity}%` }}
                    transition={{ type: 'spring', stiffness: 50 }}
                  />
                </div>
              </div>
            </div>

            {/* Main Synaptic View */}
            <div className="flex-1 relative border border-white/5 bg-black/40 rounded-xl overflow-hidden">
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <defs>
                  <linearGradient id="synapse-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgba(59, 130, 246, 0)" />
                    <stop offset="50%" stopColor="rgba(59, 130, 246, 0.5)" />
                    <stop offset="100%" stopColor="rgba(59, 130, 246, 0)" />
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Connections (Tendrils) */}
                <AnimatePresence>
                  {activeConnections.map(conn => {
                    const fromNode = nodes.find(n => n.id === conn.from);
                    const toNode = nodes.find(n => n.id === conn.to);
                    if (!fromNode || !toNode) return null;

                    return (
                      <motion.path
                        key={conn.id}
                        d={`M ${fromNode.x}% ${fromNode.y}% Q ${(fromNode.x + toNode.x) / 2}% ${(fromNode.y + toNode.y) / 2 - 10}% ${toNode.x}% ${toNode.y}%`}
                        stroke="url(#synapse-gradient)"
                        strokeWidth="2"
                        fill="none"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        style={{ filter: 'url(#glow)' }}
                      />
                    );
                  })}
                </AnimatePresence>
              </svg>

              {/* Nodes */}
              {nodes.map(node => {
                const isActive = Date.now() - (activeNodes[node.id] || 0) < 1000;
                return (
                  <motion.div
                    key={node.id}
                    className="absolute"
                    style={{ left: `${node.x}%`, top: `${node.y}%`, transform: 'translate(-50%, -50%)' }}
                    animate={isActive ? { scale: [1, 1.2, 1] } : {}}
                    transition={{ repeat: Infinity, duration: 1 }}
                  >
                    <div className={clsx(
                      "relative group flex flex-col items-center",
                      isActive ? "z-20" : "z-10"
                    )}>
                      <div className={clsx(
                        "p-3 rounded-full border transition-all duration-500",
                        node.type === 'supervisor' ? "bg-blue-500/20 border-blue-500/40" : "bg-zinc-900 border-white/10",
                        isActive && "shadow-[0_0_20px_rgba(59,130,246,0.5)] border-blue-400"
                      )}>
                        {node.type === 'supervisor' ? (
                          <Cpu size={24} className={clsx(isActive ? "text-blue-400" : "text-blue-500/60")} />
                        ) : (
                          <Activity size={18} className={clsx(isActive ? "text-blue-400" : "text-zinc-500")} />
                        )}
                      </div>
                      
                      <div className="absolute -bottom-6 flex flex-col items-center pointer-events-none">
                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-tighter whitespace-nowrap">
                          {node.label}
                        </span>
                      </div>

                      {/* Healing Icon (floating up) */}
                      <AnimatePresence>
                        {isActive && events.some(e => e.type === 'HEALING' && e.source.toLowerCase() === node.id && (Date.now() - e.timestamp < 1000)) && (
                          <motion.div
                            className="absolute -top-10 text-emerald-400"
                            initial={{ y: 0, opacity: 0, scale: 0.5 }}
                            animate={{ y: -40, opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                          >
                            <Heart size={20} fill="currentColor" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })}

              {/* Healing Overlay (Regenerating Project) */}
              <AnimatePresence>
                {events.some(e => e.type === 'HEALING' && (Date.now() - e.timestamp < 1000)) && (
                  <motion.div 
                    className="absolute inset-0 flex items-center justify-center bg-emerald-500/5 pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="flex items-center gap-3 px-6 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-full backdrop-blur-md">
                      <Shield size={20} className="text-emerald-400 animate-pulse" />
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-[0.2em]">Regenerating Project...</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Manual Controls */}
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={handleStop}
                disabled={!status.activeWaveId}
                className={clsx(
                  "flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border",
                  status.activeWaveId 
                    ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 active:scale-95" 
                    : "bg-zinc-900 border-white/5 text-zinc-600 cursor-not-allowed opacity-50"
                )}
              >
                <AlertCircle size={14} />
                Force Abort
              </button>
              <button 
                onClick={handleOverride}
                disabled={!status.activeWaveId}
                className={clsx(
                  "flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border",
                  status.activeWaveId 
                    ? "bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20 active:scale-95 shadow-[0_0_15px_rgba(59,130,246,0.1)]" 
                    : "bg-zinc-900 border-white/5 text-zinc-600 cursor-not-allowed opacity-50"
                )}
              >
                <Zap size={14} />
                Manual Override
              </button>
            </div>

            {/* Footer / Mini Log */}
            <div className="h-24 bg-black/60 border border-white/5 rounded-xl p-3 flex flex-col gap-2 overflow-hidden">
              <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1.5">
                {events.slice(0, 5).map((event, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2"
                  >
                    <span className="text-[8px] font-mono text-zinc-600">[{new Date(event.timestamp).toLocaleTimeString()}]</span>
                    <span className={clsx(
                      "text-[9px] font-medium truncate",
                      event.type === 'HEALING' ? "text-emerald-400" :
                      event.type === 'TOOL_USE' ? "text-blue-400" :
                      event.type === 'THINKING' ? "text-zinc-400 italic" : "text-zinc-300"
                    )}>
                      {event.source}: {event.payload?.message || event.type}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="pointer-events-auto px-4 py-2 rounded-full bg-black/60 border border-white/10 backdrop-blur-md text-[11px] font-bold text-white/80 flex items-center gap-2 shadow-lg ring-1 ring-white/5 hover:bg-black/80 transition-all"
      >
        <div className="relative">
          <div className={clsx(
            "absolute inset-0 rounded-full blur-[4px] opacity-50",
            status.activeWaveId ? "bg-blue-500 animate-pulse" : "bg-zinc-500"
          )} />
          <div className={clsx(
            "relative w-2 h-2 rounded-full",
            status.activeWaveId ? "bg-blue-400" : "bg-zinc-500"
          )} />
        </div>
        SWARM: {status.activeWaveId ? 'EXECUTING' : 'IDLE'}
        {isOpen ? <X size={14} /> : <Zap size={14} className={status.activeWaveId ? "text-blue-400" : "text-zinc-500"} />}
      </motion.button>
    </div>
  );
};
