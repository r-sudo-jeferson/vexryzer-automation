export const ACCOUNTING_OPERATION_VOCABULARY = Object.freeze([
  'fechamento mensal',
  'reconciliação e conferência',
  'rotinas fiscal, contábil e folha',
  'carteira de clientes',
  'coleta e validação de documentos',
  'importação, classificação e reclassificação',
  'pendências, exceções e retrabalho',
  'handoffs entre departamentos',
  'padronização e treinamento da equipe',
  'visibilidade gerencial e prazo de fechamento',
] as const);

export const ACCOUNTING_QUANTITATIVE_LENSES = Object.freeze([
  'horas consumidas por mês',
  'capacidade operacional comprometida',
  'volume por cliente ou carteira',
  'minutos por ocorrência',
  'frequência de retrabalho',
  'compressão de prazo',
  'pessoas envolvidas',
  'volume de documentos, lançamentos, reconciliações ou importações',
] as const);

export const SELLER_PERSUASION_GUARDRAILS = Object.freeze([
  'Use linguagem contábil-operacional quando ela comunicar melhor do que jargão tecnológico.',
  'Transforme dor em números somente quando observações canônicas e cálculos determinísticos sustentarem o valor.',
  'Pergunte por uma variável faltante apenas quando ela for o movimento mais forte; não siga uma sequência fixa de perguntas.',
  'Capacidades podem ser combinadas livremente e não formam uma classificação obrigatória de solução.',
  'Respeite recusa e agência do visitante; não use medo, vergonha, escassez falsa ou urgência fabricada.',
] as const);

export function buildAccountingSellerGuidance(): readonly string[] {
  return Object.freeze([
    `Vocabulário operacional disponível: ${ACCOUNTING_OPERATION_VOCABULARY.join('; ')}.`,
    `Lentes quantitativas disponíveis: ${ACCOUNTING_QUANTITATIVE_LENSES.join('; ')}.`,
    ...SELLER_PERSUASION_GUARDRAILS,
  ]);
}
