import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  BrainstormCanvas as CanvasType,
  GsdSeed,
  KSpecDraft,
  BrainstormCanvasNode as NodeType,
} from '../../api/types';

export function selectBrainstormNodes(
  canvas: CanvasType,
  selectedNodeIds: string[]
): NodeType[] {
  return canvas.nodes.filter((node) => selectedNodeIds.includes(node.id));
}

export function availableBrainstormSeeds(
  seeds: GsdSeed[],
  canvas: CanvasType
): GsdSeed[] {
  return seeds.filter(
    (seed) => !canvas.nodes.find((node) => node.sourceId === seed.id)
  );
}

export function availableBrainstormDrafts(
  drafts: KSpecDraft[],
  canvas: CanvasType
): KSpecDraft[] {
  return drafts.filter(
    (draft) => !canvas.nodes.find((node) => node.sourceId === draft.id)
  );
}

export function useBrainstormCanvasModel(
  initialCanvas: CanvasType,
  seeds: GsdSeed[],
  drafts: KSpecDraft[]
) {
  const [canvas, setCanvas] = useState<CanvasType>(initialCanvas);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCanvas(initialCanvas);
  }, [initialCanvas]);

  const selectedNodes = useMemo(
    () => selectBrainstormNodes(canvas, selectedNodeIds),
    [canvas, selectedNodeIds]
  );
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null;
  const availableSeeds = useMemo(
    () => availableBrainstormSeeds(seeds, canvas),
    [seeds, canvas]
  );
  const availableDrafts = useMemo(
    () => availableBrainstormDrafts(drafts, canvas),
    [drafts, canvas]
  );

  return {
    canvas,
    setCanvas,
    selectedNodeIds,
    setSelectedNodeIds,
    selectedEdgeId,
    setSelectedEdgeId,
    selectedNodes,
    selectedNode,
    availableSeeds,
    availableDrafts,
    isSaving,
    setIsSaving,
    isProcessing,
    setIsProcessing,
    zoom,
    setZoom,
    canvasRef,
  };
}
