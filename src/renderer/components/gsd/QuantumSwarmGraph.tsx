import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ForceGraph3D, { type ForceGraphMethods } from 'react-force-graph-3d';
import { useApi } from '../../contexts/ApiContext';
import { cn } from '../../lib/utils';
import { Loader2, Zap, Brain, Shield, ChevronLeft } from 'lucide-react';
import SpriteText from 'three-spritetext';
import type { CognitiveNode, CognitiveLink } from '../../api/intelligence-types';

interface SwarmNode extends CognitiveNode {
  x?: number;
  y?: number;
  z?: number;
}

interface SwarmLink extends CognitiveLink {
  // force-graph specific props if needed
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
  const [activeNode, setActiveNode] = useState<SwarmNode | null>(null);

  // Colors from "Toxic Glow" palette
  const COLORS = {
    agent: '#ccff00', // neon-green
    memory: '#a855f7', // purple-500
    task: '#3b82f6', // blue-500
    cluster: '#f59e0b', // amber-500
    node: '#ffffff',
    link: 'rgba(204, 255, 0, 0.15)',
    particle: '#ccff00'
  };

  const fetchGraphData = async () => {
    setLoading(true);
    try {
      if (!api.gsdGetCognitiveTopology) return;
      const topology = await api.gsdGetCognitiveTopology();
      
      setData({
        nodes: topology.nodes as SwarmNode[],
        links: topology.links as SwarmLink[]
      });
    } catch (error) {
      console.error('Failed to fetch swarm graph data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNodeClick = useCallback((node: any) => {
    const n = node as SwarmNode;
    setActiveNode(n);

    // Aim at node from outside it
    const distance = 40;
    const distRatio = 1 + distance / Math.hypot(n.x || 0, n.y || 0, n.z || 0);

    if (fgRef.current) {
        fgRef.current.cameraPosition(
            { x: (n.x || 0) * distRatio, y: (n.y || 0) * distRatio, z: (n.z || 0) * distRatio }, // new position
            n, // lookAt ({x,y,z})
            2000  // ms transition duration
        );
    }
  }, []);

  const resetView = () => {
      setActiveNode(null);
      if (fgRef.current) {
          fgRef.current.zoomToFit(1000);
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

      <div className="absolute top-4 left-4 z-20 space-y-2 pointer-events-none">
        <div className="flex items-center gap-2 bg-black/60 border border-neon-green/20 p-2 rounded-lg backdrop-blur-md">
          <Brain className="w-4 h-4 text-neon-green" />
          <h2 className="text-[10px] font-black text-white uppercase tracking-widest">Quantum Swarm Topology</h2>
        </div>
        
        {activeNode && (
            <div className="flex flex-col gap-1 p-3 bg-neon-green/10 border border-neon-green/30 rounded-xl backdrop-blur-xl animate-in slide-in-from-left-2 duration-300 pointer-events-auto max-w-[200px]">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[8px] font-black text-neon-green uppercase tracking-widest">Active Node</span>
                    <button onClick={resetView} className="p-1 hover:bg-neon-green/20 rounded transition-colors">
                        <ChevronLeft className="w-3 h-3 text-neon-green" />
                    </button>
                </div>
                <h3 className="text-xs font-black text-white truncate">{activeNode.name}</h3>
                <p className="text-[9px] text-white/60 font-mono uppercase italic">{activeNode.nodeType}</p>
                {activeNode.metadata && Object.entries(activeNode.metadata).map(([k, v]) => (
                    <div key={k} className="mt-1">
                        <span className="text-[7px] text-white/30 uppercase block">{k}</span>
                        <span className="text-[8px] text-white/70 break-all">{Array.isArray(v) ? v.join(', ') : String(v)}</span>
                    </div>
                ))}
            </div>
        )}
      </div>

      <div className="absolute top-4 right-4 z-20">
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
        nodeColor={node => (node as SwarmNode).color || COLORS.node}
        onNodeClick={handleNodeClick}
        nodeThreeObject={node => {
          const n = node as SwarmNode;
          const sprite = new SpriteText(n.name);
          sprite.color = n.color || '#ffffff';
          sprite.textHeight = n.nodeType === 'agent' ? 5 : 3;
          sprite.padding = 2;
          sprite.backgroundColor = 'rgba(0,0,0,0.6)';
          sprite.borderRadius = 2;
          sprite.borderWidth = 0.5;
          sprite.borderColor = 'rgba(255,255,255,0.1)';
          return sprite;
        }}
        nodeThreeObjectExtend={true}
        linkColor={() => COLORS.link}
        linkWidth={1}
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={() => 0.005}
        linkDirectionalParticleColor={() => COLORS.particle}
        linkDirectionalParticleWidth={1.5}
        showNavInfo={false}
        enableNodeDrag={false}
      />

      <div className="absolute bottom-4 right-4 z-20 flex gap-4 pointer-events-none">
          <div className="text-right">
              <div className="text-[10px] font-black text-white/60 uppercase tracking-widest">Dimensions</div>
              <div className="text-xl font-black text-neon-green tabular-nums">3D</div>
          </div>
          <div className="text-right">
              <div className="text-[10px] font-black text-white/60 uppercase tracking-widest">Synapses</div>
              <div className="text-xl font-black text-purple-400 tabular-nums">{data.links.length}</div>
          </div>
      </div>
    </div>
  );
};

import { RefreshCw } from 'lucide-react';
