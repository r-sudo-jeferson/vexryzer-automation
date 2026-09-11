import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SELLER_LOCAL_TOOLS,
  parseSellerToolCall,
} from '../../src/server/ai/seller/seller-wire-tools.ts';
import { buildProviderChatBody } from '../../src/server/ai/providers/openai-chat-wire.ts';
import { createVerifiedRouteFixture } from './provider-test-fixtures.ts';

function tool(name: string, args: unknown) {
  return {
    id: 'call-1',
    type: 'function' as const,
    function: { name, arguments: JSON.stringify(args) },
  };
}

test('Seller exposes three closed local tools without model-owned trust metadata in observation/calculation schemas', () => {
  assert.deepEqual(SELLER_LOCAL_TOOLS.map((item) => item.function.name), [
    'capture_user_observations',
    'request_calculations',
    'submit_seller_submission',
  ]);
  for (const item of SELLER_LOCAL_TOOLS) {
    assert.equal(item.function.parameters.type, 'object');
    assert.equal(item.function.parameters.additionalProperties, false);
  }
  const observation = SELLER_LOCAL_TOOLS.find((item) => item.function.name === 'capture_user_observations')!;
  const calculation = SELLER_LOCAL_TOOLS.find((item) => item.function.name === 'request_calculations')!;
  for (const serialized of [JSON.stringify(observation), JSON.stringify(calculation)]) {
    assert.equal(serialized.includes('"baseRevision"'), false);
    assert.equal(serialized.includes('"turnId"'), false);
    assert.equal(serialized.includes('"source"'), false);
    assert.equal(serialized.includes('"resultValue"'), false);
  }
});

test('observation tool accepts only semantic kind, exact evidence quote and value', () => {
  const result = parseSellerToolCall(tool('capture_user_observations', {
    observations: [
      { kind: 'people_count', quote: 'somos 3 pessoas', value: 3 },
      { kind: 'minutes_per_person_per_day', quote: '40 minutos por pessoa por dia', value: 40 },
    ],
  }), 12);
  assert.equal(result.ok, true);
  if (!result.ok || result.kind !== 'user_observation_requests') return;
  assert.deepEqual(result.requests, [
    { kind: 'people_count', quote: 'somos 3 pessoas', value: 3 },
    { kind: 'minutes_per_person_per_day', quote: '40 minutos por pessoa por dia', value: 40 },
  ]);
});

test('observation tool rejects model-authored revision, ids, turn binding, provenance, units and duplicated semantic requests', () => {
  const authorityFields = ['id', 'baseRevision', 'turnId', 'source', 'unit', 'period'];
  for (const field of authorityFields) {
    const result = parseSellerToolCall(tool('capture_user_observations', {
      observations: [{ kind: 'people_count', quote: 'somos 3 pessoas', value: 3, [field]: field === 'baseRevision' ? 12 : 'forged' }],
    }), 12);
    assert.equal(result.ok, false, field);
  }
  const duplicate = parseSellerToolCall(tool('capture_user_observations', {
    observations: [
      { kind: 'people_count', quote: 'somos 3 pessoas', value: 3 },
      { kind: 'people_count', quote: 'somos 3 pessoas', value: 3 },
    ],
  }), 12);
  assert.deepEqual(duplicate, { ok: false, code: 'DUPLICATE_REQUEST' });
});

test('calculation tool accepts only semantic calculation kind and canonical observation references', () => {
  const result = parseSellerToolCall(tool('request_calculations', {
    requests: [{
      kind: 'monthly_capacity',
      peopleObservationId: 'obs-people',
      minutesPerPersonPerDayObservationId: 'obs-minutes',
      workingDaysPerMonthObservationId: 'obs-days',
    }],
  }), 12);
  assert.equal(result.ok, true);
  if (!result.ok || result.kind !== 'calculation_requests') return;
  assert.deepEqual(result.requests, [{
    kind: 'monthly_capacity',
    peopleObservationId: 'obs-people',
    minutesPerPersonPerDayObservationId: 'obs-minutes',
    workingDaysPerMonthObservationId: 'obs-days',
  }]);
});

