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
  Minus,
  CheckCircle2,
  Share,
  PlusSquare
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
  onPromoteToDraft?: (seed: GsdSeed) => Promise<void>
  onPromoteToTask?: (seed: GsdSeed) => Promise<void>
}

export function BrainstormCanvas({ 
  api, 
  projectPath, 
  canvas: initialCanvas, 
  seeds, 
  drafts,
  onRefresh,
  onPromoteToDraft,
  onPromoteToTask
}: BrainstormCanvasProps) {
  const [canvas, setCanvas] = useState<CanvasType>(initialCanvas)
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isProcessing, setIsProcessing] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    setCanvas(initialCanvas)
  }, [initialCanvas])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return
      
      if ((e.key === 'Delete' || e.key === 'Backspace')) {
        if (selectedNodeIds.length > 0) {
          deleteNode(selectedNodeIds[0])
        } else if (selectedEdgeId) {
          deleteEdge(selectedEdgeId)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedNodeIds, selectedEdgeId, canvas])

  const updateNode = (id: string, updates: Partial<BrainstormCanvasNode>) => {
    const newNodes = canvas.nodes.map(n => n.id === id ? { ...n, ...updates } : n)
    const newCanvas = { ...canvas, nodes: newNodes }
    setCanvas(newCanvas)
    saveCanvas(newCanvas)
  }

  const addManualNode = () => {
    const id = `manual-${Date.now()}`
    const newNode: BrainstormCanvasNode = {
      id,
      sourceId: id,
      nodeType: 'seed',
      title: 'New Idea',
      content: 'Double click to edit in inspector...',
      x: 50 / zoom,
      y: 50 / zoom,
      width: 150,
      height: 100
    }
    const newCanvas = { ...canvas, nodes: [...canvas.nodes, newNode] }
    setCanvas(newCanvas)
    saveCanvas(newCanvas)
    setSelectedNodeIds([id])
  }

  const deleteEdge = (id: string) => {
    const newEdges = canvas.edges.filter(e => e.id !== id)
    const newCanvas = { ...canvas, edges: newEdges }
    setCanvas(newCanvas)
    saveCanvas(newCanvas)
    setSelectedEdgeId(null)
  }

  const updateEdgeLabel = (id: string, label: string) => {
    const newEdges = canvas.edges.map(e => e.id === id ? { ...e, label } : e)
    const newCanvas = { ...canvas, edges: newEdges }
    setCanvas(newCanvas)
    saveCanvas(newCanvas)
  }

  const handleExport = () => {
    let mermaid = 'graph TD\n'
    canvas.nodes.forEach(node => {
      const label = node.title.replace(/[()\[\]]/g, '')
      mermaid += `  ${node.id.substring(0, 8)}["${label} (${node.nodeType})"]\n`
    })
    canvas.edges.forEach(edge => {
      const label = edge.label ? ` -- "${edge.label}" --> ` : ' --> '
      mermaid += `  ${edge.fromNode.substring(0, 8)}${label}${edge.toNode.substring(0, 8)}\n`
    })

    const report = `# Brainstorm Topology Export\n\nGenerated on ${new Date().toLocaleString()}\n\n\`\`\`mermaid\n${mermaid}\`\`\`\n\n## Node Details\n\n` + 
      canvas.nodes.map(n => `### ${n.title} (${n.nodeType})\n${n.content}`).join('\n\n')

    navigator.clipboard.writeText(report)
    alert('Topology exported as Mermaid Markdown to clipboard!')
  }

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
    const deltaX = info.delta.x / zoom
    const deltaY = info.delta.y / zoom
    const isPartOfSelection = selectedNodeIds.includes(id)

    const newNodes = canvas.nodes.map(node => {
      if (node.id === id || (isPartOfSelection && selectedNodeIds.includes(node.id))) {
        return {
          ...node,
          x: node.x + deltaX,
          y: node.y + deltaY
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
    const idsToDelete = selectedNodeIds.includes(id) ? selectedNodeIds : [id]
    const newNodes = canvas.nodes.filter(n => !idsToDelete.includes(n.id))
    const newEdges = canvas.edges.filter(e => !idsToDelete.includes(e.fromNode) && !idsToDelete.includes(e.toNode))
    const newCanvas = { nodes: newNodes, edges: newEdges }
    setCanvas(newCanvas)
    saveCanvas(newCanvas)
    setSelectedNodeIds(prev => prev.filter(selectedId => !idsToDelete.includes(selectedId)))
  }

  const handleArchitectReview = async (node: NodeType) => {
    setIsProcessing('review')
    if (!api.brainstormArchitectReview) {
      console.warn('Architect Review API not available');
      setIsProcessing(null);
      return;
    }
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
    if (!api.brainstormAgenticSketch) {
      console.warn('Agentic Sketch API not available');
      setIsProcessing(null);
      return;
    }
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

  const handlePromote = async (type: 'draft' | 'task') => {
    if (!selectedNode || selectedNode.nodeType !== 'seed') return
    const seed = seeds.find(s => s.id === selectedNode.sourceId)
    if (!seed) return

    setIsProcessing(type)
    try {
      if (type === 'draft' && onPromoteToDraft) {
        await onPromoteToDraft(seed)
      } else if (type === 'task' && onPromoteToTask) {
        await onPromoteToTask(seed)
      }
    } catch (err) {
      console.error(`Failed to promote node to ${type}:`, err)
    } finally {
      setIsProcessing(null)
    }
  }

  const selectedNodes = useMemo(() => 
    canvas.nodes.filter(n => selectedNodeIds.includes(n.id)), 
    [canvas.nodes, selectedNodeIds]
  )

  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null

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
              <Minus size={14} />
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
            <button 
              onClick={addManualNode}
              className="p-1.5 hover:bg-white/10 rounded text-white/40 hover:text-white transition-colors"
              title="Add New Note"
            >
              <PlusSquare size={14} />
            </button>
            <button 
              onClick={handleExport}
              className="p-1.5 hover:bg-white/10 rounded text-white/40 hover:text-white transition-colors"
              title="Export Topology (Mermaid)"
            >
              <Share size={14} />
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
        onMouseDown={() => {
          setSelectedNodeIds([])
          setSelectedEdgeId(null)
        }}
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
          <svg className="absolute inset-0 w-full h-full overflow-visible">
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
                <g key={edge.id} className="group/edge cursor-pointer">
                  {/* Invisible thick hit area */}
                  <line 
                    x1={x1} y1={y1} x2={x2} y2={y2} 
                    stroke="transparent" 
                    strokeWidth="15" 
                    className="pointer-events-auto"
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      setSelectedEdgeId(edge.id)
                      setSelectedNodeIds([])
                    }}
                  />
                  <line 
                    x1={x1} y1={y1} x2={x2} y2={y2} 
                    stroke={selectedEdgeId === edge.id ? "rgba(168, 85, 247, 0.6)" : "rgba(255,255,255,0.1)"} 
                    strokeWidth={selectedEdgeId === edge.id ? "2" : "1.5"} 
                    strokeDasharray={selectedEdgeId === edge.id ? "none" : "4 4"}
                    markerEnd="url(#arrowhead)"
                    className="transition-all duration-200"
                  />
                  {edge.label && selectedEdgeId !== edge.id && (
                    <text 
                      x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 8}
                      className="text-[8px] fill-white/40 font-bold uppercase pointer-events-none"
                      textAnchor="middle"
                    >
                      {edge.label}
                    </text>
                  )}
                  {selectedEdgeId === edge.id && (
                    <foreignObject 
                      x={(x1 + x2) / 2 - 40} y={(y1 + y2) / 2 - 15} 
                      width="80" height="30"
                      className="overflow-visible pointer-events-auto"
                    >
                      <input
                        autoFocus
                        defaultValue={edge.label || ''}
                        onBlur={(e) => updateEdgeLabel(edge.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            updateEdgeLabel(edge.id, e.currentTarget.value)
                            setSelectedEdgeId(null)
                          }
                          if (e.key === 'Escape') {
                            setSelectedEdgeId(null)
                          }
                        }}
                        className="w-full bg-purple-900/80 border border-purple-500/50 rounded px-1 py-0.5 text-[9px] text-white font-bold uppercase text-center outline-none shadow-lg backdrop-blur-sm"
                        placeholder="label..."
                      />
                    </foreignObject>
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
                  if (e.ctrlKey || e.metaKey) {
                    setSelectedNodeIds(prev => 
                      prev.includes(node.id) ? prev.filter(id => id !== node.id) : [...prev, node.id]
                    )
                  } else {
                    setSelectedNodeIds([node.id])
                  }
                }}
                className={cn(
                  "brainstorm-node cursor-pointer group",
                  selectedNodeIds.includes(node.id) && "brainstorm-node-selected border-white/40 ring-4 ring-white/5",
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
        {selectedNodeIds.length > 0 && (
          <motion.div 
            initial={{ x: 300 }}
            animate={{ x: 0 }}
            exit={{ x: 300 }}
            className="absolute top-0 right-0 bottom-0 w-64 bg-black/80 backdrop-blur-2xl border-l border-white/10 z-20 p-4 shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                <Network size={12} className="text-indigo-400" />
                {selectedNodeIds.length === 1 ? 'Node Inspector' : `Selection (${selectedNodeIds.length})`}
              </h4>
              <button 
                onClick={() => setSelectedNodeIds([])}
                className="p-1 hover:bg-white/5 rounded text-white/20 hover:text-white transition-colors"
              >
                <Minimize2 size={12} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4">
              {selectedNode ? (
                <>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[8px] font-bold text-white/20 uppercase tracking-widest mb-1 block">Title</label>
                      <input 
                        value={selectedNode.title}
                        onChange={(e) => updateNode(selectedNode.id, { title: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-indigo-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] font-bold text-white/20 uppercase tracking-widest mb-1 block">Content</label>
                      <textarea 
                        value={selectedNode.content}
                        rows={6}
                        onChange={(e) => updateNode(selectedNode.id, { content: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[10px] text-white/70 focus:outline-none focus:border-indigo-500/50 leading-relaxed resize-none custom-scrollbar"
                      />
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
                      <div className="space-y-2 pt-2 border-t border-white/5 mt-2">
                        <div className="text-[9px] font-bold text-white/20 uppercase tracking-widest mb-2">Promote Idea</div>
                        
                        <button 
                          onClick={() => handlePromote('draft')}
                          disabled={!!isProcessing}
                          className="w-full flex items-center gap-3 p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 hover:bg-purple-500/20 transition-all text-[10px] font-bold disabled:opacity-50"
                        >
                          <FileEdit size={14} className={cn(isProcessing === 'draft' && "animate-spin")} />
                          Promote to Draft
                        </button>

                        <button 
                          onClick={() => handlePromote('task')}
                          disabled={!!isProcessing}
                          className="w-full flex items-center gap-3 p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/20 transition-all text-[10px] font-bold disabled:opacity-50"
                        >
                          <CheckCircle2 size={14} className={cn(isProcessing === 'task' && "animate-spin")} />
                          Convert to Task
                        </button>
                      </div>
                    )}

                    {selectedNode.nodeType === 'seed' && (
                      <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-[9px] text-white/30 italic">
                        This is a raw seed. Run Architect Review to refine the technical approach.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-[10px] text-white/40 leading-relaxed italic">
                    {selectedNodeIds.length} nodes selected. You can move them together or perform bulk operations.
                  </div>
                  
                  <button 
                    onClick={() => deleteNode(selectedNodeIds[0])}
                    className="w-full flex items-center gap-3 p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 hover:bg-red-500/20 transition-all text-[10px] font-bold"
                  >
                    <Trash2 size={14} />
                    Delete Selected
                  </button>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-white/5 mt-4">
              <div className="flex items-center justify-between text-[9px] text-white/20">
                {selectedNode ? (
                  <>
                    <span>POS: {Math.round(selectedNode.x)}, {Math.round(selectedNode.y)}</span>
                    <span>ID: {selectedNode.id.substring(0, 8)}...</span>
                  </>
                ) : (
                  <span>Bulk Selection Active</span>
                )}
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
