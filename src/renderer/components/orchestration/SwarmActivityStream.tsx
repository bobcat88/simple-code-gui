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
  Share2,
  History,
  Layers,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import type { ExtendedApi, SwarmSnapshot } from '../../api/types';
import { NeuralSwarmGraph } from './NeuralSwarmGraph';
import { useSwarmSnapshots } from '../../hooks/useSwarmSnapshots';

interface SwarmActivityStreamProps {
  api: ExtendedApi;
  projectPath: string;
}

export const SwarmActivityStream: React.FC<SwarmActivityStreamProps> = ({ api, projectPath }) => {
  const { messages, loading, refresh } = useSwarmMessages(30);
  const { snapshots, refresh: refreshSnapshots } = useSwarmSnapshots(projectPath);
  const [isSnapshotting, setIsSnapshotting] = React.useState(false);
  const [isHydrating, setIsHydrating] = React.useState(false);
  const [isRestoring, setIsRestoring] = React.useState<string | null>(null);
  const [lastAction, setLastAction] = React.useState<string | null>(null);
  const [view, setView] = React.useState<'activity' | 'snapshots'>('activity');
  const [showSnapshotDialog, setShowSnapshotDialog] = React.useState(false);
  const [handoffNotes, setHandoffNotes] = React.useState('');

  const handleSnapshot = async () => {
    if (!projectPath) return;
    setIsSnapshotting(true);
    setLastAction(null);
    try {
      const name = `snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}`;
      const result = await api.gsdCreateSwarmSnapshot(projectPath, name, handoffNotes);
      if (result.success) {
        setLastAction('Snapshot captured successfully');
        setHandoffNotes('');
        setShowSnapshotDialog(false);
        refreshSnapshots();
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

  const handleRestoreWorkspace = async (snapshot: SwarmSnapshot) => {
    if (!projectPath) return;
    setIsRestoring(snapshot.id);
    setLastAction(null);
    try {
      const result = await api.gsdCreateSnapshotWorkspace(snapshot.id);
      if (result.success) {
        setLastAction(`Workspace isolated at: ${result.path}`);
        refreshSnapshots();
        setTimeout(() => setLastAction(null), 5000);
      }
    } catch (err) {
      console.error('Failed to restore workspace:', err);
    } finally {
      setIsRestoring(null);
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
            onClick={() => setShowSnapshotDialog(true)}
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
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setView('activity')}
              className={`flex items-center gap-2 px-1 py-1 transition-all border-b-2 ${view === 'activity' ? 'border-blue-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
            >
              <Users size={14} />
              <span className="text-xs font-bold uppercase tracking-wider text-inherit">Thought Chain</span>
            </button>
            <button 
              onClick={() => setView('snapshots')}
              className={`flex items-center gap-2 px-1 py-1 transition-all border-b-2 ${view === 'snapshots' ? 'border-indigo-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
            >
              <History size={14} />
              <span className="text-xs font-bold uppercase tracking-wider text-inherit">Snapshots</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors">
              <Share2 size={12} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
          {view === 'activity' ? (
            messages.length === 0 ? (
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
            )
          ) : (
            // Snapshots View
            snapshots.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-3 opacity-20">
                <History size={32} />
                <div className="text-[10px] uppercase tracking-[0.2em] font-bold">No Neural Snapshots Found</div>
              </div>
            ) : (
              snapshots.map((snapshot) => (
                <div 
                  key={snapshot.id}
                  className="p-3 rounded-lg border border-white/5 bg-zinc-900/40 hover:bg-zinc-800/40 transition-all group relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded bg-indigo-500/10 border border-indigo-500/20">
                        <Layers size={14} className="text-indigo-400" />
                      </div>
                      <div>
                        <h4 className="text-[11px] font-bold text-white leading-tight">{snapshot.name}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] text-zinc-500 font-mono">{snapshot.commit_sha?.substring(0, 7) || 'NO_COMMIT'}</span>
                          <span className="text-zinc-700">•</span>
                          <span className="text-[9px] text-zinc-500 italic">
                            {formatDistanceToNow(new Date(snapshot.timestamp), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {snapshot.worktree_path ? (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold uppercase tracking-tighter">
                          <CheckCircle2 size={10} />
                          Active Workspace
                        </div>
                      ) : (
                        <button 
                          onClick={() => handleRestoreWorkspace(snapshot)}
                          disabled={isRestoring !== null}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-400 text-[9px] font-bold uppercase tracking-tighter transition-all"
                        >
                          {isRestoring === snapshot.id ? (
                            <Activity size={10} className="animate-spin" />
                          ) : (
                            <Zap size={10} />
                          )}
                          Restore Workspace
                        </button>
                      )}
                      <button 
                        className="p-1.5 rounded bg-zinc-800 border border-white/5 text-zinc-500 hover:text-white transition-all"
                        title="View Snapshot Data"
                      >
                        <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>
                  {snapshot.handoff_notes && (
                    <div className="mt-2 px-2 py-1.5 rounded bg-white/5 border border-white/5">
                      <p className="text-[10px] text-zinc-400 italic line-clamp-3">
                        "{snapshot.handoff_notes}"
                      </p>
                    </div>
                  )}
                  {snapshot.worktree_path && (
                    <div className="mt-2 flex items-center gap-2 p-1.5 rounded bg-black/40 border border-emerald-500/10 font-mono text-[8px] text-emerald-400/60 overflow-hidden">
                      <ExternalLink size={8} />
                      <span className="truncate">{snapshot.worktree_path}</span>
                    </div>
                  )}
                </div>
              ))
            )
          )}
        </div>
      </div>

      {/* Snapshot Creation Dialog */}
      {showSnapshotDialog && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-3 border-b border-white/5 flex items-center justify-between bg-zinc-800/50">
              <div className="flex items-center gap-2">
                <Camera size={14} className="text-indigo-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-white">Capture Swarm State</span>
              </div>
              <button 
                onClick={() => setShowSnapshotDialog(false)}
                className="text-zinc-500 hover:text-white"
              >
                <ChevronRight size={14} className="rotate-90" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Handoff Notes</label>
                <textarea 
                  value={handoffNotes}
                  onChange={(e) => setHandoffNotes(e.target.value)}
                  placeholder="Describe the current context, goals, and any specific blockers for the next agent..."
                  className="w-full h-32 bg-black/40 border border-white/10 rounded-lg p-2.5 text-[11px] text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-indigo-500/50 resize-none custom-scrollbar font-medium"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowSnapshotDialog(false)}
                  className="flex-1 py-2 rounded-lg bg-zinc-800 border border-white/5 text-zinc-400 text-[10px] font-bold uppercase hover:bg-zinc-700 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSnapshot}
                  disabled={isSnapshotting}
                  className="flex-[2] py-2 rounded-lg bg-indigo-600 text-white text-[10px] font-bold uppercase hover:bg-indigo-500 transition-all flex items-center justify-center gap-2"
                >
                  {isSnapshotting ? <Activity size={12} className="animate-spin" /> : <Zap size={12} />}
                  {isSnapshotting ? 'Capturing...' : 'Capture Snapshot'}
                </button>
              </div>
            </div>
            <div className="p-2.5 bg-black/40 border-t border-white/5 flex items-center gap-2">
              <div className="p-1 rounded bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle size={10} className="text-amber-500" />
              </div>
              <p className="text-[9px] text-zinc-500 italic">
                Capturing will freeze current neural state and generate a collaborative handoff artifact.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
