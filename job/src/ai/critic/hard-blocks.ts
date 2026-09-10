import type { CanonicalSalesContext } from '../context/canonical-sales-context.ts';
import { validateQuantitativeClaim } from '../quant/calculation-validation.ts';
import type { ExperienceProposal } from '../../experience/experience-proposal.ts';
import type { SellerMaterialClaim } from '../seller/seller-contract.ts';

export const HARD_BLOCK_CODES = [
  'UNSUPPORTED_NUMERIC_CLAIM',
  'FORGED_CONFIRMATION',
  'AUTHORITATIVE_PRICE_OR_DISCOUNT',
  'UNSUPPORTED_FEASIBILITY',
  'ATTACHMENT_ACCESS_CLAIM',
  'SECRET_OR_TOOL_ESCALATION',
  'PRODUCTION_PROTOTYPE_CONFUSION',
] as const;
export type HardBlockCode = (typeof HARD_BLOCK_CODES)[number];

export interface HardBlockFinding {
  code: HardBlockCode;
  path: string;
  summary: string;
}

export interface HardBlockInput {
  proposal: Readonly<ExperienceProposal>;
  materialClaims: readonly Readonly<SellerMaterialClaim>[];
  canonical: CanonicalSalesContext;
}

const ATTACHMENT_ASSERTION = /\b(?:li|analisei|processei|extra[ií]|revisei|read|analy[sz]ed|processed|extracted)\b.{0,60}\b(?:anexo|arquivo|pdf|documento|attachment|file|document)\b/i;
const PRICE_ASSERTION = /\b(?:nosso\s+pre[cç]o|pre[cç]o\s+da\s+vexryzer|a\s+vexryzer\s+custa|cobramos|posso\s+conceder|concedo)\b/i;
const FEASIBILITY_ASSERTION = /\b(?:100%\s*(?:vi[aá]vel|fact[ií]vel)|garanto\s+que\s+(?:funciona|[ée]\s+vi[aá]vel)|tecnicamente\s+(?:vi[aá]vel|fact[ií]vel)\s+sem\s+(?:validar|verificar))\b/i;
const SECRET_ASSERTION = /\b(?:usei|acessei|li|obtive|used|accessed|read|obtained)\b.{0,50}\b(?:api\s*key|chave\s+de\s+api|segredo|secret|access\s+token)\b/i;
const TOOL_ESCALATION_ASSERTION = /\b(?:executei|rodei|chamei|executed|ran|called)\b.{0,50}\b(?:ferramenta|tool|comando|command|shell)\b.{0,50}\b(?:n[aã]o\s+autorizad|sem\s+autoriza|unauthori[sz]ed)\b/i;
const PRODUCTION_ASSERTION = /\b(?:pronto|aprovado|seguro|ready|approved|safe)\s+(?:para|for)\s+produ[cç][aã]o\b/i;
const MATERIAL_NUMBER_PATTERN = /(?:R\$\s*)?(-?\d+(?:[.,]\d+)?)\s*(?:%|(?:horas?|hours?|h|minutos?|minutes?|min|dias?|days?|semanas?|weeks?|mes(?:es)?|months?|clientes?|clients?|pessoas?|people|documentos?|documents?|lan[cç]amentos?|entries|ocorr[eê]ncias?|occurrences?)\b)/giu;

function finding(code: HardBlockCode, path: string, summary: string): HardBlockFinding {
  return Object.freeze({ code, path, summary });
}

function collectText(value: unknown, path = 'proposal', output: { path: string; text: string }[] = []): readonly { path: string; text: string }[] {
  if (typeof value === 'string') {
    output.push({ path, text: value });
    return output;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) collectText(value[i], `${path}[${i}]`, output);
    return output;
  }
  if (typeof value === 'object' && value !== null) {
    for (const [key, nested] of Object.entries(value)) collectText(nested, `${path}.${key}`, output);
  }
  return output;
}

const NEGATION_NEAR_ASSERTION = /\b(?:não|nao|not|never|cannot|can't|did\s+not|didn't)\b(?:\s+[\p{L}\p{N}_-]+){0,3}\s*$/iu;

function numericValuesFromText(text: string): readonly number[] {
  const values: number[] = [];
  const matcher = new RegExp(MATERIAL_NUMBER_PATTERN.source, MATERIAL_NUMBER_PATTERN.flags);
  for (let match = matcher.exec(text); match !== null; match = matcher.exec(text)) {
    const raw = match[1];
    if (raw === undefined) continue;
    const parsed = Number(raw.replace(',', '.'));
    if (Number.isFinite(parsed)) values.push(parsed);
    if (match[0].length === 0) matcher.lastIndex += 1;
  }
  return Object.freeze(values);
}

function supportedCanonicalNumbers(context: CanonicalSalesContext): readonly number[] {
  const values: number[] = [];
  for (const fact of context.facts) {
    if (fact.status !== 'confirmed') continue;
    if (typeof fact.value === 'number' && Number.isFinite(fact.value)) values.push(fact.value);
    else if (typeof fact.value === 'string') values.push(...numericValuesFromText(fact.value));
  }
  for (const observation of context.quantitativeObservations) {
    if (observation.status !== 'superseded' && Number.isFinite(observation.value)) values.push(observation.value);
  }
  for (const calculation of context.verifiedCalculations) {
    if (calculation.status === 'valid' && Number.isFinite(calculation.resultValue)) values.push(calculation.resultValue);
  }
  return Object.freeze(values);
}

