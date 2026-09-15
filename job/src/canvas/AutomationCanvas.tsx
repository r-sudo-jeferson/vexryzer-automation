import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
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
import { type CameraMode } from './camera.ts';
import { resolveCameraDirection, type CameraSceneComposition } from './camera-director.ts';
import type { ProcessFixture } from './fixtures.ts';
import type { ProcessGraph } from './domain.ts';
import type {
  CanvasNodeSemanticOverlay,
  CanvasOpportunity,
  CanvasQuantification,
} from './reactive-graph-adapter.ts';
import {
  OpportunityProofNode,
  ValueProofNode,
  opportunityProofAccessibleLabel,
  valueProofAccessibleLabel,
  type OpportunityProofFlowNode,
  type ValueProofFlowNode,
} from './EvidenceProofSurface.tsx';
import { layoutProcessGraph } from './layout.ts';
import { resolveZoomBand, type ZoomBand } from './semantic-zoom.ts';
import { OriginNode, type OriginFlowNode } from './nodes/OriginNode.tsx';
import { ProcessNode, processNodeAccessibleLabel, type ProcessFlowNode } from './nodes/ProcessNode.tsx';
import { SpatialAgentNode, type SpatialAgentFlowNode } from './nodes/SpatialAgentNode.tsx';
import { SPATIAL_AGENT_NODE_ID, resolveSpatialAgentPresence, type SpatialAgentStatus } from './spatial-agent-presence.ts';
import type { MotionPolicy } from '../accessibility/motion-policy.ts';
import './canvas.css';

type CanvasNode =
  | OriginFlowNode
  | ProcessFlowNode
  | SpatialAgentFlowNode
  | OpportunityProofFlowNode
  | ValueProofFlowNode;

const nodeTypes = {
  origin: OriginNode,
  process: ProcessNode,
  'agent-presence': SpatialAgentNode,
  'opportunity-proof': OpportunityProofNode,
  'value-proof': ValueProofNode,
};

interface AutomationCanvasProps {
  fixture: ProcessFixture;
  graph?: ProcessGraph;
  semanticOverlays?: readonly Readonly<CanvasNodeSemanticOverlay>[];
  opportunities?: readonly Readonly<CanvasOpportunity>[];
  globalQuantifications?: readonly Readonly<CanvasQuantification>[];
  mode: CameraMode;
  focusedNodeId: string | null;
  motionPolicy: MotionPolicy;
  onFocusNode: (nodeId: string) => void;
  semanticTargets?: readonly string[];
  sceneComposition?: CameraSceneComposition;
  sceneAnnouncement?: string | null;
  onInterrupt?: () => void;
  externalInterruptSignal?: number;
  agentStatus?: SpatialAgentStatus;
  agentNarration?: string | null;
  agentQuestion?: string | null;
}

// Viewport-intent keys: operating the surface with these claims the camera.
// Hover, Tab traversal, activation keys and modified shortcuts never interrupt:
// they neither displace the viewport nor take camera ownership.
const INTERRUPTING_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'PageUp', 'PageDown', 'Home', 'End', '+', '=', '-',
]);

