import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvasTelemetryRecorder } from '../../src/experience/canvas-telemetry.ts';
import { createProcessGraph } from '../../src/canvas/domain.ts';
import { EXPERIENCE_ACTION_KINDS } from '../../src/experience/agent-intent.ts';
import {
  runAdaptationGate,
  type AdaptationGateInput,
} from '../../src/experience/adaptation-gate.ts';
import { validateExperienceProposal } from '../../src/experience/experience-validation.ts';
import {
  createReactiveExperienceState,
  projectExperienceProposal,
} from '../../src/experience/experience-projector.ts';
import type { ReactiveExperienceState } from '../../src/experience/reactive-experience-state.ts';

function canonical() {
  return {
    schemaVersion: 1,
    sessionId: 'session-gate',
    revision: 7,
    turnIds: ['turn-7'],
    facts: [],
    primaryPain: null,
    desiredOutcome: null,
    knownConsequences: [],
    objections: [],
    quantitativeObservations: [{
      id: 'obs-1', metric: 'conferencias por mes', value: 220, unit: 'occurrence', period: 'month',
      status: 'confirmed', source: 'user', supportingTurnIds: ['turn-7'], confirmedByTurnId: 'turn-7',
    }],
    verifiedCalculations: [{
      id: 'calc-1', kind: 'capacity', inputObservationIds: ['obs-1'], expression: '1', resultValue: 44,
      resultUnit: 'hour/month', computedBy: 'application', basedOnRevision: 7,
      status: 'valid' as const, invalidatedAtRevision: null,
    }],
    openUncertainties: [], opportunities: [], artifacts: [], currentSceneId: null,
    latestUserIntent: { turnId: 'turn-7', text: 'Quero enxergar o gargalo.' },
  } as const;
}

function baseGraph() {
  return createProcessGraph(
    [
      { id: 'node-a', kind: 'evidence', label: 'Evidencia A', summary: 'Resumo A.', provenance: 'user_stated' },
      { id: 'node-b', kind: 'evidence', label: 'Evidencia B', summary: 'Resumo B.', provenance: 'user_stated' },
    ] as const,
    [],
  );
}

function rawProposal(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    baseRevision: 7,
    narration: 'O gargalo agora tem forma visível.',
    intent: {
      schemaVersion: 1,
      objective: 'Expor o gargalo.',
      rationale: 'Há evidência suficiente.',
      capabilities: [],
      actions: [
        { id: 'act-focus', kind: 'focus', targetId: 'node-a', reason: 'Centralizar o gargalo.' },
        { id: 'act-note', kind: 'annotate', targetId: 'node-a', text: '44 h/mês comprometidas.', evidenceIds: ['fact-1'] },
      ],
      quantitativeOpportunities: [],
      artifactIntents: [],
      nextQuestion: null,
    },
    factProposals: [{
      id: 'fact-1', subject: 'fechamento', predicate: 'consome', value: 'capacidade',
      source: 'inference', supportingTurnIds: [],
    }],
    correctionProposals: [],
    processMutations: [],
    sceneProposal: { composition: 'focus', focusIds: ['node-a'], comparisonIds: [], announcement: 'Gargalo em foco.' },
    artifactProposals: [{
      id: 'artifact-1', kind: 'bi_dashboard', title: 'Painel do gargalo', summary: 'Visão conceitual.',
      evidenceIds: ['fact-1'], status: 'conceptual',
    }],
    criticRequired: true,
    ...overrides,
  };
}

function committedTurn(raw: Record<string, unknown> = rawProposal()) {
  const validated = validateExperienceProposal(raw, { expectedBaseRevision: 7 });
  if (!validated.ok) throw new Error(`fixture must validate: ${validated.code}:${validated.path}`);
  const projected = projectExperienceProposal(
    createReactiveExperienceState({ basedOnRevision: 7 }),
    validated.proposal,
    canonical(),
  );
  if (!projected.ok) throw new Error(`fixture must project: ${projected.code}`);
  return { proposal: validated.proposal, reactiveState: projected.state };
}

