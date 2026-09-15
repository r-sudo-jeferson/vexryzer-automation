import test from 'node:test';
import assert from 'node:assert/strict';
import { createAskAiClient } from '../../src/app/ask-ai-client.ts';

const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGH0123456789_-';

function accepted(revision = 1) {
  return {
    ok: true,
    idempotent: false,
    mode: 'agent',
    narration: 'Entendi o gargalo.',
    nextQuestion: 'Quantas vezes isso acontece?',
    state: {
      sessionId: 'session-client',
      canonicalRevision: revision,
      verifiedCalculations: [],
      opportunities: [],
      evidence: [],
      reactiveState: {
        schemaVersion: 1,
        basedOnRevision: revision,
        projectionRevision: 1,
        actions: [],
        processMutations: [],
        correctionSuggestions: [],
        artifacts: [],
        scene: { composition: 'stable', focusIds: [], comparisonIds: [], announcement: null },
        choreography: { generation: 0, intentKey: null, cameraTargetIds: [], interrupted: false },
        recentSemanticKeys: [],
      },
    },
  };
}

test('browser client starts lazily and sends only closed turn fields with bearer token', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = createAskAiClient({
    createRequestId: () => 'request-client',
    fetchImpl: (async (input, init) => {
      calls.push({
        url: String(input),
        ...(init === undefined ? {} : { init }),
      });
      if (String(input).endsWith('/session')) {
        return new Response(JSON.stringify({
          ok: true,
          sessionId: 'session-client',
          sessionToken: TOKEN,
          revision: 0,
        }), { status: 201, headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify(accepted()), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch,
  });

  const result = await client.submit('  Somos 3 pessoas.  ');
  assert.equal(result.ok, true);
  assert.equal(calls.length, 2);
  const turn = calls[1]!;
  assert.equal(new Headers(turn.init?.headers).get('authorization'), `Bearer ${TOKEN}`);
  const body = JSON.parse(String(turn.init?.body)) as Record<string, unknown>;
  assert.deepEqual(body, {
    sessionId: 'session-client',
    requestId: 'request-client',
    expectedRevision: 0,
    text: 'Somos 3 pessoas.',
  });
  assert.equal(Object.hasOwn(body, 'canonical'), false);
  assert.equal(Object.hasOwn(body, 'sessionToken'), false);
});

test('WP07 RED: browser rejects unknown keys across public state and proof/value objects', async () => {
  const forgedStates = [
    {
      ...accepted().state,
      unexpectedPrivatePayload: { canonical: 'must-not-enter-browser-state' },
    },
    {
      ...accepted().state,
      reactiveState: {
        ...accepted().state.reactiveState,
        actions: [{
          sourceActionId: 'action-forged',
          action: { id: 'action-forged', kind: 'execute_shell', command: 'whoami' },
          status: 'active',
          invalidatedReason: null,
        }],
      },
    },
    {
      ...accepted().state,
      verifiedCalculations: [{
        id: 'calc-one',
        resultValue: 1,
        resultUnit: 'hour/month',
        status: 'valid',
        expression: '1',
        computedBy: 'application',
        basedOnRevision: 1,
        inputObservationIds: ['obs-one'],
        unexpected: 'forged',
      }],
    },
    {
      ...accepted().state,
      opportunities: [{
        id: 'opp-one',
        kind: 'monthly_capacity',
        summary: 'Medir capacidade.',
        evidenceIds: ['fact-one'],
        missingInputs: ['volume'],
        status: 'surfaced',
        unexpected: 'forged',
      }],
    },
    {
      ...accepted().state,
      evidence: [{
        id: 'fact-one',
        kind: 'fact',
        source: 'user',
        status: 'confirmed',
        unexpected: 'forged',
      }],
    },
  ];

  for (const state of forgedStates) {
    let calls = 0;
    const client = createAskAiClient({
      createRequestId: () => 'request-closed-proof',
      fetchImpl: (async (input) => {
        calls += 1;
        if (String(input).endsWith('/session')) {
          return new Response(JSON.stringify({
            ok: true, sessionId: 'session-client', sessionToken: TOKEN, revision: 0,
          }), { status: 201 });
        }
        return new Response(JSON.stringify({ ...accepted(), state }), { status: 200 });
      }) as typeof fetch,
    });
    const result = await client.submit('Teste closed schema');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'INVALID_SERVER_RESPONSE');
    assert.equal(calls, 2);
  }
});

test('accepted response advances private revision and does not create a second session', async () => {
  const turns: Record<string, unknown>[] = [];
  let starts = 0;
  let turnCount = 0;
  const client = createAskAiClient({
    createRequestId: () => `request-${++turnCount}`,
    fetchImpl: (async (input, init) => {
      if (String(input).endsWith('/session')) {
        starts += 1;
        return new Response(JSON.stringify({
          ok: true, sessionId: 'session-client', sessionToken: TOKEN, revision: 0,
        }), { status: 201 });
      }
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      turns.push(body);
      return new Response(JSON.stringify(accepted(turns.length)), { status: 200 });
    }) as typeof fetch,
  });

  assert.equal((await client.submit('Primeiro turno')).ok, true);
  assert.equal((await client.submit('Segundo turno')).ok, true);
  assert.equal(starts, 1);
  assert.equal(turns[0]?.expectedRevision, 0);
  assert.equal(turns[1]?.expectedRevision, 1);
});

test('hard agent failure advances known canonical revision but remains failure', async () => {
  const bodies: Record<string, unknown>[] = [];
  let turn = 0;
  const client = createAskAiClient({
    createRequestId: () => `request-${++turn}`,
    fetchImpl: (async (input, init) => {
      if (String(input).endsWith('/session')) {
        return new Response(JSON.stringify({
          ok: true, sessionId: 'session-client', sessionToken: TOKEN, revision: 0,
        }), { status: 201 });
      }
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      if (bodies.length === 1) {
        return new Response(JSON.stringify({
          ok: false, code: 'AGENT_EXECUTION_FAILED', currentRevision: 1,
        }), { status: 502 });
      }
      return new Response(JSON.stringify(accepted(2)), { status: 200 });
    }) as typeof fetch,
  });

  const failed = await client.submit('Primeiro turno');
  assert.equal(failed.ok, false);
  if (!failed.ok) {
    assert.equal(failed.code, 'AGENT_EXECUTION_FAILED');
    assert.equal(failed.currentRevision, 1);
    assert.equal(failed.retryable, true);
  }

  const second = await client.submit('Novo request após falha');
  assert.equal(second.ok, true);
  assert.equal(bodies[1]?.expectedRevision, 1);
});

for (const code of ['UNAUTHORIZED', 'NOT_FOUND', 'STALE_REVISION', 'SESSION_CONFLICT', 'REQUEST_REPLAY']) {
  test(`${code} invalidates local session capability instead of reusing uncertain state`, async () => {
    let starts = 0;
    let turn = 0;
    const client = createAskAiClient({
      createRequestId: () => `request-${++turn}`,
      fetchImpl: (async (input) => {
        if (String(input).endsWith('/session')) {
          starts += 1;
          return new Response(JSON.stringify({
            ok: true,
            sessionId: 'session-client',
            sessionToken: TOKEN,
            revision: 0,
          }), { status: 201 });
        }
        if (turn === 1) {
          return new Response(JSON.stringify({
            ok: false,
            code,
            currentRevision: 1,
          }), { status: code === 'UNAUTHORIZED' ? 401 : code === 'NOT_FOUND' ? 404 : 409 });
        }
        return new Response(JSON.stringify(accepted(1)), { status: 200 });
      }) as typeof fetch,
    });

    const failed = await client.submit('Turno conflitante');
    assert.equal(failed.ok, false);
    assert.equal(client.hasSession(), false);
    const recovered = await client.submit('Nova sessão explícita');
    assert.equal(recovered.ok, true);
    assert.equal(starts, 2);
  });
}

test('busy and network failure keep a valid session for retry', async () => {
  let starts = 0;
  let turnCalls = 0;
  const client = createAskAiClient({
    createRequestId: () => `request-${turnCalls + 1}`,
    fetchImpl: (async (input) => {
      if (String(input).endsWith('/session')) {
        starts += 1;
        return new Response(JSON.stringify({
          ok: true, sessionId: 'session-client', sessionToken: TOKEN, revision: 0,
        }), { status: 201 });
      }
      turnCalls += 1;
      if (turnCalls === 1) {
        return new Response(JSON.stringify({
          ok: false, code: 'SESSION_BUSY', currentRevision: 0,
        }), { status: 409 });
      }
      return new Response(JSON.stringify(accepted(1)), { status: 200 });
    }) as typeof fetch,
  });

  const busy = await client.submit('Tente agora');
  assert.equal(busy.ok, false);
  assert.equal(client.hasSession(), true);
  const retry = await client.submit('Tente novamente');
  assert.equal(retry.ok, true);
  assert.equal(starts, 1);
});

test('explicit correction sends only correctionId and advances revision after validated response', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let request = 0;
  const client = createAskAiClient({
    createRequestId: () => `request-${++request}`,
    fetchImpl: (async (input, init) => {
      calls.push({
        url: String(input),
        ...(init === undefined ? {} : { init }),
      });
      if (String(input).endsWith('/session')) {
        return new Response(JSON.stringify({
          ok: true, sessionId: 'session-client', sessionToken: TOKEN, revision: 0,
        }), { status: 201 });
      }
      if (String(input).endsWith('/correction')) {
        return new Response(JSON.stringify({
          ok: true,
          idempotent: false,
          correctionId: 'correction-one',
          state: {
            ...accepted(2).state,
            canonicalRevision: 2,
          },
        }), { status: 200 });
      }
      return new Response(JSON.stringify(accepted(1)), { status: 200 });
    }) as typeof fetch,
  });

  assert.equal((await client.submit('Primeiro turno')).ok, true);
  const correction = await client.applyCorrection('correction-one');
  assert.equal(correction.ok, true);
  const correctionCall = calls.find((item) => item.url.endsWith('/correction'))!;
  assert.equal(new Headers(correctionCall.init?.headers).get('authorization'), `Bearer ${TOKEN}`);
  const body = JSON.parse(String(correctionCall.init?.body)) as Record<string, unknown>;
  assert.deepEqual(body, {
    sessionId: 'session-client',
    requestId: 'request-2',
    expectedRevision: 1,
    correctionId: 'correction-one',
  });
  assert.equal(Object.hasOwn(body, 'replacementValue'), false);
  assert.equal(Object.hasOwn(body, 'targetEvidenceId'), false);
  assert.equal(Object.hasOwn(body, 'source'), false);

  await client.submit('Depois da correção');
  const lastTurnBody = JSON.parse(String(calls.at(-1)?.init?.body)) as Record<string, unknown>;
  assert.equal(lastTurnBody.expectedRevision, 2);
});

test('correction action requires active session and exact returned correction identity', async () => {
  let starts = 0;
  let correctionCalls = 0;
  let request = 0;
  const client = createAskAiClient({
    createRequestId: () => `request-${++request}`,
    fetchImpl: (async (input) => {
      if (String(input).endsWith('/session')) {
        starts += 1;
        return new Response(JSON.stringify({
          ok: true, sessionId: 'session-client', sessionToken: TOKEN, revision: 0,
        }), { status: 201 });
      }
      if (String(input).endsWith('/correction')) {
        correctionCalls += 1;
        return new Response(JSON.stringify({
          ok: true,
          idempotent: false,
          correctionId: 'different-correction',
          state: accepted(2).state,
        }), { status: 200 });
      }
      return new Response(JSON.stringify(accepted(1)), { status: 200 });
    }) as typeof fetch,
  });

  const noSession = await client.applyCorrection('correction-one');
  assert.equal(noSession.ok, false);
  if (!noSession.ok) assert.equal(noSession.code, 'NO_ACTIVE_SESSION');
  assert.equal(starts, 0);

  assert.equal((await client.submit('Cria sessão')).ok, true);
  const mismatch = await client.applyCorrection('correction-one');
  assert.equal(mismatch.ok, false);
  if (!mismatch.ok) assert.equal(mismatch.code, 'SESSION_ID_MISMATCH');
  assert.equal(correctionCalls, 1);
  assert.equal(client.hasSession(), false);
});

test('correction stale/conflict invalidates uncertain local session while busy keeps it retryable', async () => {
  let phase: 'turn' | 'busy' | 'conflict' = 'turn';
  let request = 0;
  const client = createAskAiClient({
    createRequestId: () => `request-${++request}`,
    fetchImpl: (async (input) => {
      if (String(input).endsWith('/session')) {
        return new Response(JSON.stringify({
          ok: true, sessionId: 'session-client', sessionToken: TOKEN, revision: 0,
        }), { status: 201 });
      }
      if (String(input).endsWith('/correction')) {
        if (phase === 'busy') {
          return new Response(JSON.stringify({
            ok: false, code: 'SESSION_BUSY', currentRevision: 1,
          }), { status: 409 });
        }
        return new Response(JSON.stringify({
          ok: false, code: 'SESSION_CONFLICT', currentRevision: 1,
        }), { status: 409 });
      }
      return new Response(JSON.stringify(accepted(1)), { status: 200 });
    }) as typeof fetch,
  });

  assert.equal((await client.submit('Cria sessão')).ok, true);
  phase = 'busy';
  const busy = await client.applyCorrection('correction-one');
  assert.equal(busy.ok, false);
  if (!busy.ok) assert.equal(busy.retryable, true);
  assert.equal(client.hasSession(), true);

  phase = 'conflict';
  const conflict = await client.applyCorrection('correction-one');
  assert.equal(conflict.ok, false);
  assert.equal(client.hasSession(), false);
});

test('malformed accepted payload never mutates client revision', async () => {
  const bodies: Record<string, unknown>[] = [];
  let count = 0;
  const client = createAskAiClient({
    createRequestId: () => `request-${++count}`,
    fetchImpl: (async (input, init) => {
      if (String(input).endsWith('/session')) {
        return new Response(JSON.stringify({
          ok: true, sessionId: 'session-client', sessionToken: TOKEN, revision: 0,
        }), { status: 201 });
      }
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      if (bodies.length === 1) {
        return new Response(JSON.stringify({
          ok: true,
          mode: 'agent',
          state: { sessionId: 'session-client', canonicalRevision: 999 },
        }), { status: 200 });
      }
      return new Response(JSON.stringify(accepted(1)), { status: 200 });
    }) as typeof fetch,
  });

  const malformed = await client.submit('Primeiro');
  assert.equal(malformed.ok, false);
  if (!malformed.ok) assert.equal(malformed.code, 'INVALID_SERVER_RESPONSE');
  const second = await client.submit('Segundo');
  assert.equal(second.ok, true);
  assert.equal(bodies[1]?.expectedRevision, 0);
});

function forgedLineagePayload() {
  const base = accepted(1) as unknown as Record<string, unknown>;
  const state = base['state'] as Record<string, unknown>;
  return {
    ...base,
    state: {
      ...state,
      verifiedCalculations: [
        {
          id: 'calc-forged',
          resultValue: 999,
          resultUnit: 'currency/month',
          status: 'valid',
          expression: 'modelo afirmou economia',
          computedBy: 'model',
          basedOnRevision: 1,
          inputObservationIds: ['obs-1'],
        },
      ],
      opportunities: [
        {
          id: 'opp-forged',
          kind: 'monthly_cost',
          summary: 'Economia inventada.',
          evidenceIds: [],
          missingInputs: [],
          status: 'surfaced',
        },
      ],
      evidence: [],
    },
  };
}

test('client rejects calculation proof that is not computed by the application', async () => {
  const client = createAskAiClient({
    createRequestId: () => 'request-forged',
    fetchImpl: (async (input) => {
      if (String(input).endsWith('/session')) {
        return new Response(JSON.stringify({
          ok: true, sessionId: 'session-client', sessionToken: TOKEN, revision: 0,
        }), { status: 201 });
      }
      return new Response(JSON.stringify(forgedLineagePayload()), { status: 200 });
    }) as typeof fetch,
  });

  const result = await client.submit('Quero economizar.');
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'INVALID_SERVER_RESPONSE');
  assert.equal(client.hasSession(), true);
});

test('client accepts full WP07 proof lineage with opportunities and evidence refs', async () => {
  const base = accepted(1) as unknown as Record<string, unknown>;
  const state = base['state'] as Record<string, unknown>;
  const payload = {
    ...base,
    state: {
      ...state,
      verifiedCalculations: [
        {
          id: 'calc-capacity',
          resultValue: 44,
          resultUnit: 'hour/month',
          status: 'valid',
          expression: '220 ocorrencias * 12 min / 60',
          computedBy: 'application',
          basedOnRevision: 1,
          inputObservationIds: ['obs-1'],
        },
      ],
      opportunities: [
        {
          id: 'opp-capacity',
          kind: 'monthly_capacity',
          summary: 'Medir a capacidade consumida.',
          evidenceIds: ['obs-1'],
          missingInputs: ['minutos por conferencia'],
          status: 'surfaced',
        },
      ],
      evidence: [
        { id: 'obs-1', kind: 'observation', source: 'user', status: 'confirmed' },
      ],
    },
  };
  const client = createAskAiClient({
    createRequestId: () => 'request-proof',
    fetchImpl: (async (input) => {
      if (String(input).endsWith('/session')) {
        return new Response(JSON.stringify({
          ok: true, sessionId: 'session-client', sessionToken: TOKEN, revision: 0,
        }), { status: 201 });
      }
      return new Response(JSON.stringify(payload), { status: 200 });
    }) as typeof fetch,
  });

  const result = await client.submit('Onde perco capacidade?');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.verifiedCalculations[0]?.computedBy, 'application');
  assert.equal(result.state.opportunities[0]?.missingInputs[0], 'minutos por conferencia');
  assert.equal(result.state.evidence[0]?.source, 'user');
});