function CanvasSurface({
  fixture,
  graph: graphOverride,
  semanticOverlays = [],
  opportunities = [],
  globalQuantifications = [],
  mode,
  focusedNodeId,
  motionPolicy,
  onFocusNode,
  semanticTargets = [],
  sceneComposition = 'stable',
  sceneAnnouncement = null,
  onInterrupt,
  externalInterruptSignal = 0,
  agentStatus = 'idle',
  agentNarration = null,
  agentQuestion = null,
}: AutomationCanvasProps) {
  const graph = graphOverride ?? fixture.graph;
  const [instance, setInstance] = useState<ReactFlowInstance<CanvasNode, Edge> | null>(null);
  const [zoomBand, setZoomBand] = useState<ZoomBand>('medium');
  const zoomBandRef = useRef<ZoomBand>('medium');
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const userInterruptedRef = useRef(false);
  const lastCameraIntentRef = useRef<string | null>(null);
  const announcementRef = useRef<string | null>(sceneAnnouncement);
  announcementRef.current = sceneAnnouncement;
  const onInterruptRef = useRef(onInterrupt);
  onInterruptRef.current = onInterrupt;
  const lastExternalSignalRef = useRef(externalInterruptSignal);
  const observedInitialSizeRef = useRef(false);
  const [viewportRevision, setViewportRevision] = useState(0);
  const [directedMobile, setDirectedMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 720px), (pointer: coarse)').matches);
  const graphIntentKey = useMemo(
    () => graph.nodes.map((node) => node.id).join('|') + '::' + graph.edges.map((edge) => edge.id).join('|'),
    [graph],
  );
  const semanticTargetsKey = useMemo(() => [...semanticTargets].join('|'), [semanticTargets]);
  const proofIntentKey = useMemo(
    () => [
      ...globalQuantifications.map((item) => `value:${item.calculationId}`),
      ...opportunities
        .filter((item) => item.status !== 'invalidated')
        .map((item) => `opportunity:${item.id}:${item.status}`),
    ].join('|'),
    [globalQuantifications, opportunities],
  );
  const cameraIntent = `${mode}:${focusedNodeId ?? 'none'}:${sceneComposition}:${semanticTargetsKey}:${proofIntentKey}:${motionPolicy.reduced ? 'reduced' : 'standard'}:${directedMobile ? 'directed-mobile' : 'canvas'}:${graphIntentKey}`;
  const processNodeIds = useMemo(() => new Set(graph.nodes.map((node) => node.id)), [graph]);
  const overlayByNodeId = useMemo(
    () => new Map(semanticOverlays.map((overlay) => [overlay.nodeId, overlay] as const)),
    [semanticOverlays],
  );
  const stepCount = graph.nodes.length;
  const processPositions = useMemo(
    () => layoutProcessGraph(graph, { columns: directedMobile ? 2 : 4 }),
    [directedMobile, graph],
  );
  const proofOrigin = useMemo(() => {
    const positions = [...processPositions.values()];
    if (positions.length === 0) return { x: 0, y: directedMobile ? 260 : 220 };
    return {
      x: Math.min(...positions.map((position) => position.x)),
      y: Math.max(...positions.map((position) => position.y)) + (directedMobile ? 300 : 260),
    };
  }, [directedMobile, processPositions]);
  const proofNodeIdsKey = useMemo(() => [
    ...globalQuantifications.map((item) => `proof-value-${item.calculationId}`),
    ...opportunities
      .filter((item) => item.status !== 'invalidated')
      .map((item) => `proof-opportunity-${item.id}`),
  ].join('|'), [globalQuantifications, opportunities]);
  const proofNodeIds = useMemo(
    () => Object.freeze(proofNodeIdsKey === '' ? [] : proofNodeIdsKey.split('|')),
    [proofNodeIdsKey],
  );
  const presencePositions = useMemo(() => {
    const positions = new Map(processPositions);
    positions.set('origin', { x: -440, y: -40 });
    return positions;
  }, [processPositions]);
  const agentPresence = useMemo(() => resolveSpatialAgentPresence({
    status: agentStatus,
    mode,
    focusedNodeId,
    semanticTargets,
    positions: presencePositions,
    mobile: directedMobile,
  }), [agentStatus, directedMobile, focusedNodeId, mode, presencePositions, semanticTargets]);

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
    const processNodes: ProcessFlowNode[] = graph.nodes.map((model) => {
      const overlay = overlayByNodeId.get(model.id);
      return {
        id: model.id,
        type: 'process',
        position: processPositions.get(model.id) ?? { x: 0, y: 0 },
        data: {
          model,
          zoomBand,
          muted: mode === 'origin'
            || (mode === 'focus' && focusedNodeId !== model.id)
            || overlay?.deEmphasized === true,
          agentAnchored: agentPresence.anchorId === model.id,
          ...(overlay === undefined ? {} : { overlay }),
        },
        selected: mode === 'focus' && focusedNodeId === model.id,
        draggable: false,
        connectable: false,
        selectable: mode !== 'origin',
        focusable: mode !== 'origin',
        ariaLabel: processNodeAccessibleLabel(model, overlay),
        deletable: false,
      };
    });

    const visibleOpportunities = opportunities.filter((item) => item.status !== 'invalidated');
    const proofColumns = directedMobile ? 1 : Math.min(3, Math.max(1, visibleOpportunities.length + globalQuantifications.length));
    const proofNodes: CanvasNode[] = [
      ...globalQuantifications.map((quantification, index): ValueProofFlowNode => ({
        id: `proof-value-${quantification.calculationId}`,
        type: 'value-proof',
        position: {
          x: proofOrigin.x + (index % proofColumns) * 310,
          y: proofOrigin.y + Math.floor(index / proofColumns) * 230,
        },
        data: { quantification, zoomBand },
        draggable: false,
        connectable: false,
        selectable: false,
        focusable: true,
        ariaLabel: valueProofAccessibleLabel(quantification),
        deletable: false,
        zIndex: 6,
      })),
      ...visibleOpportunities.map((opportunity, offset): OpportunityProofFlowNode => {
        const index = globalQuantifications.length + offset;
        return {
          id: `proof-opportunity-${opportunity.id}`,
          type: 'opportunity-proof',
          position: {
            x: proofOrigin.x + (index % proofColumns) * 310,
            y: proofOrigin.y + Math.floor(index / proofColumns) * 230,
          },
          data: { opportunity, zoomBand },
          draggable: false,
          connectable: false,
          selectable: false,
          focusable: true,
          ariaLabel: opportunityProofAccessibleLabel(opportunity),
          deletable: false,
          zIndex: 6,
        };
      }),
    ];

    const spatialAgent: SpatialAgentFlowNode | null = agentPresence.visible ? {
      id: SPATIAL_AGENT_NODE_ID,
      type: 'agent-presence',
      position: agentPresence.position,
      data: {
        phase: agentPresence.phase,
        placement: agentPresence.placement,
        reducedMotion: motionPolicy.reduced,
        narration: agentNarration,
        question: agentQuestion,
      },
      draggable: false,
      connectable: false,
      selectable: false,
      focusable: false,
      deletable: false,
      zIndex: 12,
    } : null;

    if (mode !== 'origin') {
      return spatialAgent === null
        ? [...processNodes, ...proofNodes]
        : [...processNodes, ...proofNodes, spatialAgent];
    }

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

    return spatialAgent === null ? [origin, ...processNodes] : [origin, ...processNodes, spatialAgent];
  }, [
    agentNarration,
    agentPresence,
    agentQuestion,
    directedMobile,
    focusedNodeId,
    globalQuantifications,
    graph,
    mode,
    motionPolicy.reduced,
    opportunities,
    overlayByNodeId,
    processPositions,
    proofOrigin,
    zoomBand,
  ]);

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

    const plan = resolveCameraDirection({
      mode,
      focusedNodeId,
      targets: semanticTargets,
      composition: sceneComposition,
      announcement: announcementRef.current,
      knownNodeIds: [...processNodeIds, 'origin'],
      mobile: directedMobile,
      reducedMotion: motionPolicy.reduced,
      spatialCompanionVisible: mode !== 'origin' && agentPresence.visible,
    }).plan;
    const common = {
      padding: plan.padding,
      minZoom: plan.minZoom,
      maxZoom: plan.maxZoom,
      duration: plan.durationMs,
      interpolate: 'smooth' as const,
    };
    const includeSpatialProof = mode !== 'origin'
      && proofNodeIds.length > 0
      && (
        sceneComposition === 'stable'
        || sceneComposition === 'focus'
        || sceneComposition === 'overview'
        || sceneComposition === 'compare'
      );
    if (plan.kind === 'fit-nodes') {
      const plannedIds = includeSpatialProof
        ? [...new Set([...plan.nodeIds, ...proofNodeIds])]
        : plan.nodeIds;
      const fitNodeIds = mode !== 'origin' && agentPresence.visible
        ? [...new Set([...plannedIds, SPATIAL_AGENT_NODE_ID])]
        : plannedIds;
      void instance.fitView({ ...common, nodes: fitNodeIds.map((id) => ({ id })) });
      return;
    }
    const visibleNodes = instance.getNodes().filter((node) =>
      node.type === 'process'
      || (includeSpatialProof && (node.type === 'opportunity-proof' || node.type === 'value-proof')));
    if (visibleNodes.length > 0) void instance.fitView({ ...common, nodes: visibleNodes });
    // cameraIntent embeds every Director input (mode, focus, composition,
    // targets, motion, form factor, graph), so the dep list stays stable.
  }, [
    agentPresence.visible,
    cameraIntent,
    focusedNodeId,
    instance,
    mode,
    motionPolicy.reduced,
    proofNodeIds,
    sceneComposition,
    viewportRevision,
  ]);

  // Single interruption owner: transition-only counting keeps the probe a
  // truthful interruption count instead of an event counter, and the optional
  // callback lets future presence work observe without owning policy.
  const markInterrupted = () => {
    if (userInterruptedRef.current) return;
    userInterruptedRef.current = true;
    if (window.__VXA_PERF__) window.__VXA_PERF__.cameraInterruptions += 1;
    onInterruptRef.current?.();
    if (instance) void instance.setViewport(instance.getViewport(), { duration: 0 });
  };

  useEffect(() => {
    if (lastExternalSignalRef.current === externalInterruptSignal) return;
    lastExternalSignalRef.current = externalInterruptSignal;
    markInterrupted();
  });

  const handleMoveStart = (event: MouseEvent | TouchEvent | null) => {
    if (!event) return;
    markInterrupted();
  };

  const handlePointerDown = () => markInterrupted();
  const handleSurfaceClick = () => markInterrupted();
  const handleWheel = () => markInterrupted();
  const handleTouchStart = () => markInterrupted();
  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    // Drag-motion claims the camera; plain hover never does.
    if (event.buttons !== 0) markInterrupted();
  };
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (INTERRUPTING_KEYS.has(event.key)) markInterrupted();
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
    <div
      ref={canvasRef}
      className="vxa-canvas"
      data-mode={mode}
      data-zoom-band={zoomBand}
      onPointerDown={handlePointerDown}
      onClick={handleSurfaceClick}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onPointerMove={handlePointerMove}
      onKeyDown={handleKeyDown}
    >
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
