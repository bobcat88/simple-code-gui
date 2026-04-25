import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { RefreshCw, Shield, AlertTriangle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface UpgradeImpactReport {
  dependency: String;
  currentVersion: String;
  latestVersion: String;
  affectedFiles: String[];
  affectedSymbols: String[];
  impactedCount: number | null;
  riskScore: number;
  recommendation: String;
}

interface ProgressPayload {
  dependency: string;
  status: string;
  percentage: number;
  message: string;
}

export const UpgradePanel: React.FC = () => {
  const [dependencies] = useState(['rtk', 'bd', 'kspec', 'gitnexus']);
  const [reports, setReports] = useState<Record<string, UpgradeImpactReport>>({});
  const [analyzing, setAnalyzing] = useState<Record<string, boolean>>({});
  const [upgrading, setUpgrading] = useState<Record<string, boolean>>({});
  const [progress, setProgress] = useState<Record<string, ProgressPayload>>({});
  const [previousVersions, setPreviousVersions] = useState<Record<string, string>>({});

  useEffect(() => {
    const unlisten = listen<ProgressPayload>('upgrade-progress', (event) => {
      setProgress((prev) => ({
        ...prev,
        [event.payload.dependency]: event.payload,
      }));

      if (event.payload.status === 'completed') {
        setUpgrading((prev) => ({ ...prev, [event.payload.dependency]: false }));
        // If we have a report, we can now assume the "old" version is what we just came from
        // In a real app, we'd fetch the actual version before upgrading
      }
      
      if (event.payload.status === 'failed') {
        setUpgrading((prev) => ({ ...prev, [event.payload.dependency]: false }));
      }
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const analyzeUpgrade = async (dep: string) => {
    setAnalyzing((prev) => ({ ...prev, [dep]: true }));
    try {
      const report = await invoke<UpgradeImpactReport>('project_analyze_upgrade', {
        projectPath: '.',
        dependency: dep,
      });
      setReports((prev) => ({ ...prev, [dep]: report }));
    } catch (err) {
      console.error('Failed to analyze upgrade:', err);
    } finally {
      setAnalyzing((prev) => ({ ...prev, [dep]: false }));
    }
  };

  const startUpgrade = async (dep: string) => {
    const report = reports[dep];
    if (report) {
      setPreviousVersions((prev) => ({ ...prev, [dep]: report.currentVersion.toString() }));
    }
    setUpgrading((prev) => ({ ...prev, [dep]: true }));
    try {
      await invoke('project_upgrade_dependency', { dependency: dep });
    } catch (err) {
      console.error('Failed to upgrade:', err);
      setUpgrading((prev) => ({ ...prev, [dep]: false }));
    }
  };

  const startRollback = async (dep: string) => {
    const prevVersion = previousVersions[dep];
    if (!prevVersion) return;

    setUpgrading((prev) => ({ ...prev, [dep]: true }));
    try {
      await invoke('project_rollback_dependency', { dependency: dep, version: prevVersion });
    } catch (err) {
      console.error('Failed to rollback:', err);
      setUpgrading((prev) => ({ ...prev, [dep]: false }));
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 7) return 'text-rose-400 border-rose-500/20 bg-rose-500/10';
    if (score >= 4) return 'text-amber-400 border-amber-500/20 bg-amber-500/10';
    return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10';
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Transwarp Assimilation (Upgrades)</h4>
        <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-mono text-zinc-400">Sync with Origins</span>
      </div>

      <div className="space-y-3">
        {dependencies.map((dep) => {
          const report = reports[dep];
          const isAnalyzing = analyzing[dep];
          const isUpgrading = upgrading[dep];
          const currentProgress = progress[dep];

          return (
            <div key={dep} className="rounded-xl border border-white/5 bg-zinc-900/40 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-zinc-100 uppercase tracking-tight">{dep}</span>
                    {report && (
                      <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[9px] font-mono text-zinc-400">
                        {report.currentVersion} → {report.latestVersion}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[10px] text-zinc-500 uppercase tracking-widest">
                    External dependency integrator
                  </div>
                </div>

                <div className="flex gap-2">
                  {!report && !isAnalyzing && (
                    <button
                      onClick={() => analyzeUpgrade(dep)}
                      className="rounded-lg border border-white/5 bg-white/5 p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-200"
                    >
                      <RefreshCw size={14} />
                    </button>
                  )}
                  {isAnalyzing && (
                    <div className="p-1.5">
                      <Loader2 size={14} className="animate-spin text-zinc-500" />
                    </div>
                  )}
                  {report && !isUpgrading && (
                    <button
                      onClick={() => startUpgrade(dep)}
                      disabled={isUpgrading}
                      className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight text-emerald-400 border border-emerald-500/20 transition-all hover:bg-emerald-500/20"
                    >
                      <Shield size={12} />
                      Assimilate Latest
                    </button>
                  )}
                </div>
              </div>

              {report && !isUpgrading && (
                <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-tight">
                      <AlertTriangle size={12} className={report.riskScore >= 7 ? 'text-rose-400' : 'text-amber-400'} />
                      <span>Impact Analysis: {report.impactedCount ?? 0} Consumers</span>
                    </div>
                    <div className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${getRiskColor(report.riskScore)}`}>
                      {report.riskScore >= 7 ? 'High Risk' : report.riskScore >= 4 ? 'Medium Risk' : 'Low Risk'}
                    </div>
                  </div>
                  
                  <div className="text-[10px] leading-relaxed text-zinc-500 bg-white/5 p-2 rounded-lg border border-white/5">
                    <span className="font-bold text-zinc-400 uppercase">Recommendation:</span> {report.recommendation}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {report.affected_files?.slice(0, 3).map((f: any, i: number) => (
                      <span key={i} className="rounded-md bg-zinc-800/50 px-1.5 py-0.5 text-[8px] font-mono text-zinc-500 border border-white/5">
                        {f.split('/').pop()}
                      </span>
                    ))}
                    {report.affected_files?.length > 3 && (
                      <span className="text-[8px] text-zinc-600">+{report.affected_files.length - 3} more</span>
                    )}
                  </div>
                </div>
              )}

              {isUpgrading && currentProgress && (
                <div className="mt-3 space-y-2 border-t border-white/5 pt-3 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-tight">
                      <Loader2 size={12} className="animate-spin text-emerald-400" />
                      <span>{currentProgress.message}</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">{(currentProgress.percentage * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-zinc-800 border border-white/5">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]" 
                      style={{ width: `${currentProgress.percentage * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {currentProgress && currentProgress.status === 'completed' && !isUpgrading && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 p-2 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 size={12} />
                  <span>Assimilation Successful</span>
                </div>
              )}

              {currentProgress && currentProgress.status === 'completed' && previousVersions[dep] && !isUpgrading && (
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={() => startRollback(dep)}
                    className="text-[9px] font-bold uppercase tracking-tight text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Oops, Rollback to {previousVersions[dep]}
                  </button>
                </div>
              )}

              {currentProgress && currentProgress.status === 'failed' && !isUpgrading && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-500/10 p-2 text-[10px] font-bold text-rose-400 border border-rose-500/20">
                  <XCircle size={12} />
                  <span className="truncate">{currentProgress.message}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
