import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCanonicalSalesContext,
  type CanonicalSalesContext,
} from '../../src/ai/context/canonical-sales-context.ts';
import { applyContextMutation } from '../../src/ai/context/context-reducer.ts';

function accepted(result: ReturnType<typeof applyContextMutation>): CanonicalSalesContext {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.code);
  return result.context;
}

test('model inference cannot forge user provenance or confirmed truth', () => {
  const context = createCanonicalSalesContext({ sessionId: 'session-101' });
  const result = applyContextMutation(context, {
    baseRevision: 0,
    actor: 'model',
    mutation: {
      type: 'ADD_FACT',
      fact: {
        id: 'fact-1',
        subject: 'fechamento',
        predicate: 'leva',
        value: '3 dias',
        status: 'confirmed',
        source: 'user',
        confidence: 1,
        supportingTurnIds: ['turn-1'],
        confirmedByTurnId: 'turn-1',
      },
    },
  });

  assert.deepEqual(result, { ok: false, code: 'AUTHORITY_VIOLATION', revision: 0 });
});

test('user confirmation upgrades an inferred fact without laundering its original provenance', () => {
  let context = createCanonicalSalesContext({ sessionId: 'session-102' });
  context = accepted(applyContextMutation(context, {
    baseRevision: 0,
    actor: 'model',
    mutation: {
      type: 'ADD_FACT',
      fact: {
        id: 'fact-1',
        subject: 'conferencia',
        predicate: 'recorrencia',
        value: 'diaria',
        status: 'proposed',
        source: 'inference',
        confidence: 0.72,
        supportingTurnIds: ['turn-1'],
        confirmedByTurnId: null,
      },
    },
  }));

  const confirmed = accepted(applyContextMutation(context, {
    baseRevision: 1,
    actor: 'user',
    mutation: { type: 'CONFIRM_FACT', factId: 'fact-1', turnId: 'turn-2' },
  }));

  assert.equal(confirmed.revision, 2);
  assert.equal(confirmed.facts[0]?.status, 'confirmed');
  assert.equal(confirmed.facts[0]?.source, 'inference');
  assert.equal(confirmed.facts[0]?.confirmedByTurnId, 'turn-2');
  assert.deepEqual(confirmed.facts[0]?.supportingTurnIds, ['turn-1', 'turn-2']);
});

test('quantitative correction supersedes history and invalidates dependent calculations and opportunities', () => {
  let context = createCanonicalSalesContext({ sessionId: 'session-103' });
  context = accepted(applyContextMutation(context, {
    baseRevision: 0,
    actor: 'user',
    mutation: {
      type: 'ADD_OBSERVATION',
      observation: {
        id: 'obs-minutes', metric: 'minutos por conferencia', value: 40, unit: 'minute', period: 'day',
        status: 'confirmed', source: 'user', supportingTurnIds: ['turn-1'], confirmedByTurnId: 'turn-1',
      },
    },
  }));
  context = accepted(applyContextMutation(context, {
    baseRevision: 1,
    actor: 'system',
    mutation: {
      type: 'ADD_CALCULATION',
      calculation: {
        id: 'calc-hours', kind: 'capacity', inputObservationIds: ['obs-minutes'], expression: '40 min/day',
        resultValue: 40, resultUnit: 'minute/day', computedBy: 'application', basedOnRevision: 1,
        status: 'valid', invalidatedAtRevision: null,
      },
    },
  }));
  context = accepted(applyContextMutation(context, {
    baseRevision: 2,
    actor: 'model',
    mutation: {
      type: 'ADD_OPPORTUNITY',
      opportunity: {
        id: 'opp-1', summary: 'Liberar capacidade da conferencia',
        capabilities: ['automation_integration', 'bi_decision_intelligence'],
        evidenceIds: ['obs-minutes', 'calc-hours'], status: 'active', invalidatedAtRevision: null,
      },
    },
  }));

  const corrected = accepted(applyContextMutation(context, {
    baseRevision: 3,
    actor: 'user',
    mutation: {
      type: 'CORRECT_OBSERVATION',
      observationId: 'obs-minutes',
      turnId: 'turn-4',
      replacement: {
        id: 'obs-minutes-v2', metric: 'minutos por conferencia', value: 25, unit: 'minute', period: 'day',
        status: 'confirmed', source: 'user', supportingTurnIds: ['turn-4'], confirmedByTurnId: 'turn-4',
      },
    },
  }));

  assert.equal(corrected.revision, 4);
  assert.equal(corrected.quantitativeObservations.find((item) => item.id === 'obs-minutes')?.status, 'superseded');
  assert.equal(corrected.quantitativeObservations.find((item) => item.id === 'obs-minutes-v2')?.status, 'confirmed');
  assert.equal(corrected.verifiedCalculations[0]?.status, 'invalidated');
  assert.equal(corrected.verifiedCalculations[0]?.invalidatedAtRevision, 4);
  assert.equal(corrected.opportunities[0]?.status, 'invalidated');
  assert.equal(corrected.opportunities[0]?.invalidatedAtRevision, 4);
});

test('stale base revision is rejected and accepted mutations increment exactly once', () => {
  const context = createCanonicalSalesContext({ sessionId: 'session-104' });
  const stale = applyContextMutation(context, {
    baseRevision: 9,
    actor: 'user',
    mutation: { type: 'SET_LATEST_USER_INTENT', turnId: 'turn-1', intent: 'quero reduzir o fechamento' },
  });
  assert.deepEqual(stale, { ok: false, code: 'STALE_REVISION', revision: 0 });

  const next = accepted(applyContextMutation(context, {
    baseRevision: 0,
    actor: 'user',
    mutation: { type: 'SET_LATEST_USER_INTENT', turnId: 'turn-1', intent: 'quero reduzir o fechamento' },
  }));
  assert.equal(next.revision, 1);
  assert.equal(next.latestUserIntent?.text, 'quero reduzir o fechamento');
});
