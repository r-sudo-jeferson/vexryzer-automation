import type { CanonicalSalesContext } from '../ai/context/canonical-sales-context.ts';
import type { ReactiveExperienceState } from '../experience/reactive-experience-state.ts';
import {
  createProcessGraph,
  validateProcessGraph,
  type ProcessEdgeModel,
  type ProcessGraph,
  type ProcessNodeModel,
} from './domain.ts';

export interface CanvasQuantification {
  calculationId: string;
  resultValue: number;
  resultUnit: string;
}

export interface CanvasNodeSemanticOverlay {
  nodeId: string;
  state: 'active' | 'hypothesis' | 'invalidated' | null;
  deEmphasized: boolean;
  annotations: readonly string[];
  quantifications: readonly Readonly<CanvasQuantification>[];
}

export interface ReactiveCanvasModel {
  graph: ProcessGraph;
  focusIds: readonly string[];
  comparisonIds: readonly string[];
  overlays: readonly Readonly<CanvasNodeSemanticOverlay>[];
  globalQuantifications: readonly Readonly<CanvasQuantification>[];
}

export type ReactiveCanvasProjectionResult =
  | { ok: true; model: Readonly<ReactiveCanvasModel> }
  | {
      ok: false;
      code:
        | 'INVALID_GRAPH_MUTATION'
        | 'UNKNOWN_ACTION_TARGET'
        | 'UNKNOWN_CALCULATION'
        | 'INVALIDATED_CALCULATION';
      path: string;
      graph: ProcessGraph;
    };

function unique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)]);
}

function activeProcessMutations(state: Readonly<ReactiveExperienceState>) {
  return state.processMutations;
}

function applyGraphMutations(
  graph: ProcessGraph,
  state: Readonly<ReactiveExperienceState>,
): ReactiveCanvasProjectionResult | ProcessGraph {
  let nodes = [...graph.nodes];
  let edges = [...graph.edges];

  for (const projected of activeProcessMutations(state)) {
    const mutation = projected.mutation;
    switch (mutation.kind) {
      case 'upsert_node': {
        const index = nodes.findIndex((node) => node.id === mutation.nodeId);
        if (index < 0) {
          nodes.push(Object.freeze({
            id: mutation.nodeId,
            kind: 'evidence',
            label: mutation.label,
            summary: mutation.summary,
            provenance: 'ai_inferred',
          }));
        } else {
          const current = nodes[index]!;
          nodes[index] = Object.freeze({
            ...current,
            label: mutation.label,
            summary: mutation.summary,
          });
        }
        break;
      }
      case 'upsert_relationship': {
        const next: ProcessEdgeModel = Object.freeze({
          id: mutation.relationshipId,
          source: mutation.sourceNodeId,
          target: mutation.targetNodeId,
          label: mutation.label,
        });
        const index = edges.findIndex((edge) => edge.id === mutation.relationshipId);
        if (index < 0) edges.push(next);
        else edges[index] = next;
        break;
      }
      case 'remove_element': {
        const nodeIndex = nodes.findIndex((node) => node.id === mutation.targetId);
        if (nodeIndex >= 0) {
          nodes = nodes.filter((node) => node.id !== mutation.targetId);
          edges = edges.filter((edge) =>
            edge.source !== mutation.targetId && edge.target !== mutation.targetId);
        } else {
          edges = edges.filter((edge) => edge.id !== mutation.targetId);
        }
        break;
      }
      case 'set_node_state':
        break;
    }
  }

  const projected = createProcessGraph(nodes, edges);
  const issues = validateProcessGraph(projected);
  if (issues.length > 0) {
    return {
      ok: false,
      code: 'INVALID_GRAPH_MUTATION',
      path: issues[0]?.subjectId ?? 'graph',
      graph,
    };
  }
  return projected;
}

function quantification(
  canonical: CanonicalSalesContext,
  calculationId: string,
  path: string,
): Readonly<CanvasQuantification> | ReactiveCanvasProjectionResult {
  const calculation = canonical.verifiedCalculations.find((item) => item.id === calculationId);
  if (calculation === undefined) {
    return { ok: false, code: 'UNKNOWN_CALCULATION', path, graph: createProcessGraph([], []) };
  }
  if (calculation.status !== 'valid') {
    return { ok: false, code: 'INVALIDATED_CALCULATION', path, graph: createProcessGraph([], []) };
  }
  return Object.freeze({
    calculationId,
    resultValue: calculation.resultValue,
    resultUnit: calculation.resultUnit,
  });
}