function gateInput(overrides: Partial<AdaptationGateInput> = {}): AdaptationGateInput {
  const { proposal, reactiveState } = committedTurn();
  return {
    proposal,
    canonical: canonical(),
    reactiveState,
    baseGraph: baseGraph(),
    sessionId: 'session-gate',
    ...overrides,
  };
}

function planKeys(value: unknown, prefix = 'plan'): string[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => planKeys(item, `${prefix}[${index}]`));
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => [key, ...planKeys(nested, `${prefix}.${key}`)]);
  }
  return [];
}

test('WP04 gate resolves validated semantics into a frozen staged Presentation Plan', () => {
  const recorder = createCanvasTelemetryRecorder();
  const result = runAdaptationGate({ ...gateInput(), telemetry: recorder });
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const plan = result.plan;
  assert.ok(Object.isFrozen(plan));
  assert.equal(plan.version, 1);
  assert.equal(plan.catalogVersion, 1);
  assert.equal(plan.gateVersion, 1);
  assert.equal(plan.basedOnRevision, 7);
  assert.equal(plan.projectionRevision, 1);
  assert.equal(plan.composition, 'focus');
  assert.deepEqual(plan.focusIds, ['node-a']);
  assert.deepEqual(plan.comparisonIds, []);
  assert.equal(plan.announcement, 'Gargalo em foco.');
  assert.equal(plan.artifacts.length, 1);
  assert.equal(plan.artifacts[0]?.surfaceId, 'artifact-bi-dashboard');
  assert.equal(plan.artifacts[0]?.landmarkLabel, 'Painel de inteligência gerencial');
  assert.equal(plan.artifacts[0]?.maturity, 'conceptual');
  assert.equal(plan.camera.targets.length > 0, true);
  assert.deepEqual(plan.disclosure, { outcome: 'none-required' });

  assert.deepEqual(result.telemetry, [
    { kind: 'action-projected', actionKind: 'focus', composition: 'focus' },
    { kind: 'action-projected', actionKind: 'annotate', composition: 'focus' },
  ]);
  assert.ok(Object.isFrozen(result.telemetry));

  const rerun = runAdaptationGate(gateInput());
  assert.equal(rerun.ok, true);
  if (!rerun.ok) return;
  assert.deepEqual(rerun.plan, plan);
});

test('WP04 gate binds the session: foreign session ids fail closed without telemetry leakage', () => {
  const before = JSON.stringify(canonical());
  const result = runAdaptationGate({ ...gateInput(), sessionId: 'session-attacker' });
  assert.deepEqual(
    result.ok ? null : { stage: result.stage, code: result.code, telemetryCode: result.telemetryCode },
    { stage: 'session-authority', code: 'SESSION_MISMATCH', telemetryCode: null },
  );
  if (result.ok) return;
  assert.deepEqual(result.telemetry, []);
  assert.equal(JSON.stringify(canonical()), before);
});

test('WP04 gate rejects stale projection bindings with the fixed taxonomy', () => {
  const { reactiveState } = committedTurn();
  const staleState: Readonly<ReactiveExperienceState> = {
    ...reactiveState,
    basedOnRevision: 6,
  };
  const result = runAdaptationGate({ ...gateInput(), reactiveState: staleState, telemetry: createCanvasTelemetryRecorder() });
  assert.deepEqual(
    result.ok ? null : { stage: result.stage, code: result.code, telemetryCode: result.telemetryCode },
    { stage: 'revision-binding', code: 'STALE_REVISION', telemetryCode: 'stale-revision' },
  );
  if (result.ok) return;
  assert.deepEqual(result.telemetry, [{ kind: 'stale-revision', revision: 6 }]);
});

