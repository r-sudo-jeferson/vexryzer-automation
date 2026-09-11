import test from 'node:test';
import assert from 'node:assert/strict';
import type { CanonicalSalesContext, VerifiedCalculation } from '../../src/ai/context/canonical-sales-context.ts';
import { applyContextMutation as applyCanonicalContextMutation } from '../../src/ai/context/context-reducer.ts';
import { computeVerifiedCalculation as computeCanonicalCalculation } from '../../src/ai/quant/calculation-engine.ts';
import type { ProviderRouteDefinition } from '../../src/ai/providers/provider-registry.ts';
import type { ProviderChatClientResult } from '../../src/server/ai/providers/provider-chat-client.ts';
import {
  buildSellerProviderMessages,
  runSellerTurn,
  type SellerTurnRuntimeDependencies,
  type SellerTurnRuntimeInput,
} from '../../src/server/ai/seller/seller-turn-runtime.ts';

function canonical(revision = 7): CanonicalSalesContext {
  return Object.freeze({
    schemaVersion: 1,
    sessionId: 'session-1',
    revision,
    turnIds: Object.freeze([]),
    facts: Object.freeze([]),
    primaryPain: null,
    desiredOutcome: null,
    knownConsequences: Object.freeze([]),
    objections: Object.freeze([]),
    quantitativeObservations: Object.freeze([]),
    verifiedCalculations: Object.freeze([]),
    openUncertainties: Object.freeze([]),
    opportunities: Object.freeze([]),
    artifacts: Object.freeze([]),
    currentSceneId: null,
    latestUserIntent: Object.freeze({ turnId: 'turn-1', text: 'Quero reduzir retrabalho.' }),
  });
}

function route(overrides: Partial<ProviderRouteDefinition> = {}): Readonly<ProviderRouteDefinition> {
  return Object.freeze({
    routeId: 'deepseek-v4-pro-seller',
    family: 'deepseek',
    modelId: 'deepseek-v4-pro',
    roles: Object.freeze(['seller'] as const),
    tier: 'primary',
    priority: 10,
    enabledByDefault: true,
    credentialEnvName: 'DEEPSEEK_API_KEY',
    credentialScope: 'server',
    billingAuthorization: 'PASS',
    protocolCompatibility: 'PASS',
    sellerQuality: 'PASS',
    criticQuality: 'NOT_APPLICABLE',
    composerQuality: 'NOT_APPLICABLE',
    harnessCompatibility: 'NOT_APPLICABLE',
    workshopSafety: 'NOT_APPLICABLE',
    workshopHarness: null,
    runtimeActivation: 'PASS',
    capabilities: Object.freeze({ streaming: 'PASS', tools: 'PASS', structuredArguments: 'PASS' } as const),
    maxInputTokens: 16_000,
    emergencyInputTokens: 4_000,
    evidence: Object.freeze({ verifiedSha: 'fixture', runId: 'fixture' }),
    ...overrides,
  });
}

function budgetFor(item: Readonly<ProviderRouteDefinition>) {
  assert.notEqual(item.maxInputTokens, null);
  assert.notEqual(item.emergencyInputTokens, null);
  return Object.freeze({
    routeId: item.routeId,
    budget: Object.freeze({
      maxInputTokens: item.maxInputTokens! + 2_000,
      reservedOutputTokens: 2_000,
      emergencyInputTokens: item.emergencyInputTokens!,
    }),
  });
}

function submissionTool(revision: number, id = 'tool-submit', proposalId = `proposal-${revision}`) {
  return Object.freeze({
    id,
    type: 'function' as const,
    function: Object.freeze({
      name: 'submit_seller_submission',
      arguments: JSON.stringify({
        submission: {
          schemaVersion: 1,
          proposalId,
          proposal: { baseRevision: revision },
          materialClaims: [],
          calculationRequests: [],
        },
      }),
    }),
  });
}

function observationTool(
  _revision: number,
  observations: readonly {
    id: string;
    kind: string;
    turnId: string;
    quote: string;
    value: number;
  }[],
  toolId = 'tool-observations',
) {
  return Object.freeze({
    id: toolId,
    type: 'function' as const,
    function: Object.freeze({
      name: 'capture_user_observations',
      arguments: JSON.stringify({
        observations: observations.map((item) => ({
          kind: item.kind,
          quote: item.quote,
          value: item.value,
        })),
      }),
    }),
  });
}

