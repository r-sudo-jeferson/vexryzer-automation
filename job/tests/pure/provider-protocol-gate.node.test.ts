import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateRequiredProviderProtocols,
  REQUIRED_S002_PROVIDER_PROTOCOLS,
} from '../../tools/provider-quality/provider-protocol-gate.ts';

function record(provider: string, modelId: string, overrides: Record<string, unknown> = {}) {
  return {
    provider,
    modelId,
    authenticated: true,
    streaming: true,
    toolCall: true,
    toolReplay: true,
    errorClass: 'NONE',
    ...overrides,
  };
}

function completeEvidence() {
  return {
    schemaVersion: 1,
    status: 'complete',
    results: REQUIRED_S002_PROVIDER_PROTOCOLS.map((item) => record(item.provider, item.modelId)),
  };
}

test('required provider protocol gate passes only when exact Seller, Critic and fallback tuples pass', () => {
  const result = evaluateRequiredProviderProtocols(completeEvidence());
  assert.equal(result.pass, true);
  assert.equal(result.code, 'PASS');
  assert.equal(result.routes.length, 3);
});

test('required provider protocol gate ignores unrelated route success and fails a required protocol regression', () => {
  const evidence = completeEvidence();
  evidence.results.push(record('cloudflare-workers-ai', '@cf/nvidia/nemotron-3-120b-a12b'));
  evidence.results[1] = record('cloudflare-workers-ai', '@cf/google/gemma-4-26b-a4b-it', {
    toolReplay: false,
    errorClass: 'PROTOCOL',
  });
  const result = evaluateRequiredProviderProtocols(evidence);
  assert.equal(result.pass, false);
  assert.equal(result.code, 'REQUIRED_ROUTE_FAILED');
  assert.equal(result.routes.find((item) => item.role === 'critic')?.pass, false);
});

test('required provider protocol gate rejects duplicate exact evidence instead of selecting a convenient record', () => {
  const evidence = completeEvidence();
  evidence.results.push(record('groq', 'openai/gpt-oss-120b'));
  const result = evaluateRequiredProviderProtocols(evidence);
  assert.equal(result.pass, false);
  assert.equal(result.routes.find((item) => item.role === 'fallback')?.code, 'DUPLICATE');
});
