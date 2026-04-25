import React, { useState, useEffect } from 'react';
import { AgentTask, useAgentBoard } from '../../hooks/useAgentBoard';
import { ListTodo, ArrowUp, ArrowDown, Trash2, Clock, CheckCircle, Play } from 'lucide-react';

interface QueuePanelProps {
  agentId: string;
  agentName: string;
  onClose: () => void;
}

export const QueuePanel: React.FC<QueuePanelProps> = ({ agentId, agentName, onClose }) => {
  const { listTasks, updateTaskPriority } = useAgentBoard();
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    try {
      const data = await listTasks(agentId);
      setTasks(data);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [agentId]);

  const handleUpdatePriority = async (taskId: string, delta: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const newPriority = task.priority + delta;
    await updateTaskPriority(taskId, newPriority);
    await fetchTasks();
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'working': return <Play size={12} className="text-green-400" />;
      case 'queued': return <Clock size={12} className="text-blue-400" />;
      case 'completed': return <CheckCircle size={12} className="text-emerald-400" />;
      default: return <Clock size={12} className="text-zinc-500" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950/80 backdrop-blur-2xl border-l border-white/5 w-80">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListTodo size={16} className="text-blue-400" />
          <h3 className="text-sm font-semibold text-zinc-100 truncate max-w-[140px]">{agentName}'s Queue</h3>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-all">
          <Trash2 size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="text-center py-10 text-xs text-zinc-600 animate-pulse">Loading queue...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-10 text-xs text-zinc-600 italic">No tasks in queue</div>
        ) : (
          tasks.map((task) => (
            <div 
              key={task.id}
              className={`p-3 rounded-lg border transition-all ${
                task.status === 'working' 
                ? 'bg-blue-500/10 border-blue-500/30' 
                : 'bg-white/5 border-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  {getStatusIcon(task.status)}
                  <span className="text-xs font-medium text-zinc-200 truncate">{task.title}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => handleUpdatePriority(task.id, 1)}
                    className="p-1 hover:bg-white/5 rounded text-zinc-500 hover:text-blue-400"
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button 
                    onClick={() => handleUpdatePriority(task.id, -1)}
                    className="p-1 hover:bg-white/5 rounded text-zinc-500 hover:text-amber-400"
                  >
                    <ArrowDown size={12} />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500 uppercase tracking-tighter">Priority: {task.priority}</span>
                <span className="text-[9px] text-zinc-600 font-mono">
                  {new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