function calculationTool(
  _revision: number,
  _requestId: string,
  toolId: string,
  occurrencesPerMonthObservationId = 'obs-volume',
  minutesPerOccurrenceObservationId = 'obs-minutes',
) {
  return Object.freeze({
    id: toolId,
    type: 'function' as const,
    function: Object.freeze({
      name: 'request_calculations',
      arguments: JSON.stringify({
        requests: [{
          kind: 'monthly_workload',
          occurrencesPerMonthObservationId,
          minutesPerOccurrenceObservationId,
        }],
      }),
    }),
  });
}

function completion(toolCalls: readonly ReturnType<typeof submissionTool>[], content = ''): ProviderChatClientResult {
  return Object.freeze({ ok: true, completion: Object.freeze({ content, toolCalls: Object.freeze([...toolCalls]), finishReason: 'tool_calls' }) });
}

function packageOk(input: Parameters<SellerTurnRuntimeDependencies['packageContext']>[0]) {
  return {
    ok: true as const,
    pack: Object.freeze({
      schemaVersion: 1 as const,
      role: 'seller' as const,
      canonicalRevision: input.canonical.revision,
      marker: `full-${input.canonical.revision}`,
      metadata: Object.freeze({ estimatedInputTokens: 300 }),
    }),
  };
}

function calculationOk(context: CanonicalSalesContext, request: { id: string }) {
  return {
    ok: true as const,
    calculation: Object.freeze({
      id: request.id,
      kind: 'capacity',
      inputObservationIds: Object.freeze(['obs-volume', 'obs-minutes']),
      expression: 'verified expression',
      resultValue: 12,
      resultUnit: 'hour/month',
      computedBy: 'application' as const,
      basedOnRevision: context.revision,
      status: 'valid' as const,
      invalidatedAtRevision: null,
    }),
  };
}

function commitCalculations(context: CanonicalSalesContext, envelope: { mutation: { calculations?: readonly VerifiedCalculation[] } }) {
  const additions = envelope.mutation.calculations ?? [];
  return {
    ok: true as const,
    context: Object.freeze({
      ...context,
      revision: context.revision + 1,
      verifiedCalculations: Object.freeze([...context.verifiedCalculations, ...additions]),
    }),
  };
}

function validateSubmission(value: unknown) {
  const raw = value as { schemaVersion: 1; proposalId: string; proposal: Record<string, unknown>; materialClaims: unknown[]; calculationRequests: unknown[] };
  return {
    ok: true as const,
    submission: Object.freeze({
      schemaVersion: 1 as const,
      proposalId: raw.proposalId,
      proposal: Object.freeze({ ...raw.proposal }),
      materialClaims: Object.freeze([...raw.materialClaims]),
      calculationRequests: Object.freeze([...raw.calculationRequests]),
    }),
  };
}

function baseInput(
  routes: readonly Readonly<ProviderRouteDefinition>[],
  executeProviderChatStream: SellerTurnRuntimeDependencies['executeProviderChatStream'],
  dependencyOverrides: Partial<SellerTurnRuntimeDependencies> = {},
): SellerTurnRuntimeInput {
  return {
    canonical: canonical(),
    digest: null,
    recentTurns: Object.freeze([{ id: 'turn-1', role: 'user', text: 'Quero reduzir retrabalho.' }]),
    visualState: Object.freeze({ sceneId: null, focusedEntityIds: Object.freeze([]), activeArtifactIds: Object.freeze([]) }),
    routes,
    routeBudgets: Object.freeze(routes.map(budgetFor)),
    runtimeStates: Object.freeze(routes.map((item) => Object.freeze({ routeId: item.routeId, circuit: 'closed' as const, quota: 'available' as const }))),
    estimateTokens: () => 100,
    resolveCredential: () => 'server-secret',
    serverConfig: Object.freeze({}),
    timeoutMs: 10_000,
    dependencies: {
      packageContext: packageOk as unknown as SellerTurnRuntimeDependencies['packageContext'],
      computeVerifiedCalculation: calculationOk as SellerTurnRuntimeDependencies['computeVerifiedCalculation'],
      applyContextMutation: commitCalculations as SellerTurnRuntimeDependencies['applyContextMutation'],
      validateSellerSubmission: validateSubmission as unknown as SellerTurnRuntimeDependencies['validateSellerSubmission'],
      executeProviderChatStream,
      ...dependencyOverrides,
    },
  };
}

