import test from 'node:test';
import assert from 'node:assert/strict';
import type { CanonicalSalesContext } from '../../src/ai/context/canonical-sales-context.ts';
import type { SellerSubmission } from '../../src/ai/seller/seller-contract.ts';
import {
  evaluateAccountingSellerQuality,
  evaluateStrategyDiversity,
  type AccountingSellerQualityScenario,
} from '../../src/ai/evals/accounting-seller-quality.ts';

function canonical(withCalculation = false): CanonicalSalesContext {
  return {
    schemaVersion: 1,
    sessionId: 'eval-session',
    revision: 2,
    turnIds: ['turn-1'],
    facts: [],
    primaryPain: 'retrabalho no fechamento',
    desiredOutcome: null,
    knownConsequences: [],
    objections: [],
    quantitativeObservations: [],
    verifiedCalculations: withCalculation ? [{
      id: 'calc-1',
      kind: 'capacity',
      inputObservationIds: ['obs-1'],
      expression: 'verified',
      resultValue: 44,
      resultUnit: 'hour/month',
      computedBy: 'application',
      basedOnRevision: 2,
      status: 'valid',
      invalidatedAtRevision: null,
    }] : [],
    openUncertainties: [],
    opportunities: [],
    artifacts: [],
    currentSceneId: null,
    latestUserIntent: { turnId: 'turn-1', text: 'Quero reduzir retrabalho.' },
  };
}

function submission(overrides: {
  narration?: string;
  capabilities?: readonly ('automation_integration' | 'training_enablement' | 'process_data_improvement' | 'bi_decision_intelligence')[];
  actions?: readonly { id: string; kind: 'focus'; targetId: string; reason: string }[];
  quantitativeOpportunities?: readonly { id: string; kind: 'other'; objective: string; evidenceIds: readonly string[]; missingInputs: readonly string[] }[];
} = {}): SellerSubmission {
  return {
    schemaVersion: 1,
    proposalId: 'proposal-1',
    proposal: {
      schemaVersion: 1,
      baseRevision: 2,
      narration: overrides.narration ?? 'O fechamento contábil concentra retrabalho e pendências.',
      intent: {
        schemaVersion: 1,
        objective: 'Reduzir retrabalho no fechamento.',
        rationale: 'A rotina contábil informada mostra uma oportunidade operacional.',
        capabilities: overrides.capabilities ?? ['process_data_improvement'],
        actions: overrides.actions ?? [{ id: 'action-1', kind: 'focus', targetId: 'node-1', reason: 'Focar o gargalo.' }],
        quantitativeOpportunities: overrides.quantitativeOpportunities ?? [],
        artifactIntents: [],
        nextQuestion: null,
      },
      factProposals: [],
      correctionProposals: [],
      processMutations: [],
      sceneProposal: null,
      artifactProposals: [],
      criticRequired: true,
    },
    materialClaims: [],
    calculationRequests: [],
  };
}

const scenario: AccountingSellerQualityScenario = {
  id: 'closing',
  accountingSignalGroups: [['fechamento'], ['retrabalho', 'pendência', 'pendencia']],
  expectedCapabilitiesAnyOf: ['process_data_improvement', 'automation_integration'],
  forbiddenCapabilities: [],
  quantitativeExpectation: 'opportunity_or_calculation',
  requireSemanticUi: true,
};

test('seller quality evaluator requires accounting language, capability fit, quantitative engagement and semantic UI', () => {
  const result = evaluateAccountingSellerQuality({
    scenario,
    submission: submission({
      quantitativeOpportunities: [{
        id: 'quant-1',
        kind: 'other',
        objective: 'Medir horas mensais de retrabalho.',
        evidenceIds: [],
        missingInputs: ['horas por mês'],
      }],
    }),
    canonical: canonical(),
  });
  assert.equal(result.pass, true);
  assert.deepEqual(result.checks, {
    accountingNative: true,
    capabilityFit: true,
    forbiddenCapabilityAbsent: true,
    quantitativeIntegrity: true,
    semanticUi: true,
  });
});

test('verified calculation satisfies the stronger quantitative expectation', () => {
  const result = evaluateAccountingSellerQuality({
    scenario: { ...scenario, quantitativeExpectation: 'verified_calculation' },
    submission: submission(),
    canonical: canonical(true),
  });
  assert.equal(result.checks.quantitativeIntegrity, true);
});

test('no-software-fit scenarios fail when the Seller forces a software capability', () => {
  const result = evaluateAccountingSellerQuality({
    scenario: {
      id: 'no-software',
      accountingSignalGroups: [['rotina']],
      expectedCapabilitiesAnyOf: [],
      forbiddenCapabilities: ['automation_integration'],
      quantitativeExpectation: 'none',
      requireSemanticUi: false,
    },
    submission: submission({
      narration: 'A rotina contábil é pontual.',
      capabilities: ['automation_integration'],
      actions: [],
    }),
    canonical: canonical(),
  });
  assert.equal(result.pass, false);
  assert.equal(result.checks.forbiddenCapabilityAbsent, false);
});

test('strategy diversity counts only passing materially distinct strategy signatures', () => {
  const diversityScenario = {
    ...scenario,
    expectedCapabilitiesAnyOf: ['process_data_improvement', 'bi_decision_intelligence'] as const,
    quantitativeExpectation: 'none' as const,
  };
  const first = evaluateAccountingSellerQuality({
    scenario: diversityScenario,
    submission: submission({ capabilities: ['process_data_improvement'] }),
    canonical: canonical(),
  });
  const second = evaluateAccountingSellerQuality({
    scenario: diversityScenario,
    submission: submission({ capabilities: ['bi_decision_intelligence'] }),
    canonical: canonical(),
  });
  const failed = { ...second, pass: false };
  assert.deepEqual(evaluateStrategyDiversity([first, second], 2), { pass: true, distinctStrategies: 2 });
  assert.deepEqual(evaluateStrategyDiversity([first, failed], 2), { pass: false, distinctStrategies: 1 });
});


test('required capability composition fails partial solutions and passes only when the complete capability set is present', () => {
  const compositeScenario: AccountingSellerQualityScenario = {
    ...scenario,
    expectedCapabilitiesAnyOf: [],
    requiredCapabilities: ['process_data_improvement', 'bi_decision_intelligence'],
    quantitativeExpectation: 'none',
  };
  const partial = evaluateAccountingSellerQuality({
    scenario: compositeScenario,
    submission: submission({ capabilities: ['process_data_improvement'] }),
    canonical: canonical(),
  });
  const complete = evaluateAccountingSellerQuality({
    scenario: compositeScenario,
    submission: submission({ capabilities: ['process_data_improvement', 'bi_decision_intelligence'] }),
    canonical: canonical(),
  });
  assert.equal(partial.checks.capabilityFit, false);
  assert.equal(partial.pass, false);
  assert.equal(complete.checks.capabilityFit, true);
  assert.equal(complete.pass, true);
});
