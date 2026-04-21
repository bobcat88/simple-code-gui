import React from 'react';
import { useActivityLog } from '../hooks/useActivityLog';
import { formatDistanceToNow } from 'date-fns';
import { Terminal, Info, AlertTriangle, CheckCircle, Cpu, User } from 'lucide-react';

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
    <div className="flex flex-col h-full bg-zinc-900/50 backdrop-blur-md border-l border-white/5">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">Activity Feed</h3>
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Live</span>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
        {events.length === 0 ? (
          <div className="text-center py-8 text-zinc-600 text-xs italic">No activity yet</div>
        ) : (
          events.map((event, i) => (
            <div 
              key={event.id || i} 
              className="p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{getIcon(event.event_type, event.source)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">
                      {event.source}
                    </span>
                    <span className="text-[10px] text-zinc-600 whitespace-nowrap">
                      {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed break-words">
                    {event.message}
                  </p>
                  {event.metadata && (
                    <div className="mt-2 text-[10px] text-zinc-500 font-mono truncate">
                      {event.metadata}
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
