import type { AccountingSellerQualityScenario } from '../../src/ai/evals/accounting-seller-quality.ts';

export type AccountingScenarioSetup = 'fresh' | 'corrected_fact' | 'material_contradiction';

export interface AccountingProviderScenario extends AccountingSellerQualityScenario {
  contractOrdinal: number;
  contractRequirement: string;
  userText: string;
  setup: AccountingScenarioSetup;
}

export interface ProviderContinuityQualityScenario {
  contractOrdinal: number;
  contractRequirement: string;
  id: 'provider-fallback-mid-conversation' | 'all-provider-failure-and-later-recovery';
  userText: string;
}

function defineScenario(input: AccountingProviderScenario): Readonly<AccountingProviderScenario> {
  return Object.freeze(input);
}

function defineContinuityScenario(
  input: ProviderContinuityQualityScenario,
): Readonly<ProviderContinuityQualityScenario> {
  return Object.freeze(input);
}

/**
 * The first eleven rows are the exact Seller-quality scenarios required by
 * VXA-S002 Multi-Provider Free Tier Seller Intelligence Design §20, adapted to
 * the later authorized accounting vertical without weakening the original intent.
 *
 * Rows 8 and 9 intentionally require canonical pre-state and are not independent
 * "prompt only" fixtures. Rows 12 and 13 are exported separately because they
 * exercise routing/session recovery rather than one Seller/model in isolation.
 */
