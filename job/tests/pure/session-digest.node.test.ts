import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanonicalSalesContext } from '../../src/ai/context/canonical-sales-context.ts';
import { applyContextMutation } from '../../src/ai/context/context-reducer.ts';
import { createSessionDigest } from '../../src/ai/context/session-digest.ts';

function accept(context: ReturnType<typeof createCanonicalSalesContext>, input: Parameters<typeof applyContextMutation>[1]) {
  const result = applyContextMutation(context, input);
  if (!result.ok) assert.fail(result.code);
  return result.context;
}

test('session digest preserves evidence status, quantitative truth and open objections without inventing confirmation', () => {
  let context = createCanonicalSalesContext({ sessionId: 'session-201' });
  context = accept(context, {
    baseRevision: 0, actor: 'model', mutation: { type: 'ADD_FACT', fact: {
      id: 'fact-1', subject: 'fechamento', predicate: 'pressao', value: 'alta', status: 'proposed', source: 'inference',
      confidence: 0.61, supportingTurnIds: ['turn-1'], confirmedByTurnId: null,
    } },
  });
  context = accept(context, {
    baseRevision: 1, actor: 'user', mutation: { type: 'ADD_OBSERVATION', observation: {
      id: 'obs-clients', metric: 'clientes na carteira', value: 180, unit: 'client', period: null,
      status: 'confirmed', source: 'user', supportingTurnIds: ['turn-2'], confirmedByTurnId: 'turn-2',
    } },
  });
  context = accept(context, {
    baseRevision: 2, actor: 'user', mutation: { type: 'ADD_OBJECTION', objection: {
      id: 'obj-1', kind: 'price', summary: 'receio de custo', status: 'open', supportingTurnIds: ['turn-3'],
    } },
  });

  const digest = createSessionDigest(context);
  assert.equal(digest.schemaVersion, 1);
  assert.equal(digest.basedOnRevision, 3);
  assert.deepEqual(digest.facts, [{ id: 'fact-1', status: 'proposed', source: 'inference', subject: 'fechamento', predicate: 'pressao', value: 'alta' }]);
  assert.deepEqual(digest.quantitativeObservations, [{ id: 'obs-clients', metric: 'clientes na carteira', value: 180, unit: 'client', period: null, status: 'confirmed', source: 'user' }]);
  assert.deepEqual(digest.openObjections, [{ id: 'obj-1', kind: 'price', summary: 'receio de custo' }]);
  assert.equal(digest.facts[0]?.status, 'proposed');
});
