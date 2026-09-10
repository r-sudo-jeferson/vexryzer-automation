import type { AgentIntent } from './agent-intent.ts';
import type { ArtifactKind } from './artifact-intent.ts';

export interface FactProposal {
  id: string;
  subject: string;
  predicate: string;
  value: string | number | boolean;
  source: 'user' | 'inference' | 'system';
  supportingTurnIds: readonly string[];
}

export interface CorrectionProposal {
  id: string;
  targetEvidenceId: string;
  reason: string;
  replacementValue: string | number | boolean;
  supportingTurnIds: readonly string[];
}

export type ProcessMutationProposal =
  | {
      id: string;
      kind: 'upsert_node';
      nodeId: string;
      label: string;
      summary: string;
      evidenceIds: readonly string[];
    }
  | {
      id: string;
      kind: 'upsert_relationship';
      relationshipId: string;
      sourceNodeId: string;
      targetNodeId: string;
      label: string;
      evidenceIds: readonly string[];
    }
  | {
      id: string;
      kind: 'remove_element';
      targetId: string;
      reason: string;
    }
  | {
      id: string;
      kind: 'set_node_state';
      nodeId: string;
      state: 'active' | 'hypothesis' | 'invalidated';
      reason: string;
    };

export interface ExperienceSceneProposal {
  composition: 'stable' | 'focus' | 'compare' | 'overview' | 'artifact';
  focusIds: readonly string[];
  comparisonIds: readonly string[];
  announcement: string | null;
}

export interface ArtifactProposal {
  id: string;
  kind: ArtifactKind;
  title: string;
  summary: string;
  evidenceIds: readonly string[];
  status: 'conceptual' | 'prototype';
}

export interface ExperienceProposal {
  schemaVersion: 1;
  baseRevision: number;
  narration: string;
  intent: AgentIntent;
  factProposals: readonly FactProposal[];
  correctionProposals: readonly CorrectionProposal[];
  processMutations: readonly ProcessMutationProposal[];
  sceneProposal: ExperienceSceneProposal | null;
  artifactProposals: readonly ArtifactProposal[];
  criticRequired: boolean;
}
