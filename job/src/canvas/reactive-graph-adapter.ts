import { OPPORTUNITY_PRESENTATION_LIMIT } from '../ai/context/canonical-sales-context.ts';
import type {
  OpportunityKind,
  OpportunityRecord,
  VerifiedCalculation,
} from '../ai/context/canonical-sales-context.ts';
import type { ReactiveExperienceState } from '../experience/reactive-experience-state.ts';
import {
  createProcessGraph,
  validateProcessGraph,
  type ProcessEdgeModel,
  type ProcessGraph,
  type ProcessNodeModel,
} from './domain.ts';

/**
 * WP07 per-evidence provenance lineage.
 *
 * Every commercial surface in the Canvas carries the original source and
 * status of each evidence item it cites. A user confirmation changes status
 * but never rewrites source: an inference-confirmed fact keeps
 * `source: 'inference'`, so confirmation cannot launder provenance.
 * Calculations cite `source: 'application'` (their `computedBy` authority).
 * Opportunities and artifacts are derived commercial/presentation objects and
 * can never recursively become evidence authority.
 * Only ids, kinds, sources and statuses travel here — never values, text
 * payloads, secrets or attachment content.
 */
export interface CanvasEvidenceLineage {
  id: string;
  kind: 'fact' | 'observation' | 'calculation';
  source: 'user' | 'inference' | 'system' | 'application';
  status: string;
}

export interface CanvasQuantificationInput {
  id: string;
  source: 'user' | 'inference' | 'system';
  status: string;
}

export interface CanvasQuantification {
  calculationId: string;
  resultValue: number;
  resultUnit: string;
  // Deterministic-application proof: only `computedBy: 'application'`
  // calculations with status `valid` ever reach presentation; anything else
  // fails closed or disappears before this shape is built.
  expression: string;
  computedBy: 'application';
  basedOnRevision: number;
  inputObservationIds: readonly string[];
  inputs: readonly Readonly<CanvasQuantificationInput>[];
}

export interface CanvasAnnotationEvidence {
  text: string;
  evidenceIds: readonly string[];
  evidence: readonly Readonly<CanvasEvidenceLineage>[];
}

export interface CanvasNodeSemanticOverlay {
  nodeId: string;
  state: 'active' | 'hypothesis' | 'invalidated' | null;
  deEmphasized: boolean;
  revealed: boolean;
  annotations: readonly string[];
  annotationEvidence: readonly Readonly<CanvasAnnotationEvidence>[];
  quantifications: readonly Readonly<CanvasQuantification>[];
}

/**
 * WP07 opportunity surface.
 *
 * A quantitativeOpportunity without numeric evidence stays explicitly
 * non-numeric: it carries `missingInputs` and no numeric field of any kind.
 * Presentation must render the missing inputs/uncertainty and never
 * synthesize ROI, savings, capacity, cost or percentage values.
 */
export interface CanvasOpportunity {
  id: string;
  kind: OpportunityKind;
  objective: string;
  evidenceIds: readonly string[];
  missingInputs: readonly string[];
  status: 'surfaced' | 'active' | 'invalidated';
  evidence: readonly Readonly<CanvasEvidenceLineage>[];
}

export interface CanvasSemanticGroup {
  groupId: string;
  label: string;
  memberIds: readonly string[];
}

export interface CanvasRelationshipExplanation {
  sourceId: string;
  targetId: string;
  text: string;
}

export interface ReactiveCanvasModel {
  graph: ProcessGraph;
  focusIds: readonly string[];
  comparisonIds: readonly string[];
  overlays: readonly Readonly<CanvasNodeSemanticOverlay>[];
  groups: readonly Readonly<CanvasSemanticGroup>[];
  relationshipExplanations: readonly Readonly<CanvasRelationshipExplanation>[];
  globalQuantifications: readonly Readonly<CanvasQuantification>[];
  opportunities: readonly Readonly<CanvasOpportunity>[];
}

