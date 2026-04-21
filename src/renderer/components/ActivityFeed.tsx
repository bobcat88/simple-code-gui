import React from 'react';
import { useActivityLog } from '../hooks/useActivityLog';
import { formatDistanceToNow } from 'date-fns';
import { Terminal, Info, AlertTriangle, CheckCircle, Cpu, User, Activity } from 'lucide-react';

export const ActivityFeed: React.FC = () => {
  const { events, loading } = useActivityLog(20);

  if (loading) {
    return <div className="p-4 text-zinc-500 animate-pulse">Loading activity...</div>;
  }

  const getIcon = (type: string, source: string) => {
    if (source === 'agents') return <User size={14} className="text-blue-400" />;
    if (source === 'jobs') return <Cpu size={14} className="text-purple-400" />;
    if (type === 'error') return <AlertTriangle size={14} className="text-red-400" />;
    if (type === 'success') return <CheckCircle size={14} className="text-green-400" />;
    if (type === 'info') return <Info size={14} className="text-zinc-400" />;
    return <Terminal size={14} className="text-zinc-400" />;
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-2xl overflow-hidden">
      <div className="p-3 border-b border-white/5 flex items-center justify-between bg-white/5">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-emerald-400" />
          <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-tight">Activity Feed</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-medium">Live</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-2 opacity-20">
            <Terminal size={24} />
            <div className="text-[10px] uppercase tracking-widest font-bold">Waiting for events</div>
          </div>
        ) : (
          events.map((event, i) => (
            <div 
              key={event.id || i} 
              className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all group relative overflow-hidden"
            >
              {/* Event specific background tint */}
              {event.event_type === 'error' && <div className="absolute inset-0 bg-red-500/5" />}
              {event.event_type === 'success' && <div className="absolute inset-0 bg-emerald-500/5" />}
              
              <div className="flex items-start gap-3 relative z-10">
                <div className="mt-0.5 shrink-0">
                  <div className={`p-1.5 rounded-lg bg-zinc-900 border border-white/5 ${
                    event.event_type === 'error' ? 'text-red-400' : 
                    event.event_type === 'success' ? 'text-emerald-400' : 'text-zinc-400'
                  }`}>
                    {getIcon(event.event_type, event.source)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className={`text-[9px] font-bold uppercase tracking-tighter ${
                      event.source === 'agents' ? 'text-blue-400' : 
                      event.source === 'jobs' ? 'text-purple-400' : 'text-zinc-500'
                    }`}>
                      {event.source}
                    </span>
                    <span className="text-[9px] text-zinc-600 font-medium italic">
                      {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-300 leading-snug break-words font-medium">
                    {event.message}
                  </p>
                  {event.metadata && (
                    <div className="mt-1.5 p-1.5 rounded bg-black/40 border border-white/5 text-[9px] text-zinc-500 font-mono overflow-x-auto whitespace-pre custom-scrollbar">
                      {typeof event.metadata === 'string' && event.metadata.startsWith('{') ? 
                        JSON.stringify(JSON.parse(event.metadata), null, 2) : 
                        event.metadata
                      }
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
