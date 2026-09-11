import test from 'node:test';
import assert from 'node:assert/strict';
import type { CanonicalSalesContext } from '../../src/ai/context/canonical-sales-context.ts';
import type { ProviderRouteDefinition } from '../../src/ai/providers/provider-registry.ts';
import type { SellerSubmission } from '../../src/ai/seller/seller-contract.ts';
import type { ProviderChatClientResult } from '../../src/server/ai/providers/provider-chat-client.ts';
import {
  buildCriticProviderMessages,
  runCriticTurn,
  type CriticTurnRuntimeDependencies,
  type CriticTurnRuntimeInput,
} from '../../src/server/ai/critic/critic-turn-runtime.ts';

function canonical(revision = 7): CanonicalSalesContext {
  return Object.freeze({
    schemaVersion: 1,
    sessionId: 'session-critic',
    revision,
    turnIds: Object.freeze([]),
    facts: Object.freeze([]),
    primaryPain: 'fechamento comprimido',
    desiredOutcome: 'liberar capacidade',
    knownConsequences: Object.freeze([]),
    objections: Object.freeze([]),
    quantitativeObservations: Object.freeze([]),
    verifiedCalculations: Object.freeze([]),
    openUncertainties: Object.freeze([]),
    opportunities: Object.freeze([]),
    artifacts: Object.freeze([]),
    currentSceneId: null,
    latestUserIntent: Object.freeze({
      turnId: 'turn-7',
      text: 'Quero entender onde perco capacidade.',
    }),
  });
}

function submission(revision = 7): Readonly<SellerSubmission> {
  return Object.freeze({
    schemaVersion: 1,
    proposalId: 'proposal-critic',
    proposal: Object.freeze({
      schemaVersion: 1,
      baseRevision: revision,
      narration: 'A conferência manual concentra capacidade operacional.',
      intent: Object.freeze({
        schemaVersion: 1,
        objective: 'Expor o gargalo sem inventar economia.',
        rationale: 'Há sinal operacional suficiente para focar a discussão.',
        capabilities: Object.freeze(['process_data_improvement'] as const),
        actions: Object.freeze([]),
        quantitativeOpportunities: Object.freeze([]),
        artifactIntents: Object.freeze([]),
        nextQuestion: null,
      }),
      factProposals: Object.freeze([]),
      correctionProposals: Object.freeze([]),
      processMutations: Object.freeze([]),
      sceneProposal: null,
      artifactProposals: Object.freeze([]),
      criticRequired: true,
    }),
    materialClaims: Object.freeze([]),
    calculationRequests: Object.freeze([]),
  });
}

