import React, { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Network, 
  Plus, 
  Trash2, 
  Zap, 
  ShieldCheck, 
  Maximize2, 
  Minimize2,
  Save,
  RefreshCw,
  Lightbulb,
  FileEdit,
  PenTool,
  CheckCircle2
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type { 
  BrainstormCanvas as CanvasType, 
  BrainstormCanvasNode as NodeType, 
  BrainstormCanvasEdge as EdgeType,
  ExtendedApi, 
  GsdSeed, 
  KSpecDraft 
} from '../../api/types'

interface BrainstormCanvasProps {
  api: ExtendedApi
  projectPath: string
  canvas: CanvasType
  seeds: GsdSeed[]
  drafts: KSpecDraft[]
  onRefresh: () => Promise<void>
}

export function BrainstormCanvas({ 
  api, 
  projectPath, 
  canvas: initialCanvas, 
  seeds, 
  drafts,
  onRefresh 
}: BrainstormCanvasProps) {
  const [canvas, setCanvas] = useState<CanvasType>(initialCanvas)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isProcessing, setIsProcessing] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    setCanvas(initialCanvas)
  }, [initialCanvas])

  const saveCanvas = async (newCanvas: CanvasType) => {
    setIsSaving(true)
    try {
      await api.brainstormSaveCanvas(projectPath, newCanvas)
    } catch (err) {
      console.error('Failed to save canvas:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleNodeDrag = (id: string, info: any) => {
    const newNodes = canvas.nodes.map(node => {
      if (node.id === id) {
        return {
          ...node,
          x: node.x + info.delta.x / zoom,
          y: node.y + info.delta.y / zoom
        }
      }
      return node
    })
    const newCanvas = { ...canvas, nodes: newNodes }
    setCanvas(newCanvas)
  }

  const handleNodeDragEnd = () => {
    saveCanvas(canvas)
  }

  const addNodeFromSeed = (seed: GsdSeed) => {
    const id = `node-seed-${seed.id || Math.random().toString(36).substr(2, 9)}`
    if (canvas.nodes.find(n => n.sourceId === seed.id)) return

    const newNode: NodeType = {
      id,
      nodeType: 'seed',
      title: seed.title,
      content: seed.why || '',
      x: 50 + Math.random() * 100,
      y: 50 + Math.random() * 100,
      width: 160,
      height: 80,
      sourceId: seed.id
    }

    const newCanvas = { ...canvas, nodes: [...canvas.nodes, newNode] }
    setCanvas(newCanvas)
    saveCanvas(newCanvas)
  }

  const addNodeFromDraft = (draft: KSpecDraft) => {
    const id = `node-draft-${draft.id || Math.random().toString(36).substr(2, 9)}`
    if (canvas.nodes.find(n => n.sourceId === draft.id)) return

    const newNode: NodeType = {
      id,
      nodeType: 'draft',
      title: draft.title,
      content: draft.content.substring(0, 100) + '...',
      x: 50 + Math.random() * 100,
      y: 50 + Math.random() * 100,
      width: 180,
      height: 100,
      sourceId: draft.id
    }

    const newCanvas = { ...canvas, nodes: [...canvas.nodes, newNode] }
    setCanvas(newCanvas)
    saveCanvas(newCanvas)
  }

  const deleteNode = (id: string) => {
    const newNodes = canvas.nodes.filter(n => n.id !== id)
    const newEdges = canvas.edges.filter(e => e.fromNode !== id && e.toNode !== id)
    const newCanvas = { nodes: newNodes, edges: newEdges }
    setCanvas(newCanvas)
    saveCanvas(newCanvas)
    if (selectedNodeId === id) setSelectedNodeId(null)
  }

  const handleArchitectReview = async (node: NodeType) => {
    setIsProcessing('review')
    try {
      const reviewNode = await api.brainstormArchitectReview(
        projectPath, 
        node.id, 
        node.nodeType, 
        node.title, 
        node.content
      )
      
      const updatedNodes = [...canvas.nodes, {
        ...reviewNode,
        x: node.x + 220,
        y: node.y
      }]
      
      const newEdge: EdgeType = {
        id: `edge-${Date.now()}`,
        fromNode: node.id,
        toNode: reviewNode.id,
        label: 'review'
      }

      const newCanvas = { 
        nodes: updatedNodes, 
        edges: [...canvas.edges, newEdge] 
      }
      setCanvas(newCanvas)
      saveCanvas(newCanvas)
    } catch (err) {
      console.error('Architect review failed:', err)
    } finally {
      setIsProcessing(null)
    }
  }

  const handleAgenticSketch = async (node: NodeType) => {
    setIsProcessing('sketch')
    try {
      const sketchNode = await api.brainstormAgenticSketch(
        projectPath, 
        node.id, 
        node.title, 
        node.content
      )
      
      const updatedNodes = [...canvas.nodes, {
        ...sketchNode,
        x: node.x,
        y: node.y + 120
      }]
      
      const newEdge: EdgeType = {
        id: `edge-${Date.now()}`,
        fromNode: node.id,
        toNode: sketchNode.id,
        label: 'sketch'
      }

      const newCanvas = { 
        nodes: updatedNodes, 
        edges: [...canvas.edges, newEdge] 
      }
      setCanvas(newCanvas)
      saveCanvas(newCanvas)
    } catch (err) {
      console.error('Agentic sketch failed:', err)
    } finally {
      setIsProcessing(null)
    }
  }

  const selectedNode = useMemo(() => 
    canvas.nodes.find(n => n.id === selectedNodeId), 
    [canvas.nodes, selectedNodeId]
  )

  return (
    <div className="flex flex-col h-[500px] bg-black/20 rounded-2xl border border-white/5 overflow-hidden relative">
      {/* Canvas Header/Toolbar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-1 p-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10">
            <button 
              onClick={() => setZoom(z => Math.min(z + 0.1, 2))}
              className="p-1.5 hover:bg-white/10 rounded text-white/40 hover:text-white transition-colors"
              title="Zoom In"
            >
              <Plus size={14} />
            </button>
            <div className="px-2 text-[10px] font-mono text-white/20 min-w-[40px] text-center">
              {Math.round(zoom * 100)}%
            </div>
            <button 
              onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))}
              className="p-1.5 hover:bg-white/10 rounded text-white/40 hover:text-white transition-colors"
              title="Zoom Out"
            >
              <Trash2 size={14} className="rotate-45" /> {/* Using Trash2 rotated as a minus placeholder since Minus isn't imported */}
            </button>
          </div>
          
          <div className="flex items-center gap-1 p-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10">
            <button 
              onClick={onRefresh}
              className="p-1.5 hover:bg-white/10 rounded text-white/40 hover:text-white transition-colors"
              title="Sync All Data"
            >
              <RefreshCw size={14} />
            </button>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <div className="flex items-center gap-1 px-1">
              <span className="text-[9px] font-bold text-white/20 uppercase tracking-tighter">Inventory:</span>
              <div className="flex -space-x-1">
                {seeds.filter(s => !canvas.nodes.find(n => n.sourceId === s.id)).map(seed => (
                  <button 
                    key={seed.id}
                    onClick={() => addNodeFromSeed(seed)}
                    className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 hover:scale-110 hover:z-10 transition-all shadow-lg"
                    title={`Add Seed: ${seed.title}`}
                  >
                    <Lightbulb size={10} />
                  </button>
                ))}
                {drafts.filter(d => !canvas.nodes.find(n => n.sourceId === d.id)).map(draft => (
                  <button 
                    key={draft.id}
                    onClick={() => addNodeFromDraft(draft)}
                    className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 hover:scale-110 hover:z-10 transition-all shadow-lg"
                    title={`Add Draft: ${draft.title}`}
                  >
                    <FileEdit size={10} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-auto">
          {isSaving && (
            <div className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center gap-2 animate-pulse">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Auto-saving</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Workspace Area */}
      <div 
        ref={canvasRef}
        className="flex-1 overflow-hidden relative cursor-grab active:cursor-grabbing"
        onMouseDown={() => setSelectedNodeId(null)}
      >
        <div 
          className="absolute inset-0 transition-transform duration-200"
          style={{ 
            transform: `scale(${zoom})`,
            transformOrigin: '0 0',
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: '30px 30px'
          }}
        >
          {/* Edges layer */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="rgba(255,255,255,0.1)" />
              </marker>
            </defs>
            {canvas.edges.map(edge => {
              const fromNode = canvas.nodes.find(n => n.id === edge.fromNode)
              const toNode = canvas.nodes.find(n => n.id === edge.toNode)
              if (!fromNode || !toNode) return null

              const x1 = fromNode.x + fromNode.width / 2
              const y1 = fromNode.y + fromNode.height / 2
              const x2 = toNode.x + toNode.width / 2
              const y2 = toNode.y + toNode.height / 2

              return (
                <g key={edge.id}>
                  <line 
                    x1={x1} y1={y1} x2={x2} y2={y2} 
                    stroke="rgba(255,255,255,0.1)" 
                    strokeWidth="1.5" 
                    strokeDasharray="4 4"
                    markerEnd="url(#arrowhead)"
                  />
                  {edge.label && (
                    <text 
                      x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 5}
                      className="text-[8px] fill-white/20 font-bold uppercase"
                      textAnchor="middle"
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>

          {/* Nodes layer */}
          <AnimatePresence>
            {canvas.nodes.map(node => (
              <motion.div
                key={node.id}
                drag
                dragMomentum={false}
                onDrag={(e, info) => handleNodeDrag(node.id, info)}
                onDragEnd={handleNodeDragEnd}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedNodeId(node.id)
                }}
                className={cn(
                  "brainstorm-node cursor-pointer group",
                  selectedNodeId === node.id && "brainstorm-node-selected border-white/40 ring-4 ring-white/5",
                  node.nodeType === 'draft' && "brainstorm-node-draft",
                  node.nodeType === 'sketch' && "brainstorm-node-sketch",
                  node.nodeType === 'review' && "brainstorm-node-review"
                )}
                style={{ 
                  left: node.x, 
                  top: node.y, 
                  width: node.width,
                  height: node.height
                }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="brainstorm-node-type">
                    {node.nodeType}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteNode(node.id)
                      }}
                      className="p-1 hover:bg-red-500/20 rounded text-white/20 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
                <div className="brainstorm-node-title">{node.title}</div>
                <div className="brainstorm-node-body">{node.content}</div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Selected Node Sidebar/Panel */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div 
            initial={{ x: 300 }}
            animate={{ x: 0 }}
            exit={{ x: 300 }}
            className="absolute top-0 right-0 bottom-0 w-64 bg-black/80 backdrop-blur-2xl border-l border-white/10 z-20 p-4 shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                <Network size={12} className="text-indigo-400" />
                Node Inspector
              </h4>
              <button 
                onClick={() => setSelectedNodeId(null)}
                className="p-1 hover:bg-white/5 rounded text-white/20 hover:text-white transition-colors"
              >
                <Minimize2 size={12} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4">
              <div>
                <div className="text-[11px] font-bold text-white mb-1">{selectedNode.title}</div>
                <div className="text-[10px] text-white/40 leading-relaxed italic border-l-2 border-white/5 pl-2 mb-4">
                  {selectedNode.content}
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <div className="text-[9px] font-bold text-white/20 uppercase tracking-widest mb-2">Agentic Actions</div>
                
                <button 
                  onClick={() => handleArchitectReview(selectedNode)}
                  disabled={!!isProcessing}
                  className="w-full flex items-center gap-3 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 hover:bg-amber-500/20 transition-all text-[10px] font-bold disabled:opacity-50"
                >
                  <ShieldCheck size={14} className={cn(isProcessing === 'review' && "animate-spin")} />
                  Architect Review
                </button>

                <button 
                  onClick={() => handleAgenticSketch(selectedNode)}
                  disabled={!!isProcessing}
                  className="w-full flex items-center gap-3 p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 hover:bg-cyan-500/20 transition-all text-[10px] font-bold disabled:opacity-50"
                >
                  <PenTool size={14} className={cn(isProcessing === 'sketch' && "animate-spin")} />
                  Agentic Sketch
                </button>

                {selectedNode.nodeType === 'seed' && (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-[9px] text-white/30 italic">
                    This is a raw seed. Run Architect Review to refine the technical approach.
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 mt-4">
              <div className="flex items-center justify-between text-[9px] text-white/20">
                <span>POS: {Math.round(selectedNode.x)}, {Math.round(selectedNode.y)}</span>
                <span>ID: {selectedNode.id.substring(0, 8)}...</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {canvas.nodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
          <motion.div 
            animate={{ 
              y: [0, -10, 0],
              opacity: [0.2, 0.4, 0.2]
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Network size={48} className="text-white/20 mb-4" />
          </motion.div>
          <h3 className="text-xs font-bold text-white/40 mb-2">Visual Workspace Empty</h3>
          <p className="text-[10px] text-white/20 leading-relaxed max-w-[240px] mb-6">
            Start mind-mapping by adding seeds or drafts from the inventory toolbar above.
          </p>
          <div className="grid grid-cols-2 gap-3 w-full max-w-[300px]">
             <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10 text-left">
                <Lightbulb size={12} className="text-indigo-400/60 mb-2" />
                <div className="text-[9px] font-bold text-indigo-300/80 mb-1">Seeds</div>
                <div className="text-[8px] text-white/20">Raw ideas waiting for architectural refinement.</div>
             </div>
             <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/10 text-left">
                <FileEdit size={12} className="text-purple-400/60 mb-2" />
                <div className="text-[9px] font-bold text-purple-300/80 mb-1">Drafts</div>
                <div className="text-[8px] text-white/20">KSpec modules being drafted for implementation.</div>
             </div>
          </div>
        </div>
      )}
    </div>
  )
}