function nodeExists(graph: ProcessGraph, id: string): boolean {
  return graph.nodes.some((node) => node.id === id);
}

function ensureTarget(
  graph: ProcessGraph,
  id: string,
  path: string,
): ReactiveCanvasProjectionResult | null {
  return nodeExists(graph, id)
    ? null
    : { ok: false, code: 'UNKNOWN_ACTION_TARGET', path, graph };
}

export function projectReactiveCanvas(
  baseGraph: ProcessGraph,
  state: Readonly<ReactiveExperienceState>,
  canonical: CanonicalSalesContext,
): ReactiveCanvasProjectionResult {
  const graphResult = applyGraphMutations(baseGraph, state);
  if ('ok' in graphResult) return graphResult;
  const graph = graphResult;

  const overlays = new Map<string, {
    state: CanvasNodeSemanticOverlay['state'];
    deEmphasized: boolean;
    annotations: string[];
    quantifications: Readonly<CanvasQuantification>[];
  }>();

  const overlayFor = (nodeId: string) => {
    let value = overlays.get(nodeId);
    if (value === undefined) {
      value = { state: null, deEmphasized: false, annotations: [], quantifications: [] };
      overlays.set(nodeId, value);
    }
    return value;
  };

  for (let i = 0; i < state.processMutations.length; i += 1) {
    const mutation = state.processMutations[i]!.mutation;
    if (mutation.kind !== 'set_node_state') continue;
    const missing = ensureTarget(graph, mutation.nodeId, `reactive.processMutations[${i}].nodeId`);
    if (missing !== null) return missing;
    overlayFor(mutation.nodeId).state = mutation.state;
  }

  const focusIds = new Set<string>();
  const comparisonIds = new Set<string>();
  for (const id of state.scene.focusIds) focusIds.add(id);
  for (const id of state.scene.comparisonIds) comparisonIds.add(id);

  const globalQuantifications: Readonly<CanvasQuantification>[] = [];
  for (let i = 0; i < state.actions.length; i += 1) {
    const projected = state.actions[i]!;
    if (projected.status !== 'active') continue;
    const action = projected.action;
    switch (action.kind) {
      case 'focus': {
        const missing = ensureTarget(graph, action.targetId, `reactive.actions[${i}].targetId`);
        if (missing !== null) return missing;
        focusIds.add(action.targetId);
        break;
      }
      case 'compare':
        for (const id of action.targetIds) {
          const missing = ensureTarget(graph, id, `reactive.actions[${i}].targetIds`);
          if (missing !== null) return missing;
          comparisonIds.add(id);
        }
        break;
      case 'annotate': {
        const missing = ensureTarget(graph, action.targetId, `reactive.actions[${i}].targetId`);
        if (missing !== null) return missing;
        overlayFor(action.targetId).annotations.push(action.text);
        break;
      }
      case 'de_emphasize':
        for (const id of action.targetIds) {
          const missing = ensureTarget(graph, id, `reactive.actions[${i}].targetIds`);
          if (missing !== null) return missing;
          overlayFor(id).deEmphasized = true;
        }
        break;
      case 'quantify': {
        const metric = quantification(canonical, action.calculationId, `reactive.actions[${i}].calculationId`);
        if ('ok' in metric) return { ...metric, graph };
        if (action.targetId === null) globalQuantifications.push(metric);
        else {
          const missing = ensureTarget(graph, action.targetId, `reactive.actions[${i}].targetId`);
          if (missing !== null) return missing;
          overlayFor(action.targetId).quantifications.push(metric);
        }
        break;
      }
      case 'reveal':
      case 'group':
      case 'demonstrate':
      case 'explain_relationship':
      case 'stage_artifact':
      case 'request_workshop':
        break;
    }
  }

  for (const id of focusIds) {
    const missing = ensureTarget(graph, id, 'reactive.scene.focusIds');
    if (missing !== null) return missing;
  }
  for (const id of comparisonIds) {
    const missing = ensureTarget(graph, id, 'reactive.scene.comparisonIds');
    if (missing !== null) return missing;
  }

  return {
    ok: true,
    model: Object.freeze({
      graph,
      focusIds: unique([...focusIds]),
      comparisonIds: unique([...comparisonIds]),
      overlays: Object.freeze([...overlays.entries()].map(([nodeId, value]) => Object.freeze({
        nodeId,
        state: value.state,
        deEmphasized: value.deEmphasized,
        annotations: Object.freeze([...value.annotations]),
        quantifications: Object.freeze([...value.quantifications]),
      }))),
      globalQuantifications: Object.freeze([...globalQuantifications]),
    }),
  };
}