function route(overrides: Partial<ProviderRouteDefinition> = {}): Readonly<ProviderRouteDefinition> {
  return Object.freeze({
    routeId: 'critic-primary',
    family: 'deepseek',
    modelId: 'deepseek-v4-pro',
    roles: Object.freeze(['critic'] as const),
    tier: 'primary',
    priority: 10,
    enabledByDefault: true,
    credentialEnvName: 'DEEPSEEK_API_KEY',
    credentialScope: 'server',
    billingAuthorization: 'PASS',
    protocolCompatibility: 'PASS',
    sellerQuality: 'NOT_APPLICABLE',
    criticQuality: 'PASS',
    composerQuality: 'NOT_APPLICABLE',
    harnessCompatibility: 'NOT_APPLICABLE',
    workshopSafety: 'NOT_APPLICABLE',
    workshopHarness: null,
    runtimeActivation: 'PASS',
    capabilities: Object.freeze({
      streaming: 'PASS',
      tools: 'PASS',
      structuredArguments: 'PASS',
    } as const),
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

function reviewTool(revision = 7, overrides: Record<string, unknown> = {}) {
  return Object.freeze({
    id: 'tool-critic',
    type: 'function' as const,
    function: Object.freeze({
      name: 'submit_critic_review',
      arguments: JSON.stringify({
        review: {
          schemaVersion: 1,
          proposalId: 'proposal-critic',
          basedOnRevision: revision,
          verdict: 'PASS',
          findings: [],
          ...overrides,
        },
      }),
    }),
  });
}

function completion(
  toolCalls: readonly ReturnType<typeof reviewTool>[],
  content = '',
): ProviderChatClientResult {
  return Object.freeze({
    ok: true,
    completion: Object.freeze({
      content,
      toolCalls: Object.freeze([...toolCalls]),
      finishReason: 'tool_calls',
    }),
  });
}

function packageOk(input: Parameters<CriticTurnRuntimeDependencies['packageContext']>[0]) {
  return {
    ok: true as const,
    pack: Object.freeze({
      schemaVersion: 1 as const,
      role: 'critic' as const,
      canonicalRevision: input.canonical.revision,
      marker: 'critic-full',
      metadata: Object.freeze({ estimatedInputTokens: 100 }),
    }),
  };
}

function baseInput(
  routes: readonly Readonly<ProviderRouteDefinition>[],
  executeProviderChatStream: CriticTurnRuntimeDependencies['executeProviderChatStream'],
  dependencyOverrides: Partial<CriticTurnRuntimeDependencies> = {},
): CriticTurnRuntimeInput {
  return {
    canonical: canonical(),
    submission: submission(),
    digest: null,
    recentTurns: Object.freeze([
      { id: 'turn-7', role: 'user', text: 'Quero entender onde perco capacidade.' },
    ]),
    visualState: Object.freeze({
      sceneId: null,
      focusedEntityIds: Object.freeze([]),
      activeArtifactIds: Object.freeze([]),
    }),
    routes,
    routeBudgets: Object.freeze(routes.map(budgetFor)),
    runtimeStates: Object.freeze(routes.map((item) => Object.freeze({
      routeId: item.routeId,
      circuit: 'closed' as const,
      quota: 'available' as const,
    }))),
    estimateTokens: () => 100,
    resolveCredential: () => 'server-secret',
    serverConfig: Object.freeze({}),
    timeoutMs: 10_000,
    dependencies: {
      packageContext: packageOk as unknown as CriticTurnRuntimeDependencies['packageContext'],
      validateSellerSubmission: ((value: Readonly<SellerSubmission>) => ({
        ok: true as const,
        submission: value,
      })) as never,
      executeProviderChatStream,
      ...dependencyOverrides,
    },
  };
}

test('builds a revision-bound Critic request without exposing provider conversation authority', () => {
  const messages = buildCriticProviderMessages({
    role: 'critic',
    canonicalRevision: 7,
    contextMode: 'full',
    fallbackReason: null,
    context: {
      schemaVersion: 1,
      canonicalRevision: 7,
      marker: 'canon',
    },
  }, submission());

  assert.equal(messages.length, 2);
  assert.equal(messages[0]?.role, 'system');
  if (messages[0]?.role === 'system') {
    assert.match(messages[0].content, /MANIPULATION_RISK/);
    assert.match(messages[0].content, /USER_INTENT_MISMATCH alone is not sufficient/);
  }
  const user = messages[1];
  if (user === undefined || user.role !== 'user') throw new Error('expected user payload');
  const payload = JSON.parse(user.content) as {
    canonicalRevision: number;
    reviewTarget: { proposalId: string };
  };
  assert.equal(payload.canonicalRevision, 7);
  assert.equal(payload.reviewTarget.proposalId, 'proposal-critic');
  assert.equal(JSON.stringify(messages).includes('server-secret'), false);

  assert.throws(() => buildCriticProviderMessages({
    role: 'critic',
    canonicalRevision: 7,
    contextMode: 'full',
    fallbackReason: null,
    context: {
      schemaVersion: 1,
      canonicalRevision: 7,
      providerConversationId: 'provider-owned',
    },
  } as never, submission()), /Provider conversation authority/);
});

test('rejects a stale Seller submission before packaging, credential resolution or provider execution', async () => {
  let providerCalls = 0;
  const primary = route();
  const input = baseInput([primary], async () => {
    providerCalls += 1;
    return completion([reviewTool()]);
  });
  input.submission = submission(6);
  const result = await runCriticTurn(input);
  assert.deepEqual(result, { ok: false, code: 'STALE_SUBMISSION' });
  assert.equal(providerCalls, 0);
});

test('primary Critic receives role-specific canonical context and only a bound tool verdict can pass', async () => {
  const primary = route();
  const observed: unknown[] = [];
  const input = baseInput([primary], async (providerInput) => {
    observed.push(providerInput.messages);
    return completion([reviewTool()]);
  });
  const result = await runCriticTurn(input);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.review.verdict, 'PASS');
  assert.equal(result.review.proposalId, 'proposal-critic');
  assert.equal(result.review.basedOnRevision, 7);
  assert.equal(result.routeId, primary.routeId);
  assert.equal(result.providerCalls, 1);

  const messages = observed[0] as Array<{ role: string; content: string }>;
  const payload = JSON.parse(messages[1]!.content) as {
    contextMode: string;
    context: { role: string; marker: string };
  };
  assert.equal(payload.contextMode, 'full');
  assert.equal(payload.context.role, 'critic');
  assert.equal(payload.context.marker, 'critic-full');
});

test('capacity failure stays on the single DeepSeek Critic route and fails bounded', async () => {
  const primary = route();
  let calls = 0;
  const result = await runCriticTurn(baseInput([primary], async () => {
    calls += 1;
    return { ok: false, class: 'capacity', status: 503, retryAfterMs: 500 };
  }));
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, 'PROVIDER_FAILED');
    if (result.code === 'PROVIDER_FAILED') assert.equal(result.failureClass, 'capacity');
  }
  assert.equal(calls, 1);
});

