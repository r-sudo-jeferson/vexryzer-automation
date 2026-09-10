import test from 'node:test';
import assert from 'node:assert/strict';
import { CRITIC_FINDING_CODES } from '../../src/ai/critic/critic-contract.ts';
import { CRITIC_LOCAL_TOOLS, parseCriticReviewToolCall } from '../../src/server/ai/critic/critic-wire-tools.ts';

function call(review: unknown, extra: Record<string, unknown> = {}) {
  return { id: 'tool-review', type: 'function' as const, function: { name: 'submit_critic_review', arguments: JSON.stringify({ review, ...extra }) } };
}
function review(overrides: Record<string, unknown> = {}) {
  return { schemaVersion: 1, proposalId: 'proposal-1', basedOnRevision: 7, verdict: 'PASS', findings: [], ...overrides };
}

test('exports one closed Critic tool whose finding vocabulary comes from the Critic contract', () => {
  assert.equal(CRITIC_LOCAL_TOOLS.length, 1);
  const tool = CRITIC_LOCAL_TOOLS[0]!;
  assert.equal(tool.function.name, 'submit_critic_review');
  assert.equal(tool.function.parameters['additionalProperties'], false);
  const serialized = JSON.stringify(tool.function.parameters);
  for (const code of CRITIC_FINDING_CODES) assert.equal(serialized.includes(code), true, code);
  assert.equal(serialized.includes('FUNNEL_DEVIATION'), false);
});

test('parses PASS and returns the validated CriticReview bound to exact proposal and revision', () => {
  const result = parseCriticReviewToolCall(call(review()), 'proposal-1', 7);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.review.proposalId, 'proposal-1');
  assert.equal(result.review.basedOnRevision, 7);
  assert.equal(result.review.verdict, 'PASS');
});

test('accepts contract-consistent REVISE and BLOCK findings without introducing sales-funnel doctrine', async (t) => {
  for (const [verdict, severity] of [['REVISE', 'revise'], ['BLOCK', 'block']] as const) {
    await t.test(verdict, () => {
      const result = parseCriticReviewToolCall(call(review({
        verdict,
        findings: [{ id: `finding-${severity}`, code: 'NUMERIC_INTEGRITY', severity, summary: 'Material claim requires evidence.', evidenceIds: ['calc-1'] }],
      })), 'proposal-1', 7);
      assert.equal(result.ok, true);
      if (result.ok) assert.equal(result.review.verdict, verdict);
    });
  }
});

test('rejects stale proposal or revision as STALE_REVIEW', async (t) => {
  for (const candidate of [review({ proposalId: 'proposal-old' }), review({ basedOnRevision: 6 })]) {
    await t.test(JSON.stringify(candidate), () => {
      const result = parseCriticReviewToolCall(call(candidate), 'proposal-1', 7);
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.code, 'STALE_REVIEW');
    });
  }
});

test('rejects unknown findings and inconsistent verdict through the canonical Critic validator', async (t) => {
  const cases = [
    review({ verdict: 'REVISE', findings: [{ id: 'finding-1', code: 'FUNNEL_DEVIATION', severity: 'revise', summary: 'Unexpected strategy.', evidenceIds: [] }] }),
    review({ verdict: 'PASS', findings: [{ id: 'finding-1', code: 'NUMERIC_INTEGRITY', severity: 'revise', summary: 'Needs evidence.', evidenceIds: [] }] }),
  ];
  for (const candidate of cases) await t.test(JSON.stringify(candidate), () => {
    const result = parseCriticReviewToolCall(call(candidate), 'proposal-1', 7);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'INVALID_REVIEW');
  });
});

test('rejects unknown tool, wrapper extras, invalid expected binding and oversized arguments fail-closed', async (t) => {
  const unknown = { ...call(review()), function: { ...call(review()).function, name: 'other_tool' } };
  const cases: Array<[string, () => ReturnType<typeof parseCriticReviewToolCall>]> = [
    ['unknown tool', () => parseCriticReviewToolCall(unknown, 'proposal-1', 7)],
    ['wrapper extra', () => parseCriticReviewToolCall(call(review(), { extra: true }), 'proposal-1', 7)],
    ['bad expected id', () => parseCriticReviewToolCall(call(review()), '../proposal', 7)],
    ['bad expected revision', () => parseCriticReviewToolCall(call(review()), 'proposal-1', -1)],
    ['oversized', () => parseCriticReviewToolCall({ ...call(review()), function: { name: 'submit_critic_review', arguments: JSON.stringify({ review: review(), pad: 'x'.repeat(300_000) }) } }, 'proposal-1', 7)],
  ];
  for (const [name, run] of cases) await t.test(name, () => assert.equal(run().ok, false));
});