export type ReactiveCanvasProjectionResult =
  | { ok: true; model: Readonly<ReactiveCanvasModel> }
  | {
      ok: false;
      code:
        | 'INVALID_GRAPH_MUTATION'
        | 'UNKNOWN_ACTION_TARGET'
        | 'UNKNOWN_CALCULATION'
        | 'INVALIDATED_CALCULATION'
        | 'UNKNOWN_EVIDENCE_REFERENCE';
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

export interface CanvasEvidenceFact {
  id: string;
  source: 'user' | 'inference' | 'system';
  status: string;
}

export interface CanvasEvidenceObservation {
  id: string;
  source: 'user' | 'inference' | 'system';
  status: string;
}

export interface CanvasEvidenceContext {
  verifiedCalculations: readonly Readonly<
    Pick<
      VerifiedCalculation,
      'id' | 'resultValue' | 'resultUnit' | 'status' | 'computedBy' | 'expression' | 'basedOnRevision' | 'inputObservationIds'
    >
  >[];
  facts: readonly Readonly<CanvasEvidenceFact>[];
  quantitativeObservations: readonly Readonly<CanvasEvidenceObservation>[];
  opportunities: readonly Readonly<
    Pick<OpportunityRecord, 'id' | 'kind' | 'summary' | 'evidenceIds' | 'missingInputs' | 'status'>
  >[];
  // Same-turn proposed facts: the projector treats the turn's factProposals
  // as known evidence pre-commit, so lineage resolution must see them too.
  // Post-commit callers pass an empty list (proposals are canonical by then).
  proposalFacts: readonly Readonly<CanvasEvidenceFact>[];
}

type EvidenceFailure = Extract<ReactiveCanvasProjectionResult, { ok: false }>;

function failure(code: EvidenceFailure['code'], path: string): EvidenceFailure {
  return { ok: false, code, path, graph: createProcessGraph([], []) };
}

function resolveEvidenceLineage(
  canonical: Readonly<CanvasEvidenceContext>,
  evidenceId: string,
  path: string,
): Readonly<CanvasEvidenceLineage> | EvidenceFailure {
  const fact = canonical.facts.find((item) => item.id === evidenceId);
  if (fact !== undefined) {
    if (fact.status === 'superseded') return failure('UNKNOWN_EVIDENCE_REFERENCE', path);
    return Object.freeze({ id: evidenceId, kind: 'fact' as const, source: fact.source, status: fact.status });
  }
  const proposalFact = canonical.proposalFacts.find((item) => item.id === evidenceId);
  if (proposalFact !== undefined) {
    return Object.freeze({
      id: evidenceId,
      kind: 'fact' as const,
      source: proposalFact.source,
      status: proposalFact.status,
    });
  }
  const observation = canonical.quantitativeObservations.find((item) => item.id === evidenceId);
  if (observation !== undefined) {
    if (observation.status === 'superseded') return failure('UNKNOWN_EVIDENCE_REFERENCE', path);
    return Object.freeze({
      id: evidenceId,
      kind: 'observation' as const,
      source: observation.source,
      status: observation.status,
    });
  }
  const calculation = canonical.verifiedCalculations.find((item) => item.id === evidenceId);
  if (calculation !== undefined) {
    if (calculation.status !== 'valid' || calculation.computedBy !== 'application') {
      return failure('UNKNOWN_EVIDENCE_REFERENCE', path);
    }
    return Object.freeze({
      id: evidenceId,
      kind: 'calculation' as const,
      source: 'application' as const,
      status: calculation.status,
    });
  }
  return failure('UNKNOWN_EVIDENCE_REFERENCE', path);
}

function resolveEvidenceList(
  canonical: Readonly<CanvasEvidenceContext>,
  evidenceIds: readonly string[],
  path: string,
): readonly Readonly<CanvasEvidenceLineage>[] | EvidenceFailure {
  const lineage: Readonly<CanvasEvidenceLineage>[] = [];
  for (const evidenceId of evidenceIds) {
    const resolved = resolveEvidenceLineage(canonical, evidenceId, path);
    if ('ok' in resolved) return resolved;
    lineage.push(resolved);
  }
  return Object.freeze(lineage);
}

function quantification(
  canonical: Readonly<CanvasEvidenceContext>,
  calculationId: string,
  path: string,
): Readonly<CanvasQuantification> | EvidenceFailure {
  const calculation = canonical.verifiedCalculations.find((item) => item.id === calculationId);
  if (calculation === undefined) {
    return failure('UNKNOWN_CALCULATION', path);
  }
  if (calculation.status !== 'valid' || calculation.computedBy !== 'application') {
    return failure('INVALIDATED_CALCULATION', path);
  }
  const inputs: Readonly<CanvasQuantificationInput>[] = [];
  for (const inputId of calculation.inputObservationIds) {
    const observation = canonical.quantitativeObservations.find((item) => item.id === inputId);
    if (observation === undefined || observation.status !== 'confirmed') {
      return failure('UNKNOWN_EVIDENCE_REFERENCE', path);
    }
    inputs.push(Object.freeze({ id: inputId, source: observation.source, status: observation.status }));
  }
  return Object.freeze({
    calculationId,
    resultValue: calculation.resultValue,
    resultUnit: calculation.resultUnit,
    expression: calculation.expression,
    computedBy: 'application' as const,
    basedOnRevision: calculation.basedOnRevision,
    inputObservationIds: Object.freeze([...calculation.inputObservationIds]),
    inputs: Object.freeze(inputs),
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
  canonical: Readonly<CanvasEvidenceContext>,
): ReactiveCanvasProjectionResult {
  const graphResult = applyGraphMutations(baseGraph, state);
  if ('ok' in graphResult) return graphResult;
  const graph = graphResult;

  const overlays = new Map<string, {
    state: CanvasNodeSemanticOverlay['state'];
    deEmphasized: boolean;
    revealed: boolean;
    annotations: string[];
    annotationEvidence: CanvasAnnotationEvidence[];
    quantifications: Readonly<CanvasQuantification>[];
  }>();

  const overlayFor = (nodeId: string) => {
    let value = overlays.get(nodeId);
    if (value === undefined) {
      value = { state: null, deEmphasized: false, revealed: false, annotations: [], annotationEvidence: [], quantifications: [] };
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

  const groups: Readonly<CanvasSemanticGroup>[] = [];
  const relationshipExplanations: Readonly<CanvasRelationshipExplanation>[] = [];
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
        const lineage = resolveEvidenceList(canonical, action.evidenceIds, `reactive.actions[${i}].evidenceIds`);
        if ('ok' in lineage) {
          return { ok: false, code: lineage.code, path: lineage.path, graph };
        }
        const target = overlayFor(action.targetId);
        target.annotations.push(action.text);
        target.annotationEvidence.push(Object.freeze({
          text: action.text,
          evidenceIds: Object.freeze([...action.evidenceIds]),
          evidence: lineage,
        }));
        break;
      }
      case 'de_emphasize':
        for (const id of action.targetIds) {
          const missing = ensureTarget(graph, id, `reactive.actions[${i}].targetIds`);
          if (missing !== null) return missing;
          overlayFor(id).deEmphasized = true;
        }
        break;
      case 'reveal': {
        const missing = ensureTarget(graph, action.targetId, `reactive.actions[${i}].targetId`);
        if (missing !== null) return missing;
        overlayFor(action.targetId).revealed = true;
        break;
      }
      case 'group': {
        for (const id of action.memberIds) {
          const missing = ensureTarget(graph, id, `reactive.actions[${i}].memberIds`);
          if (missing !== null) return missing;
        }
        groups.push(Object.freeze({
          groupId: action.groupId,
          label: action.label,
          memberIds: Object.freeze([...action.memberIds]),
        }));
        break;
      }
      case 'explain_relationship': {
        const sourceMissing = ensureTarget(graph, action.sourceId, `reactive.actions[${i}].sourceId`);
        if (sourceMissing !== null) return sourceMissing;
        const targetMissing = ensureTarget(graph, action.targetId, `reactive.actions[${i}].targetId`);
        if (targetMissing !== null) return targetMissing;
        relationshipExplanations.push(Object.freeze({
          sourceId: action.sourceId,
          targetId: action.targetId,
          text: action.text,
        }));
        break;
      }
      case 'quantify': {
        const metric = quantification(canonical, action.calculationId, `reactive.actions[${i}].calculationId`);
        if ('ok' in metric) {
          return { ok: false, code: metric.code, path: metric.path, graph };
        }
        if (action.targetId === null) globalQuantifications.push(metric);
        else {
          const missing = ensureTarget(graph, action.targetId, `reactive.actions[${i}].targetId`);
          if (missing !== null) return missing;
          overlayFor(action.targetId).quantifications.push(metric);
        }
        break;
      }
      case 'demonstrate':
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

  const opportunities: Readonly<CanvasOpportunity>[] = [];
  const activeOpportunities = canonical.opportunities
    .filter((opportunity) => opportunity.status !== 'invalidated')
    .slice(-OPPORTUNITY_PRESENTATION_LIMIT);
  for (const opportunity of activeOpportunities) {
    const lineage = resolveEvidenceList(canonical, opportunity.evidenceIds, `canonical.opportunities.${opportunity.id}`);
    if ('ok' in lineage) {
      return { ok: false, code: lineage.code, path: lineage.path, graph };
    }
    opportunities.push(Object.freeze({
      id: opportunity.id,
      kind: opportunity.kind,
      objective: opportunity.summary,
      evidenceIds: Object.freeze([...opportunity.evidenceIds]),
      missingInputs: Object.freeze([...opportunity.missingInputs]),
      status: opportunity.status,
      evidence: lineage,
    }));
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
        revealed: value.revealed,
        annotations: Object.freeze([...value.annotations]),
        annotationEvidence: Object.freeze([...value.annotationEvidence]),
        quantifications: Object.freeze([...value.quantifications]),
      }))),
      groups: Object.freeze([...groups]),
      relationshipExplanations: Object.freeze([...relationshipExplanations]),
      globalQuantifications: Object.freeze([...globalQuantifications]),
      opportunities: Object.freeze(opportunities),
    }),
  };
}