test('builds every Seller provider message from the revision-bound dispatch context and rejects provider conversation authority keys', () => {
  const envelope = Object.freeze({
    schemaVersion: 1 as const,
    routeId: 'deepseek-v4-pro-seller',
    providerFamily: 'deepseek' as const,
    modelId: 'deepseek-v4-pro',
    role: 'seller' as const,
    canonicalRevision: 7,
    contextMode: 'full' as const,
    fallbackReason: null,
    credentialEnvName: 'DEEPSEEK_API_KEY',
    context: Object.freeze({ schemaVersion: 1 as const, canonicalRevision: 7, marker: 'canon-derived' }),
  });
  const messages = buildSellerProviderMessages(envelope);
  assert.equal(messages.length, 2);
  assert.equal(messages[0]?.role, 'system');
  if (messages[0] === undefined || messages[0].role !== 'system') throw new Error('expected Seller system instruction');
  assert.match(messages[0].content, /application binds canonical revision.*request identifiers/i);
  assert.match(messages[0].content, /semantic kind.*exact quote.*unit.*period/i);
  assert.match(messages[0].content, /no explicit numeric token.*do not call capture_user_observations/i);
  assert.match(messages[0].content, /Action fields must match kind.*focus\/reveal.*targetId\+reason.*compare\/de_emphasize.*targetIds\+reason/i);
  assert.match(messages[0].content, /Material claim fields must match kind.*verified_numeric.*calculationId.*qualitative.*evidenceIds/i);
  assert.match(messages[0].content, /materially supported capabilities.*accounting-native.*semantic UI/i);
  assert.match(messages[0].content, /repairRequest.*structural correction hint.*never canonical truth/i);
  assert.equal(messages[1]?.role, 'user');
  const userMessage = messages[1];
  if (userMessage === undefined || userMessage.role !== 'user') throw new Error('expected bounded user context message');
  const payload = JSON.parse(userMessage.content) as { canonicalRevision: number; contextMode: string; context: { marker: string } };
  assert.equal(payload.canonicalRevision, 7);
  assert.equal(payload.contextMode, 'full');
  assert.equal(payload.context.marker, 'canon-derived');
  assert.equal(JSON.stringify(messages).includes('server-secret'), false);

  assert.throws(() => buildSellerProviderMessages({
    ...envelope,
    context: { schemaVersion: 1, canonicalRevision: 7, providerConversationId: 'provider-owned' },
  } as never), /Provider conversation authority/);
});

test('rejects route and token-budget divergence before packaging or provider execution', async () => {
  const primary = route();
  let calls = 0;
  const input = baseInput([primary], async () => { calls += 1; return completion([submissionTool(7)]) as never; });
  input.routeBudgets = [{
    routeId: primary.routeId,
    budget: { maxInputTokens: 18_001, reservedOutputTokens: 2_000, emergencyInputTokens: 4_000 },
  }];
  const result = await runSellerTurn(input);
  if (result.ok || result.code !== 'INVALID_RUNTIME_CONFIG') throw new Error(`unexpected result: ${JSON.stringify(result)}`);
  assert.equal(result.detail, 'ROUTE_BUDGET_MISMATCH');
  assert.equal(calls, 0);
});

test('primary Seller call requires only full context and final submission is accepted only through Seller validator', async () => {
  const primary = route();
  let validatorCalls = 0;
  const observedMessages: unknown[] = [];
  const input = baseInput([primary], async (providerInput) => {
    observedMessages.push(providerInput.messages);
    return completion([submissionTool(7)]);
  }, {
    validateSellerSubmission: ((value: unknown) => { validatorCalls += 1; return validateSubmission(value); }) as never,
  });
  const result = await runSellerTurn(input);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.routeId, primary.routeId);
  assert.equal(result.canonical.revision, 7);
  assert.equal(validatorCalls, 1);
  const messages = observedMessages[0] as Array<{ role: string; content: string }>;
  const payload = JSON.parse(messages[1]!.content) as { contextMode: string; canonicalRevision: number; context: { marker: string } };
  assert.equal(payload.contextMode, 'full');
  assert.equal(payload.canonicalRevision, 7);
  assert.equal(payload.context.marker, 'full-7');
});

