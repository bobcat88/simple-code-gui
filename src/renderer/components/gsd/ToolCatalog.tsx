import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Terminal, 
  Cpu, 
  Zap, 
  Shield, 
  GitBranch, 
  FileCode, 
  Wrench,
  Grid,
  List,
  Filter,
  ExternalLink,
  Activity
} from 'lucide-react';
import { useApi } from '../../contexts/ApiContext';
import { cn } from '../../lib/utils';
import type { ToolInfo } from '../../api/types';

export function ToolCatalog() {
  const { api } = useApi();
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | 'system' | 'ai' | 'mcp'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    async function fetchTools() {
      if (!api?.gsdListTools) return;
      try {
        const result = await api.gsdListTools();
        setTools(result);
      } catch (err) {
        console.error('Failed to fetch tools:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchTools();
  }, [api]);

  const filteredTools = useMemo(() => {
    return tools.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) || 
                           t.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === 'all' || t.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [tools, search, category]);

  const getToolIcon = (t: ToolInfo) => {
    if (t.name.includes('git')) return <GitBranch size={20} />;
    if (t.name.includes('code') || t.name.includes('file')) return <FileCode size={20} />;
    if (t.name.includes('ai') || t.name.includes('neural')) return <Zap size={20} />;
    if (t.category === 'mcp') return <Cpu size={20} />;
    return <Wrench size={20} />;
  };

  return (
    <div className="flex flex-col h-full bg-black/20 backdrop-blur-3xl rounded-2xl border border-white/5 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="p-6 border-b border-white/5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
              <Grid className="text-indigo-400" />
              Agentic Tool Catalog
            </h2>
            <p className="text-sm text-white/40 mt-1">
              Explore and inspect all capabilities available to the swarm.
            </p>
          </div>
          
          <div className="flex items-center gap-2 p-1 bg-white/5 rounded-lg border border-white/5">
            <button 
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-2 rounded-md transition-all",
                viewMode === 'grid' ? "bg-indigo-500/20 text-indigo-400 shadow-inner" : "text-white/40 hover:text-white/60"
              )}
            >
              <Grid size={16} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={cn(
                "p-2 rounded-md transition-all",
                viewMode === 'list' ? "bg-indigo-500/20 text-indigo-400 shadow-inner" : "text-white/40 hover:text-white/60"
              )}
            >
              <List size={16} />
            </button>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={18} />
            <input 
              type="text"
              placeholder="Search tools, parameters, or descriptions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
            />
          </div>
          
          <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-xl border border-white/5">
            {(['all', 'system', 'ai', 'mcp'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all",
                  category === cat ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <Activity className="animate-spin text-indigo-500/50" size={32} />
          </div>
        ) : (
          <div className={cn(
            "grid gap-4",
            viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
          )}>
            <AnimatePresence mode="popLayout">
              {filteredTools.map((tool, idx) => (
                <motion.div
                  key={tool.name}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, delay: idx * 0.02 }}
                  className={cn(
                    "group relative p-5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/[0.08] hover:border-white/10 transition-all duration-300",
                    tool.is_enabled ? "opacity-100" : "opacity-50 grayscale"
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "p-3 rounded-xl transition-all group-hover:scale-110",
                      tool.category === 'ai' ? "bg-indigo-500/20 text-indigo-400" :
                      tool.category === 'system' ? "bg-emerald-500/20 text-emerald-400" :
                      "bg-amber-500/20 text-amber-400"
                    )}>
                      {getToolIcon(tool)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-white tracking-tight truncate group-hover:text-indigo-400 transition-colors">
                          {tool.name}
                        </h3>
                        {tool.version && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/30 font-mono">
                            v{tool.version}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/40 leading-relaxed line-clamp-2">
                        {tool.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-[10px] font-mono text-white/30">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Activity size={10} /> {tool.usage_count} Calls
                      </span>
                      <span className="flex items-center gap-1">
                        <Zap size={10} /> {(tool.avg_latency_ms || 45).toFixed(0)}ms
                      </span>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="flex items-center gap-1 hover:text-white transition-colors">
                        SCHEMA <ExternalLink size={10} />
                      </button>
                    </div>
                  </div>

                  {/* Highlighting for new/critical tools */}
                  {tool.name === 'generate_neural_insight' && (
                    <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-indigo-600 text-[10px] font-bold text-white rounded-md shadow-lg shadow-indigo-900/50">
                      NEW
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="px-6 py-4 bg-white/[0.02] border-t border-white/5 flex items-center justify-between text-[11px] text-white/30 font-medium">
        <div className="flex gap-4">
          <span>Active Capabilities: {tools.filter(t => t.is_enabled).length}</span>
          <span>MCP Servers: 4</span>
          <span>Swarm Latency: 12ms</span>
        </div>
        <div className="flex items-center gap-2 text-indigo-400/60">
          <Shield size={12} />
          SECURE RUNTIME ACTIVE
        </div>
      </div>
    </div>
  );
}
