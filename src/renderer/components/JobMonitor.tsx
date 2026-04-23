import React from 'react';
import { useJobStore } from '../stores/jobs';
import { Cpu, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';

export const JobMonitor: React.FC = () => {
  const { jobs } = useJobStore();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Pending': return <Clock size={14} className="text-zinc-500" />;
      case 'Running': return <Loader2 size={14} className="text-blue-400 animate-spin" />;
      case 'Completed': return <CheckCircle size={14} className="text-emerald-400" />;
      case 'Failed': return <XCircle size={14} className="text-red-400" />;
      case 'Cancelled': return <XCircle size={14} className="text-zinc-500" />;
      default: return <Clock size={14} className="text-zinc-500" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900/50 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden">
      <div className="p-3 border-b border-white/5 flex items-center justify-between bg-white/5">
        <div className="flex items-center gap-2">
          <Cpu size={14} className="text-purple-400" />
          <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-tight">Active Jobs</h3>
        </div>
        <span className="text-[10px] text-zinc-500 font-mono">{jobs.filter(j => j.status === 'Running').length} Running</span>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2 max-h-[300px]">
        {jobs.length === 0 ? (
          <div className="text-center py-6 text-zinc-600 text-[10px] italic">No background jobs</div>
        ) : (
          jobs.map((job) => (
            <div 
              key={job.id} 
              className="p-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  {getStatusIcon(job.status)}
                  <span className="text-[10px] font-bold text-zinc-300 uppercase truncate">
                    {job.job_type}
                  </span>
                </div>
                <span className="text-[9px] text-zinc-500 font-mono">
                  {Math.round(job.progress * 100)}%
                </span>
              </div>
              
              <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden mb-1">
                <div 
                  className={`h-full transition-all duration-500 ${
                    job.status === 'Failed' ? 'bg-red-500' : 
                    job.status === 'Completed' ? 'bg-emerald-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${job.progress * 100}%` }}
                />
              </div>
              
              <div className="text-[9px] text-zinc-500 truncate">
                {job.status === 'Running' ? 'Processing...' : job.status}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