test('Critic revision request is same-revision, calculation-free, and requires a distinct proposal id', async (t) => {
  const primary = route();
  const revisionRequest = Object.freeze({
    rootProposalId: 'proposal-7',
    previousProposalId: 'proposal-7',
    review: Object.freeze({
      schemaVersion: 1 as const,
      proposalId: 'proposal-7',
      basedOnRevision: 7,
      verdict: 'REVISE' as const,
      findings: Object.freeze([Object.freeze({
        id: 'finding-1',
        code: 'USER_INTENT_MISMATCH' as const,
        severity: 'revise' as const,
        summary: 'Align the move to the confirmed objective.',
        evidenceIds: Object.freeze([]),
      })]),
    }),
  });

  await t.test('accepts a newly identified revised proposal and exposes only the final submission tool', async () => {
    let observed = '';
    let observedTools: readonly { function: { name: string } }[] = [];
    const input = baseInput([primary], async (providerInput) => {
      observed = (providerInput.messages[1] as { content: string }).content;
      observedTools = providerInput.tools;
      return completion([submissionTool(7, 'tool-revised', 'proposal-7-revised')]);
    });
    input.revisionRequest = revisionRequest;
    const result = await runSellerTurn(input);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.submission.proposalId, 'proposal-7-revised');
    assert.equal(observed.includes('"previousProposalId":"proposal-7"'), true);
    assert.deepEqual(observedTools.map((tool) => tool.function.name), ['submit_seller_submission']);
  });

  await t.test('rejects calculation tool use and reused proposal id during revision', async () => {
    const calculationInput = baseInput([primary], async () => completion([
      calculationTool(7, 'calc-revision', 'tool-calc-revision'),
    ] as never));
    calculationInput.revisionRequest = revisionRequest;
    const calculationResult = await runSellerTurn(calculationInput);
    if (calculationResult.ok || calculationResult.code !== 'INVALID_PROVIDER_OUTPUT') throw new Error(JSON.stringify(calculationResult));
    assert.equal(calculationResult.detail, 'NON_SUBMISSION_TOOL_FORBIDDEN_DURING_CRITIC_REVISION');

    const reusedInput = baseInput([primary], async () => completion([
      submissionTool(7, 'tool-reused', 'proposal-7'),
    ]));
    reusedInput.revisionRequest = revisionRequest;
    const reusedResult = await runSellerTurn(reusedInput);
    if (reusedResult.ok || reusedResult.code !== 'INVALID_PROVIDER_OUTPUT') throw new Error(JSON.stringify(reusedResult));
    assert.equal(reusedResult.detail, 'REVISED_PROPOSAL_ID_REUSED');
  });

  await t.test('rejects stale Critic feedback before provider execution', async () => {
    let calls = 0;
    const input = baseInput([primary], async () => {
      calls += 1;
      return completion([submissionTool(7)]);
    });
    input.revisionRequest = Object.freeze({
      ...revisionRequest,
      review: Object.freeze({ ...revisionRequest.review, basedOnRevision: 6 }),
    });
    const result = await runSellerTurn(input);
    if (result.ok || result.code !== 'INVALID_RUNTIME_CONFIG') throw new Error(JSON.stringify(result));
    assert.equal(result.detail, 'INVALID_REVISION_REQUEST');
    assert.equal(calls, 0);
  });
});

test('provider-side capacity failure stays on the single DeepSeek route and fails bounded', async () => {
  const primary = route();
  let calls = 0;
  const input = baseInput([primary], async () => {
    calls += 1;
    return { ok: false, class: 'capacity', status: 503, retryAfterMs: 1000 };
  });
  const result = await runSellerTurn(input);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, 'PROVIDER_FAILED');
    if (result.code === 'PROVIDER_FAILED') assert.equal(result.failureClass, 'capacity');
  }
  assert.equal(calls, 1);
});

for (const failureClass of ['cancelled', 'client'] as const) {
  test(`${failureClass} provider failure stays on the single DeepSeek route`, async () => {
    const primary = route();
    let calls = 0;
    const input = baseInput([primary], async () => {
      calls += 1;
      return {
        ok: false,
        class: failureClass,
        status: failureClass === 'client' ? 400 : null,
        retryAfterMs: null,
      };
    });
    const result = await runSellerTurn(input);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'PROVIDER_FAILED');
    assert.equal(calls, 1);
  });
}

