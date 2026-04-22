import React from 'react';
import { useHealthStatus } from '../hooks/useHealthStatus';
import { Activity, Cpu, Database, Server } from 'lucide-react';

export const HealthDashboard: React.FC = () => {
  const { status, loading } = useHealthStatus();

  if (loading || !status) {
    return <div className="p-4 text-zinc-500 animate-pulse">Initializing diagnostics...</div>;
  }

  const installedMcp = status.installed_extensions.filter((extension) => extension.type === 'mcp');
  const installedPlugins = status.installed_extensions.filter((extension) => extension.type !== 'mcp');
  const serviceCount = status.services.length;

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  const getStatusColor = (value: string) => {
    const normalized = value.toLowerCase();
    if (normalized === 'healthy') return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10';
    if (normalized === 'warning') return 'text-amber-400 border-amber-500/20 bg-amber-500/10';
    return 'text-rose-400 border-rose-500/20 bg-rose-500/10';
  };

  const StatCard = ({
    label,
    value,
    icon,
  }: {
    label: string;
    value: string;
    icon: React.ReactNode;
  }) => (
    <div className="rounded-xl border border-white/5 bg-zinc-900/50 px-3 py-2">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-sm font-semibold text-zinc-100">{value}</div>
    </div>
  );

  const ExtensionRow = ({
    name,
    type,
    enabled,
    scope,
    detail,
  }: {
    name: string;
    type: string;
    enabled: boolean;
    scope: string;
    detail: string;
  }) => (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-white/5 bg-zinc-900/40 px-3 py-2.5">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-zinc-100">{name}</div>
        <div className="mt-0.5 truncate text-[10px] uppercase tracking-widest text-zinc-500">{detail}</div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-zinc-300">
          {type}
        </span>
        <span
          className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
            enabled ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-zinc-500/20 bg-zinc-500/10 text-zinc-400'
          }`}
        >
          {enabled ? 'enabled' : 'disabled'} · {scope}
        </span>
      </div>
    </div>
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="relative z-10 mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-1.5">
            <Server size={16} className="text-emerald-400" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-tight text-zinc-100">App & Plugin Health</h3>
        </div>
        <div
          className={`rounded-md border px-2 py-0.5 text-[9px] font-black shadow-inner ${getStatusColor(status.status)}`}
        >
          {status.status.toUpperCase()}
        </div>
      </div>

      <div className="relative z-10 mb-4 grid grid-cols-2 gap-3">
        <StatCard
          label="CPU"
          value={`${status.cpu_usage.toFixed(1)}%`}
          icon={<Cpu size={12} className="text-zinc-400" />}
        />
        <StatCard
          label="Memory"
          value={`${formatBytes(status.memory_usage)} / ${formatBytes(status.total_memory)}`}
          icon={<Database size={12} className="text-zinc-400" />}
        />
        <StatCard label="Services" value={`${serviceCount}`} icon={<Activity size={12} className="text-zinc-400" />} />
        <StatCard label="MCPs" value={`${installedMcp.length}`} icon={<Server size={12} className="text-zinc-400" />} />
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto pr-1 custom-scrollbar">
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Core Services</h4>
            <span className="text-[10px] font-mono text-zinc-500">{serviceCount} monitored</span>
          </div>
          <div className="space-y-2">
            {status.services.map((service) => (
              <div
                key={service.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-white/5 bg-zinc-900/40 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-zinc-100">{service.name}</div>
                  <div className="mt-0.5 truncate text-[10px] uppercase tracking-widest text-zinc-500">{service.detail}</div>
                </div>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
                    service.status.toLowerCase() === 'healthy'
                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                      : service.status.toLowerCase() === 'warning'
                        ? 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                        : 'border-rose-500/20 bg-rose-500/10 text-rose-300'
                  }`}
                >
                  {service.status}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Installed MCPs</h4>
            <span className="text-[10px] font-mono text-zinc-500">{installedMcp.length} active</span>
          </div>
          {installedMcp.length > 0 ? (
            <div className="space-y-2">
              {installedMcp.map((extension) => (
                <ExtensionRow
                  key={`${extension.id}-${extension.scope}-${extension.projectPath ?? 'global'}`}
                  name={extension.name}
                  type={extension.type}
                  enabled={extension.enabled}
                  scope={extension.scope}
                  detail={extension.description}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 bg-zinc-900/20 px-3 py-4 text-sm text-zinc-500">
              No MCP extensions installed.
            </div>
          )}
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Installed Plugins</h4>
            <span className="text-[10px] font-mono text-zinc-500">{installedPlugins.length} total</span>
          </div>
          {installedPlugins.length > 0 ? (
            <div className="space-y-2">
              {installedPlugins.map((extension) => (
                <ExtensionRow
                  key={`${extension.id}-${extension.scope}-${extension.projectPath ?? 'global'}`}
                  name={extension.name}
                  type={extension.type}
                  enabled={extension.enabled}
                  scope={extension.scope}
                  detail={extension.description}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 bg-zinc-900/20 px-3 py-4 text-sm text-zinc-500">
              No non-MCP extensions installed.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
