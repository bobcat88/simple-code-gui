import React, { useState, useEffect } from 'react';
import { 
  Network, 
  RefreshCw, 
  Database, 
  Shield, 
  MessageSquare, 
  Zap,
  ArrowRight,
  Cpu,
  Globe,
  Lock,
  Eye,
  Settings,
  Loader2
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ExtendedApi } from '../../api/types';

interface SynapticExpansionProps {
  api: ExtendedApi;
  projectPath: string;
}

export const SynapticExpansion: React.FC<SynapticExpansionProps> = ({ api, projectPath }) => {
  const [activeSubTab, setActiveSubTab] = useState<'mcp' | 'feedback' | 'architect'>('mcp');

  return (
    <div className="flex flex-col h-full space-y-4 animate-in slide-in-from-bottom-2 duration-500">
      {/* Sub-navigation */}
      <div className="flex gap-2 p-1 bg-black/40 rounded-xl border border-white/5 mx-1">
        <button
          onClick={() => setActiveSubTab('mcp')}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
            activeSubTab === 'mcp' 
              ? "bg-codex-neon/10 text-codex-neon border border-codex-neon/30" 
              : "text-white/30 hover:text-white/60"
          )}
        >
          <Globe size={12} />
          MCP
        </button>
        <button
          onClick={() => setActiveSubTab('feedback')}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
            activeSubTab === 'feedback' 
              ? "bg-purple-500/10 text-purple-400 border border-purple-500/30" 
              : "text-white/30 hover:text-white/60"
          )}
        >
          <MessageSquare size={12} />
          Loops
        </button>
        <button
          onClick={() => setActiveSubTab('architect')}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
            activeSubTab === 'architect' 
              ? "bg-amber-500/10 text-amber-400 border border-amber-500/30" 
              : "text-white/30 hover:text-white/60"
          )}
        >
          <Shield size={12} />
          Architect
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-1 space-y-4">
        {activeSubTab === 'mcp' && <DistributedMCPSection api={api} />}
        {activeSubTab === 'feedback' && <CognitiveFeedbackSection api={api} />}
        {activeSubTab === 'architect' && <AutonomousArchitectSection api={api} projectPath={projectPath} />}
      </div>
    </div>
  );
};

const DistributedMCPSection: React.FC<{ api: ExtendedApi }> = ({ api }) => {
  const [nodes, setNodes] = useState<McpServerConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);

  const fetchNodes = async () => {
    setLoading(true);
    try {
      const data = await api.mcpGetServers();
      setNodes(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNodes();
  }, []);

  const handleDiscovery = async () => {
    setDiscovering(true);
    try {
      const discovered = await api.mcpDiscoverServers();
      // For simplicity, automatically register discovered servers for now
      for (const server of discovered) {
        await api.registerMcpServer(server);
      }
      fetchNodes();
    } catch (e) {
      console.error(e);
    } finally {
      setDiscovering(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em]">Distributed MCP Nodes</h3>
        <button 
          onClick={fetchNodes}
          disabled={loading}
          className="p-1 rounded hover:bg-white/5 text-white/30 hover:text-codex-neon transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={cn(loading && "animate-spin")} />
        </button>
      </div>

      <div className="space-y-2">
        {nodes.length === 0 && !loading && (
          <div className="p-8 text-center border border-dashed border-white/5 rounded-2xl">
            <Globe size={24} className="mx-auto text-white/10 mb-2" />
            <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">No Active Nodes Detected</p>
          </div>
        )}

        {nodes.map(node => (
          <div key={node.name} className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between group hover:border-codex-neon/30 transition-all">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center border",
                node.command ? "bg-codex-neon/10 border-codex-neon/20 text-codex-neon" : "bg-blue-500/10 border-blue-500/20 text-blue-400"
              )}>
                {node.command ? <Cpu size={14} /> : <Globe size={14} />}
              </div>
              <div>
                <div className="text-[11px] font-bold text-white/90">{node.name}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[8px] font-mono text-white/30 uppercase">
                    {node.command ? 'Local Stdio' : 'Remote HTTP'}
                  </span>
                  <span className="text-white/10">•</span>
                  <span className="text-[8px] font-bold text-white/40 truncate max-w-[120px]">
                    {node.url || node.command}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentColor]",
                "bg-codex-neon text-codex-neon"
              )} />
              <button className="p-1.5 opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-white/10 text-white/40 hover:text-white">
                <Settings size={12} />
              </button>
            </div>
          </div>
        ))}

        <button 
          onClick={handleDiscovery}
          disabled={discovering}
          className="w-full py-2.5 border border-dashed border-white/10 rounded-xl text-[10px] font-bold text-white/20 hover:text-white/40 hover:border-white/20 hover:bg-white/[0.02] transition-all flex items-center justify-center gap-2 uppercase tracking-widest disabled:opacity-50"
        >
          {discovering ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
          {discovering ? 'Discovering Nodes...' : 'Discover Neural Nodes'}
        </button>
      </div>
    </div>
  );
};