test('explicit user numbers flow through capture then deterministic calculation then final Seller submission across exact revisions', async () => {
  const primary = route();
  const text = 'Somos 3 pessoas, gastamos 40 minutos por pessoa por dia e trabalhamos 22 dias por mês.';
  const initial = Object.freeze({
    ...canonical(7),
    latestUserIntent: Object.freeze({ turnId: 'turn-1', text }),
  });
  const revisions: number[] = [];
  let providerCall = 0;
  const input = baseInput([primary], async (providerInput) => {
    const payload = JSON.parse((providerInput.messages[1] as { content: string }).content) as { canonicalRevision: number };
    revisions.push(payload.canonicalRevision);
    providerCall += 1;
    if (providerCall === 1) {
      return completion([observationTool(7, [
        { id: 'obs-people', kind: 'people_count', turnId: 'turn-1', quote: '3 pessoas', value: 3 },
        { id: 'obs-minutes', kind: 'minutes_per_person_per_day', turnId: 'turn-1', quote: '40 minutos por pessoa por dia', value: 40 },
        { id: 'obs-days', kind: 'working_days_per_month', turnId: 'turn-1', quote: '22 dias por mês', value: 22 },
      ])] as never);
    }
    if (providerCall === 2) {
      return completion([Object.freeze({
        id: 'tool-calc-capacity',
        type: 'function' as const,
        function: Object.freeze({
          name: 'request_calculations',
          arguments: JSON.stringify({
            requests: [{
              kind: 'monthly_capacity',
              peopleObservationId: 'seller-observation-r7-1',
              minutesPerPersonPerDayObservationId: 'seller-observation-r7-2',
              workingDaysPerMonthObservationId: 'seller-observation-r7-3',
            }],
          }),
        }),
      })] as never);
    }
    return completion([submissionTool(9)]);
  }, {
    applyContextMutation: applyCanonicalContextMutation,
    computeVerifiedCalculation: computeCanonicalCalculation,
  });
  input.canonical = initial;
  input.recentTurns = Object.freeze([{ id: 'turn-1', role: 'user', text }]);

  const result = await runSellerTurn(input);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(revisions, [7, 8, 9]);
  assert.equal(result.providerRounds, 3);
  assert.equal(result.canonical.revision, 9);
  assert.deepEqual(result.canonical.quantitativeObservations.map((item) => item.id), [
    'seller-observation-r7-1', 'seller-observation-r7-2', 'seller-observation-r7-3',
  ]);
  assert.equal(result.canonical.quantitativeObservations.every((item) =>
    item.source === 'user' && item.status === 'confirmed'), true);
  assert.equal(result.canonical.verifiedCalculations[0]?.id, 'seller-calculation-r8-1');
  assert.equal(result.canonical.verifiedCalculations[0]?.resultValue, 44);
  assert.equal(result.canonical.verifiedCalculations[0]?.resultUnit, 'hour/month');
});

test('hallucinated quoted observation is rejected before any canonical mutation', async () => {
  const primary = route();
  const text = 'Somos 3 pessoas.';
  let mutationCalls = 0;
  const input = baseInput([primary], async () => completion([
    observationTool(7, [{
      id: 'obs-people',
      kind: 'people_count',
      turnId: 'turn-1',
      quote: '3 pessoas',
      value: 30,
    }]),
  ] as never), {
    applyContextMutation: ((...args: Parameters<typeof applyCanonicalContextMutation>) => {
      mutationCalls += 1;
      return applyCanonicalContextMutation(...args);
    }) as SellerTurnRuntimeDependencies['applyContextMutation'],
  });
  input.canonical = Object.freeze({
    ...canonical(7),
    latestUserIntent: Object.freeze({ turnId: 'turn-1', text }),
  });
  input.recentTurns = Object.freeze([{ id: 'turn-1', role: 'user', text }]);

  const result = await runSellerTurn(input);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'OBSERVATION_CAPTURE_REJECTED');
  if (result.code === 'OBSERVATION_CAPTURE_REJECTED') {
    assert.equal(result.detail, 'VALUE_NOT_IN_QUOTE');
    assert.equal(result.requestId, 'seller-observation-r7-1');
  }
  assert.equal(mutationCalls, 0);
  assert.equal(result.canonical.revision, 7);
  assert.equal(result.canonical.quantitativeObservations.length, 0);
});

test('multiple calculation tool calls are computed against one revision and committed once atomically before the next provider round', async () => {
  const primary = route();
  const revisions: number[] = [];
  const commitBatches: Array<{ baseRevision: number; ids: string[] }> = [];
  let providerCall = 0;
  const input = baseInput([primary], async (providerInput) => {
    const payload = JSON.parse((providerInput.messages[1] as { content: string }).content) as { canonicalRevision: number };
    revisions.push(payload.canonicalRevision);
    providerCall += 1;
    if (providerCall === 1) {
      return completion([
        calculationTool(7, 'calc-one', 'tool-calc-one'),
        calculationTool(7, 'calc-two', 'tool-calc-two', 'obs-volume-2', 'obs-minutes-2'),
      ] as never);
    }
    return completion([submissionTool(8)]);
  }, {
    applyContextMutation: ((context: CanonicalSalesContext, envelope: { baseRevision: number; mutation: { calculations: readonly VerifiedCalculation[] } }) => {
      commitBatches.push({ baseRevision: envelope.baseRevision, ids: envelope.mutation.calculations.map((item) => item.id) });
      return commitCalculations(context, envelope);
    }) as never,
  });
  const result = await runSellerTurn(input);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.canonical.revision, 8);
  assert.deepEqual(revisions, [7, 8]);
  assert.deepEqual(commitBatches, [{ baseRevision: 7, ids: ['seller-calculation-r7-1', 'seller-calculation-r7-2'] }]);
  assert.deepEqual(result.canonical.verifiedCalculations.map((item) => item.id), ['seller-calculation-r7-1', 'seller-calculation-r7-2']);
});

