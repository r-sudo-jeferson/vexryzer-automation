import type { AccountingSellerQualityScenario } from '../../src/ai/evals/accounting-seller-quality.ts';

export interface AccountingProviderScenario extends AccountingSellerQualityScenario {
  userText: string;
}

export const ACCOUNTING_PROVIDER_QUALITY_SCENARIOS: readonly Readonly<AccountingProviderScenario>[] = Object.freeze([
  Object.freeze({
    id: 'closing-pressure',
    userText: 'Todo fechamento mensal vira uma correria. As pendências aparecem tarde e a equipe perde o controle do que falta.',
    accountingSignalGroups: Object.freeze([
      Object.freeze(['fechamento']),
      Object.freeze(['pendência', 'pendencia', 'prazo', 'capacidade', 'retrabalho']),
    ]),
    expectedCapabilitiesAnyOf: Object.freeze(['process_data_improvement', 'bi_decision_intelligence', 'automation_integration']),
    forbiddenCapabilities: Object.freeze([]),
    quantitativeExpectation: 'opportunity_or_calculation',
    requireSemanticUi: true,
  }),
  Object.freeze({
    id: 'reconciliation-quantified',
    userText: 'Na reconciliação temos 120 ocorrências por mês e cada ocorrência toma 12 minutos em média.',
    accountingSignalGroups: Object.freeze([
      Object.freeze(['reconciliação', 'reconciliacao']),
      Object.freeze(['ocorrência', 'ocorrencia', 'horas', 'minutos']),
    ]),
    expectedCapabilitiesAnyOf: Object.freeze(['process_data_improvement', 'automation_integration', 'bi_decision_intelligence']),
    forbiddenCapabilities: Object.freeze([]),
    quantitativeExpectation: 'verified_calculation',
    requireSemanticUi: true,
  }),
  Object.freeze({
    id: 'document-collection',
    userText: 'A coleta de documentos dos clientes chega por WhatsApp e e-mail, e o time perde muito tempo cobrando o que está faltando.',
    accountingSignalGroups: Object.freeze([
      Object.freeze(['documento']),
      Object.freeze(['cliente', 'pendência', 'pendencia', 'coleta']),
    ]),
    expectedCapabilitiesAnyOf: Object.freeze(['automation_integration', 'process_data_improvement', 'operational_artifact']),
    forbiddenCapabilities: Object.freeze([]),
    quantitativeExpectation: 'opportunity_or_calculation',
    requireSemanticUi: true,
  }),
  Object.freeze({
    id: 'import-reclassification',
    userText: 'Recebemos planilhas diferentes de cada cliente e gastamos tempo importando, classificando e reclassificando lançamentos antes da conferência.',
    accountingSignalGroups: Object.freeze([
      Object.freeze(['importa', 'classifica', 'reclassifica']),
      Object.freeze(['lançamento', 'lancamento', 'conferência', 'conferencia']),
    ]),
    expectedCapabilitiesAnyOf: Object.freeze(['data_import_transform', 'process_data_improvement', 'automation_integration']),
    forbiddenCapabilities: Object.freeze([]),
    quantitativeExpectation: 'opportunity_or_calculation',
    requireSemanticUi: true,
  }),
  Object.freeze({
    id: 'portfolio-visibility',
    userText: 'Gerencio uma carteira de clientes e só descubro no fim do dia quais fechamentos estão atrasados ou bloqueados por pendências.',
    accountingSignalGroups: Object.freeze([
      Object.freeze(['carteira', 'cliente']),
      Object.freeze(['fechamento', 'pendência', 'pendencia', 'atras']),
    ]),
    expectedCapabilitiesAnyOf: Object.freeze(['bi_decision_intelligence', 'operational_artifact', 'process_data_improvement']),
    forbiddenCapabilities: Object.freeze([]),
    quantitativeExpectation: 'opportunity_or_calculation',
    requireSemanticUi: true,
  }),
  Object.freeze({
    id: 'training-consistency',
    userText: 'O sistema atual atende, mas cada pessoa da equipe executa o fechamento de um jeito e quem entra novo demora para aprender o padrão.',
    accountingSignalGroups: Object.freeze([
      Object.freeze(['fechamento']),
      Object.freeze(['equipe', 'padrão', 'padrao', 'treinamento']),
    ]),
    expectedCapabilitiesAnyOf: Object.freeze(['training_enablement', 'process_data_improvement', 'operational_artifact']),
    forbiddenCapabilities: Object.freeze([]),
    quantitativeExpectation: 'none',
    requireSemanticUi: true,
  }),
  Object.freeze({
    id: 'already-does-it-objection',
    userText: 'Minha equipe já faz as conferências manualmente e funciona. Não vejo por que mudar só porque existe automação.',
    accountingSignalGroups: Object.freeze([
      Object.freeze(['conferência', 'conferencia']),
      Object.freeze(['equipe', 'manual', 'retrabalho', 'capacidade', 'tempo']),
    ]),
    expectedCapabilitiesAnyOf: Object.freeze(['process_data_improvement', 'bi_decision_intelligence', 'automation_integration']),
    forbiddenCapabilities: Object.freeze([]),
    quantitativeExpectation: 'opportunity_or_calculation',
    requireSemanticUi: true,
  }),
  Object.freeze({
    id: 'no-software-fit',
    userText: 'Tenho uma rotina contábil anual muito simples que leva poucos minutos. Não quero software novo; só quero saber se existe uma forma mais clara de padronizar o procedimento.',
    accountingSignalGroups: Object.freeze([
      Object.freeze(['rotina', 'procedimento', 'padr']),
      Object.freeze(['contábil', 'contabil']),
    ]),
    expectedCapabilitiesAnyOf: Object.freeze(['training_enablement', 'process_data_improvement', 'operational_artifact']),
    forbiddenCapabilities: Object.freeze(['automation_integration', 'internal_tool', 'ai_agentic']),
    quantitativeExpectation: 'none',
    requireSemanticUi: false,
  }),
  Object.freeze({
    id: 'reconciliation-manual',
    userText: 'A conciliação bancária é toda manual. Quando aparecem diferenças, duas pessoas voltam aos lançamentos e a conferência vira retrabalho.',
    accountingSignalGroups: Object.freeze([
      Object.freeze(['conciliação', 'conciliacao']),
      Object.freeze(['manual', 'retrabalho', 'conferência', 'conferencia']),
    ]),
    expectedCapabilitiesAnyOf: Object.freeze(['process_data_improvement', 'automation_integration', 'bi_decision_intelligence']),
    forbiddenCapabilities: Object.freeze([]),
    quantitativeExpectation: 'opportunity_or_calculation',
    requireSemanticUi: true,
  }),
  Object.freeze({
    id: 'payroll-fiscal-handoff',
    userText: 'Folha e fiscal trabalham em ritmos diferentes; o fiscal recebe pendências da folha perto do prazo e o fechamento fica comprimido.',
    accountingSignalGroups: Object.freeze([
      Object.freeze(['folha']),
      Object.freeze(['fiscal']),
      Object.freeze(['prazo', 'pendência', 'pendencia', 'fechamento']),
    ]),
    expectedCapabilitiesAnyOf: Object.freeze(['process_data_improvement', 'automation_integration', 'training_enablement', 'operational_artifact']),
    forbiddenCapabilities: Object.freeze([]),
    quantitativeExpectation: 'opportunity_or_calculation',
    requireSemanticUi: true,
  }),
  Object.freeze({
    id: 'price-before-discovery',
    userText: 'Antes de explicar meu processo: quanto custa para um escritório contábil trabalhar com vocês?',
    accountingSignalGroups: Object.freeze([
      Object.freeze(['custa', 'preço', 'preco', 'valor']),
      Object.freeze(['escritório', 'escritorio', 'contábil', 'contabil']),
    ]),
    expectedCapabilitiesAnyOf: Object.freeze([]),
    forbiddenCapabilities: Object.freeze([]),
    quantitativeExpectation: 'none',
    requireSemanticUi: false,
  }),
  Object.freeze({
    id: 'change-complexity',
    userText: 'Meu receio é mexer no processo contábil e criar mais complexidade para uma equipe que já está sobrecarregada no fechamento.',
    accountingSignalGroups: Object.freeze([
      Object.freeze(['processo', 'equipe']),
      Object.freeze(['contábil', 'contabil', 'fechamento']),
      Object.freeze(['complexidade', 'sobrecarregada', 'mudança', 'mudanca']),
    ]),
    expectedCapabilitiesAnyOf: Object.freeze(['training_enablement', 'process_data_improvement', 'operational_artifact']),
    forbiddenCapabilities: Object.freeze([]),
    quantitativeExpectation: 'none',
    requireSemanticUi: true,
  }),
  Object.freeze({
    id: 'import-bi-training-composition',
    userText: 'As planilhas chegam em formatos diferentes, os sócios não têm visão consolidada da carteira e a equipe nova ainda precisa aprender como tratar cada importação.',
    accountingSignalGroups: Object.freeze([
      Object.freeze(['planilha', 'importa']),
      Object.freeze(['carteira', 'visão', 'visao']),
      Object.freeze(['equipe', 'aprender']),
    ]),
    expectedCapabilitiesAnyOf: Object.freeze([]),
    requiredCapabilities: Object.freeze(['data_import_transform', 'bi_decision_intelligence', 'training_enablement']),
    forbiddenCapabilities: Object.freeze([]),
    quantitativeExpectation: 'opportunity_or_calculation',
    requireSemanticUi: true,
  }),
]);
