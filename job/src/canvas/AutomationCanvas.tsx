import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type ReactFlowInstance,
  type Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { createCameraPlan, type CameraMode } from './camera.ts';
import type { ProcessFixture } from './fixtures.ts';
import { layoutProcessGraph } from './layout.ts';
import { resolveZoomBand, type ZoomBand } from './semantic-zoom.ts';
import { OriginNode, type OriginFlowNode } from './nodes/OriginNode.tsx';
import { ProcessNode, type ProcessFlowNode } from './nodes/ProcessNode.tsx';
import type { MotionPolicy } from '../accessibility/motion-policy.ts';
import './canvas.css';

type CanvasNode = OriginFlowNode | ProcessFlowNode;

const nodeTypes = {
  origin: OriginNode,
  process: ProcessNode,
};

interface AutomationCanvasProps {
  fixture: ProcessFixture;
  mode: CameraMode;
  focusedNodeId: string | null;
  motionPolicy: MotionPolicy;
  onFocusNode: (nodeId: string) => void;
}

function CanvasSurface({ fixture, mode, focusedNodeId, motionPolicy, onFocusNode }: AutomationCanvasProps) {
  const [instance, setInstance] = useState<ReactFlowInstance<CanvasNode, Edge> | null>(null);
  const [zoomBand, setZoomBand] = useState<ZoomBand>('medium');
  const zoomBandRef = useRef<ZoomBand>('medium');
  const [directedMobile, setDirectedMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 720px), (pointer: coarse)').matches);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 720px), (pointer: coarse)');
    const update = () => setDirectedMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const nodes = useMemo<CanvasNode[]>(() => {
    const positions = layoutProcessGraph(fixture.graph);
    const processNodes: ProcessFlowNode[] = fixture.graph.nodes.map((model) => ({
      id: model.id,
      type: 'process',
      position: positions.get(model.id) ?? { x: 0, y: 0 },
      data: {
        model,
        zoomBand,
        muted: mode === 'origin' || (mode === 'focus' && focusedNodeId !== model.id),
      },
      selected: mode === 'focus' && focusedNodeId === model.id,
      draggable: false,
      connectable: false,
      selectable: mode !== 'origin',
      focusable: mode !== 'origin',
      ariaLabel: `${model.label}. ${model.summary}`,
      deletable: false,
    }));

    const origin: OriginFlowNode = {
      id: 'origin',
      type: 'origin',
      position: { x: -440, y: -40 },
      data: { muted: mode !== 'origin' },
      draggable: false,
      connectable: false,
      selectable: false,
      focusable: mode === 'origin',
      deletable: false,
    };

    return [origin, ...processNodes];
  }, [fixture, focusedNodeId, mode, zoomBand]);

  const edges = useMemo<Edge[]>(() => fixture.graph.edges.map((edge) => ({
    ...edge,
    type: 'smoothstep',
    selectable: false,
    focusable: false,
    deletable: false,
    animated: false,
    style: { strokeWidth: 1.25 },
  })), [fixture]);

  useEffect(() => {
    if (!instance) return;
    const plan = createCameraPlan({
      mode,
      ...(focusedNodeId ? { focusNodeId: focusedNodeId } : {}),
      reducedMotion: motionPolicy.reduced,
    });
    const common = {
      padding: plan.padding,
      minZoom: plan.minZoom,
      maxZoom: plan.maxZoom,
      duration: plan.durationMs,
      interpolate: 'smooth' as const,
    };
    if (plan.kind === 'fit-nodes') {
      void instance.fitView({ ...common, nodes: plan.nodeIds.map((id) => ({ id })) });
      return;
    }
    const processNodes = instance.getNodes().filter((node) => node.type === 'process');
    if (processNodes.length > 0) void instance.fitView({ ...common, nodes: processNodes });
  }, [focusedNodeId, instance, mode, motionPolicy.reduced]);

  const handleViewport = (_event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
    const next = resolveZoomBand(viewport.zoom, zoomBandRef.current);
    if (next !== zoomBandRef.current) {
      zoomBandRef.current = next;
      setZoomBand(next);
    }
  };

  return (
    <div className="vxa-canvas" data-mode={mode} data-zoom-band={zoomBand}>
      <ReactFlow<CanvasNode, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={setInstance}
        onMove={handleViewport}
        onNodeClick={(_event, node) => node.type === 'process' && onFocusNode(node.id)}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesReconnectable={false}
        elementsSelectable
        selectionOnDrag={false}
        panOnDrag={directedMobile ? false : [0, 1]}
        panOnScroll={false}
        zoomOnScroll={!directedMobile}
        zoomOnPinch={!directedMobile}
        zoomOnDoubleClick={false}
        minZoom={0.42}
        maxZoom={1.4}
        preventScrolling={false}
        fitView={false}
        aria-label="Mapa visual do processo"
        proOptions={{ hideAttribution: false }}
      >
        <Background variant={BackgroundVariant.Dots} gap={28} size={0.9} />
      </ReactFlow>
      <div className="vxa-canvas__status" aria-live="polite">
        <span>{zoomBand}</span>
        <span>{fixture.graph.nodes.length} etapas</span>
      </div>
    </div>
  );
}

export function AutomationCanvas(props: AutomationCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasSurface {...props} />
    </ReactFlowProvider>
  );
}
