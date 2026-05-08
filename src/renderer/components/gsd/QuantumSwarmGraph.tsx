import React, { useState, useEffect, useMemo, useRef } from 'react';
import ForceGraph3D, { type ForceGraphMethods } from 'react-force-graph-3d';
import { useApi } from '../../contexts/ApiContext';
import { cn } from '../../lib/utils';
import { Loader2, Zap, Brain, Shield } from 'lucide-react';
import SpriteText from 'three-spritetext';

interface SwarmNode {
  id: string;
  name: string;
  type: 'agent' | 'memory' | 'task' | 'node';
  val: number;
  color?: string;
}

interface SwarmLink {
  source: string;
  target: string;
  value: number;
  type?: string;
}

interface GraphData {
  nodes: SwarmNode[];
  links: SwarmLink[];
}

export const QuantumSwarmGraph: React.FC = () => {
  const api = useApi();
  const fgRef = useRef<any>(null);
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);

  // Colors from "Toxic Glow" palette
  const COLORS = {
    agent: '#ccff00', // neon-green
    memory: '#a855f7', // purple-500
    task: '#3b82f6', // blue-500
    node: '#f59e0b', // amber-500
    link: 'rgba(204, 255, 0, 0.2)',
    particle: '#ccff00'
  };

  const fetchGraphData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Personas (Agents)
      const personas = api.gsdGetPersonas ? await api.gsdGetPersonas() : [];
      
      const nodes: SwarmNode[] = [];
      const links: SwarmLink[] = [];

      personas.forEach((p: any) => {
        nodes.push({
          id: p.id,
          name: p.name,
          type: 'agent',
          val: 20,
          color: COLORS.agent
        });
      });

      // 2. Mock some memory nodes for visualization foundation
      // In a real scenario, we would fetch recent patterns from gsd_swarm_query_memory
      for (let i = 0; i < 15; i++) {
        const id = `mem-${i}`;
        nodes.push({
          id,
          name: `Memory ${i}`,
          type: 'memory',
          val: 8,
          color: COLORS.memory
        });
        
        // Random link to an agent
        if (nodes.length > personas.length) {
            const agentId = personas[Math.floor(Math.random() * personas.length)]?.id;
            if (agentId) {
                links.push({
                    source: agentId,
                    target: id,
                    value: 2
                });
            }
        }
      }

      setData({ nodes, links });
    } catch (error) {
      console.error('Failed to fetch swarm graph data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraphData();
  }, []);

  return (
    <div className="relative w-full h-full bg-black/80 rounded-2xl border border-white/5 overflow-hidden group">
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm gap-3">
          <Loader2 className="w-8 h-8 text-neon-green animate-spin" />
          <p className="text-[10px] font-black text-neon-green uppercase tracking-[0.2em] animate-pulse">Initializing Synaptic Graph...</p>
        </div>
      )}

      <div className="absolute top-4 left-4 z-10 space-y-2 pointer-events-none">
        <div className="flex items-center gap-2 bg-black/60 border border-neon-green/20 p-2 rounded-lg backdrop-blur-md">
          <Brain className="w-4 h-4 text-neon-green" />
          <h2 className="text-[10px] font-black text-white uppercase tracking-widest">Quantum Swarm Topology</h2>
        </div>
        
        <div className="flex flex-wrap gap-2">
            {Object.entries(COLORS).filter(([k]) => ['agent', 'memory', 'task', 'node'].includes(k)).map(([type, color]) => (
                <div key={type} className="flex items-center gap-1.5 px-2 py-1 bg-black/40 rounded border border-white/5 backdrop-blur-sm">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
                    <span className="text-[8px] font-bold text-white/40 uppercase tracking-tighter">{type}</span>
                </div>
            ))}
        </div>
      </div>

      <div className="absolute top-4 right-4 z-10">
        <button 
            onClick={fetchGraphData}
            className="p-2 bg-black/60 border border-white/10 rounded-lg hover:border-neon-green/40 text-white/40 hover:text-neon-green transition-all backdrop-blur-sm active:scale-95"
            title="Recalculate Topology"
        >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </button>
      </div>

      <ForceGraph3D
        ref={fgRef}
        graphData={data}
        backgroundColor="#000000"
        nodeLabel="name"
        nodeColor={node => (node as SwarmNode).color || '#ffffff'}
        nodeThreeObject={node => {
          const n = node as SwarmNode;
          const sprite = new SpriteText(n.name);
          sprite.color = n.color || '#ffffff';
          sprite.textHeight = 4;
          sprite.padding = 2;
          sprite.backgroundColor = 'rgba(0,0,0,0.4)';
          sprite.borderRadius = 2;
          sprite.borderWidth = 0.5;
          sprite.borderColor = 'rgba(255,255,255,0.1)';
          return sprite;
        }}
        nodeThreeObjectExtend={true}
        linkColor={() => COLORS.link}
        linkWidth={1}
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={d => 0.005}
        linkDirectionalParticleColor={() => COLORS.particle}
        linkDirectionalParticleWidth={1.5}
        showNavInfo={false}
        enableNodeDrag={false}
      />

      <div className="absolute bottom-4 right-4 z-10 flex gap-4 pointer-events-none">
          <div className="text-right">
              <div className="text-[10px] font-black text-white/60 uppercase tracking-widest">Nodes</div>
              <div className="text-xl font-black text-neon-green tabular-nums">{data.nodes.length}</div>
          </div>
          <div className="text-right">
              <div className="text-[10px] font-black text-white/60 uppercase tracking-widest">Synapses</div>
              <div className="text-xl font-black text-purple-400 tabular-nums">{data.links.length}</div>
          </div>
      </div>
    </div>
  );
};

// Helper for Lucide icons in Sprite (not easily done without canvas drawing, keeping SpriteText for now)
import { RefreshCw } from 'lucide-react';
