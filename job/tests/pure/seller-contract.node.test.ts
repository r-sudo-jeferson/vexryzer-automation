import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSellerSubmission } from '../../src/ai/seller/seller-contract.ts';
import { buildAccountingSellerGuidance } from '../../src/ai/seller/accounting-language.ts';
import type { CanonicalSalesContext } from '../../src/ai/context/canonical-sales-context.ts';

const context: CanonicalSalesContext = {
  schemaVersion: 1,
  sessionId: 'session-501',
  revision: 12,
  turnIds: ['turn-10', 'turn-11', 'turn-12'],
  facts: [{
    id: 'fact-closing', subject: 'fechamento', predicate: 'dura', value: '5 dias', status: 'confirmed', source: 'user', confidence: 1,
    supportingTurnIds: ['turn-10'], confirmedByTurnId: 'turn-10',
  }],
  primaryPain: 'fechamento comprimido',
  desiredOutcome: 'liberar capacidade sem ampliar equipe',
  knownConsequences: [], objections: [], quantitativeObservations: [],
  verifiedCalculations: [{
    id: 'calc-capacity', kind: 'capacity', inputObservationIds: ['obs-people', 'obs-minutes', 'obs-days'],
    expression: '3 people × 40 minutes/day × 22 days', resultValue: 44, resultUnit: 'hour/month', computedBy: 'application',
    basedOnRevision: 12, status: 'valid', invalidatedAtRevision: null,
  }],
  openUncertainties: [], opportunities: [], artifacts: [], currentSceneId: 'scene-closing',
  latestUserIntent: { turnId: 'turn-12', text: 'Quero reduzir o fechamento sem contratar mais gente.' },
};

function proposal(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    baseRevision: 12,
    narration: 'O gargalo de fechamento pode ser reframado como capacidade operacional.',
    intent: {
      schemaVersion: 1,
      objective: 'Tornar o custo de capacidade visível.',
      rationale: 'O visitante já confirmou o tempo do fechamento.',
      capabilities: ['bi_decision_intelligence', 'process_data_improvement'],
      actions: [], quantitativeOpportunities: [], artifactIntents: [], nextQuestion: null,
    },
    factProposals: [], correctionProposals: [], processMutations: [], sceneProposal: null, artifactProposals: [], criticRequired: true,
    ...overrides,
  };
}

function submission(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    proposalId: 'proposal-501',
    proposal: proposal(),
    materialClaims: [],
    calculationRequests: [],
    ...overrides,
  };
}

const options = { canonical: context } as const;

test('accepts an improvisational multi-capability proposal with no question', () => {
  const result = validateSellerSubmission(submission(), options);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.submission.proposal.intent.capabilities, ['bi_decision_intelligence', 'process_data_improvement']);
  assert.equal(result.submission.proposal.intent.nextQuestion, null);
});

test('rejects any Seller submission that tries to disable the independent Critic gate', () => {
  const result = validateSellerSubmission(submission({
    proposal: proposal({ criticRequired: false }),
  }), options);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'INVALID_VALUE');
  assert.equal(result.path, 'sellerSubmission.proposal.criticRequired');
});

test('accepts a verified numeric claim only when backed by a valid application calculation', () => {
  const result = validateSellerSubmission(submission({
    materialClaims: [{ id: 'claim-1', kind: 'verified_numeric', text: 'O processo consome 44 horas por mês.', calculationId: 'calc-capacity' }],
  }), options);
  assert.equal(result.ok, true);
});

test('hard-blocks unsupported numeric claims before Critic', () => {
  const result = validateSellerSubmission(submission({
    materialClaims: [{ id: 'claim-1', kind: 'verified_numeric', text: 'Você economizará 30%.', calculationId: 'calc-missing' }],
  }), options);
  assert.equal(result.ok, false);
  if (result.ok) return;
  if (result.code !== 'HARD_BLOCK') assert.fail(`expected HARD_BLOCK, got ${result.code}`);
  assert.equal(result.finding.code, 'UNSUPPORTED_NUMERIC_CLAIM');
});

test('hard-blocks model provenance laundering even when it cites a real user turn', () => {
  const result = validateSellerSubmission(submission({
    proposal: proposal({ factProposals: [{ id: 'fact-new', subject: 'equipe', predicate: 'aceita', value: true, source: 'user', supportingTurnIds: ['turn-12'] }] }),
  }), options);
  assert.equal(result.ok, false);
  if (result.ok) return;
  if (result.code !== 'HARD_BLOCK') assert.fail(`expected HARD_BLOCK, got ${result.code}`);
  assert.equal(result.finding.code, 'FORGED_CONFIRMATION');
});