test('calculation tool rejects model-authored id, revision, result and duplicate semantic requests', () => {
  for (const extra of [
    { id: 'calc-forged' },
    { baseRevision: 12 },
    { resultValue: 999 },
  ]) {
    const result = parseSellerToolCall(tool('request_calculations', {
      requests: [{
        kind: 'monthly_workload',
        occurrencesPerMonthObservationId: 'obs-occ',
        minutesPerOccurrenceObservationId: 'obs-min',
        ...extra,
      }],
    }), 12);
    assert.equal(result.ok, false);
  }
  const request = {
    kind: 'monthly_workload',
    occurrencesPerMonthObservationId: 'obs-occ',
    minutesPerOccurrenceObservationId: 'obs-min',
  };
  assert.deepEqual(parseSellerToolCall(tool('request_calculations', { requests: [request, request] }), 12), {
    ok: false,
    code: 'DUPLICATE_REQUEST',
  });
});

test('submission proposal revision is server-bound even when omitted or stale in model output', () => {
  for (const proposal of [
    { schemaVersion: 1, narration: 'x' },
    { schemaVersion: 1, baseRevision: 3, narration: 'x' },
  ]) {
    const result = parseSellerToolCall(tool('submit_seller_submission', {
      submission: {
        schemaVersion: 1,
        proposalId: 'proposal-1',
        proposal,
        materialClaims: [],
        calculationRequests: [],
      },
    }), 12);
    assert.equal(result.ok, true);
    if (!result.ok || result.kind !== 'seller_submission') continue;
    const normalized = result.submission['proposal'] as Record<string, unknown>;
    assert.equal(normalized['baseRevision'], 12);
  }
});

test('submission still rejects pending calculations, unknown wrapper fields and unknown tools fail-closed', () => {
  const pending = parseSellerToolCall(tool('submit_seller_submission', {
    submission: {
      schemaVersion: 1,
      proposalId: 'proposal-1',
      proposal: {},
      materialClaims: [],
      calculationRequests: [{ kind: 'monthly_workload' }],
    },
  }), 12);
  assert.equal(pending.ok, false);

  const extra = parseSellerToolCall(tool('submit_seller_submission', {
    submission: {
      schemaVersion: 1,
      proposalId: 'proposal-1',
      proposal: {},
      materialClaims: [],
      calculationRequests: [],
    },
    executable: 'nope',
  }), 12);
  assert.equal(extra.ok, false);
  assert.equal(parseSellerToolCall(tool('browser_search', {}), 12).ok, false);
});


function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function collectPropertySchemas(value: unknown, propertyName: string, output: unknown[] = []): readonly unknown[] {
  if (Array.isArray(value)) {
    for (const item of value) collectPropertySchemas(item, propertyName, output);
    return output;
  }
  if (!isRecord(value)) return output;
  const properties = value['properties'];
  if (isRecord(properties) && Object.hasOwn(properties, propertyName)) output.push(properties[propertyName]);
  for (const nested of Object.values(value)) collectPropertySchemas(nested, propertyName, output);
  return output;
}

function collectEnumStrings(value: unknown, output = new Set<string>()): ReadonlySet<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectEnumStrings(item, output);
    return output;
  }
  if (!isRecord(value)) return output;
  const values = value['enum'];
  if (Array.isArray(values)) {
    for (const item of values) if (typeof item === 'string') output.add(item);
  }
  for (const nested of Object.values(value)) collectEnumStrings(nested, output);
  return output;
}

