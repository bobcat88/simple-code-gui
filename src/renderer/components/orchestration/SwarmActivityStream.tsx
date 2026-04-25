import React from 'react';
import { useSwarmMessages, AgentMessage } from '../../hooks/useSwarmMessages';
import { formatDistanceToNow } from 'date-fns';
import { Zap, MessageSquare, AlertTriangle, Bell, User, Users, Activity } from 'lucide-react';

export const SwarmActivityStream: React.FC = () => {
  const { messages, loading } = useSwarmMessages(30);

  if (loading) {
    return <div className="p-4 text-zinc-500 animate-pulse font-mono text-[10px]">Synchronizing with Swarm Bus...</div>;
  }

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'finding': return {
        icon: <Zap size={12} className="text-emerald-400" />,
        bg: 'bg-emerald-500/5',
        border: 'border-emerald-500/20',
        text: 'text-emerald-400',
        label: 'Finding'
      };
      case 'request': return {
        icon: <MessageSquare size={12} className="text-blue-400" />,
        bg: 'bg-blue-500/5',
        border: 'border-blue-500/20',
        text: 'text-blue-400',
        label: 'Request'
      };
      case 'warning': return {
        icon: <AlertTriangle size={12} className="text-amber-400" />,
        bg: 'bg-amber-500/5',
        border: 'border-amber-500/20',
        text: 'text-amber-400',
        label: 'Warning'
      };
      case 'alert': return {
        icon: <Bell size={12} className="text-red-400" />,
        bg: 'bg-red-500/5',
        border: 'border-red-500/20',
        text: 'text-red-400',
        label: 'Alert'
      };
      default: return {
        icon: <Activity size={12} className="text-zinc-400" />,
        bg: 'bg-zinc-500/5',
        border: 'border-zinc-500/20',
        text: 'text-zinc-400',
        label: 'Message'
      };
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950/20 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden shadow-2xl">
      <div className="p-3 border-b border-white/5 flex items-center justify-between bg-zinc-900/40">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-blue-400" />
          <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">Swarm Activity</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
          <span className="text-[9px] text-zinc-500 font-mono">NODE_CLUSTER_STABLE</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3 opacity-20">
            <Users size={32} />
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold">Waiting for swarm sync</div>
          </div>
        ) : (
          messages.map((msg) => {
            const styles = getTypeStyles(msg.message_type);
            return (
              <div 
                key={msg.id}
                className={`p-2.5 rounded-lg border ${styles.border} ${styles.bg} transition-all hover:bg-white/5 group relative overflow-hidden`}
              >
                <div className="flex items-start gap-3 relative z-10">
                  <div className="shrink-0 mt-0.5">
                    <div className="p-1.5 rounded bg-zinc-900/80 border border-white/5 shadow-inner">
                      {styles.icon}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black uppercase tracking-tighter px-1 rounded bg-zinc-900 ${styles.text}`}>
                          {styles.label}
                        </span>
                        <div className="flex items-center gap-1 text-zinc-400">
                          <User size={10} />
                          <span className="text-[10px] font-bold truncate max-w-[80px]">{msg.from_agent}</span>
                        </div>
                        {msg.to_agent && (
                          <div className="flex items-center gap-1 text-zinc-500">
                            <span className="text-[10px]">→</span>
                            <span className="text-[10px] italic">{msg.to_agent}</span>
                          </div>
                        )}
                      </div>
                      <span className="text-[9px] text-zinc-500 font-medium font-mono">
                        {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-300 leading-relaxed font-medium">
                      {msg.content}
                    </p>
                    {msg.metadata && (
                      <div className="mt-2 p-1.5 rounded bg-black/60 border border-white/5 text-[9px] text-zinc-500 font-mono overflow-x-auto whitespace-pre custom-scrollbar max-h-32">
                        {JSON.stringify(msg.metadata, null, 2)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