function hasUnsupportedMaterialNumber(text: string, supported: readonly number[]): boolean {
  return numericValuesFromText(text).some((value) => !supported.some((candidate) => Math.abs(candidate - value) <= 1e-9));
}

function hasUnnegatedAssertion(text: string, pattern: RegExp): boolean {
  const flags = `${pattern.flags.replaceAll('g', '')}g`;
  const matcher = new RegExp(pattern.source, flags);
  for (let match = matcher.exec(text); match !== null; match = matcher.exec(text)) {
    const prefix = text.slice(Math.max(0, match.index - 48), match.index);
    const clause = prefix.slice(Math.max(prefix.lastIndexOf('.'), prefix.lastIndexOf('!'), prefix.lastIndexOf('?'), prefix.lastIndexOf(';')) + 1);
    if (!NEGATION_NEAR_ASSERTION.test(clause)) return true;
    if (match[0].length === 0) matcher.lastIndex += 1;
  }
  return false;
}

export function evaluateHardBlocks(input: HardBlockInput): readonly HardBlockFinding[] {
  const findings: HardBlockFinding[] = [];
  for (let i = 0; i < input.proposal.factProposals.length; i += 1) {
    const fact = input.proposal.factProposals[i];
    if (fact === undefined) continue;
    if (fact.source !== 'inference') {
      findings.push(finding('FORGED_CONFIRMATION', `proposal.factProposals[${i}].source`, 'Seller/model output cannot mint user or system provenance; authoritative evidence enters through the deterministic context mutation boundary.'));
    }
  }

  for (let i = 0; i < input.materialClaims.length; i += 1) {
    const claim = input.materialClaims[i];
    if (claim === undefined) continue;
    const path = `materialClaims[${i}]`;
    switch (claim.kind) {
      case 'verified_numeric': {
        const validation = validateQuantitativeClaim(input.canonical, { kind: 'verified_result', calculationId: claim.calculationId });
        if (!validation.ok) findings.push(finding('UNSUPPORTED_NUMERIC_CLAIM', path, 'Numeric claim is not backed by a valid application calculation.'));
        break;
      }
      case 'qualitative':
        break;
      case 'feasibility':
        if (claim.state === 'confirmed') findings.push(finding('UNSUPPORTED_FEASIBILITY', path, 'Technical feasibility cannot be confirmed by Seller without separate application evidence.'));
        break;
      case 'price':
      case 'discount':
        findings.push(finding('AUTHORITATIVE_PRICE_OR_DISCOUNT', path, 'S002 Seller has no authoritative price or discount power.'));
        break;
      case 'attachment_access':
        findings.push(finding('ATTACHMENT_ACCESS_CLAIM', path, 'Customer attachment contents are outside the S002 model boundary.'));
        break;
      case 'secret_access':
      case 'tool_escalation':
        findings.push(finding('SECRET_OR_TOOL_ESCALATION', path, 'Seller cannot claim secret access or unauthorized tool authority.'));
        break;
      case 'artifact_readiness':
        if (claim.readiness === 'production') findings.push(finding('PRODUCTION_PROTOTYPE_CONFUSION', path, 'S002 conceptual/prototype artifacts cannot be represented as production-ready.'));
        break;
    }
  }

  const supportedNumbers = supportedCanonicalNumbers(input.canonical);
  for (const item of collectText(input.proposal)) {
    if (hasUnsupportedMaterialNumber(item.text, supportedNumbers)) findings.push(finding('UNSUPPORTED_NUMERIC_CLAIM', item.path, 'Proposal text contains a material numeric value that is not present in canonical evidence or a valid application calculation.'));
    if (hasUnnegatedAssertion(item.text, ATTACHMENT_ASSERTION)) findings.push(finding('ATTACHMENT_ACCESS_CLAIM', item.path, 'Proposal text claims attachment-content access that S002 forbids.'));
    if (hasUnnegatedAssertion(item.text, PRICE_ASSERTION)) findings.push(finding('AUTHORITATIVE_PRICE_OR_DISCOUNT', item.path, 'Proposal text asserts Vexryzer price or discount authority unavailable in S002.'));
    if (hasUnnegatedAssertion(item.text, FEASIBILITY_ASSERTION)) findings.push(finding('UNSUPPORTED_FEASIBILITY', item.path, 'Proposal text asserts unsupported technical feasibility.'));
    if (hasUnnegatedAssertion(item.text, SECRET_ASSERTION) || hasUnnegatedAssertion(item.text, TOOL_ESCALATION_ASSERTION)) findings.push(finding('SECRET_OR_TOOL_ESCALATION', item.path, 'Proposal text asserts prohibited secret or tool authority.'));
    if (hasUnnegatedAssertion(item.text, PRODUCTION_ASSERTION)) findings.push(finding('PRODUCTION_PROTOTYPE_CONFUSION', item.path, 'Proposal text confuses conceptual/prototype material with production readiness.'));
  }

  const seen = new Set<string>();
  return Object.freeze(findings.filter((item) => {
    const key = `${item.code}:${item.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }));
}