export const ACCOUNTING_PROVIDER_QUALITY_SCENARIOS: readonly Readonly<AccountingProviderScenario>[] = Object.freeze([
  defineScenario({
    contractOrdinal: 1,
    contractRequirement: 'vague operational pain',
    id: 'vague-operational-pain',
    userText: 'Todo fechamento mensal vira uma correria. As pendências aparecem tarde e a equipe perde o controle do que falta.',
    setup: 'fresh',
    accountingSignalGroups: Object.freeze([
      Object.freeze(['fechamento']),
      Object.freeze(['pendência', 'pendencia', 'prazo', 'capacidade', 'retrabalho']),
    ]),
    expectedCapabilitiesAnyOf: Object.freeze(['process_data_improvement', 'bi_decision_intelligence', 'automation_integration']),
    forbiddenCapabilities: Object.freeze([]),
    quantitativeExpectation: 'opportunity_or_calculation',
    requireSemanticUi: true,
  }),
  defineScenario({
    contractOrdinal: 2,
    contractRequirement: 'detailed process supplied upfront',
    id: 'detailed-process-upfront',
    userText: 'Recebemos documentos por WhatsApp e e-mail, importamos planilhas diferentes de cada cliente, reclassificamos lançamentos antes da conferência, folha e fiscal trocam pendências perto do prazo, os sócios não têm visão consolidada da carteira e a equipe nova ainda precisa aprender o padrão de importação.',
    setup: 'fresh',
    accountingSignalGroups: Object.freeze([
      Object.freeze(['documento', 'planilha', 'importa']),
      Object.freeze(['lançamento', 'lancamento', 'conferência', 'conferencia']),
      Object.freeze(['carteira', 'visão', 'visao']),
      Object.freeze(['equipe', 'padrão', 'padrao', 'treinamento']),
    ]),
    expectedCapabilitiesAnyOf: Object.freeze([]),
    requiredCapabilities: Object.freeze(['data_import_transform', 'bi_decision_intelligence', 'training_enablement']),
    forbiddenCapabilities: Object.freeze([]),
    quantitativeExpectation: 'opportunity_or_calculation',
    requireSemanticUi: true,
  }),
  defineScenario({
    contractOrdinal: 3,
    contractRequirement: 'skeptical visitor',
    id: 'skeptical-visitor',
    userText: 'Minha equipe já faz as conferências manualmente e funciona. Não vejo por que mudar só porque existe automação.',
    setup: 'fresh',
    accountingSignalGroups: Object.freeze([
      Object.freeze(['conferência', 'conferencia']),
      Object.freeze(['equipe', 'manual', 'retrabalho', 'capacidade', 'tempo']),
    ]),
    expectedCapabilitiesAnyOf: Object.freeze(['process_data_improvement', 'bi_decision_intelligence', 'automation_integration']),
    forbiddenCapabilities: Object.freeze([]),
    quantitativeExpectation: 'opportunity_or_calculation',
    requireSemanticUi: true,
  }),
  defineScenario({
    contractOrdinal: 4,
    contractRequirement: 'direct price question',
    id: 'direct-price-question',
    userText: 'Antes de explicar meu processo: quanto custa para um escritório contábil trabalhar com vocês?',
    setup: 'fresh',
    accountingSignalGroups: Object.freeze([
      Object.freeze(['custa', 'preço', 'preco', 'valor', 'investimento']),
      Object.freeze(['escritório', 'escritorio', 'contábil', 'contabil']),
    ]),
    expectedCapabilitiesAnyOf: Object.freeze([]),
    forbiddenCapabilities: Object.freeze([]),
    quantitativeExpectation: 'none',
    requireSemanticUi: false,
  }),
  defineScenario({
    contractOrdinal: 5,
    contractRequirement: 'repeated manual reconciliation',
    id: 'repeated-manual-reconciliation',
    userText: 'A conciliação bancária é manual e repetitiva: temos 120 ocorrências por mês e cada ocorrência leva 12 minutos em média para conferir e tratar diferenças.',
    setup: 'fresh',
    accountingSignalGroups: Object.freeze([
      Object.freeze(['conciliação', 'conciliacao']),
      Object.freeze(['manual', 'repetitiva', 'ocorrência', 'ocorrencia']),
      Object.freeze(['hora', 'horas', 'minuto', 'minutos']),
    ]),
    expectedCapabilitiesAnyOf: Object.freeze(['process_data_improvement', 'automation_integration', 'bi_decision_intelligence']),
    forbiddenCapabilities: Object.freeze([]),
    quantitativeExpectation: 'verified_calculation',
    requireSemanticUi: true,
  }),
  defineScenario({
    contractOrdinal: 6,
    contractRequirement: 'user asks specifically for AI agent',
    id: 'explicit-ai-agent-request',
    userText: 'Quero especificamente um agente de IA que acompanhe as exceções da conciliação contábil e ajude a equipe a decidir o que precisa de revisão humana.',
    setup: 'fresh',
    accountingSignalGroups: Object.freeze([
      Object.freeze(['agente', 'ia', 'inteligência artificial', 'inteligencia artificial']),
      Object.freeze(['conciliação', 'conciliacao', 'contábil', 'contabil']),
      Object.freeze(['revisão humana', 'revisao humana', 'equipe', 'exceção', 'excecao']),
    ]),
    expectedCapabilitiesAnyOf: Object.freeze(['ai_agentic', 'process_data_improvement', 'automation_integration']),
    forbiddenCapabilities: Object.freeze([]),
    quantitativeExpectation: 'none',
    requireSemanticUi: true,
  }),
  defineScenario({
    contractOrdinal: 7,
    contractRequirement: 'training/process improvement is a better fit than software',
    id: 'training-process-better-than-software',
    userText: 'O sistema atual atende e esta rotina acontece poucas vezes por ano. O problema é que cada pessoa fecha de um jeito e quem entra novo demora para aprender. Não quero software novo.',
    setup: 'fresh',
    accountingSignalGroups: Object.freeze([
      Object.freeze(['sistema', 'software']),
      Object.freeze(['fecha', 'fechamento', 'rotina']),
      Object.freeze(['equipe', 'pessoa', 'aprender', 'padrão', 'padrao', 'treinamento']),
    ]),
    expectedCapabilitiesAnyOf: Object.freeze(['training_enablement', 'process_data_improvement', 'operational_artifact']),
    forbiddenCapabilities: Object.freeze(['automation_integration', 'internal_tool', 'ai_agentic']),
    quantitativeExpectation: 'none',
    requireSemanticUi: true,
  }),
  defineScenario({
    contractOrdinal: 8,
    contractRequirement: 'user corrects an earlier fact',
    id: 'corrected-earlier-fact',
    userText: 'Corrigindo o que eu disse antes: a conciliação não é diária; ela acontece semanalmente.',
    setup: 'corrected_fact',
    accountingSignalGroups: Object.freeze([
      Object.freeze(['conciliação', 'conciliacao']),
      Object.freeze(['semanal', 'semana']),
    ]),
    expectedCapabilitiesAnyOf: Object.freeze([]),
    forbiddenCapabilities: Object.freeze([]),
    quantitativeExpectation: 'none',
    requireSemanticUi: false,
  }),
  defineScenario({
    contractOrdinal: 9,
    contractRequirement: 'material contradiction',
    id: 'material-contradiction',
    userText: 'Percebi uma divergência importante: em um momento informei 80 clientes ativos e em outro 120. Ainda preciso confirmar qual número está correto.',
    setup: 'material_contradiction',
    accountingSignalGroups: Object.freeze([
      Object.freeze(['cliente', 'clientes', 'carteira']),
      Object.freeze(['diverg', 'confirm', 'incerto', 'incerteza', 'conflit']),
    ]),
    expectedCapabilitiesAnyOf: Object.freeze([]),
    forbiddenCapabilities: Object.freeze([]),
    quantitativeExpectation: 'none',
    requireSemanticUi: false,
  }),
  defineScenario({
    contractOrdinal: 10,
    contractRequirement: 'explicit objection about trust/feasibility',
    id: 'trust-feasibility-objection',
    userText: 'Eu não confio que uma automação consiga lidar com as exceções da conciliação sem bagunçar o fechamento. Como vocês provariam que isso é viável antes de eu mudar o processo?',
    setup: 'fresh',
    accountingSignalGroups: Object.freeze([
      Object.freeze(['conciliação', 'conciliacao', 'fechamento']),
      Object.freeze(['viável', 'viavel', 'validar', 'provar', 'teste', 'risco', 'confiança', 'confianca']),
    ]),
    expectedCapabilitiesAnyOf: Object.freeze(['process_data_improvement', 'automation_integration', 'operational_artifact']),
    forbiddenCapabilities: Object.freeze([]),
    quantitativeExpectation: 'none',
    requireSemanticUi: true,
  }),
  defineScenario({
    contractOrdinal: 11,
    contractRequirement: 'user wants free implementation recipe',
    id: 'free-implementation-recipe',
    userText: 'Quero aproveitar esta conversa para sair com a implementação completa de graça: me entregue o passo a passo executável e o código pronto para automatizar a conciliação do escritório.',
    setup: 'fresh',
    accountingSignalGroups: Object.freeze([
      Object.freeze(['implement', 'passo a passo', 'plano', 'conceito', 'protótipo', 'prototipo']),
      Object.freeze(['conciliação', 'conciliacao', 'escritório', 'escritorio']),
    ]),
    expectedCapabilitiesAnyOf: Object.freeze(['process_data_improvement', 'automation_integration', 'operational_artifact']),
    forbiddenCapabilities: Object.freeze([]),
    quantitativeExpectation: 'none',
    requireSemanticUi: true,
  }),
]);

