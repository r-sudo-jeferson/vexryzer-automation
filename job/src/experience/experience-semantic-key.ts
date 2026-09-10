import type { ExperienceAction } from './agent-intent.ts';
import type { ExperienceProposal, ProcessMutationProposal } from './experience-proposal.ts';

function stableSerialize(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`;
}

function sorted(values: readonly string[]): readonly string[] {
  return [...values].sort();
}

function visualActionPayload(action: Readonly<ExperienceAction>): unknown {
  switch (action.kind) {
    case 'focus': return { kind: action.kind, targetId: action.targetId };
    case 'compare': return { kind: action.kind, targetIds: sorted(action.targetIds) };
    case 'annotate': return { kind: action.kind, targetId: action.targetId, text: action.text, evidenceIds: sorted(action.evidenceIds) };
    case 'reveal': return { kind: action.kind, targetId: action.targetId };
    case 'group': return { kind: action.kind, groupId: action.groupId, memberIds: sorted(action.memberIds), label: action.label };
    case 'de_emphasize': return { kind: action.kind, targetIds: sorted(action.targetIds) };
    case 'quantify': return { kind: action.kind, calculationId: action.calculationId, targetId: action.targetId };
    case 'demonstrate': return { kind: action.kind, artifactIntentId: action.artifactIntentId };
    case 'explain_relationship': return { kind: action.kind, sourceId: action.sourceId, targetId: action.targetId, text: action.text };
    case 'stage_artifact': return { kind: action.kind, artifactIntentId: action.artifactIntentId };
    case 'request_workshop': return { kind: action.kind, artifactIntentId: action.artifactIntentId };
  }
}

function visualMutationPayload(mutation: Readonly<ProcessMutationProposal>): unknown {
  switch (mutation.kind) {
    case 'upsert_node':
      return { kind: mutation.kind, nodeId: mutation.nodeId, label: mutation.label, summary: mutation.summary, evidenceIds: sorted(mutation.evidenceIds) };
    case 'upsert_relationship':
      return {
        kind: mutation.kind,
        relationshipId: mutation.relationshipId,
        sourceNodeId: mutation.sourceNodeId,
        targetNodeId: mutation.targetNodeId,
        label: mutation.label,
        evidenceIds: sorted(mutation.evidenceIds),
      };
    case 'remove_element': return { kind: mutation.kind, targetId: mutation.targetId };
    case 'set_node_state': return { kind: mutation.kind, nodeId: mutation.nodeId, state: mutation.state };
  }
}

export function createExperienceSemanticKey(proposal: Readonly<ExperienceProposal>): string {
  const payload = {
    actions: proposal.intent.actions.map(visualActionPayload).sort((a, b) => stableSerialize(a).localeCompare(stableSerialize(b))),
    processMutations: proposal.processMutations.map(visualMutationPayload).sort((a, b) => stableSerialize(a).localeCompare(stableSerialize(b))),
    scene: proposal.sceneProposal === null ? null : {
      composition: proposal.sceneProposal.composition,
      focusIds: sorted(proposal.sceneProposal.focusIds),
      comparisonIds: sorted(proposal.sceneProposal.comparisonIds),
      announcement: proposal.sceneProposal.announcement,
    },
    artifacts: proposal.artifactProposals.map((artifact) => ({
      kind: artifact.kind,
      title: artifact.title,
      summary: artifact.summary,
      evidenceIds: sorted(artifact.evidenceIds),
      status: artifact.status,
    })).sort((a, b) => stableSerialize(a).localeCompare(stableSerialize(b))),
  };
  return stableSerialize(payload);
}

export function createCameraIntent(
  proposal: Readonly<ExperienceProposal>,
): { key: string | null; targets: readonly string[] } {
  const targets = new Set<string>();
  for (const action of proposal.intent.actions) {
    if (action.kind === 'focus') targets.add(action.targetId);
    if (action.kind === 'compare') for (const id of action.targetIds) targets.add(id);
  }
  if (proposal.sceneProposal) {
    for (const id of proposal.sceneProposal.focusIds) targets.add(id);
    for (const id of proposal.sceneProposal.comparisonIds) targets.add(id);
  }
  const targetIds = [...targets].sort();
  if (targetIds.length === 0) return { key: null, targets: Object.freeze([]) };
  const composition = proposal.sceneProposal?.composition ?? 'stable';
  return { key: stableSerialize({ composition, targetIds }), targets: Object.freeze(targetIds) };
}