test('one invalid sibling calculation rejects the entire batch without committing or leaking an uncommitted numeric result', async () => {
  const primary = route();
  let commitCalls = 0;
  const input = baseInput([primary], async () => completion([
    calculationTool(7, 'calc-valid', 'tool-valid'),
    calculationTool(7, 'calc-invalid', 'tool-invalid', 'obs-invalid', 'obs-minutes'),
  ] as never), {
    computeVerifiedCalculation: ((context: CanonicalSalesContext, request: { id: string }) => {
      if (request.id === 'seller-calculation-r7-2') return { ok: false, code: 'UNIT_MISMATCH' as const };
      return calculationOk(context, request);
    }) as never,
    applyContextMutation: ((...args: unknown[]) => { commitCalls += 1; return { ok: false, code: 'INVALID_MUTATION', revision: 7 }; }) as never,
  });
  const result = await runSellerTurn(input);
  if (result.ok || result.code !== 'CALCULATION_REJECTED') throw new Error(`unexpected result: ${JSON.stringify(result)}`);
  assert.equal(result.requestId, 'seller-calculation-r7-2');
  assert.equal(result.canonical.revision, 7);
  assert.equal(commitCalls, 0);
  assert.equal(JSON.stringify(result).includes('resultValue'), false);
});

test('duplicate semantic calculation requests across sibling tool calls are rejected before calculation or mutation', async () => {
  const primary = route();
  let computeCalls = 0;
  let commitCalls = 0;
  const input = baseInput([primary], async () => completion([
    calculationTool(7, 'ignored-one', 'tool-one'),
    calculationTool(7, 'ignored-two', 'tool-two'),
  ] as never), {
    computeVerifiedCalculation: ((...args: unknown[]) => { computeCalls += 1; return { ok: false, code: 'INVALID_REQUEST' }; }) as never,
    applyContextMutation: ((...args: unknown[]) => { commitCalls += 1; return { ok: false, code: 'INVALID_MUTATION', revision: 7 }; }) as never,
  });
  const result = await runSellerTurn(input);
  if (result.ok || result.code !== 'INVALID_PROVIDER_OUTPUT') throw new Error(`unexpected result: ${JSON.stringify(result)}`);
  assert.equal(result.detail, 'DUPLICATE_CALCULATION_REQUEST');
  assert.equal(computeCalls, 0);
  assert.equal(commitCalls, 0);
});

test('state-aware tool exposure hides capture without literal numeric evidence and requires capture first when evidence exists', async () => {
  const primary = route();
  const seen: string[][] = [];
  const noNumber = baseInput([primary], async (providerInput) => {
    seen.push(providerInput.tools.map((tool) => tool.function.name));
    return completion([submissionTool(7)]);
  });
  const noNumberResult = await runSellerTurn(noNumber);
  assert.equal(noNumberResult.ok, true);
  assert.deepEqual(seen[0], ['request_calculations', 'submit_seller_submission']);

  const numericText = 'Temos 120 ocorrências por mês e cada ocorrência leva 12 minutos.';
  let numericCall = 0;
  const numeric = baseInput([primary], async (providerInput) => {
    seen.push(providerInput.tools.map((tool) => tool.function.name));
    numericCall += 1;
    if (numericCall === 1) {
      return completion([observationTool(7, [
        { id: 'obs-volume', kind: 'occurrences_per_month', turnId: 'turn-1', quote: '120 ocorrências por mês', value: 120 },
        { id: 'obs-minutes', kind: 'minutes_per_occurrence', turnId: 'turn-1', quote: '12 minutos', value: 12 },
      ])] as never);
    }
    return completion([submissionTool(8)]);
  }, { applyContextMutation: applyCanonicalContextMutation });
  numeric.canonical = Object.freeze({
    ...canonical(7),
    latestUserIntent: Object.freeze({ turnId: 'turn-1', text: numericText }),
  });
  numeric.recentTurns = Object.freeze([{ id: 'turn-1', role: 'user', text: numericText }]);
  const numericResult = await runSellerTurn(numeric);
  assert.equal(numericResult.ok, true, JSON.stringify(numericResult));
  assert.deepEqual(seen[1], ['capture_user_observations']);
  assert.deepEqual(seen[2], ['request_calculations', 'submit_seller_submission']);
});

