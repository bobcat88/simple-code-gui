import React from 'react';
import { useTokenStats } from '../../hooks/useTokenStats';
import { 
  Coins, 
  Cpu, 
  TrendingDown, 
  Clock, 
  Box, 
  Database,
  BarChart3,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';

interface CostDashboardProps {
  projectPath?: string;
  className?: string;
}

export function CostDashboard({ projectPath, className }: CostDashboardProps) {
  const { data, loading, error } = useTokenStats({ projectPath });

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-white/40">
        <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-medium uppercase tracking-widest">Loading Telemetry...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-red-400/60 p-6 text-center">
        <AlertCircle size={32} />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-red-400">Failed to load cost data</p>
          <p className="text-xs opacity-80">{error}</p>
        </div>
      </div>
    );
  }

  if (!data || data.totals.transactionCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-white/20">
        <Coins size={32} />
        <p className="text-sm">No transaction data yet.</p>
      </div>
    );
  }

  const { totals, daily, sessions, backendBreakdown, projectBreakdown } = data;

  return (
    <div className={cn("space-y-6 p-6 overflow-y-auto max-h-full scrollbar-hide", className)}>
      {/* Header Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard 
          title="Total Estimated Cost" 
          value={`$${totals.costEstimate.toFixed(4)}`}
          icon={<Coins className="text-amber-400" size={18} />}
          subtext={`${totals.transactionCount} total requests`}
        />
        <SummaryCard 
          title="Tokens Consumed" 
          value={(totals.inputTokens + totals.outputTokens).toLocaleString()}
          icon={<Cpu className="text-blue-400" size={18} />}
          subtext={`${(totals.inputTokens / 1000).toFixed(1)}k in / ${(totals.outputTokens / 1000).toFixed(1)}k out`}
        />
        <SummaryCard 
          title="Avg. Cost per Request" 
          value={`$${(totals.costEstimate / totals.transactionCount).toFixed(4)}`}
          icon={<TrendingDown className="text-emerald-400" size={18} />}
          subtext="Based on last 30 days"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Spend Graph (Simple CSS implementation) */}
        <Section title="Spending History" icon={<BarChart3 size={16} />}>
          <div className="h-48 flex items-end gap-1 pt-4 px-2">
            {daily.map((point, i) => (
              <div key={point.date} className="group relative flex-1 flex flex-col items-center gap-2">
                <div 
                  className="w-full bg-blue-500/30 group-hover:bg-blue-500/50 rounded-t-sm transition-all cursor-help"
                  style={{ 
                    height: `${Math.max(10, (point.costEstimate / Math.max(...daily.map(d => d.costEstimate), 0.01)) * 100)}%` 
                  }}
                >
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20">
                    <div className="bg-zinc-900 border border-white/10 px-2 py-1 rounded text-[10px] whitespace-nowrap shadow-xl">
                      <div className="font-bold">{format(new Date(point.date), 'MMM d')}</div>
                      <div className="text-amber-400">${point.costEstimate.toFixed(4)}</div>
                    </div>
                  </div>
                </div>
                <span className="text-[8px] text-white/20 rotate-45 origin-left whitespace-nowrap mt-1">
                  {i % 5 === 0 ? format(new Date(point.date), 'MM/dd') : ''}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* Backend Breakdown */}
        <Section title="By Provider" icon={<Box size={16} />}>
          <div className="space-y-3 pt-2">
            {backendBreakdown.map((item) => (
              <div key={item.key} className="space-y-1">
                <div className="flex justify-between text-[10px] font-medium uppercase tracking-wider text-white/40">
                  <span>{item.key}</span>
                  <span>${item.costEstimate.toFixed(4)}</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(item.costEstimate / totals.costEstimate) * 100}%` }}
                    className="h-full bg-blue-500/50 shadow-[0_0_8px_rgba(59,130,246,0.3)]"
                  />
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* Recent Sessions */}
      <Section title="Recent Sessions" icon={<Clock size={16} />}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="border-b border-white/5 text-white/30 uppercase tracking-tighter">
                <th className="py-2 font-medium">Session / Project</th>
                <th className="py-2 font-medium text-right">Tokens</th>
                <th className="py-2 font-medium text-right">Cost</th>
                <th className="py-2 font-medium text-right">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sessions.slice(0, 10).map((session) => (
                <tr key={session.sessionId} className="group hover:bg-white/5 transition-colors">
                  <td className="py-3 pr-4">
                    <div className="flex flex-col">
                      <span className="font-mono text-white/80 group-hover:text-white transition-colors truncate max-w-[200px]">
                        {session.sessionId}
                      </span>
                      <span className="text-[9px] text-white/30 flex items-center gap-1 mt-0.5">
                        <Database size={10} />
                        {session.projectPath.split('/').pop()}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 text-right tabular-nums">
                    <div className="flex flex-col">
                      <span className="text-white/60">{(session.inputTokens + session.outputTokens).toLocaleString()}</span>
                      <span className="text-[9px] text-white/20">{Math.round(session.transactionCount)} reqs</span>
                    </div>
                  </td>
                  <td className="py-3 text-right tabular-nums font-medium text-amber-400/80">
                    ${session.costEstimate.toFixed(4)}
                  </td>
                  <td className="py-3 text-right text-white/40 tabular-nums">
                    {format(new Date(session.lastTimestamp), 'MMM d, HH:mm')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function SummaryCard({ title, value, icon, subtext }: { title: string, value: string, icon: React.ReactNode, subtext: string }) {
  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group">
      <div className="flex justify-between items-start mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 group-hover:text-white/60 transition-colors">
          {title}
        </span>
        <div className="p-1.5 rounded-lg bg-white/5">
          {icon}
        </div>
      </div>
      <div className="text-xl font-bold tracking-tight text-white/90">
        {value}
      </div>
      <div className="text-[10px] text-white/30 mt-1">
        {subtext}
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) {
  return (
    <div className="flex flex-col bg-zinc-900/40 border border-white/5 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5 bg-white/5">
        <div className="text-white/40">{icon}</div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-white/60">{title}</h3>
      </div>
      <div className="p-5 flex-1">
        {children}
      </div>
    </div>
  );
}
