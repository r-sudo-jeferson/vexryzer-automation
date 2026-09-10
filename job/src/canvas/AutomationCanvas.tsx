import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeChange,
  type ReactFlowInstance,
  type Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { createCameraPlan, type CameraMode } from './camera.ts';
import type { ProcessFixture } from './fixtures.ts';
import type { ProcessGraph } from './domain.ts';
import type { CanvasNodeSemanticOverlay } from './reactive-graph-adapter.ts';
import { layoutProcessGraph } from './layout.ts';
import { resolveZoomBand, type ZoomBand } from './semantic-zoom.ts';
import { OriginNode, type OriginFlowNode } from './nodes/OriginNode.tsx';
import { ProcessNode, processNodeAccessibleLabel, type ProcessFlowNode } from './nodes/ProcessNode.tsx';
import type { MotionPolicy } from '../accessibility/motion-policy.ts';
import './canvas.css';

type CanvasNode = OriginFlowNode | ProcessFlowNode;

const nodeTypes = {
  origin: OriginNode,
  process: ProcessNode,
};

interface AutomationCanvasProps {
  fixture: ProcessFixture;
  graph?: ProcessGraph;
  semanticOverlays?: readonly Readonly<CanvasNodeSemanticOverlay>[];
  mode: CameraMode;
  focusedNodeId: string | null;
  motionPolicy: MotionPolicy;
  onFocusNode: (nodeId: string) => void;
}

