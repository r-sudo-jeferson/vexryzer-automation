/**
 * UXR5-00 lifecycle baseline RED — GitHub issue #41.
 *
 * CONTRACT_ID: UXR5-00 (SUPERSEDES #26, IMMUTABLE)
 * MASTER: #40 End-to-End Adaptive Solution Experience (payload SHA-256
 *   765908b7b3d54833e48ee0e648d84ea64d5d29c0e3b13e29397ab17bee6421c)
 * EMBODIMENT: #25 Spatial Conductor. PORTFOLIO: #36 Adaptive Solution Portfolio.
 * BASELINE: c791ae6e15502eecf41370cae2d0b907c9632f09 (staging/vxa-s002-agent-led-accounting-seller)
 *
 * RED assertions below must FAIL on the baseline for legitimate contract
 * reasons: required lifecycle behavior/state is missing or wrong. Compatibility
 * guards may PASS when they protect an existing S001/S002 contract from needless
 * replacement. No RED may fail on syntax/import errors, renamed legacy enums, or
 * pixel trivia; each failure names the missing semantic capability and owner stage.
 *
 * Invariants honored here, never asserted as legacy detail:
 * - numbers are optional: no test forces ROI, savings, or 44 h/month;
 * - no preferredSolutionKind anywhere (see canonical-sales-context guards);
 * - DeepSeek-only authority untouched; S007 / PRIVATE-SOLUTIONS out of scope.
 *
 * Stage-to-assertion matrix (#40 cycle):
 * | #40 stage      | test                                            | production surface probed              |
 * |----------------|-----------------------------------------------|----------------------------------------|
 * | ARRIVE         | compatibility guard; world truth lives in E2E | experience-state compatibility          |
 * | DISCOVER/FRAME | additive truth class + current-state frame     | canonical truth + frame                 |
 * | DESIGN         | additive multi-family routing                  | capabilities preserved + #36 families  |
 * | DEMONSTRATE    | demonstrate-uses-heterogeneous-demonstrators  | artifact-registry surface descriptors  |
 * | PROVE          | prove-claims-are-inspectable                  | seller-contract material claims        |
 * | CHALLENGE      | challenge-correction-propagates               | projector reconcile + scene            |
 * | VALIDATE       | validate-requires-pov-success-criteria        | canonical validation contract          |
 * | DECIDE         | decide-exposes-truthful-decision-frame        | context-packager decisionContext       |
 * | COMMIT         | commit-captures-only-authorized-commitments   | seller-contract commitment boundary    |
 * | HANDOFF        | handoff-preserves-versioned-provenance        | accepted-transaction handoff builder   |
 * | CONTINUE       | continue-ends-honestly-without-fake-delivery  | canonical lifecycle terminal state     |
 * | RECOVERY       | transient-failure-enters-deterministic-recover | app-machine accepted-world continuity |
 * | cross-cutting  | conductor-speaks-semantic-not-generic-states  | canvas/spatial-agent-presence (#25)    |
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createActor } from 'xstate';
import { initialExperienceState } from '../../src/app/experience-state.ts';
import { appMachine } from '../../src/app/app-machine.ts';
import * as CanonicalModule from '../../src/ai/context/canonical-sales-context.ts';
import {
  createCanonicalSalesContext,
  EVIDENCE_STATUSES,
} from '../../src/ai/context/canonical-sales-context.ts';
import * as AgentIntentModule from '../../src/experience/agent-intent.ts';
import { resolveArtifactSurface } from '../../src/experience/artifact-registry.ts';
import * as SellerModule from '../../src/ai/seller/seller-contract.ts';
import { validateSellerSubmission } from '../../src/ai/seller/seller-contract.ts';
import { createReactiveExperienceState } from '../../src/experience/reactive-experience-state.ts';
import {
  projectExperienceProposal,
  reconcileReactiveExperience,
} from '../../src/experience/experience-projector.ts';
import * as SpatialPresence from '../../src/canvas/spatial-agent-presence.ts';
import { resolveSpatialAgentPresence } from '../../src/canvas/spatial-agent-presence.ts';
import * as AcceptedTransaction from '../../src/experience/accepted-experience-transaction.ts';
import { packageContext } from '../../src/ai/context/context-packager.ts';
import type { CanonicalSalesContext } from '../../src/ai/context/canonical-sales-context.ts';

const {
  CAPABILITY_KINDS: CANONICAL_CAPABILITY_KINDS,
  CANONICAL_CONTEXT_KEYS,
} = CanonicalModule;
const { CAPABILITY_KINDS: AGENT_CAPABILITY_KINDS } = AgentIntentModule;

function redContext(): CanonicalSalesContext {
  return createCanonicalSalesContext({ sessionId: 'session-uxr5-red' });
}

// #40 §3 — authoritative portfolio families routed by outcome/mechanism.
const PORTFOLIO_FAMILIES = [
  'AUTOMATION_SYSTEM',
  'SPECIALIZED_AI_AGENT',
  'BUSINESS_INTELLIGENCE',
  'PRESENTATION_NARRATIVE',
  'DATA_INTEGRATION_WORKFLOW',
  'REPORT_DECISION_ASSET',
  'INTERACTIVE_BUSINESS_TOOL',
  'COMPOSITE_SOLUTION',
  'CUSTOM_CATALOG_EXTENSION',
] as const;

// #40 §1 — application-owned buyer states.
const BUYER_STATES = [
  'EXPLORING',
  'PROBLEM_FORMING',
  'CONTEXT_ESTABLISHED',
  'SOLUTION_CANDIDATES',
  'SOLUTION_ALIGNED',
  'DEMO_READY',
  'PROOF_IN_PROGRESS',
  'TECHNICALLY_VALIDATED',
  'DECISION_READY',
  'COMMITMENT_CAPTURED',
  'HANDOFF_READY',
  'FULFILLMENT_ACTIVE',
  'OUTCOME_REVIEW',
] as const;

// #25 §4 — Conductor semantic action vocabulary.
const CONDUCTOR_SEMANTIC_STATES = [
  'REST', 'ORIENT', 'POINT', 'ACQUIRE', 'HOLD', 'MOVE', 'PLACE', 'CONNECT',
  'GROUP', 'UNGROUP', 'REVEAL', 'COMPARE', 'QUANTIFY', 'QUESTION', 'CONFIRM',
  'CORRECT', 'DEFER', 'RECOVER', 'COMPOSE_DECISION',
] as const;

const TRUTH_CLASSES = [
  'USER_STATED', 'VERIFIED', 'INFERRED', 'ASSUMPTION', 'UNKNOWN', 'INVALIDATED',
] as const;
const AUTHORIZED_COMMITMENTS = [
  'CONTINUE_DISCOVERY', 'PROVIDE_INPUT', 'APPROVE_DEMO_OR_POV',
  'REQUEST_FORMAL_PROPOSAL', 'REQUEST_IMPLEMENTATION_PLANNING', 'ACCEPT_ARTIFACT',
  'EXPORT_OR_SHARE', 'SAVE_FOR_LATER', 'DECLINE',
] as const;
const FORBIDDEN_FAKE_COMMITMENTS = [
  'PRICE', 'DISCOUNT', 'CONTRACT_ACCEPTANCE', 'SIGNATURE', 'PAYMENT', 'DEPLOYMENT',
  'PRODUCTION_IMPLEMENTATION', 'ONBOARDING',
] as const;

type UnknownRecord = Record<string, unknown>;
function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function enumExportContaining(module: UnknownRecord, required: readonly string[]): readonly string[] | null {
  for (const value of Object.values(module)) {
    if (Array.isArray(value) && required.every((item) => value.includes(item))) return value as readonly string[];
  }
  return null;
}
function findSemanticRecord(
  value: unknown,
  aliasGroups: readonly (readonly string[])[],
  seen = new Set<unknown>(),
  depth = 0,
): UnknownRecord | null {
  if (depth > 8 || value === null || typeof value !== 'object' || seen.has(value)) return null;
  seen.add(value);
  if (isRecord(value)) {
    const keys = new Set(Object.keys(value));
    if (aliasGroups.every((aliases) => aliases.some((alias) => keys.has(alias)))) return value;
    for (const child of Object.values(value)) {
      const match = findSemanticRecord(child, aliasGroups, seen, depth + 1);
      if (match !== null) return match;
    }
  } else if (Array.isArray(value)) {
    for (const child of value) {
      const match = findSemanticRecord(child, aliasGroups, seen, depth + 1);
      if (match !== null) return match;
    }
  }
  return null;
}
function findFunctionExport(module: UnknownRecord, pattern: RegExp): ((input: UnknownRecord) => unknown) | null {
  for (const [name, value] of Object.entries(module)) {
    if (pattern.test(name) && typeof value === 'function') return value as (input: UnknownRecord) => unknown;
  }
  return null;
}
function findRecordById(value: unknown, id: string, seen = new Set<unknown>()): UnknownRecord | null {
  if (value === null || typeof value !== 'object' || seen.has(value)) return null;
  seen.add(value);
  if (isRecord(value)) {
    if (value['id'] === id) return value;
    for (const child of Object.values(value)) {
      const match = findRecordById(child, id, seen);
      if (match !== null) return match;
    }
  } else if (Array.isArray(value)) {
    for (const child of value) {
      const match = findRecordById(child, id, seen);
      if (match !== null) return match;
    }
  }
  return null;
}
function semanticValue(record: UnknownRecord, aliases: readonly string[]): unknown {
  for (const alias of aliases) if (Object.hasOwn(record, alias)) return record[alias];
  return undefined;
}
function hasMaterialValue(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (isRecord(value)) return Object.keys(value).length > 0;
  return value !== null && value !== undefined;
}
function assertMaterialSemanticGroups(
  record: UnknownRecord,
  aliasGroups: readonly (readonly string[])[],
  label: string,
): void {
  for (const aliases of aliasGroups) {
    const value = semanticValue(record, aliases);
    assert.ok(
      hasMaterialValue(value),
      `RED ${label}: semantic group [${aliases.join('|')}] is absent or vacuous`,
    );
  }
}

test('UXR5-00 ARRIVE compatibility guard: world-ness must not require renaming the existing mode token', () => {
  assert.equal(typeof initialExperienceState.mode, 'string');
  assert.ok(initialExperienceState.mode.length > 0);
  // Canvas-as-world is an observable structural contract and is gated in the
  // E2E harness. This guard intentionally refuses to make "origin" a defect.
});

test('UXR5-00 DISCOVER: truth class is additive and does not replace canonical evidence status', () => {
  assert.deepEqual(
    [...EVIDENCE_STATUSES],
    ['proposed', 'confirmed', 'conflicted', 'superseded'],
    'guard: existing evidence lifecycle statuses remain intact',
  );
  const truthClassEnum = enumExportContaining(CanonicalModule as UnknownRecord, TRUTH_CLASSES);
  assert.ok(
    truthClassEnum,
    'RED DISCOVER: no separate application-owned truth-class dimension exposes ' +
      TRUTH_CLASSES.join('/') + ' while preserving evidence status (#40 Stage B).',
  );
});

test('UXR5-00 FRAME: current reality is materialized as a correctable semantic model before solutioning', () => {
  const ctx = redContext();
  assert.ok(CANONICAL_CONTEXT_KEYS.includes('facts'));
  const frame = findSemanticRecord(ctx, [
    ['problem', 'problemStatement', 'objective', 'outcome', 'desiredOutcome'],
    ['actors', 'users', 'audience', 'stakeholders'],
    ['systems', 'integrations', 'dataSources', 'data'],
    ['process', 'workflow', 'topology', 'currentState'],
    ['constraints', 'constraintItems'],
    ['missing', 'missingInputs', 'unknowns', 'openQuestions'],
    ['success', 'successCriteria', 'decisionCriteria'],
  ]);
  assert.ok(
    frame,
    'RED FRAME: no correctable current-state model covers problem/outcome, actors, systems/data, ' +
      'topology, constraints, missing truth and success criteria (#40 Stage C).',
  );
});

test('UXR5-00 DESIGN: solution-family routing is additive to capabilities and never preferred-kind driven', () => {
  const ctx = redContext();
  assert.equal(Object.hasOwn(ctx, 'preferredSolutionKind'), false, 'guard: preferredSolutionKind must stay absent');
  assert.ok(AGENT_CAPABILITY_KINDS.length > 0 && CANONICAL_CAPABILITY_KINDS.length > 0);
  assert.deepEqual(
    [...AGENT_CAPABILITY_KINDS],
    [...CANONICAL_CAPABILITY_KINDS],
    'guard: existing capabilities remain available as implementation primitives',
  );

  const familyRegistry = enumExportContaining(
    { ...CanonicalModule, ...AgentIntentModule } as UnknownRecord,
    PORTFOLIO_FAMILIES,
  );
  assert.ok(
    familyRegistry,
    'RED DESIGN: no additive application-owned routing surface exposes all #36 solution families ' +
      'without replacing capabilities or introducing preferredSolutionKind (#40 Stage D/#36).',
  );
});

test('UXR5-00 DEMONSTRATE: distinct solution families stage heterogeneous non-vacuous demonstrators', () => {
  const workflowSurface = resolveArtifactSurface('workflow_concept');
  const biSurface = resolveArtifactSurface('bi_dashboard');
  const agentSurface = resolveArtifactSurface('prototype');
  assert.equal(workflowSurface.surfaceId, 'artifact-workflow-concept');
  assert.equal(biSurface.surfaceId, 'artifact-bi-dashboard');
  assert.equal(agentSurface.surfaceId, 'artifact-prototype');

  const automationGroups = [
    ['currentFlow', 'beforeFlow', 'currentStateFlow'],
    ['futureFlow', 'proposedFlow', 'targetFlow'],
    ['changedSteps', 'stepChanges', 'changes'],
    ['humanCheckpoints', 'approvalPoints', 'humanControls'],
    ['integrationBoundaries', 'integrations', 'systemBoundaries'],
  ] as const;
  const biGroups = [
    ['dataLineage', 'lineage', 'sources'],
    ['metricDefinitions', 'metrics', 'metricSemantics'],
    ['insight', 'visualInsight', 'signal'],
    ['decisionAction', 'decisionActions', 'action'],
  ] as const;
  const agentGroups = [
    ['scenario', 'scenarioInput', 'input'],
    ['visibleContext', 'context', 'contextVisibleToAgent'],
    ['allowedTools', 'tools', 'toolAuthority'],
    ['approval', 'approvalPoints', 'humanApproval'],
    ['recovery', 'recoveryPath', 'failureRecovery'],
  ] as const;

  const automation = findSemanticRecord(workflowSurface, automationGroups);
  const bi = findSemanticRecord(biSurface, biGroups);
  const agent = findSemanticRecord(agentSurface, agentGroups);
  assert.ok(automation, 'RED DEMONSTRATE: automation surface lacks a family-specific before/after demonstrator contract');
  assert.ok(bi, 'RED DEMONSTRATE: BI surface lacks lineage/metric/insight/decision demonstrator semantics');
  assert.ok(agent, 'RED DEMONSTRATE: agent prototype lacks scenario/context/tools/approval/recovery demonstrator semantics');
  if (automation !== null) assertMaterialSemanticGroups(automation, automationGroups, 'DEMONSTRATE automation');
  if (bi !== null) assertMaterialSemanticGroups(bi, biGroups, 'DEMONSTRATE BI');
  if (agent !== null) assertMaterialSemanticGroups(agent, agentGroups, 'DEMONSTRATE agent');
});

test('UXR5-00 PROVE: every material claim carries a non-vacuous inspectable proof chain', () => {
  const canonical: CanonicalSalesContext = {
    ...redContext(),
    revision: 3,
    turnIds: ['turn-1'],
    facts: [{
      id: 'fact-friction', subject: 'fechamento', predicate: 'contem', value: 'retrabalho',
      status: 'confirmed', source: 'user', confidence: 1,
      supportingTurnIds: ['turn-1'], confirmedByTurnId: 'turn-1',
    }],
    latestUserIntent: { turnId: 'turn-1', text: 'Quero reduzir o retrabalho do fechamento.' },
  };
  const baseSubmission = {
    schemaVersion: 1 as const,
    proposalId: 'proposal-red-prove',
    proposal: {
      schemaVersion: 1 as const, baseRevision: 3, narration: 'O retrabalho pode ser enquadrado sem prometer números.',
      intent: {
        schemaVersion: 1 as const, objective: 'Enquadrar o atrito.', rationale: 'Fato confirmado pelo cliente.',
        capabilities: [], actions: [], quantitativeOpportunities: [], artifactIntents: [], nextQuestion: null,
      },
      factProposals: [], correctionProposals: [], processMutations: [],
      sceneProposal: null, artifactProposals: [], criticRequired: true,
    },
    calculationRequests: [],
  };
  const reasoning = 'O fato fact-friction foi confirmado pelo cliente e sustenta esta conclusão.';
  const uncertainty = 'A consequência operacional exata ainda depende de validação adicional.';
  const consequence = 'A decisão deve permanecer condicional até a incerteza ser resolvida.';
  const baseClaim = {
    id: 'claim-qual', kind: 'qualitative', text: 'O retrabalho consome atenção do time.',
    evidenceIds: ['fact-friction'],
  };
  const withoutProof = validateSellerSubmission({ ...baseSubmission, materialClaims: [baseClaim] }, { canonical });
  assert.equal(
    withoutProof.ok,
    false,
    'RED PROVE: material claims without an inspectable proof chain must be rejected, not silently accepted.',
  );

  const proofVariants: unknown[] = [
    { ...baseClaim, reasoning, uncertainty, consequence },
    { ...baseClaim, proof: { reasoning, uncertainty, consequence } },
    { ...baseClaim, proofChain: { reasoning, uncertainty, consequence } },
    { ...baseClaim, proofChain: [{ reasoning, uncertainty, consequence }] },
  ];
  const accepted = proofVariants
    .map((claim) => validateSellerSubmission({ ...baseSubmission, materialClaims: [claim] }, { canonical }))
    .find((result) => result.ok);
  assert.ok(
    accepted?.ok,
    'RED PROVE: seller contract accepts no coherent proof-chain shape carrying reasoning, uncertainty and consequence (#40 Stage F).',
  );
  if (!accepted?.ok) return;
  const serialized = JSON.stringify(accepted.submission.materialClaims[0]);
  assert.ok(serialized.includes('fact-friction'), 'RED PROVE: accepted proof chain lost its evidence binding');
  assert.ok(serialized.includes(reasoning), 'RED PROVE: accepted proof chain lost non-empty reasoning');
  assert.ok(serialized.includes(uncertainty), 'RED PROVE: accepted proof chain lost explicit uncertainty');
  assert.ok(serialized.includes(consequence), 'RED PROVE: accepted proof chain lost stated consequence');
});

test('UXR5-00 CHALLENGE: correction invalidates dependents and the next projection cannot revive refuted truth', () => {
  const canonical: CanonicalSalesContext = {
    ...redContext(),
    revision: 3,
    turnIds: ['turn-1'],
    facts: [{
      id: 'fact-friction', subject: 'fechamento', predicate: 'contem', value: 'retrabalho',
      status: 'confirmed', source: 'user', confidence: 1,
      supportingTurnIds: ['turn-1'], confirmedByTurnId: 'turn-1',
    }],
    latestUserIntent: { turnId: 'turn-1', text: 'Quero reduzir o retrabalho.' },
  };
  const proposal = {
    schemaVersion: 1 as const,
    baseRevision: 3,
    narration: 'Enquadramento inicial do atrito.',
    intent: {
      schemaVersion: 1 as const,
      objective: 'Enquadrar o atrito.',
      rationale: 'Fato confirmado pelo cliente.',
      capabilities: [],
      actions: [{
        id: 'action-annotate', kind: 'annotate' as const, targetId: 'fact-friction',
        text: 'Atrito confirmado.', evidenceIds: ['fact-friction'],
      }],
      quantitativeOpportunities: [], artifactIntents: [], nextQuestion: null,
    },
    factProposals: [],
    correctionProposals: [{
      id: 'correction-1', targetEvidenceId: 'fact-friction',
      reason: 'Cliente corrigiu o escopo do atrito.', replacementValue: 'espera por aprovação',
      supportingTurnIds: ['turn-1'],
    }],
    processMutations: [],
    sceneProposal: {
      composition: 'focus' as const, focusIds: ['fact-friction'], comparisonIds: [], announcement: null,
    },
    artifactProposals: [{
      id: 'artifact-friction', kind: 'workflow_concept' as const, title: 'Fluxo do fechamento',
      summary: 'Visual dependente do atrito confirmado.', evidenceIds: ['fact-friction'], status: 'conceptual' as const,
    }],
    criticRequired: true,
  };
  const projected = projectExperienceProposal(createReactiveExperienceState({ basedOnRevision: 3 }), proposal, canonical);
  assert.equal(projected.ok, true, 'sanity: evidence-dependent proposal projects');
  if (!projected.ok) return;

  const corrected: CanonicalSalesContext = {
    ...canonical,
    revision: 4,
    facts: canonical.facts.map((fact) => ({ ...fact, status: 'superseded' as const })),
  };
  const reconciled = reconcileReactiveExperience(projected.state, corrected);
  assert.equal(reconciled.actions.find((item) => item.sourceActionId === 'action-annotate')?.status, 'invalidated');
  assert.equal(reconciled.correctionSuggestions.find((item) => item.sourceCorrectionId === 'correction-1')?.status, 'invalidated');
  assert.equal(reconciled.artifacts.find((item) => item.id === 'artifact-friction')?.truthStatus, 'invalidated');

  const followUp = projectExperienceProposal(reconciled, {
    schemaVersion: 1,
    baseRevision: 4,
    narration: 'Reconciliação após a correção do cliente.',
    intent: {
      schemaVersion: 1, objective: 'Reconciliar verdade corrigida.', rationale: 'Não reviver relação refutada.',
      capabilities: [], actions: [], quantitativeOpportunities: [], artifactIntents: [], nextQuestion: null,
    },
    factProposals: [], correctionProposals: [], processMutations: [],
    sceneProposal: null, artifactProposals: [], criticRequired: true,
  }, corrected);
  assert.equal(followUp.ok, true, 'sanity: next projection can reconcile without inventing replacement truth');
  if (!followUp.ok) return;

  const stillPresented = [...followUp.state.scene.focusIds, ...followUp.state.scene.comparisonIds]
    .includes('fact-friction');
  assert.equal(
    stillPresented,
    false,
    'RED CHALLENGE: the next projection still presents invalidated evidence as current scene truth; ' +
      'correction lineage must remain inspectable without reviving the refuted relation (#40 Stage G).',
  );
});

test('UXR5-00 VALIDATE: significant validation has a pre-declared, revision-bound POV contract', () => {
  const validation = findSemanticRecord(redContext(), [
    ['criterion', 'criteria', 'whatIsTested', 'testTarget'],
    ['measurement', 'measurementMethod', 'evidenceMethod', 'method'],
    ['baseline', 'startingPoint', 'currentBaseline'],
    ['threshold', 'expectedRange', 'acceptanceRange'],
    ['owner', 'decisionMaker', 'acceptanceOwner'],
    ['scope', 'validationScope', 'testScope'],
    ['assumptions', 'knownAssumptions'],
    ['endCondition', 'completionCondition'],
    ['result', 'outcome', 'verdict'],
    ['revision', 'version', 'declaredAtRevision', 'lockedAtRevision'],
  ]);
  assert.ok(
    validation,
    'RED VALIDATE: no revision-bound POV contract covers test target, evidence method, baseline, ' +
      'threshold, owner, scope, assumptions, end condition and result (#40 Stage H).',
  );
  if (validation === null) return;
  const validationResult = semanticValue(validation, ['result', 'outcome', 'verdict']);
  assert.ok(
    typeof validationResult === 'string' && ['PASS', 'FAIL', 'INCONCLUSIVE'].includes(validationResult),
    'RED VALIDATE: explicit result field must be PASS/FAIL/INCONCLUSIVE so goalposts cannot move silently.',
  );
});

test('UXR5-00 DECIDE: decision frame exposes value, risk, assumptions, scope, and maturity', () => {
  const canonical: CanonicalSalesContext = {
    ...redContext(),
    revision: 7,
    turnIds: ['turn-1'],
    primaryPain: 'fechamento comprimido',
    desiredOutcome: 'liberar capacidade consultiva',
    latestUserIntent: { turnId: 'turn-1', text: 'Quero decidir com segurança.' },
  };
  const packed = packageContext({
    role: 'seller',
    canonical,
    digest: null,
    recentTurns: [],
    visualState: { sceneId: 'scene-closing', focusedEntityIds: [], activeArtifactIds: [], processNodes: [] },
    budget: { maxInputTokens: 10_000, reservedOutputTokens: 2_000 },
    estimateTokens: (value: unknown) => JSON.stringify(value).length,
  });
  // Sanity: the packager works on the baseline.
  assert.equal(packed.ok, true, 'sanity: context pack builds');
  if (!packed.ok) return;
  const frame = findSemanticRecord(packed.pack, [
    ['problem', 'problemStatement', 'objective', 'outcome', 'primaryPain', 'desiredOutcome'],
    ['selectedSolution', 'selectedCandidate', 'solution', 'candidate', 'blueprint'],
    ['alternatives', 'options'],
    ['evidence', 'evidenceIds', 'verifiedEvidence'],
    ['assumptions'],
    ['unknowns', 'openQuestions', 'uncertainties'],
    ['risks', 'dependencies'],
    ['maturity'],
    ['capability', 'capabilities', 'capabilityState'],
    ['expectedValue', 'value', 'valueDimensions'],
    ['scope', 'scopeBoundary'],
    ['exclusions', 'notIncluded'],
    ['successCriteria', 'criteria'],
    ['nextStep', 'recommendedNextStep'],
  ]);
  assert.ok(
    frame,
    'RED DECIDE: decision frame is incomplete; it must expose objective/problem, selected solution, ' +
      'alternatives, evidence, assumptions, unknowns, risks, maturity/capability, value, scope, ' +
      'exclusions, success criteria and next step (#40 Stage I).',
  );
});

test('UXR5-00 COMMIT: allowlist captures only presales commitments and explicitly excludes fake authority', () => {
  const boundary = enumExportContaining(SellerModule as UnknownRecord, AUTHORIZED_COMMITMENTS);
  assert.ok(
    boundary,
    'RED COMMIT: no application-owned commitment allowlist contains every authorized presales commitment (#40 Stage J).',
  );
  if (boundary === null) return;
  const normalized = boundary.map((value) => String(value).toUpperCase());
  assert.deepEqual(
    [...normalized].sort(),
    [...AUTHORIZED_COMMITMENTS].sort(),
    'RED COMMIT: commitment boundary must be the exact presales allowlist — no missing or extra authority.',
  );
  const forbidden = FORBIDDEN_FAKE_COMMITMENTS.filter((value) => normalized.includes(value));
  assert.deepEqual(
    forbidden,
    [],
    'RED COMMIT: allowlist grants price/discount/legal/payment/deploy/implementation/onboarding authority that this Slice does not have',
  );
});

test('UXR5-00 HANDOFF: generated package is complete, versioned and preserves truth lineage', () => {
  const builder = findFunctionExport(AcceptedTransaction as UnknownRecord, /handoff|transfer.*package|context.*package/i);
  assert.ok(
    builder,
    'RED HANDOFF: no application-owned handoff builder exists at the accepted Trust Kernel boundary (#40 §10/Stage K).',
  );
  if (builder === null) return;

  const canonical: CanonicalSalesContext = {
    ...redContext(),
    revision: 9,
    turnIds: ['turn-user', 'turn-inference', 'turn-correction'],
    primaryPain: 'fechamento com retrabalho',
    desiredOutcome: 'reduzir reprocessamento sem perder controle humano',
    facts: [
      {
        id: 'fact-user', subject: 'fechamento', predicate: 'tem', value: 'retrabalho',
        status: 'confirmed', source: 'user', confidence: 1,
        supportingTurnIds: ['turn-user'], confirmedByTurnId: 'turn-user',
      },
      {
        id: 'fact-inferred', subject: 'causa', predicate: 'pode-ser', value: 'handoff manual',
        status: 'proposed', source: 'inference', confidence: 0.6,
        supportingTurnIds: ['turn-inference'], confirmedByTurnId: null,
      },
      {
        id: 'fact-superseded', subject: 'causa', predicate: 'era', value: 'planilha',
        status: 'superseded', source: 'user', confidence: 1,
        supportingTurnIds: ['turn-user', 'turn-correction'], confirmedByTurnId: 'turn-user',
      },
    ],
    latestUserIntent: { turnId: 'turn-correction', text: 'Quero seguir para planejamento, mantendo essas ressalvas.' },
  };
  const output = builder({
    canonical,
    selectedBlueprint: {
      id: 'solution-current', revision: 7, familyIds: ['AUTOMATION_SYSTEM'],
      assumptions: ['integração ainda não validada'], missingInputs: ['API do ERP'],
      risks: ['permissão de escrita'], integrations: ['ERP'],
      maturity: 'CONCEPT', capability: 'UNKNOWN_NEEDS_VALIDATION',
    },
    calculations: [],
    securityAuthority: ['aprovação humana obrigatória'],
    demoResult: 'INCONCLUSIVE',
    successCriteria: ['sem duplicação de lançamentos'],
    commitments: ['REQUEST_IMPLEMENTATION_PLANNING'],
    exclusions: ['deploy em produção'],
    unresolvedQuestions: ['escopo da API'],
    nextStep: 'validar integração e autoridade',
  });

  const handoff = findSemanticRecord(output, [
    ['version', 'packageVersion', 'revision'],
    ['selectedBlueprint', 'acceptedBlueprint', 'solutionBlueprint', 'selectedSolution'],
    ['familyIds', 'families', 'solutionFamilies'],
    ['evidence', 'facts', 'provenance'],
    ['assumptions'],
    ['missingInputs', 'unknowns'],
    ['calculations'],
    ['risks'],
    ['integrations', 'data'],
    ['securityAuthority', 'security', 'authority'],
    ['maturity'],
    ['capability', 'capabilityState'],
    ['demoResult', 'povResult', 'validationResult'],
    ['successCriteria', 'criteria'],
    ['commitments'],
    ['exclusions'],
    ['unresolvedQuestions', 'openQuestions'],
    ['nextStep', 'recommendedNextStep'],
  ]);
  assert.ok(
    handoff,
    'RED HANDOFF: generated package is missing version/blueprint revision, family, provenance, assumptions, missing inputs, ' +
      'calculations, risks, integrations, security/authority, maturity/capability, demo/POV, criteria, commitments, exclusions, unresolved questions or next step.',
  );
  const blueprint = findRecordById(output, 'solution-current');
  assert.ok(blueprint, 'RED HANDOFF: selected blueprint identity/revision was dropped');
  assert.equal(blueprint?.['revision'], 7, 'RED HANDOFF: selected blueprint revision changed or disappeared');
  const blueprintFamilies = blueprint === null ? undefined : semanticValue(blueprint, ['familyIds', 'families', 'solutionFamilies']);
  assert.ok(
    Array.isArray(blueprintFamilies) && blueprintFamilies.includes('AUTOMATION_SYSTEM'),
    'RED HANDOFF: selected solution family identity was dropped or changed',
  );
  const inferred = findRecordById(output, 'fact-inferred');
  assert.ok(inferred, 'RED HANDOFF: inference lineage was dropped; next stage would need the customer to reconstruct context');
  assert.equal(inferred?.['source'], 'inference', 'RED HANDOFF: inference became authoritative fact');
  assert.equal(inferred?.['status'], 'proposed', 'RED HANDOFF: inference truth status changed during handoff');
  const superseded = findRecordById(output, 'fact-superseded');
  assert.ok(superseded, 'RED HANDOFF: superseded lineage/history was discarded');
  assert.equal(superseded?.['status'], 'superseded', 'RED HANDOFF: superseded truth revived as current');
});

test('UXR5-00 CONTINUE: HANDOFF_READY is the honest presales terminal and fulfillment requires real authority', () => {
  const buyerStates = enumExportContaining(CanonicalModule as UnknownRecord, BUYER_STATES);
  assert.ok(
    buyerStates,
    'RED CONTINUE: application-owned buyer-state model is missing the #40 lifecycle states.',
  );
  const policy = findSemanticRecord(redContext(), [
    ['buyer', 'buyerState', 'state'],
    ['terminalState', 'authorizedTerminal', 'presalesTerminal'],
    ['fulfillmentAuthorized', 'deliveryAuthorized', 'fulfillmentCapability', 'deliveryCapability'],
  ]);
  assert.ok(
    policy,
    'RED CONTINUE: no runtime lifecycle policy can represent HANDOFF_READY as the presales terminal ' +
      'and gate FULFILLMENT_ACTIVE on real authorized capability (#40 Stage L).',
  );
  if (policy === null) return;
  const terminal = policy['terminalState'] ?? policy['authorizedTerminal'] ?? policy['presalesTerminal'];
  assert.equal(terminal, 'HANDOFF_READY', 'RED CONTINUE: presales terminal must be HANDOFF_READY for this Slice');
  const buyer = policy['buyer'] ?? policy['buyerState'] ?? policy['state'];
  const presalesStates = BUYER_STATES.slice(0, BUYER_STATES.indexOf('HANDOFF_READY') + 1) as readonly string[];
  assert.ok(
    typeof buyer === 'string' && presalesStates.includes(buyer),
    'RED CONTINUE: buyer state must remain a valid presales state at or before HANDOFF_READY in this Slice',
  );
  const fulfillment = policy['fulfillmentAuthorized'] ?? policy['deliveryAuthorized']
    ?? policy['fulfillmentCapability'] ?? policy['deliveryCapability'];
  assert.notEqual(
    buyer,
    'FULFILLMENT_ACTIVE',
    'RED CONTINUE: runtime claims active fulfillment without an authorized delivery capability',
  );
  assert.notEqual(
    fulfillment,
    true,
    'RED CONTINUE: runtime grants fulfillment authority in a presales-only Slice',
  );
});

test('UXR5-00 CONDUCTOR: agent presence speaks the #25 semantic vocabulary, not generic phases', () => {
  const presence = resolveSpatialAgentPresence({
    status: 'idle',
    mode: 'process',
    focusedNodeId: null,
    semanticTargets: [],
    positions: new Map(),
    mobile: false,
  });
  // Sanity: spatial presence resolves on the baseline.
  assert.equal(typeof presence.visible, 'boolean');
  // Namespace sanity: the module itself is the Conductor surface (#25).
  assert.ok('SPATIAL_AGENT_NODE_ID' in SpatialPresence);
  // RED: #25 §4 requires REST/ORIENT/POINT/ACQUIRE/HOLD/MOVE/PLACE/CONNECT/
  // GROUP/UNGROUP/REVEAL/COMPARE/QUANTIFY/QUESTION/CONFIRM/CORRECT/DEFER/
  // RECOVER/COMPOSE_DECISION. Baseline presence speaks generic pipeline phases
  // (observing/thinking/asking…), so lifecycle choreography in #40 §15
  // (QUESTION frames a missing slot, CORRECT retracts lineage, COMPOSE_DECISION
  // converges proof) has no physicalized actuator.
  const vocabulary = enumExportContaining(SpatialPresence as UnknownRecord, CONDUCTOR_SEMANTIC_STATES);
  assert.ok(
    vocabulary,
    'RED CONDUCTOR: no exported Conductor semantic-state vocabulary covering ' +
      CONDUCTOR_SEMANTIC_STATES.join('/') +
      ' (#25 §4, #40 §15; owner stage: Spatial Conductor).',
  );
  if (vocabulary === null) return;
  assert.ok(
    vocabulary.includes(presence.phase),
    `RED CONDUCTOR: resolved presence still emits generic phase ${JSON.stringify(presence.phase)} instead of a #25 semantic state.`,
  );
});

function acceptedRecoveryState(revision: number) {
  return {
    sessionId: 'session-uxr5-recovery',
    canonicalRevision: revision,
    verifiedCalculations: [],
    opportunities: [],
    evidence: [],
    reactiveState: createReactiveExperienceState({ basedOnRevision: revision }),
  } as const;
}

for (const failure of [
  { name: 'network interruption', event: { type: 'ASK_FAILED' as const, code: 'NETWORK_UNAVAILABLE' } },
  { name: 'retryable store/provider failure', event: { type: 'ASK_FAILED' as const, code: 'STORE_UNAVAILABLE' } },
  { name: 'correction transport failure', event: { type: 'CORRECTION_FAILED' as const, code: 'NETWORK_UNAVAILABLE' } },
]) {
  test(`UXR5-00 RECOVERY: ${failure.name} preserves accepted world and enters deterministic RECOVER`, () => {
    const actor = createActor(appMachine);
    actor.start();
    actor.send({ type: 'ENTER_PROCESS' });
    actor.send({
      type: 'ASK_ACCEPTED',
      response: {
        ok: true, idempotent: false, mode: 'agent',
        narration: 'Estado aceito antes da interrupção.',
        nextQuestion: null, state: acceptedRecoveryState(4),
      },
    });
    const accepted = actor.getSnapshot();
    if (failure.event.type === 'CORRECTION_FAILED') actor.send({ type: 'CORRECTION_REQUESTED' });
    actor.send(failure.event);
    const recovering = actor.getSnapshot();

    assert.strictEqual(
      recovering.context.agentState,
      accepted.context.agentState,
      'guard: transient failure must preserve the exact accepted world until reconciliation succeeds',
    );
    assert.equal(
      recovering.value,
      accepted.value,
      'guard: transient failure must preserve spatial navigation state',
    );
    assert.equal(
      recovering.context.agentStatus,
      'recovery',
      `RED RECOVERY: ${failure.name} becomes generic error instead of explicit deterministic RECOVER (#40 §17).`,
    );

    actor.send({
      type: 'ASK_ACCEPTED',
      response: {
        ok: true, idempotent: false, mode: 'agent',
        narration: 'Reconciliação concluída sem duplicar o mundo aceito.',
        nextQuestion: null, state: acceptedRecoveryState(5),
      },
    });
    const resumed = actor.getSnapshot();
    assert.equal(resumed.context.agentStatus, 'awaiting_user', 'RED RECOVERY: safe retry/reconcile path did not leave recovery');
    assert.ok(
      (resumed.context.agentState?.canonicalRevision ?? -1) >= 4,
      'RED RECOVERY: retry/reconcile rolled canonical state backward',
    );
    actor.stop();
  });
}

test('UXR5-00 RECOVERY guard: hard validation failure does not masquerade as retryable recovery', () => {
  const actor = createActor(appMachine);
  actor.start();
  actor.send({ type: 'ENTER_PROCESS' });
  actor.send({
    type: 'ASK_ACCEPTED',
    response: {
      ok: true, idempotent: false, mode: 'agent',
      narration: 'Estado aceito.',
      nextQuestion: null, state: acceptedRecoveryState(4),
    },
  });
  actor.send({ type: 'ASK_FAILED', code: 'INVALID_INPUT' });
  const failed = actor.getSnapshot();
  assert.equal(failed.context.agentStatus, 'error');
  assert.equal(failed.context.agentState?.canonicalRevision, 4, 'guard: hard validation failure must not rollback accepted Canon');
  actor.stop();
});