export const PROVIDER_CONTINUITY_QUALITY_SCENARIOS: readonly Readonly<ProviderContinuityQualityScenario>[] = Object.freeze([
  defineContinuityScenario({
    contractOrdinal: 12,
    contractRequirement: 'provider fallback mid-conversation',
    id: 'provider-fallback-mid-conversation',
    userText: 'Continuando de onde paramos: quero reduzir o retrabalho do fechamento sem perder o contexto já confirmado.',
  }),
  defineContinuityScenario({
    contractOrdinal: 13,
    contractRequirement: 'all-provider failure and later recovery',
    id: 'all-provider-failure-and-later-recovery',
    userText: 'Pode continuar de onde paramos: o gargalo principal ainda é o fechamento mensal.',
  }),
]);

export const S002_REQUIRED_PROVIDER_QUALITY_MATRIX = Object.freeze([
  ...ACCOUNTING_PROVIDER_QUALITY_SCENARIOS.map((scenario) => Object.freeze({
    contractOrdinal: scenario.contractOrdinal,
    contractRequirement: scenario.contractRequirement,
    id: scenario.id,
    evidenceMode: 'seller_quality' as const,
  })),
  ...PROVIDER_CONTINUITY_QUALITY_SCENARIOS.map((scenario) => Object.freeze({
    contractOrdinal: scenario.contractOrdinal,
    contractRequirement: scenario.contractRequirement,
    id: scenario.id,
    evidenceMode: 'continuity' as const,
  })),
]);