test('WP04 gate resolves spatial targets through the adapter: ghost targets fail closed', () => {
  const ghost = rawProposal({
    intent: {
      ...(rawProposal().intent as Record<string, unknown>),
      actions: [{ id: 'act-ghost', kind: 'focus', targetId: 'node-ghost', reason: 'Foco fantasma.' }],
    },
    sceneProposal: { composition: 'focus', focusIds: ['node-ghost'], comparisonIds: [], announcement: null },
  });
  const validated = validateExperienceProposal(ghost, { expectedBaseRevision: 7 });
  assert.equal(validated.ok, true);
  if (!validated.ok) return;
  const projected = projectExperienceProposal(
    createReactiveExperienceState({ basedOnRevision: 7 }),
    validated.proposal,
    canonical(),
  );
  assert.equal(projected.ok, true);
  if (!projected.ok) return;

  const result = runAdaptationGate({
    proposal: validated.proposal,
    canonical: canonical(),
    reactiveState: projected.state,
    baseGraph: baseGraph(),
    sessionId: 'session-gate',
    telemetry: createCanvasTelemetryRecorder(),
  });
  assert.deepEqual(
    result.ok ? null : { stage: result.stage, code: result.code, telemetryCode: result.telemetryCode },
    { stage: 'target-resolution', code: 'UNKNOWN_ACTION_TARGET', telemetryCode: 'missing-evidence' },
  );
  if (result.ok) return;
  assert.deepEqual(result.telemetry, [{ kind: 'intent-rejected', rejectionCode: 'missing-evidence', revision: 7 }]);
});

test('WP04 gate rejects forged models, artifact kinds, URLs and executable payloads', () => {
  const forgedComposition = {
    ...committedTurn().proposal,
    sceneProposal: { composition: 'cinematic', focusIds: [], comparisonIds: [], announcement: null },
  } as never;
  const modelMiss = runAdaptationGate({ ...gateInput(), proposal: forgedComposition, telemetry: createCanvasTelemetryRecorder() });
  assert.deepEqual(
    modelMiss.ok ? null : { stage: modelMiss.stage, code: modelMiss.code, telemetryCode: modelMiss.telemetryCode },
    { stage: 'catalog', code: 'UNKNOWN_MODEL', telemetryCode: 'unknown-kind' },
  );
  if (!modelMiss.ok) {
    assert.deepEqual(modelMiss.telemetry, [{ kind: 'intent-rejected', rejectionCode: 'unknown-kind', revision: 7 }]);
  } else {
    assert.fail('forged composition must not resolve');
  }

  const forgedArtifact = {
    ...committedTurn().proposal,
    artifactProposals: [{
      id: 'artifact-evil', kind: 'holodeck', title: 'X', summary: 'Y', evidenceIds: [], status: 'conceptual',
    }],
  } as never;
  const artifactMiss = runAdaptationGate({ ...gateInput(), proposal: forgedArtifact, telemetry: createCanvasTelemetryRecorder() });
  assert.deepEqual(
    artifactMiss.ok ? null : { stage: artifactMiss.stage, code: artifactMiss.code, telemetryCode: artifactMiss.telemetryCode },
    { stage: 'catalog', code: 'CATALOG_MISS', telemetryCode: 'catalog-miss' },
  );
  if (!artifactMiss.ok) assert.deepEqual(artifactMiss.telemetry, [{ kind: 'catalog-miss' }]);
  else assert.fail('forged artifact kind must not resolve');

  const urlSmuggled = { ...rawProposal(), url: 'https://evil.example/widget.js' };
  assert.equal(validateExperienceProposal(urlSmuggled, { expectedBaseRevision: 7 }).ok, false);

  const scriptAnnouncement = {
    ...committedTurn().proposal,
    sceneProposal: { composition: 'focus', focusIds: ['node-a'], comparisonIds: [], announcement: '<script>alert(1)</script>' },
  } as never;
  const scriptRejected = runAdaptationGate({ ...gateInput(), proposal: scriptAnnouncement, telemetry: createCanvasTelemetryRecorder() });
  assert.deepEqual(scriptRejected.ok ? null : scriptRejected.code, 'EXECUTABLE_SURFACE');
  if (!scriptRejected.ok) {
    assert.equal(scriptRejected.stage, 'policy');
    assert.equal(scriptRejected.telemetryCode, null);
  } else {
    assert.fail('executable announcement must not reach a plan');
  }

  // Action reasons never enter the plan or any rendered surface (validator-owned
  // inert metadata): the validator must reject the payload upstream, and the
  // gate must accept the turn while leaving zero trace of the payload in the plan.
  const smuggledReason = {
    ...committedTurn().proposal,
    intent: {
      ...committedTurn().proposal.intent,
      actions: [{ id: 'act-evil', kind: 'focus', targetId: 'node-a', reason: 'window.location = 1' }],
    },
  } as never;
  const smuggledRaw = {
    ...rawProposal(),
    intent: {
      ...(rawProposal().intent as Record<string, unknown>),
      actions: [{ id: 'act-evil', kind: 'focus', targetId: 'node-a', reason: 'window.location = 1' }],
    },
  };
  const smuggledValidation = validateExperienceProposal(smuggledRaw, { expectedBaseRevision: 7 });
  assert.deepEqual(smuggledValidation.ok ? null : smuggledValidation.code, 'EXECUTABLE_SURFACE');
  const reasonGate = runAdaptationGate({ ...gateInput(), proposal: smuggledReason });
  assert.equal(reasonGate.ok, true);
  if (!reasonGate.ok) return;
  assert.ok(!JSON.stringify(reasonGate.plan).includes('window.location'));

  const overlong = {
    ...committedTurn().proposal,
    sceneProposal: { composition: 'focus', focusIds: ['node-a'], comparisonIds: [], announcement: 'A'.repeat(601) },
  } as never;
  const a11y = runAdaptationGate({ ...gateInput(), proposal: overlong, telemetry: createCanvasTelemetryRecorder() });
  assert.deepEqual(
    a11y.ok ? null : { stage: a11y.stage, code: a11y.code, telemetryCode: a11y.telemetryCode },
    { stage: 'policy', code: 'ANNOUNCEMENT_LIMIT_EXCEEDED', telemetryCode: 'a11y-violation' },
  );
});

