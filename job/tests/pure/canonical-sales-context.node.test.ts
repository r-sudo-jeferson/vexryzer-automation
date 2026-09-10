import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANONICAL_CONTEXT_KEYS,
  createCanonicalSalesContext,
  type CanonicalSalesContext,
} from '../../src/ai/context/canonical-sales-context.ts';

test('canonical context starts bounded, immutable, and free of attachment/model-memory authority', () => {
  const context = createCanonicalSalesContext({ sessionId: 'session-001' });

  assert.equal(context.schemaVersion, 1);
  assert.equal(context.revision, 0);
  assert.equal(context.sessionId, 'session-001');
  assert.equal(Object.isFrozen(context), true);
  assert.equal(Object.isFrozen(context.facts), true);
  assert.equal(Object.isFrozen(context.quantitativeObservations), true);
  assert.equal(Object.isFrozen(context.verifiedCalculations), true);
  assert.equal(Object.hasOwn(context, 'attachments'), false);
  assert.equal(Object.hasOwn(context, 'providerSessionId'), false);
  assert.equal(Object.hasOwn(context, 'preferredSolutionKind'), false);
  assert.equal(CANONICAL_CONTEXT_KEYS.includes('facts'), true);
  assert.equal(CANONICAL_CONTEXT_KEYS.some((key) => /attachment|providerSession|preferredSolution/i.test(key)), false);
});

test('canonical context rejects unsafe session ids', () => {
  assert.throws(() => createCanonicalSalesContext({ sessionId: '' }), /sessionId/i);
  assert.throws(() => createCanonicalSalesContext({ sessionId: '../escape' }), /sessionId/i);
});

test('canonical context exposes composable opportunity history rather than one solution classifier', () => {
  const context: CanonicalSalesContext = createCanonicalSalesContext({ sessionId: 'session-002' });
  assert.deepEqual(context.opportunities, []);
  assert.equal('preferredSolutionKind' in context, false);
});