test('one bounded structural repair replays only application-owned failure metadata and can recover', async () => {
  const primary = route();
  let calls = 0;
  let repairPayload: unknown = null;
  const input = baseInput([primary], async (providerInput) => {
    calls += 1;
    if (calls === 1) {
      return completion([
        calculationTool(7, 'calc-one', 'tool-calc'),
        submissionTool(7),
      ] as never);
    }
    repairPayload = JSON.parse((providerInput.messages[1] as { content: string }).content);
    return completion([submissionTool(7)]);
  });
  const result = await runSellerTurn(input);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(calls, 2);
  assert.deepEqual((repairPayload as { repairRequest?: unknown }).repairRequest, {
    code: 'INVALID_PROVIDER_OUTPUT',
    detail: 'MIXED_TOOL_KINDS',
  });
  assert.equal(JSON.stringify(repairPayload).includes('tool-calc'), false);
});

test('structural repair is bounded to one attempt and a second invalid response fails closed', async () => {
  const primary = route();
  let calls = 0;
  const input = baseInput([primary], async () => {
    calls += 1;
    return completion([
      calculationTool(7, 'calc-one', 'tool-calc'),
      submissionTool(7),
    ] as never);
  });
  const result = await runSellerTurn(input);
  if (result.ok || result.code !== 'INVALID_PROVIDER_OUTPUT') throw new Error(JSON.stringify(result));
  assert.equal(result.detail, 'MIXED_TOOL_KINDS');
  assert.equal(calls, 2);
  assert.equal(result.canonical.revision, 7);
});

test('proven provider tool-use generation failure gets one same-route repair before failure routing', async () => {
  const primary = route();
  let calls = 0;
  let repairPayload: unknown = null;
  const input = baseInput([primary], async (providerInput) => {
    calls += 1;
    if (calls === 1) {
      return {
        ok: false,
        class: 'malformed',
        status: 200,
        retryAfterMs: null,
        malformedDetail: 'stream_chunk',
        streamChunkDetail: 'provider_tool_use_failed',
      };
    }
    repairPayload = JSON.parse((providerInput.messages[1] as { content: string }).content);
    return completion([submissionTool(7)]);
  });
  const result = await runSellerTurn(input);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(calls, 2);
  assert.deepEqual((repairPayload as { repairRequest?: unknown }).repairRequest, {
    code: 'PROVIDER_TOOL_USE_FAILED',
    detail: 'EMIT_VALID_ALLOWED_TOOL_CALL',
  });
});

test('mixed calculation and final-submission tools are rejected as one invalid provider turn', async () => {
  const primary = route();
  const input = baseInput([primary], async () => completion([
    calculationTool(7, 'calc-one', 'tool-calc'),
    submissionTool(7),
  ] as never));
  const result = await runSellerTurn(input);
  if (result.ok || result.code !== 'INVALID_PROVIDER_OUTPUT') throw new Error(`unexpected result: ${JSON.stringify(result)}`);
  assert.equal(result.detail, 'MIXED_TOOL_KINDS');
});

test('text-only and free-text-plus-tools completions are both rejected', async (t: import('node:test').TestContext) => {
  const primary = route();
  await t.test('text only', async () => {
    const input = baseInput([primary], async () => ({ ok: true, completion: { content: 'Resposta não autorizada.', toolCalls: [], finishReason: 'stop' } }));
    const result = await runSellerTurn(input);
    if (result.ok || result.code !== 'INVALID_PROVIDER_OUTPUT') throw new Error(`unexpected result: ${JSON.stringify(result)}`);
    assert.equal(result.detail, 'FREE_TEXT_WITH_OR_WITHOUT_TOOLS');
  });
  await t.test('text plus tool', async () => {
    const input = baseInput([primary], async () => completion([submissionTool(7)], 'Texto misturado'));
    const result = await runSellerTurn(input);
    if (result.ok || result.code !== 'INVALID_PROVIDER_OUTPUT') throw new Error(`unexpected result: ${JSON.stringify(result)}`);
    assert.equal(result.detail, 'FREE_TEXT_WITH_OR_WITHOUT_TOOLS');
  });
});

test('Seller validator rejection prevents final submission from escaping the deterministic boundary', async () => {
  const primary = route();
  const input = baseInput([primary], async () => completion([submissionTool(7)]), {
    validateSellerSubmission: (() => ({ ok: false, code: 'HARD_BLOCK', path: 'materialClaims[0]' })) as never,
  });
  const result = await runSellerTurn(input);
  if (result.ok || result.code !== 'SELLER_SUBMISSION_REJECTED') throw new Error(`unexpected result: ${JSON.stringify(result)}`);
  assert.equal(result.validation.code, 'HARD_BLOCK');
  assert.equal(result.canonical.revision, 7);
});

