import React, { useState, useEffect } from 'react';
import { AgentTrace, useAgentBoard } from '../../hooks/useAgentBoard';
import { Activity, CheckCircle2, Circle, AlertCircle, Clock, ChevronRight } from 'lucide-react';

interface TracePanelProps {
  agentId: string;
  onClose: () => void;
}

export const TracePanel: React.FC<TracePanelProps> = ({ agentId, onClose }) => {
  const { listTraces } = useAgentBoard();
  const [traces, setTraces] = useState<AgentTrace[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTraces = async () => {
    try {
      const data = await listTraces(agentId);
      setTraces(data);
    } catch (err) {
      console.error('Failed to fetch traces:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTraces();
    const interval = setInterval(fetchTraces, 3000);
    return () => clearInterval(interval);
  }, [agentId]);

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'success': return <CheckCircle2 size={14} className="text-emerald-400" />;
      case 'running': return <Activity size={14} className="text-blue-400 animate-pulse" />;
      case 'failed': return <AlertCircle size={14} className="text-red-400" />;
      default: return <Circle size={14} className="text-zinc-600" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950/90 backdrop-blur-3xl border-l border-white/5 w-96 shadow-2xl">
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-blue-400" />
          <h3 className="text-sm font-semibold text-zinc-100">Live Workflow Trace</h3>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 p-1 hover:bg-white/5 rounded">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {loading && traces.length === 0 ? (
          <div className="text-center py-20 text-xs text-zinc-600 animate-pulse">Initializing trace...</div>
        ) : traces.length === 0 ? (
          <div className="text-center py-20 text-xs text-zinc-600 italic">No execution data available</div>
        ) : (
          traces.map((trace, index) => (
            <div key={trace.id} className="relative pl-6">
              {index !== traces.length - 1 && (
                <div className="absolute left-[7px] top-4 bottom-[-20px] w-0.5 bg-zinc-800" />
              )}
              <div className="absolute left-0 top-0.5 bg-zinc-950 rounded-full">
                {getStatusIcon(trace.status)}
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-200 uppercase tracking-tight">{trace.step_name}</span>
                  <span className="text-[9px] text-zinc-600 font-mono">
                    {new Date(trace.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {trace.details && (
                  <div className="text-[10px] text-zinc-500 bg-white/[0.02] p-2 rounded border border-white/5 font-mono leading-relaxed break-words">
                    {trace.details}
                  </div>
                )}
                {trace.duration_ms && (
                  <div className="flex items-center gap-1 text-[9px] text-zinc-600">
                    <Clock size={10} />
                    <span>{trace.duration_ms}ms</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
