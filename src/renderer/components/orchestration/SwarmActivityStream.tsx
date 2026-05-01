import React from 'react';
import { useSwarmMessages, AgentMessage } from '../../hooks/useSwarmMessages';
import { formatDistanceToNow } from 'date-fns';
import { 
  Zap, 
  MessageSquare, 
  AlertTriangle, 
  Bell, 
  User, 
  Users, 
  Activity,
  Camera,
  Download,
  CheckCircle2,
  Share2
} from 'lucide-react';
import type { ExtendedApi } from '../../api/types';
import { NeuralSwarmGraph } from './NeuralSwarmGraph';

interface SwarmActivityStreamProps {
  api: ExtendedApi;
  projectPath: string;
}

export const SwarmActivityStream: React.FC<SwarmActivityStreamProps> = ({ api, projectPath }) => {
  const { messages, loading, refresh } = useSwarmMessages(30);
  const [isSnapshotting, setIsSnapshotting] = React.useState(false);
  const [isHydrating, setIsHydrating] = React.useState(false);
  const [lastAction, setLastAction] = React.useState<string | null>(null);

  const handleSnapshot = async () => {
    if (!projectPath) return;
    setIsSnapshotting(true);
    setLastAction(null);
    try {
      const name = `snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}`;
      const result = await api.gsdCreateSwarmSnapshot(projectPath, name);
      if (result.success) {
        setLastAction('Snapshot captured successfully');
        setTimeout(() => setLastAction(null), 3000);
      }
    } catch (err) {
      console.error('Failed to create snapshot:', err);
    } finally {
      setIsSnapshotting(false);
    }
  };

  const handleHydrate = async () => {
    if (!projectPath) return;
    setIsHydrating(true);
    setLastAction(null);
    try {
      const result = await api.gsdHydrateSwarm(projectPath);
      if (result.success) {
        setLastAction(`Restored ${result.count} messages`);
        refresh();
        setTimeout(() => setLastAction(null), 3000);
      }
    } catch (err) {
      console.error('Failed to hydrate swarm:', err);
    } finally {
      setIsHydrating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center space-y-4 p-8 text-center opacity-40">
        <Activity className="w-8 h-8 text-blue-400 animate-spin" />
        <p className="text-[10px] font-mono tracking-widest uppercase">Synchronizing Neural Bus...</p>
      </div>
    );
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
      case 'simulation': return {
        icon: <Zap size={12} className="text-purple-400" />,
        bg: 'bg-purple-500/5',
        border: 'border-purple-500/20',
        text: 'text-purple-400',
        label: 'Simulation'
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
    <div className="flex flex-col h-full space-y-4">
      {/* Neural Visualization Section */}
      <div className="h-48 bg-zinc-950/40 border border-white/5 rounded-xl overflow-hidden relative group">
        <NeuralSwarmGraph messages={messages} />
        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={handleSnapshot}
            disabled={isSnapshotting}
            className="p-1.5 bg-zinc-900/80 border border-white/10 rounded-lg text-white/40 hover:text-white hover:border-indigo-500/50 transition-all shadow-xl"
            title="Create Cognitive Snapshot"
          >
            {isSnapshotting ? <Activity size={14} className="animate-spin text-indigo-400" /> : <Camera size={14} />}
          </button>
          <button 
            onClick={handleHydrate}
            disabled={isHydrating}
            className="p-1.5 bg-zinc-900/80 border border-white/10 rounded-lg text-white/40 hover:text-white hover:border-blue-500/50 transition-all shadow-xl"
            title="Restore from Snapshots"
          >
            {isHydrating ? <Activity size={14} className="animate-spin text-blue-400" /> : <Download size={14} />}
          </button>
        </div>
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Neural Mesh Active</span>
        </div>
        {lastAction && (
          <div className="absolute top-3 left-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] px-2 py-1 rounded-md flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-300">
            <CheckCircle2 size={12} />
            {lastAction}
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col bg-zinc-950/20 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden shadow-2xl min-h-[300px]">
        <div className="p-3 border-b border-white/5 flex items-center justify-between bg-zinc-900/40">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-blue-400" />
            <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">Thought Chain</h3>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors">
              <Share2 size={12} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3 opacity-20">
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
                      {msg.metadata && Object.keys(msg.metadata).length > 0 && (
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
    </div>
  );
};
