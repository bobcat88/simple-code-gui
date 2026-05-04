import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import SpriteText from 'three-spritetext'
import * as THREE from 'three'
import { 
  Activity,
  Zap,
  Globe,
  Database,
  RefreshCw,
  Search,
  Filter,
  Maximize2,
  Cpu,
  Layers,
  Brain
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type { ExtendedApi } from '../../api/types'

export interface Node {
  id: string
  name: string
  type: string
  val: number
  color: string
}

interface Link {
  source: string
  target: string
  value: number
}

interface GraphData {
  nodes: Node[]
  links: Link[]
}

interface NeuralHUDTabProps {
  api: ExtendedApi
  projectPath?: string | null
  embedded?: boolean
}

export function NeuralHUDTab({ api, projectPath, embedded }: NeuralHUDTabProps) {
  const fgRef = useRef<any>()
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] })
  const [isLoading, setIsLoading] = useState(false)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeThought, setActiveThought] = useState<{ message: string, nodeIds: string[] } | null>(null)
  const [thoughtHistory, setThoughtHistory] = useState<any[]>([])
  const [highlightNodes, setHighlightNodes] = useState(new Set())
  const [highlightLinks, setHighlightLinks] = useState(new Set())
  const [hoverNode, setHoverNode] = useState<any>(null)

  const fetchGraphData = useCallback(async (query: string = '') => {
    setIsLoading(true)
    try {
      // Query for patterns to build the graph
      const results = await api.gsdSwarmQueryMemory(query || 'project', undefined, 50)
      
      const nodes: Node[] = []
      const links: Link[] = []
      const nodeSet = new Set<string>()

      // Mocking some connections for now until we have real relationship extraction
      results.forEach((res: any, i: number) => {
        const id = `node-${i}`
        const name = res.content?.substring(0, 30) || `Pattern ${i}`
        const type = res.type || 'unknown'
        
        if (!nodeSet.has(id)) {
          nodes.push({
            id,
            name,
            type,
            val: 10 + (res.content?.length || 0) / 100,
            color: getNodeColor(type)
          })
          nodeSet.add(id)
        }

        // Add some random links for visualization if no real links exist
        if (i > 0) {
          links.push({
            source: nodes[Math.floor(Math.random() * nodes.length)].id,
            target: id,
            value: 1
          })
        }
      })

      setGraphData({ nodes, links })
    } catch (err) {
      console.error('Failed to fetch neural graph data:', err)
    } finally {
      setIsLoading(false)
    }
  }, [api])

  useEffect(() => {
    fetchGraphData()

    // Initialize Quantum Sync
    if (api.gsdQuantumSyncStart) {
      api.gsdQuantumSyncStart().catch(err => console.error('Failed to start quantum sync:', err));
    }

    // Listen for real-time swarm execution events
    const unlistenExecution = api.onGsdExecutionEvent((event: any) => {
      console.log('NeuralHUD received event:', event)
      
      // Add to history
      setThoughtHistory(prev => [event, ...prev].slice(0, 50))

      // Identify related nodes based on message content or IDs in the event
      const relatedNodeIds: string[] = []
      // Simple keyword matching for demo/foundation
      const message = event.message.toLowerCase()
      
      setGraphData(current => {
        current.nodes.forEach(node => {
          if (message.includes(node.name.toLowerCase())) {
            relatedNodeIds.push(node.id)
          }
        });
        return current
      })

      if (relatedNodeIds.length > 0) {
        setHighlightNodes(new Set(relatedNodeIds))
        
        // Auto-orbit to the first related node if one exists
        const firstNode = graphData.nodes.find(n => n.id === relatedNodeIds[0])
        if (firstNode && fgRef.current) {
          // Subtle camera nudge towards activity
          // fgRef.current.cameraPosition(...)
        }
      }

      setActiveThought({ message: event.message, nodeIds: relatedNodeIds })
      
      // Fade out the thought bubble after a few seconds
      setTimeout(() => {
        setActiveThought(current => {
          if (current?.message === event.message) return null
          return current
        })
        setHighlightNodes(new Set())
      }, 5000)
    })

    // Listen for synaptic sync events
    const unlistenSync = api.onGsdSyncEvent ? api.onGsdSyncEvent((event: any) => {
      console.log('NeuralHUD received sync event:', event)
      // Refresh graph data when sync occurs
      fetchGraphData()
      
      // Add a special "Sync" event to history
      setThoughtHistory(prev => [{
        timestamp: Date.now(),
        eventType: 'SYNC',
        message: 'Synaptic shift detected. Knowledge graph re-synchronized.'
      }, ...prev].slice(0, 50))
    }) : Promise.resolve(() => {});

    return () => {
      unlistenExecution.then(fn => fn())
      unlistenSync.then(fn => fn())
    }
  }, [fetchGraphData, api, graphData.nodes])

  const getNodeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'feature': return '#ccff00' // Toxic Neon
      case 'spec': return '#ccff00' // Toxic Neon
      case 'task': return '#ccff00' // Toxic Neon
      case 'bug': return '#ff0055' // Cyber Red
      case 'thought': return '#ccff00' // Toxic Neon
      default: return '#ccff00' // Toxic Neon
    }
  }

  const handleNodeClick = useCallback((node: any) => {
    // Aim at node from outside it
    const distance = 40
    const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z)

    fgRef.current.cameraPosition(
      { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, // new pos
      node, // lookAt pos
      3000  // ms transition duration
    )
    setSelectedNode(node)
  }, [])

  const nodeThreeObject = useCallback((node: any) => {
    const isHighlighted = highlightNodes.has(node.id)
    const isHovered = hoverNode === node
    
    const sprite = new SpriteText(node.name)
    sprite.color = isHighlighted ? '#ffffff' : (isHovered ? '#ccff00' : node.color)
    sprite.textHeight = isHighlighted || isHovered ? 12 : 8
    sprite.backgroundColor = isHighlighted ? 'rgba(204, 255, 0, 0.4)' : 'rgba(0,0,0,0.5)'
    sprite.padding = isHighlighted ? 4 : 2
    sprite.borderRadius = 8
    
    // Add a glow sphere if highlighted
    if (isHighlighted) {
      const group = new THREE.Group()
      group.add(sprite)
      
      const glowGeometry = new THREE.SphereGeometry(15, 32, 32)
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(node.color),
        transparent: true,
        opacity: 0.15
      })
      const glow = new THREE.Mesh(glowGeometry, glowMaterial)
      group.add(glow)
      
      return group
    }
    
    return sprite
  }, [highlightNodes, hoverNode])

  const particleWidth = useCallback((link: any) => {
    return highlightNodes.has(link.source.id) || highlightNodes.has(link.target.id) ? 4 : 1
  }, [highlightNodes])

  const particleCount = useCallback((link: any) => {
    return highlightNodes.has(link.source.id) || highlightNodes.has(link.target.id) ? 8 : 0
  }, [highlightNodes])

  return (
    <div className={cn(
      "flex flex-col h-full overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300 relative",
      !embedded && "bg-black/40"
    )}>
      {/* Header Overlay */}
      {!embedded && (
        <div className="absolute top-0 left-0 right-0 p-4 z-10 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto">
            <div className="w-8 h-8 rounded-xl bg-codex-neon/20 flex items-center justify-center border border-codex-neon/30 shadow-neon-sm">
              <Brain className="w-4 h-4 text-codex-neon" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight uppercase">NeuralHUD</h3>
              <p className="text-[10px] text-white/40 font-medium uppercase tracking-widest">Real-time Knowledge Graph</p>
            </div>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-codex-neon/10 border border-codex-neon/20 mr-2 shadow-neon-sm">
              <Zap size={10} className="text-codex-neon animate-pulse" />
              <span className="text-[9px] font-black text-codex-neon uppercase tracking-widest">Quantum Sync Active</span>
            </div>
            <button 
              onClick={() => fetchGraphData(searchQuery)}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/80 transition-all border border-white/5"
              title="Refresh Knowledge"
            >
              <RefreshCw size={14} className={cn(isLoading && "animate-spin")} />
            </button>
          </div>
        </div>
      )}

      {/* Search Overlay */}
      {!embedded && (
        <div className="absolute bottom-4 left-4 right-4 z-10 pointer-events-none">
          <div className="glass-panel p-2 flex items-center gap-2 pointer-events-auto max-w-md mx-auto rounded-xl border-white/10 shadow-neon-sm">
            <Search className="w-3.5 h-3.5 text-white/20 ml-2" />
            <input 
              type="text"
              placeholder="Search neural patterns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchGraphData(searchQuery)}
              className="bg-transparent border-none outline-none text-xs text-white placeholder:text-white/20 flex-1 py-1 uppercase tracking-tight"
            />
            <div className="h-4 w-px bg-white/10 mx-1" />
            <button 
              onClick={() => fetchGraphData(searchQuery)}
              className="px-2 py-1 rounded-lg bg-codex-neon/20 hover:bg-codex-neon/30 text-codex-neon text-[10px] font-bold transition-all border border-codex-neon/20 uppercase tracking-widest"
            >
              RESOLVE
            </button>
          </div>
        </div>
      )}

      {/* Node Details Overlay */}
      {selectedNode && (
        <div className="absolute top-16 right-4 z-10 w-64 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="p-4 bg-black/80 backdrop-blur-xl border border-codex-neon/20 rounded-2xl shadow-2xl space-y-4 shadow-neon-sm">
            <div className="flex items-center justify-between">
              <span className="px-1.5 py-0.5 rounded bg-codex-neon/10 border border-codex-neon/20 text-codex-neon text-[8px] font-black uppercase tracking-widest">
                ACTIVE SYNAPSE
              </span>
              <button 
                onClick={() => setSelectedNode(null)}
                className="text-white/20 hover:text-white/60 transition-colors"
              >
                <Maximize2 size={10} />
              </button>
            </div>

            <div className="space-y-1">
              <h4 className="text-xs font-bold text-white/90 leading-tight uppercase tracking-tight">{selectedNode.name}</h4>
              <p className="text-[10px] text-white/40 font-mono break-all">{selectedNode.id}</p>
            </div>

            <div className="pt-2 border-t border-white/5 space-y-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-white/30 uppercase font-bold">Synapse Strength</span>
                <span className="text-codex-neon font-bold">84%</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                <div className="h-full bg-codex-neon w-[84%] shadow-neon-sm" />
              </div>
            </div>

            <button className="w-full py-1.5 bg-codex-neon/10 hover:bg-codex-neon/20 text-codex-neon rounded-xl text-[10px] font-bold transition-all border border-codex-neon/20 uppercase tracking-widest">
              EXPLORE CONNECTIONS
            </button>
          </div>
        </div>
      )}

      {/* Main 3D Graph */}
      <div className="flex-1 w-full h-full cursor-move">
        <ForceGraph3D
          ref={fgRef}
          graphData={graphData}
          backgroundColor="rgba(0,0,0,0)"
          nodeLabel="name"
          nodeColor="color"
          nodeRelSize={4}
          linkWidth={link => highlightNodes.has((link.source as any).id) || highlightNodes.has((link.target as any).id) ? 3 : 1}
          linkColor={link => highlightNodes.has((link.source as any).id) || highlightNodes.has((link.target as any).id) ? '#ccff00' : 'rgba(204, 255, 0, 0.05)'}
          linkDirectionalParticles={particleCount}
          linkDirectionalParticleSpeed={0.02}
          linkDirectionalParticleWidth={particleWidth}
          nodeThreeObject={nodeThreeObject}
          nodeThreeObjectExtend={true}
          onNodeClick={handleNodeClick}
          onNodeHover={setHoverNode}
          enableNodeDrag={false}
          showNavInfo={false}
        />
      </div>

      {/* Thought History Sidebar */}
      <div className="absolute top-16 left-4 bottom-24 w-48 z-10 pointer-events-none flex flex-col gap-2">
        <div className="flex items-center gap-2 px-2 mb-1">
          <Activity className="w-3 h-3 text-codex-neon" />
          <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Live Telemetry</span>
        </div>
        <div className="flex-1 overflow-y-auto pointer-events-auto space-y-2 scrollbar-none pr-2">
          {thoughtHistory.map((thought, i) => (
            <div 
              key={`${thought.timestamp}-${i}`}
              className={cn(
                "glass-panel p-2 text-[9px] leading-snug border-l-2 transition-all animate-in slide-in-from-left-2 duration-300",
                i === 0 ? "border-l-codex-neon bg-codex-neon/10 text-white/90" : "border-l-white/10 text-white/40 hover:text-white/60"
              )}
            >
              <div className="flex items-center justify-between mb-1 opacity-60">
                <span className="font-mono text-[9px]">{new Date(thought.timestamp).toLocaleTimeString()}</span>
                <span className="uppercase text-[9px] tracking-tighter bg-white/5 px-1 rounded">{thought.eventType}</span>
              </div>
              <p className="line-clamp-3">{thought.message}</p>
            </div>
          ))}
          {thoughtHistory.length === 0 && (
            <div className="text-[9px] text-white/20 italic px-2">Awaiting synaptic events...</div>
          )}
        </div>
      </div>

      {/* Thought Bubble Overlay */}
      {activeThought && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none w-full max-w-lg px-8 animate-in zoom-in-95 fade-in duration-500">
          <div className="glass-panel p-6 bg-codex-neon/10 border-codex-neon/30 backdrop-blur-xl shadow-[0_0_50px_var(--codex-neon-glow)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 rounded-full bg-codex-neon animate-pulse" />
              <span className="text-[10px] font-black text-codex-neon uppercase tracking-widest">Active Reasoning Step</span>
            </div>
            <p className="text-lg font-medium text-white/90 leading-relaxed italic">
              "{activeThought.message}"
            </p>
            {activeThought.nodeIds.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {activeThought.nodeIds.map(id => {
                  const node = graphData.nodes.find(n => n.id === id)
                  return (
                    <span key={id} className="text-[9px] px-2 py-0.5 rounded-full bg-codex-neon/20 text-codex-neon border border-codex-neon/30 font-bold">
                      {node?.name || 'Resolving...'}
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend & Stats */}
      <div className="absolute top-16 left-4 z-10 space-y-2">
        <div className="glass-panel p-2 flex flex-col gap-1 border-white/5">
          <div className="flex items-center gap-2 px-1">
            <div className="w-1.5 h-1.5 rounded-full bg-codex-neon" />
            <span className="text-[9px] font-bold text-white/40 uppercase">Features</span>
          </div>
          <div className="flex items-center gap-2 px-1">
            <div className="w-1.5 h-1.5 rounded-full bg-codex-neon/60" />
            <span className="text-[9px] font-bold text-white/40 uppercase">Specs</span>
          </div>
          <div className="flex items-center gap-2 px-1">
            <div className="w-1.5 h-1.5 rounded-full bg-codex-neon/40" />
            <span className="text-[9px] font-bold text-white/40 uppercase">Tasks</span>
          </div>
        </div>

        <div className="glass-panel p-2 flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[9px] text-white/30 uppercase font-bold">Nodes</span>
            <span className="text-xs font-bold text-white/80 tabular-nums">{graphData.nodes.length}</span>
          </div>
          <div className="w-px h-6 bg-white/5" />
          <div className="flex flex-col">
            <span className="text-[9px] text-white/30 uppercase font-bold">Synapses</span>
            <span className="text-xs font-bold text-white/80 tabular-nums">{graphData.links.length}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