test('model-facing action, process and material schemas communicate exact kind-specific field contracts without inflating the wire', () => {
  const submit = SELLER_LOCAL_TOOLS.find((item) => item.function.name === 'submit_seller_submission');
  assert.ok(submit);

  const actionSchemas = collectPropertySchemas(submit.function.parameters, 'actions');
  assert.equal(actionSchemas.length, 1);
  const action = actionSchemas[0];
  assert.ok(isRecord(action));
  assert.ok(isRecord(action['items']));
  assert.match(String(action['items']['description']), /focus\/reveal=id\+kind\+targetId\+reason/i);
  assert.match(String(action['items']['description']), /explain_relationship=id\+kind\+sourceId\+targetId\+text/i);

  const processSchemas = collectPropertySchemas(submit.function.parameters, 'processMutations');
  assert.equal(processSchemas.length, 1);
  const process = processSchemas[0];
  assert.ok(isRecord(process));
  assert.ok(isRecord(process['items']));
  assert.match(String(process['items']['description']), /upsert_node=id\+kind\+nodeId\+label\+summary\+evidenceIds/i);
  assert.match(String(process['items']['description']), /set_node_state=id\+kind\+nodeId\+state\+reason/i);

  const claimSchemas = collectPropertySchemas(submit.function.parameters, 'materialClaims');
  assert.equal(claimSchemas.length, 1);
  const claims = claimSchemas[0];
  assert.ok(isRecord(claims));
  assert.ok(isRecord(claims['items']));
  assert.match(String(claims['items']['description']), /verified_numeric=id\+kind\+text\+calculationId/i);
  assert.match(String(claims['items']['description']), /artifact_readiness=id\+kind\+text\+artifactId\+readiness/i);
});

test('observation contract tells the model not to invent numeric evidence or paraphrase the authoritative quote', () => {
  const observation = SELLER_LOCAL_TOOLS.find((item) => item.function.name === 'capture_user_observations');
  assert.ok(observation);
  assert.match(observation.function.description, /no explicit numeric token, do not call/i);
  assert.match(observation.function.description, /exact contiguous substring copied verbatim/i);
  const serialized = JSON.stringify(observation.function.parameters);
  assert.match(serialized, /never paraphrase/i);
  assert.match(serialized, /occurrences_per_month requires occurrence\+month/i);
});

test('final Seller tool publishes the full closed model-facing contract within the provider wire budget', () => {
  const submit = SELLER_LOCAL_TOOLS.find((item) => item.function.name === 'submit_seller_submission');
  assert.ok(submit);

  const route = createVerifiedRouteFixture({
    family: 'groq',
    modelId: 'openai/gpt-oss-120b',
    tier: 'independent_fallback',
  });
  assert.doesNotThrow(() => buildProviderChatBody({
    route,
    messages: [{ role: 'system', content: 'contract' }, { role: 'user', content: 'canonical context' }],
    tools: SELLER_LOCAL_TOOLS,
  }));

  const bytes = new TextEncoder().encode(JSON.stringify(submit.function.parameters)).byteLength;
  assert.ok(bytes < 64_000, `submission schema unexpectedly grew to ${bytes} bytes`);

  assert.equal(collectPropertySchemas(submit.function.parameters, 'baseRevision').length, 0);
  const criticRequired = collectPropertySchemas(submit.function.parameters, 'criticRequired');
  assert.equal(criticRequired.length, 1);
  assert.deepEqual(criticRequired[0], {
    type: 'boolean',
    enum: [true],
    description: 'Every Seller submission requires independent Critic review.',
  });

  const sourceSchemas = collectPropertySchemas(submit.function.parameters, 'source');
  assert.equal(sourceSchemas.length, 1);
  const sourceSchema = sourceSchemas[0];
  assert.ok(isRecord(sourceSchema));
  assert.deepEqual(sourceSchema['enum'], ['inference']);

  const enums = collectEnumStrings(submit.function.parameters);
  for (const forbidden of [
    'price',
    'discount',
    'attachment_access',
    'secret_access',
    'tool_escalation',
  ]) {
    assert.equal(enums.has(forbidden), false, forbidden);
  }
  for (const safe of ['verified_numeric', 'qualitative', 'feasibility', 'artifact_readiness']) {
    assert.equal(enums.has(safe), true, safe);
  }
});
