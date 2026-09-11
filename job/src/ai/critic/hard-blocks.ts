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
  'FREE_IMPLEMENTATION_SUBSTITUTION',
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
const COMPLETE_IMPLEMENTATION_OFFER = /\b(?:aqui\s+est[aá]|segue|entrego|here\s+(?:is|are)|below\s+is).{0,100}\b(?:implementa[cç][aã]o\s+completa|passo\s+a\s+passo\s+completo|complete\s+implementation|complete\s+step[-\s]?by[-\s]?step)\b/i;
const PRODUCTION_READY_CODE_OFFER = /\b(?:aqui\s+est[aá]|segue|entrego|here\s+(?:is|are)|below\s+is).{0,100}\b(?:c[oó]digo|code)\b.{0,80}\b(?:pront[oa]\s+para\s+produ[cç][aã]o|production[-\s]?ready|ready\s+(?:for\s+production|to\s+deploy))\b/i;
const IMPLEMENTATION_STEP = /\b(?:replique|configure|implemente|publique|implante|execute|instale|clone|implement|deploy|publish|run|install)\b/giu;
const PRODUCTION_DELIVERY = /\b(?:produ[cç][aã]o|production|deploy|publique|publish)\b/i;
type MaterialNumberKind =
  | 'currency'
  | 'percent'
  | 'hour'
  | 'minute'
  | 'day'
  | 'week'
  | 'month'
  | 'client'
  | 'person'
  | 'document'
  | 'entry'
  | 'occurrence';

interface MaterialNumber {
  value: number;
  kind: MaterialNumberKind;
}

const MATERIAL_NUMBER_PATTERN = /(R\$\s*)?([-+]?\d[\d.,]*)(?:\s*(%|horas?|hours?|h|minutos?|minutes?|min|dias?|days?|semanas?|weeks?|m[eê]s(?:es)?|months?|clientes?|clients?|pessoas?|people|documentos?|documents?|lan[cç]amentos?|entries|ocorr[eê]ncias?|occurrences?))?/giu;

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

function normalizeToken(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR');
}

function parseLocalizedNumber(raw: string): number | null {
  const token = raw.replace(/[.,]+$/, '');
  if (!token) return null;
  const sign = token.startsWith('-') ? -1 : 1;
  const unsigned = token.replace(/^[-+]/, '');
  if (!unsigned) return null;

  let normalized = unsigned;
  const comma = unsigned.lastIndexOf(',');
  const dot = unsigned.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? ',' : '.';
    const thousands = decimal === ',' ? /\./g : /,/g;
    normalized = unsigned.replace(thousands, '').replace(decimal, '.');
  } else if (comma >= 0) {
    normalized = unsigned.replace(/\./g, '').replace(',', '.');
  } else if (dot >= 0) {
    const groups = unsigned.split('.');
    normalized = groups.length > 1 && groups.slice(1).every((group) => group.length === 3)
      ? groups.join('')
      : unsigned;
  }

  const parsed = Number(normalized) * sign;
  return Number.isFinite(parsed) ? parsed : null;
}

function materialKind(currencyPrefix: string | undefined, rawUnit: string | undefined): MaterialNumberKind | null {
  if (currencyPrefix !== undefined) return 'currency';
  if (rawUnit === undefined) return null;
  const unit = normalizeToken(rawUnit);
  if (unit === '%') return 'percent';
  if (unit === 'h' || unit.startsWith('hora') || unit.startsWith('hour')) return 'hour';
  if (unit === 'min' || unit.startsWith('minuto') || unit.startsWith('minute')) return 'minute';
  if (unit.startsWith('dia') || unit.startsWith('day')) return 'day';
  if (unit.startsWith('semana') || unit.startsWith('week')) return 'week';
  if (unit.startsWith('mes') || unit.startsWith('month')) return 'month';
  if (unit.startsWith('cliente') || unit.startsWith('client')) return 'client';
  if (unit.startsWith('pessoa') || unit.startsWith('people')) return 'person';
  if (unit.startsWith('documento') || unit.startsWith('document')) return 'document';
  if (unit.startsWith('lancamento') || unit.startsWith('entr')) return 'entry';
  if (unit.startsWith('ocorrencia') || unit.startsWith('occurrence')) return 'occurrence';
  return null;
}

function materialNumbersFromText(text: string): readonly Readonly<MaterialNumber>[] {
  const values: MaterialNumber[] = [];
  const matcher = new RegExp(MATERIAL_NUMBER_PATTERN.source, MATERIAL_NUMBER_PATTERN.flags);
  for (let match = matcher.exec(text); match !== null; match = matcher.exec(text)) {
    const kind = materialKind(match[1], match[3]);
    const raw = match[2];
    if (kind === null || raw === undefined) continue;
    const value = parseLocalizedNumber(raw);
    if (value !== null) values.push(Object.freeze({ value, kind }));
    if (match[0].length === 0) matcher.lastIndex += 1;
  }
  return Object.freeze(values);
}

