import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCriticReview, bindRevisedProposal, createCriticCycleState, validateCriticReview } from '../../src/ai/critic/critic-contract.ts';

function review(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    proposalId: 'proposal-601',
    basedOnRevision: 20,
    verdict: 'PASS',
    findings: [],
    ...overrides,
  };
}

test('accepts PASS only when the review has no material findings', () => {
  const result = validateCriticReview(review(), { expectedProposalId: 'proposal-601', expectedRevision: 20 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.review.verdict, 'PASS');
});

test('rejects funnel/novelty enforcement as an unsupported Critic finding', () => {
  const result = validateCriticReview(review({
    verdict: 'REVISE',
    findings: [{ id: 'finding-1', code: 'FUNNEL_DEVIATION', severity: 'revise', summary: 'Pulou a pergunta esperada.', evidenceIds: [] }],
  }), { expectedProposalId: 'proposal-601', expectedRevision: 20 });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'UNSUPPORTED_FINDING');
});

test('derives verdict consistency from finding severity', () => {
  const inconsistent = validateCriticReview(review({
    verdict: 'PASS',
    findings: [{ id: 'finding-1', code: 'NUMERIC_INTEGRITY', severity: 'revise', summary: 'Cálculo precisa de revisão.', evidenceIds: ['calc-1'] }],
  }), { expectedProposalId: 'proposal-601', expectedRevision: 20 });
  assert.equal(inconsistent.ok, false);
  if (inconsistent.ok) return;
  assert.equal(inconsistent.code, 'INCONSISTENT_VERDICT');
});

test('allows exactly one REVISE cycle and rejects a second revise request', () => {
  const parsed = validateCriticReview(review({
    verdict: 'REVISE',
    findings: [{ id: 'finding-1', code: 'USER_INTENT_MISMATCH', severity: 'revise', summary: 'A proposta não responde ao pedido mais recente.', evidenceIds: ['turn-20'] }],
  }), { expectedProposalId: 'proposal-601', expectedRevision: 20 });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  const initial = createCriticCycleState({ proposalId: 'proposal-601', basedOnRevision: 20 });
  const first = applyCriticReview(initial, parsed.review, { currentProposalId: 'proposal-601', currentRevision: 20 });
  assert.equal(first.ok, true);
  if (!first.ok || first.action !== 'REVISE') return;
  assert.equal(first.state.reviseCount, 1);

  const replayBeforeRevision = applyCriticReview(first.state, parsed.review, { currentProposalId: 'proposal-601', currentRevision: 20 });
  assert.equal(replayBeforeRevision.ok, false);
  if (replayBeforeRevision.ok) return;
  assert.equal(replayBeforeRevision.code, 'REVISION_PENDING');

  const rebound = bindRevisedProposal(first.state, { proposalId: 'proposal-602', basedOnRevision: 20 });
  assert.equal(rebound.ok, true);
  if (!rebound.ok) return;

  const revised = validateCriticReview(review({
    proposalId: 'proposal-602',
    verdict: 'REVISE',
    findings: [{ id: 'finding-2', code: 'USER_INTENT_MISMATCH', severity: 'revise', summary: 'A revisão ainda não responde ao pedido mais recente.', evidenceIds: ['turn-20'] }],
  }), { expectedProposalId: 'proposal-602', expectedRevision: 20 });
  assert.equal(revised.ok, true);
  if (!revised.ok) return;

  const second = applyCriticReview(rebound.state, revised.review, { currentProposalId: 'proposal-602', currentRevision: 20 });
  assert.equal(second.ok, false);
  if (second.ok) return;
  assert.equal(second.code, 'REVISE_LIMIT_REACHED');
});

test('stale canonical revision can never yield COMMIT', () => {
  const parsed = validateCriticReview(review(), { expectedProposalId: 'proposal-601', expectedRevision: 20 });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const state = createCriticCycleState({ proposalId: 'proposal-601', basedOnRevision: 20 });
  const result = applyCriticReview(state, parsed.review, { currentProposalId: 'proposal-601', currentRevision: 21 });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'STALE_VERDICT');
});

test('a verdict for an older proposal id can never commit a revised proposal', () => {
  const parsed = validateCriticReview(review(), { expectedProposalId: 'proposal-601', expectedRevision: 20 });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const state = createCriticCycleState({ proposalId: 'proposal-601', basedOnRevision: 20 });
  const result = applyCriticReview(state, parsed.review, { currentProposalId: 'proposal-602', currentRevision: 20 });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'STALE_VERDICT');
});

test('BLOCK finding yields a non-committing BLOCK action', () => {
  const parsed = validateCriticReview(review({
    verdict: 'BLOCK',
    findings: [{ id: 'finding-1', code: 'EXECUTION_SAFETY', severity: 'block', summary: 'A ação ultrapassa a autoridade permitida.', evidenceIds: [] }],
  }), { expectedProposalId: 'proposal-601', expectedRevision: 20 });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const state = createCriticCycleState({ proposalId: 'proposal-601', basedOnRevision: 20 });
  const result = applyCriticReview(state, parsed.review, { currentProposalId: 'proposal-601', currentRevision: 20 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.action, 'BLOCK');
});
