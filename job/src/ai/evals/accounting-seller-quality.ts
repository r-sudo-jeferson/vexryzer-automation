import type { CanonicalSalesContext, CapabilityKind } from '../context/canonical-sales-context.ts';
import type { SellerSubmission } from '../seller/seller-contract.ts';

export type QuantitativeExpectation = 'none' | 'opportunity_or_calculation' | 'verified_calculation';

export interface AccountingSellerQualityScenario {
  id: string;
  accountingSignalGroups: readonly (readonly string[])[];
  expectedCapabilitiesAnyOf: readonly CapabilityKind[];
  forbiddenCapabilities?: readonly CapabilityKind[];
  quantitativeExpectation: QuantitativeExpectation;
  requireSemanticUi: boolean;
}

export interface AccountingSellerQualityChecks {
  accountingNative: boolean;
  capabilityFit: boolean;
  forbiddenCapabilityAbsent: boolean;
  quantitativeIntegrity: boolean;
  semanticUi: boolean;
}

export interface AccountingSellerQualityResult {
  scenarioId: string;
  pass: boolean;
  checks: Readonly<AccountingSellerQualityChecks>;
  strategySignature: string;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

function semanticText(submission: Readonly<SellerSubmission>): string {
  const proposal = submission.proposal;
  const parts = [
    proposal.narration,
    proposal.intent.objective,
    proposal.intent.rationale,
    proposal.intent.nextQuestion?.text ?? '',
    proposal.intent.nextQuestion?.objective ?? '',
    ...proposal.intent.quantitativeOpportunities.flatMap((item) => [
      item.objective,
      ...item.missingInputs,
    ]),
    ...proposal.intent.artifactIntents.flatMap((item) => [item.objective, item.desiredImpact]),
    ...proposal.processMutations.flatMap((item) => {
      if (item.kind === 'upsert_node') return [item.label, item.summary];
      if (item.kind === 'upsert_relationship') return [item.label];
      return [item.reason];
    }),
    ...proposal.artifactProposals.flatMap((item) => [item.title, item.summary]),
  ];
  return normalize(parts.join(' '));
}

function hasAccountingSignals(text: string, groups: readonly (readonly string[])[]): boolean {
  if (groups.length === 0) return true;
  return groups.some((group) => group.some((term) => text.includes(normalize(term))));
}

function hasSemanticUi(submission: Readonly<SellerSubmission>): boolean {
  const proposal = submission.proposal;
  return proposal.intent.actions.length > 0
    || proposal.processMutations.length > 0
    || proposal.sceneProposal !== null
    || proposal.artifactProposals.length > 0
    || proposal.intent.artifactIntents.length > 0;
}

function quantitativeIntegrity(
  expectation: QuantitativeExpectation,
  submission: Readonly<SellerSubmission>,
  canonical: CanonicalSalesContext,
): boolean {
  if (expectation === 'none') return true;
  const validCalculations = canonical.verifiedCalculations.filter((item) => item.status === 'valid');
  if (expectation === 'verified_calculation') return validCalculations.length > 0;
  return validCalculations.length > 0 || submission.proposal.intent.quantitativeOpportunities.length > 0;
}

export function strategySignature(submission: Readonly<SellerSubmission>): string {
  const proposal = submission.proposal;
  const capabilities = [...proposal.intent.capabilities].sort();
  const actions = [...new Set(proposal.intent.actions.map((item) => item.kind))].sort();
  const artifacts = [...new Set([
    ...proposal.intent.artifactIntents.map((item) => item.kind),
    ...proposal.artifactProposals.map((item) => item.kind),
  ])].sort();
  return JSON.stringify({
    capabilities,
    actions,
    artifacts,
    asksQuestion: proposal.intent.nextQuestion !== null,
    composition: proposal.sceneProposal?.composition ?? null,
  });
}

export function evaluateAccountingSellerQuality(input: {
  scenario: Readonly<AccountingSellerQualityScenario>;
  submission: Readonly<SellerSubmission>;
  canonical: CanonicalSalesContext;
}): AccountingSellerQualityResult {
  const text = semanticText(input.submission);
  const capabilities = new Set(input.submission.proposal.intent.capabilities);
  const checks: AccountingSellerQualityChecks = Object.freeze({
    accountingNative: hasAccountingSignals(text, input.scenario.accountingSignalGroups),
    capabilityFit: input.scenario.expectedCapabilitiesAnyOf.length === 0
      || input.scenario.expectedCapabilitiesAnyOf.some((capability) => capabilities.has(capability)),
    forbiddenCapabilityAbsent: (input.scenario.forbiddenCapabilities ?? []).every((capability) => !capabilities.has(capability)),
    quantitativeIntegrity: quantitativeIntegrity(input.scenario.quantitativeExpectation, input.submission, input.canonical),
    semanticUi: !input.scenario.requireSemanticUi || hasSemanticUi(input.submission),
  });
  return Object.freeze({
    scenarioId: input.scenario.id,
    pass: Object.values(checks).every(Boolean),
    checks,
    strategySignature: strategySignature(input.submission),
  });
}

export function evaluateStrategyDiversity(
  results: readonly Readonly<AccountingSellerQualityResult>[],
  minimumDistinctStrategies: number,
): { pass: boolean; distinctStrategies: number } {
  if (!Number.isInteger(minimumDistinctStrategies) || minimumDistinctStrategies < 1) {
    throw new TypeError('minimumDistinctStrategies must be a positive integer');
  }
  const distinctStrategies = new Set(
    results.filter((result) => result.pass).map((result) => result.strategySignature),
  ).size;
  return Object.freeze({
    pass: distinctStrategies >= minimumDistinctStrategies,
    distinctStrategies,
  });
}