test('WP04 plan carries references and screened prose, never value payloads or imperative directives', () => {
  const result = runAdaptationGate(gateInput());
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const keys = new Set(planKeys(result.plan));
  const forbidden = [
    'expression', 'resultValue', 'resultUnit', 'value', 'values', 'observation',
    'secret', 'payload', 'html', 'url', 'component', 'module', 'script',
    'viewport', 'coordinates', 'focusNode', 'querySelector', 'transform',
  ];
  for (const key of forbidden) {
    assert.ok(!keys.has(key), `plan must not carry ${key}`);
  }
  for (const quantification of result.plan.quantifications) {
    assert.deepEqual(new Set(Object.keys(quantification)), new Set(['calculationId', 'targetId']));
  }
  assert.ok(!JSON.stringify(result.plan).includes('resultValue'));
});

test('WP04 gate passes narration-only turns through with stable composition and no usage telemetry', () => {
  const validated = validateExperienceProposal(
    {
      ...rawProposal(),
      narration: 'Nenhuma mudança visual é necessária neste turno.',
      intent: {
        ...(rawProposal().intent as Record<string, unknown>),
        actions: [],
      },
      sceneProposal: null,
      factProposals: [],
      artifactProposals: [],
    },
    { expectedBaseRevision: 7 },
  );
  assert.equal(validated.ok, true);
  if (!validated.ok) return;
  const projected = projectExperienceProposal(
    createReactiveExperienceState({ basedOnRevision: 7 }),
    validated.proposal,
    canonical(),
  );
  assert.equal(projected.ok, true);
  if (!projected.ok) return;

  const recorder = createCanvasTelemetryRecorder();
  const result = runAdaptationGate({
    proposal: validated.proposal,
    canonical: canonical(),
    reactiveState: projected.state,
    baseGraph: baseGraph(),
    sessionId: 'session-gate',
    telemetry: recorder,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.plan.composition, 'stable');
  assert.deepEqual(result.plan.focusIds, []);
  assert.deepEqual(result.plan.artifacts, []);
  assert.deepEqual(result.telemetry, []);
});

test('WP04 gate adds no model-visible action kinds and leaves canonical truth untouched', () => {
  assert.equal(EXPERIENCE_ACTION_KINDS.length, 11);
  const before = JSON.stringify(canonical());
  const input = gateInput();
  const result = runAdaptationGate(input);
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(canonical()), before);
  assert.equal(JSON.stringify(input.reactiveState), JSON.stringify(result.ok ? input.reactiveState : null));
});
