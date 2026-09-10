import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANONICAL_CONTEXT_KEYS,
  createCanonicalSalesContext,
  freezeCanonicalSalesContext,
  freezeFact,
  freezeObservation,
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

test('runtime validators reject enum forgery from untrusted JSON while allowing hourly cost evidence', () => {
  assert.throws(() => freezeObservation({
    id: 'obs-invalid-unit', metric: 'custo', value: 10, unit: 'bitcoin' as never, period: null,
    status: 'confirmed', source: 'user', supportingTurnIds: ['turn-1'], confirmedByTurnId: 'turn-1',
  }), /unit/i);
  assert.throws(() => freezeObservation({
    id: 'obs-invalid-source', metric: 'custo', value: 10, unit: 'currency', period: 'hour',
    status: 'confirmed', source: 'provider' as never, supportingTurnIds: ['turn-1'], confirmedByTurnId: 'turn-1',
  }), /source/i);
  assert.throws(() => freezeFact({
    id: 'fact-invalid-status', subject: 'fechamento', predicate: 'status', value: 'ok',
    status: 'verified' as never, source: 'user', confidence: 1, supportingTurnIds: ['turn-1'], confirmedByTurnId: 'turn-1',
  }), /status/i);
  assert.doesNotThrow(() => freezeObservation({
    id: 'obs-hourly-cost', metric: 'custo hora informado', value: 75, unit: 'currency', period: 'hour',
    status: 'confirmed', source: 'user', supportingTurnIds: ['turn-1'], confirmedByTurnId: 'turn-1',
  }));
});

test('runtime validators reject forged objection, calculation, opportunity, and artifact enum values', () => {
  const base = createCanonicalSalesContext({ sessionId: 'session-runtime-guards' });

  assert.throws(() => freezeCanonicalSalesContext({
    ...base,
    objections: [{ id: 'obj-forged', kind: 'coupon' as never, summary: 'nao', status: 'open', supportingTurnIds: ['turn-1'] }],
  }), /objection\.kind/i);

  assert.throws(() => freezeCanonicalSalesContext({
    ...base,
    verifiedCalculations: [{
      id: 'calc-forged', kind: 'fortune' as never, inputObservationIds: ['obs-1'], expression: '1', resultValue: 1,
      resultUnit: 'hour/month', computedBy: 'application', basedOnRevision: 0, status: 'valid', invalidatedAtRevision: null,
    }],
  }), /calculation\.kind/i);

  assert.throws(() => freezeCanonicalSalesContext({
    ...base,
    opportunities: [{
      id: 'opp-forged', summary: 'x', capabilities: [], evidenceIds: [], status: 'approved' as never, invalidatedAtRevision: null,
    }],
  }), /opportunity\.status/i);

  assert.throws(() => freezeCanonicalSalesContext({
    ...base,
    artifacts: [{
      id: 'artifact-forged', kind: 'executable_bundle' as never, title: 'x', summary: 'x', maturity: 'conceptual', evidenceIds: [], status: 'proposed', invalidatedAtRevision: null,
    }],
  }), /artifact\.kind/i);

  assert.throws(() => freezeCanonicalSalesContext({
    ...base,
    artifacts: [{
      id: 'artifact-bad-maturity', kind: 'bi_dashboard', title: 'x', summary: 'x',
      maturity: 'production' as never, evidenceIds: [], status: 'proposed', invalidatedAtRevision: null,
    }],
  }), /artifact\.maturity/i);
});