test('bounded provider rounds stop repeated calculation cycles after preserving the last committed canonical revision', async () => {
  const primary = route();
  const input = baseInput([primary], async () => completion([calculationTool(7, 'calc-one', 'tool-one')] as never));
  input.maxProviderRounds = 1;
  const result = await runSellerTurn(input);
  if (result.ok || result.code !== 'ROUND_LIMIT_EXCEEDED') throw new Error(`unexpected result: ${JSON.stringify(result)}`);
  assert.equal(result.providerRounds, 1);
  assert.equal(result.providerCalls, 1);
  assert.equal(result.canonical.revision, 8);
});

test('primary context packaging accounts for Seller system and tool-schema wire overhead before route selection', async () => {
  const primary = route();
  let providerCalls = 0;
  let packagerSawWireEstimate = false;
  const input = baseInput([primary], async () => {
    providerCalls += 1;
    return completion([submissionTool(7)]);
  }, {
    packageContext: ((packInput: Parameters<SellerTurnRuntimeDependencies['packageContext']>[0]) => {
      const measured = packInput.estimateTokens({ schemaVersion: 1, canonicalRevision: packInput.canonical.revision });
      packagerSawWireEstimate = measured === 16_001;
      return measured > 16_000
        ? { ok: false, code: 'CONTEXT_BUDGET_EXCEEDED', attempts: 2, estimatedInputTokens: measured, availableInputTokens: 16_000 }
        : packageOk(packInput);
    }) as SellerTurnRuntimeDependencies['packageContext'],
  });
  input.estimateTokens = (value: unknown) => {
    const serialized = JSON.stringify(value);
    if (serialized.includes('submit_seller_submission') && serialized.includes('request_calculations')) {
      return 16_001;
    }
    return 100;
  };

  const result = await runSellerTurn(input);
  if (result.ok || result.code !== 'NO_ELIGIBLE_ROUTE') throw new Error(`unexpected result: ${JSON.stringify(result)}`);
  assert.equal(packagerSawWireEstimate, true);
  assert.equal(providerCalls, 0);
});

test('primary context overflow fails closed before DeepSeek dispatch', async () => {
  const primary = route();
  let providerCalls = 0;
  const input = baseInput([primary], async () => {
    providerCalls += 1;
    return completion([submissionTool(7)]);
  }, {
    packageContext: (() => ({
      ok: false,
      code: 'CONTEXT_BUDGET_EXCEEDED',
      attempts: 2,
      estimatedInputTokens: 16_001,
      availableInputTokens: 16_000,
    })) as SellerTurnRuntimeDependencies['packageContext'],
  });

  const result = await runSellerTurn(input);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'NO_ELIGIBLE_ROUTE');
  assert.equal(providerCalls, 0);
});

test('the complete Seller contract fits the DeepSeek primary wire budget', async () => {
  const primary = route({ maxInputTokens: 16_000 });
  let providerCalls = 0;
  let maxMeasuredTokens = 0;
  const input = baseInput([primary], async () => {
    providerCalls += 1;
    return completion([submissionTool(7)]);
  });
  input.estimateTokens = (value: unknown) => {
    const measured = Math.ceil(new TextEncoder().encode(JSON.stringify(value)).byteLength / 3);
    maxMeasuredTokens = Math.max(maxMeasuredTokens, measured);
    return measured;
  };

  const result = await runSellerTurn(input);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(providerCalls, 1);
  assert.ok(maxMeasuredTokens <= 16_000, `measured ${maxMeasuredTokens} primary-wire tokens`);
});

test('non-deterministic token measurement is bounded and fails closed instead of looping or dispatching', async () => {
  const primary = route();
  let providerCalls = 0;
  let measurement = 100;
  const input = baseInput([primary], async () => {
    providerCalls += 1;
    return completion([submissionTool(7)]);
  });
  input.estimateTokens = () => {
    measurement = measurement === 100 ? 101 : 100;
    return measurement;
  };

  const result = await runSellerTurn(input);
  if (result.ok || result.code !== 'CONTEXT_PREPARATION_FAILED') throw new Error(`unexpected result: ${JSON.stringify(result)}`);
  assert.equal(result.detail, 'UNSTABLE_TOKEN_ESTIMATOR');
  assert.equal(providerCalls, 0);
});