test('free text, multiple review tools and stale review output are rejected fail-closed', async (t) => {
  const primary = route();

  await t.test('free text', async () => {
    const result = await runCriticTurn(baseInput(
      [primary],
      async () => completion([reviewTool()], 'aprovado'),
    ));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'INVALID_PROVIDER_OUTPUT');
  });

  await t.test('multiple tools', async () => {
    const result = await runCriticTurn(baseInput(
      [primary],
      async () => completion([reviewTool(), reviewTool()] as never),
    ));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'INVALID_PROVIDER_OUTPUT');
  });

  await t.test('stale review', async () => {
    const result = await runCriticTurn(baseInput(
      [primary],
      async () => completion([reviewTool(6)]),
    ));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'CRITIC_REVIEW_REJECTED');
      assert.equal(result.detail, 'STALE_REVIEW');
    }
  });
});

for (const failureClass of ['cancelled', 'client'] as const) {
  test(failureClass + ' Critic provider failure stays on the single DeepSeek route', async () => {
    const primary = route();
    let calls = 0;
    const result = await runCriticTurn(baseInput([primary], async () => {
      calls += 1;
      return {
        ok: false,
        class: failureClass,
        status: failureClass === 'client' ? 400 : null,
        retryAfterMs: null,
      };
    }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'PROVIDER_FAILED');
    assert.equal(calls, 1);
  });
}

test('invalid Seller revalidation blocks Critic execution instead of trusting a typed caller', async () => {
  const primary = route();
  let providerCalls = 0;
  const input = baseInput([primary], async () => {
    providerCalls += 1;
    return completion([reviewTool()]);
  }, {
    validateSellerSubmission: (() => ({
      ok: false,
      code: 'INVALID_VALUE',
      path: 'sellerSubmission.proposal.criticRequired',
    })) as never,
  });
  const result = await runCriticTurn(input);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'SELLER_SUBMISSION_REJECTED');
  assert.equal(providerCalls, 0);
});