test('hard-blocks authoritative price, discount, fake feasibility, attachment-read, secret/tool escalation, and production confusion', async (t) => {
  const cases = [
    ['price', { id: 'claim-p', kind: 'price', text: 'O preço da Vexryzer é R$ 5.000.' }, 'AUTHORITATIVE_PRICE_OR_DISCOUNT'],
    ['discount', { id: 'claim-d', kind: 'discount', text: 'Posso conceder 20% de desconto.' }, 'AUTHORITATIVE_PRICE_OR_DISCOUNT'],
    ['feasibility', { id: 'claim-f', kind: 'feasibility', text: 'É tecnicamente viável.', state: 'confirmed', evidenceIds: [] }, 'UNSUPPORTED_FEASIBILITY'],
    ['attachment', { id: 'claim-a', kind: 'attachment_access', text: 'Li o PDF enviado.' }, 'ATTACHMENT_ACCESS_CLAIM'],
    ['secret', { id: 'claim-s', kind: 'secret_access', text: 'Usei sua API key.' }, 'SECRET_OR_TOOL_ESCALATION'],
    ['tool', { id: 'claim-t', kind: 'tool_escalation', text: 'Executei uma ferramenta não autorizada.' }, 'SECRET_OR_TOOL_ESCALATION'],
    ['production', { id: 'claim-r', kind: 'artifact_readiness', text: 'O protótipo está pronto para produção.', artifactId: 'artifact-1', readiness: 'production' }, 'PRODUCTION_PROTOTYPE_CONFUSION'],
  ] as const;

  for (const [name, claim, expected] of cases) {
    await t.test(name, () => {
      const result = validateSellerSubmission(submission({ materialClaims: [claim] }), options);
      assert.equal(result.ok, false);
      if (result.ok) return;
      if (result.code !== 'HARD_BLOCK') assert.fail(`expected HARD_BLOCK, got ${result.code}`);
      assert.equal(result.finding.code, expected);
    });
  }
});

test('defense-in-depth blocks an attachment-read assertion hidden only in narration', () => {
  const result = validateSellerSubmission(submission({
    proposal: proposal({ narration: 'Li o seu PDF e encontrei três inconsistências.' }),
  }), options);
  assert.equal(result.ok, false);
  if (result.ok) return;
  if (result.code !== 'HARD_BLOCK') assert.fail(`expected HARD_BLOCK, got ${result.code}`);
  assert.equal(result.finding.code, 'ATTACHMENT_ACCESS_CLAIM');
});

test('defense-in-depth scans semantic text nested inside actions, not only top-level narration', () => {
  const base = proposal();
  const result = validateSellerSubmission(submission({
    proposal: proposal({
      intent: { ...base.intent, actions: [{ id: 'action-1', kind: 'focus', targetId: 'node-1', reason: 'Li o PDF enviado e confirmei o gargalo.' }] },
    }),
  }), options);
  assert.equal(result.ok, false);
  if (result.ok) return;
  if (result.code !== 'HARD_BLOCK') assert.fail(`expected HARD_BLOCK, got ${result.code}`);
  assert.equal(result.finding.code, 'ATTACHMENT_ACCESS_CLAIM');
});

test('truthful negations about unavailable authority are allowed rather than false-positive blocked', () => {
  const result = validateSellerSubmission(submission({
    proposal: proposal({ narration: 'Não li o PDF, não posso conceder desconto e o protótipo não está pronto para produção.' }),
  }), options);
  assert.equal(result.ok, true);
});

test('accounting guidance is policy/vocabulary, not a fixed question funnel or canned reply', () => {
  const guidance = buildAccountingSellerGuidance();
  const joined = guidance.join('\n').toLowerCase();
  assert.equal(joined.includes('fechamento'), true);
  assert.equal(joined.includes('reconcil'), true);
  assert.equal(joined.includes('capacidade'), true);
  for (const forbidden of ['pergunta 1', 'pergunta 2', 'etapa 1', 'etapa 2', 'sempre pergunte primeiro']) {
    assert.equal(joined.includes(forbidden), false, forbidden);
  }
});


test('defense-in-depth rejects material numeric persuasion hidden in proposal text when no canonical number supports it', () => {
  const result = validateSellerSubmission(submission({
    proposal: proposal({ narration: 'Isso reduz 30% do retrabalho por mês.' }),
  }), options);
  assert.equal(result.ok, false);
  if (result.ok) return;
  if (result.code !== 'HARD_BLOCK') assert.fail(`expected HARD_BLOCK, got ${result.code}`);
  assert.equal(result.finding.code, 'UNSUPPORTED_NUMERIC_CLAIM');
});

test('defense-in-depth permits material numbers already supported by canonical facts or application calculations', async (t) => {
  await t.test('verified calculation result', () => {
    const result = validateSellerSubmission(submission({
      proposal: proposal({ narration: 'A carga verificada é de 44 horas por mês.' }),
    }), options);
    assert.equal(result.ok, true);
  });

  await t.test('confirmed fact number', () => {
    const result = validateSellerSubmission(submission({
      proposal: proposal({ narration: 'O fechamento informado dura 5 dias.' }),
    }), options);
    assert.equal(result.ok, true);
  });
});