function calculationResultKind(resultUnit: string): MaterialNumberKind | null {
  const unit = normalizeToken(resultUnit);
  if (unit.includes('currency') || unit.includes('brl') || unit.includes('real')) return 'currency';
  if (unit.includes('percent') || unit.includes('%')) return 'percent';
  if (unit.includes('hour') || unit.includes('hora')) return 'hour';
  if (unit.includes('minute') || unit.includes('minuto')) return 'minute';
  if (unit.includes('day') || unit.includes('dia')) return 'day';
  if (unit.includes('week') || unit.includes('semana')) return 'week';
  if (unit.includes('month') || unit.includes('mes')) return 'month';
  if (unit.includes('client') || unit.includes('cliente')) return 'client';
  if (unit.includes('person') || unit.includes('pessoa')) return 'person';
  if (unit.includes('document')) return 'document';
  if (unit.includes('entry') || unit.includes('lancamento')) return 'entry';
  if (unit.includes('occurrence') || unit.includes('ocorrencia')) return 'occurrence';
  return null;
}

function observationKind(unit: CanonicalSalesContext['quantitativeObservations'][number]['unit']): MaterialNumberKind | null {
  switch (unit) {
    case 'currency':
    case 'percent':
    case 'hour':
    case 'minute':
    case 'day':
    case 'client':
    case 'person':
    case 'document':
    case 'entry':
    case 'occurrence':
      return unit;
    case 'other':
      return null;
  }
}

function supportedCanonicalNumbers(context: CanonicalSalesContext): readonly Readonly<MaterialNumber>[] {
  const values: MaterialNumber[] = [];
  for (const fact of context.facts) {
    if (fact.status !== 'confirmed' || typeof fact.value !== 'string') continue;
    values.push(...materialNumbersFromText(fact.value));
  }
  for (const observation of context.quantitativeObservations) {
    if (observation.status !== 'confirmed') continue;
    const kind = observationKind(observation.unit);
    if (kind !== null && Number.isFinite(observation.value)) {
      values.push(Object.freeze({ value: observation.value, kind }));
    }
  }
  for (const calculation of context.verifiedCalculations) {
    if (calculation.status !== 'valid' || !Number.isFinite(calculation.resultValue)) continue;
    const kind = calculationResultKind(calculation.resultUnit);
    if (kind !== null) values.push(Object.freeze({ value: calculation.resultValue, kind }));
  }
  return Object.freeze(values);
}

function hasUnsupportedMaterialNumber(
  text: string,
  supported: readonly Readonly<MaterialNumber>[],
): boolean {
  return materialNumbersFromText(text).some((claim) => !supported.some(
    (candidate) => candidate.kind === claim.kind && Math.abs(candidate.value - claim.value) <= 1e-9,
  ));
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

function offersCompleteExecutableSubstitution(text: string): boolean {
  if (hasUnnegatedAssertion(text, PRODUCTION_READY_CODE_OFFER)) return true;
  if (!hasUnnegatedAssertion(text, COMPLETE_IMPLEMENTATION_OFFER) || !PRODUCTION_DELIVERY.test(text)) return false;
  const steps = new Set(Array.from(text.matchAll(IMPLEMENTATION_STEP), (match) => normalizeToken(match[0])));
  return steps.size >= 2;
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
    const correctionSuggestion = item.path.startsWith('proposal.correctionProposals[');
    if (!correctionSuggestion && hasUnsupportedMaterialNumber(item.text, supportedNumbers)) findings.push(finding('UNSUPPORTED_NUMERIC_CLAIM', item.path, 'Proposal text contains a material numeric value/unit pair that is not present in confirmed canonical evidence or a valid application calculation.'));
    if (hasUnnegatedAssertion(item.text, ATTACHMENT_ASSERTION)) findings.push(finding('ATTACHMENT_ACCESS_CLAIM', item.path, 'Proposal text claims attachment-content access that S002 forbids.'));
    if (hasUnnegatedAssertion(item.text, PRICE_ASSERTION)) findings.push(finding('AUTHORITATIVE_PRICE_OR_DISCOUNT', item.path, 'Proposal text asserts Vexryzer price or discount authority unavailable in S002.'));
    if (hasUnnegatedAssertion(item.text, FEASIBILITY_ASSERTION)) findings.push(finding('UNSUPPORTED_FEASIBILITY', item.path, 'Proposal text asserts unsupported technical feasibility.'));
    if (hasUnnegatedAssertion(item.text, SECRET_ASSERTION) || hasUnnegatedAssertion(item.text, TOOL_ESCALATION_ASSERTION)) findings.push(finding('SECRET_OR_TOOL_ESCALATION', item.path, 'Proposal text asserts prohibited secret or tool authority.'));
    if (offersCompleteExecutableSubstitution(item.text)) findings.push(finding('FREE_IMPLEMENTATION_SUBSTITUTION', item.path, 'Proposal text delivers a complete executable production implementation that substitutes for the paid engagement.'));
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