function CanvasSurface({
  fixture,
  graph: graphOverride,
  semanticOverlays = [],
  mode,
  focusedNodeId,
  motionPolicy,
  onFocusNode,
}: AutomationCanvasProps) {
  const graph = graphOverride ?? fixture.graph;
  const [instance, setInstance] = useState<ReactFlowInstance<CanvasNode, Edge> | null>(null);
  const [zoomBand, setZoomBand] = useState<ZoomBand>('medium');
  const zoomBandRef = useRef<ZoomBand>('medium');
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const userInterruptedRef = useRef(false);
  const lastCameraIntentRef = useRef<string | null>(null);
  const observedInitialSizeRef = useRef(false);
  const [viewportRevision, setViewportRevision] = useState(0);
  const [directedMobile, setDirectedMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 720px), (pointer: coarse)').matches);
  const graphIntentKey = useMemo(
    () => graph.nodes.map((node) => node.id).join('|') + '::' + graph.edges.map((edge) => edge.id).join('|'),
    [graph],
  );
  const cameraIntent = `${mode}:${focusedNodeId ?? 'none'}:${motionPolicy.reduced ? 'reduced' : 'standard'}:${directedMobile ? 'directed-mobile' : 'canvas'}:${graphIntentKey}`;
  const processNodeIds = useMemo(() => new Set(graph.nodes.map((node) => node.id)), [graph]);
  const overlayByNodeId = useMemo(
    () => new Map(semanticOverlays.map((overlay) => [overlay.nodeId, overlay] as const)),
    [semanticOverlays],
  );
  const stepCount = graph.nodes.length;

  useEffect(() => {
    if (window.__VXA_PERF__) window.__VXA_PERF__.canvasCommits += 1;
  });

  useEffect(() => {
    const media = window.matchMedia('(max-width: 720px), (pointer: coarse)');
    const update = () => setDirectedMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (!observedInitialSizeRef.current) {
        observedInitialSizeRef.current = true;
        return;
      }
      setViewportRevision((revision) => revision + 1);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const nodes = useMemo<CanvasNode[]>(() => {
    const positions = layoutProcessGraph(graph, { columns: directedMobile ? 2 : 4 });
    const processNodes: ProcessFlowNode[] = graph.nodes.map((model) => ({
      id: model.id,
      type: 'process',
      position: positions.get(model.id) ?? { x: 0, y: 0 },
      data: {
        model,
        zoomBand,
        muted: mode === 'origin'
          || (mode === 'focus' && focusedNodeId !== model.id)
          || overlayByNodeId.get(model.id)?.deEmphasized === true,
        overlay: overlayByNodeId.get(model.id),
      },
      selected: mode === 'focus' && focusedNodeId === model.id,
      draggable: false,
      connectable: false,
      selectable: mode !== 'origin',
      focusable: mode !== 'origin',
      ariaLabel: processNodeAccessibleLabel(model, overlayByNodeId.get(model.id)),
      deletable: false,
    }));

    if (mode !== 'origin') return processNodes;

    const origin: OriginFlowNode = {
      id: 'origin',
      type: 'origin',
      position: { x: -440, y: -40 },
      data: { muted: false },
      draggable: false,
      connectable: false,
      selectable: false,
      focusable: true,
      deletable: false,
    };

    return [origin, ...processNodes];
  }, [directedMobile, focusedNodeId, graph, mode, overlayByNodeId, zoomBand]);

  const edges = useMemo<Edge[]>(() => graph.edges.map((edge) => ({
    ...edge,
    type: 'smoothstep',
    selectable: false,
    focusable: false,
    deletable: false,
    animated: false,
    style: { strokeWidth: 1.25 },
  })), [graph]);

  useEffect(() => {
    if (!instance) return;

    const intentChanged = lastCameraIntentRef.current !== cameraIntent;
    if (intentChanged) {
      lastCameraIntentRef.current = cameraIntent;
      userInterruptedRef.current = false;
    } else if (userInterruptedRef.current) {
      return;
    }

    if (window.__VXA_PERF__) {
      window.__VXA_PERF__.cameraCommands += 1;
      if (!intentChanged && viewportRevision > 0) window.__VXA_PERF__.cameraResizeRefits += 1;
    }

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
  }, [cameraIntent, focusedNodeId, instance, mode, motionPolicy.reduced, viewportRevision]);

  const handleMoveStart = (event: MouseEvent | TouchEvent | null) => {
    if (!event || !instance) return;
    userInterruptedRef.current = true;
    if (window.__VXA_PERF__) window.__VXA_PERF__.cameraInterruptions += 1;
    void instance.setViewport(instance.getViewport(), { duration: 0 });
  };

  const handleViewport = (_event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
    if (window.__VXA_PERF__) window.__VXA_PERF__.viewportEvents += 1;
    const next = resolveZoomBand(viewport.zoom, zoomBandRef.current);
    if (next !== zoomBandRef.current) {
      if (window.__VXA_PERF__) window.__VXA_PERF__.semanticBandChanges += 1;
      zoomBandRef.current = next;
      setZoomBand(next);
    }
  };

  const handleNodesChange = (changes: NodeChange<CanvasNode>[]) => {
    const selected = changes.find((change) => change.type === 'select' && change.selected && processNodeIds.has(change.id));
    if (selected?.type === 'select' && selected.id !== focusedNodeId) onFocusNode(selected.id);
  };

  return (
    <div ref={canvasRef} className="vxa-canvas" data-mode={mode} data-zoom-band={zoomBand}>
      <ReactFlow<CanvasNode, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={setInstance}
        onMoveStart={handleMoveStart}
        onMove={handleViewport}
        onNodesChange={handleNodesChange}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable
        edgesReconnectable={false}
        elementsSelectable
        selectionOnDrag={false}
        autoPanOnNodeFocus
        panOnDrag={[0, 1]}
        panOnScroll={false}
        zoomOnScroll={!directedMobile}
        zoomOnPinch
        zoomOnDoubleClick={false}
        minZoom={0.42}
        maxZoom={1.4}
        preventScrolling={!directedMobile}
        fitView={false}
        aria-label="Mapa visual do processo"
        proOptions={{ hideAttribution: false }}
      >
        <Background variant={BackgroundVariant.Dots} gap={28} size={0.9} />
      </ReactFlow>
      <div className="vxa-canvas__status" aria-live="polite">
        <span>{zoomBand}</span>
        <span>{stepCount} {stepCount === 1 ? 'etapa' : 'etapas'}</span>
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