const CognitiveFeedbackSection: React.FC<{ api: ExtendedApi }> = ({ api }) => {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchMetrics = async () => {
    if (!api.gsdGetSynapticMetrics) return;
    setLoading(true);
    try {
      const data = await api.gsdGetSynapticMetrics();
      setMetrics(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em]">Synaptic Policy Loops</h3>
        <button 
          onClick={fetchMetrics}
          className="p-1 text-white/20 hover:text-purple-400 transition-colors"
        >
          <RefreshCw size={12} className={cn(loading && "animate-spin")} />
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 bg-purple-500/5 border border-purple-500/10 rounded-xl">
          <div className="text-[8px] font-black text-purple-400/50 uppercase tracking-wider mb-1">Active Loops</div>
          <div className="text-xl font-black text-white tabular-nums">{metrics?.feedbackLoops || 0}</div>
        </div>
        <div className="p-3 bg-purple-500/5 border border-purple-500/10 rounded-xl">
          <div className="text-[8px] font-black text-purple-400/50 uppercase tracking-wider mb-1">Cohesion</div>
          <div className="text-xl font-black text-white tabular-nums">{metrics ? `${(metrics.swarmCohesion * 100).toFixed(0)}%` : '0%'}</div>
        </div>
      </div>

      <div className="space-y-2">
        <button 
          onClick={() => api.gsdTriggerExpansionLoop?.('policy-refinement')}
          className="w-full p-3 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 rounded-xl flex items-center justify-between group transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Zap size={14} className="text-purple-400" />
            </div>
            <div className="text-left">
              <div className="text-[10px] font-black uppercase tracking-widest text-white/80">Refine Synaptic Policy</div>
              <div className="text-[8px] text-white/30">Execute automatic balance correction</div>
            </div>
          </div>
          <ArrowRight size={14} className="text-purple-500/40 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
};

const AutonomousArchitectSection: React.FC<{ api: ExtendedApi; projectPath: string }> = ({ api, projectPath }) => {
  const [isAuditing, setIsAuditing] = useState(false);

  const handleAudit = async () => {
    if (!api.gsdExecuteProactiveAudit) return;
    setIsAuditing(true);
    try {
      await api.gsdExecuteProactiveAudit(projectPath);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl space-y-4 relative overflow-hidden">
        {isAuditing && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center space-y-3">
            <Loader2 size={24} className="text-amber-500 animate-spin" />
            <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] animate-pulse">Running Deep Audit...</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
            <Shield size={20} />
          </div>
          <div>
            <h3 className="text-xs font-black text-white uppercase tracking-tighter">Autonomous Architect</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[9px] font-bold text-amber-500/60 uppercase tracking-widest">Active Guard</span>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-white/40 leading-relaxed italic">
          "The Architect proactively monitors codebase structural integrity using GitNexus call-graph intelligence."
        </p>

        <div className="space-y-2">
          <div className="p-2.5 bg-black/40 rounded-xl border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database size={12} className="text-amber-500/60" />
              <span className="text-[10px] font-bold text-white/70">Structural Drift</span>
            </div>
            <span className="text-[10px] font-black text-amber-400">Minimal (0.04)</span>
          </div>
          <div className="p-2.5 bg-black/40 rounded-xl border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network size={12} className="text-amber-500/60" />
              <span className="text-[10px] font-bold text-white/70">Graph Stability</span>
            </div>
            <span className="text-[10px] font-black text-emerald-400">99.8%</span>
          </div>
        </div>

        <button 
          onClick={handleAudit}
          disabled={isAuditing}
          className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-black rounded-xl text-xs font-black uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(245,158,11,0.2)] transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
        >
          {isAuditing ? 'Audit in Progress' : 'Trigger Deep Audit'}
          <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
};
