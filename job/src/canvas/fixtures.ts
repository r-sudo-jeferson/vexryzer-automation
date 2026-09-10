import { createProcessGraph, type ProcessGraph, type ProcessNodeModel, type Provenance } from './domain.ts';

export interface ProcessFixture {
  readonly id: 'origin' | 'single' | 'standard' | 'longContent' | 'stress' | 'duplicateLabels' | 'provenance';
  readonly label: string;
  readonly graph: ProcessGraph;
}

const standardNodes: ProcessNodeModel[] = [
  { id: 'source-inbox', kind: 'source', label: 'Documentos recebidos', summary: 'Arquivos chegam por e-mail e canais diferentes.', provenance: 'user_stated' },
  { id: 'manual-review', kind: 'manual_action', label: 'Conferência manual', summary: 'Uma pessoa confere dados, nomes e competência antes de seguir.', provenance: 'user_confirmed', effort: { minutesPerOccurrence: 18 } },
  { id: 'system-entry', kind: 'system', label: 'Lançamento no sistema', summary: 'Os dados revisados são registrados no sistema contábil.', provenance: 'ai_inferred', systemName: 'Sistema contábil' },
  { id: 'output-report', kind: 'output', label: 'Entrega revisada', summary: 'O material final segue para conferência e envio ao cliente.', provenance: 'ai_inferred' },
];

const standardEdges = [
  { id: 'edge-inbox-review', source: 'source-inbox', target: 'manual-review' },
  { id: 'edge-review-system', source: 'manual-review', target: 'system-entry' },
  { id: 'edge-system-output', source: 'system-entry', target: 'output-report' },
] as const;

const stressProvenance: readonly Provenance[] = ['user_stated', 'ai_inferred', 'user_confirmed'];
const stressNodes: ProcessNodeModel[] = Array.from({ length: 20 }, (_, index) => {
  const step = index + 1;
  const id = `stress-${step}`;
  const provenance = stressProvenance[index % stressProvenance.length]!;
  if (index === 0) return { id, kind: 'source', label: 'Entrada do lote', summary: 'Início do fluxo de estresse.', provenance };
  if (index === 19) return { id, kind: 'output', label: 'Saída consolidada', summary: 'Fim do fluxo de estresse.', provenance };
  if (index % 5 === 0) return { id, kind: 'uncertainty', label: `Ponto de dúvida ${step}`, summary: 'Informação ainda precisa ser confirmada.', provenance: 'ai_inferred', question: 'Qual sistema participa desta etapa?' };
  if (index % 3 === 0) return { id, kind: 'system', label: `Sistema ${step}`, summary: 'Etapa automatizada em sistema externo.', provenance, systemName: `Sistema ${step}` };
  return { id, kind: 'manual_action', label: `Etapa manual ${step}`, summary: 'Atividade humana representativa para o teste de densidade.', provenance, effort: { minutesPerOccurrence: 6 + index } };
});

const stressEdges = stressNodes.slice(0, -1).map((node, index) => ({
  id: `stress-edge-${index + 1}`,
  source: node.id,
  target: stressNodes[index + 1]!.id,
}));

const duplicateLabelNodes: ProcessNodeModel[] = [
  { id: 'duplicate-first', kind: 'manual_action', label: 'Conferência manual', summary: 'Primeira conferência com identidade própria.', provenance: 'user_stated', effort: { minutesPerOccurrence: 8 } },
  { id: 'duplicate-second', kind: 'manual_action', label: 'Conferência manual', summary: 'Segunda conferência com o mesmo rótulo e identidade distinta.', provenance: 'user_confirmed', effort: { minutesPerOccurrence: 6 } },
  { id: 'duplicate-output', kind: 'output', label: 'Saída revisada', summary: 'Resultado após as duas conferências.', provenance: 'ai_inferred' },
];

const provenanceNodes: ProcessNodeModel[] = [
  { id: 'provenance-source', kind: 'source', label: 'Entrada informada', summary: 'Fato explicitamente informado no exemplo visual.', provenance: 'user_stated' },
  { id: 'provenance-uncertainty', kind: 'uncertainty', label: 'Sistema a confirmar', summary: 'Hipótese visual que permanece claramente não confirmada.', provenance: 'ai_inferred', question: 'Qual sistema recebe estes dados?' },
  { id: 'provenance-output', kind: 'output', label: 'Saída confirmada', summary: 'Fato confirmado no exemplo visual.', provenance: 'user_confirmed' },
];

export const processFixtures: Readonly<Record<ProcessFixture['id'], ProcessFixture>> = Object.freeze({
  origin: { id: 'origin', label: 'Origin', graph: createProcessGraph([], []) },
  single: { id: 'single', label: 'Uma etapa', graph: createProcessGraph([
    { id: 'single-manual', kind: 'manual_action', label: 'Conferência manual', summary: 'Uma única etapa humana para validar o estado mínimo do Canvas.', provenance: 'user_stated', effort: { minutesPerOccurrence: 12 } },
  ], []) },
  standard: { id: 'standard', label: 'Fluxo representativo', graph: createProcessGraph(standardNodes, standardEdges) },
  longContent: {
    id: 'longContent',
    label: 'Conteúdo longo',
    graph: createProcessGraph([
      { id: 'long-source', kind: 'source', label: 'Recebimento de documentos fiscais, comprovantes e planilhas enviados por múltiplos canais do cliente', summary: 'Fixture adversarial para verificar wrapping, densidade e legibilidade sem truncar informação essencial.', provenance: 'user_stated' },
      { id: 'long-output', kind: 'output', label: 'Entrega final', summary: 'Saída representativa.', provenance: 'user_confirmed' },
    ], [{ id: 'long-edge', source: 'long-source', target: 'long-output' }]),
  },
  stress: { id: 'stress', label: '20 nós', graph: createProcessGraph(stressNodes, stressEdges) },
  duplicateLabels: {
    id: 'duplicateLabels',
    label: 'Rótulos duplicados',
    graph: createProcessGraph(duplicateLabelNodes, [
      { id: 'duplicate-edge-first-second', source: 'duplicate-first', target: 'duplicate-second' },
      { id: 'duplicate-edge-second-output', source: 'duplicate-second', target: 'duplicate-output' },
    ]),
  },
  provenance: {
    id: 'provenance',
    label: 'Proveniência e incerteza',
    graph: createProcessGraph(provenanceNodes, [
      { id: 'provenance-edge-source-uncertainty', source: 'provenance-source', target: 'provenance-uncertainty' },
      { id: 'provenance-edge-uncertainty-output', source: 'provenance-uncertainty', target: 'provenance-output' },
    ]),
  },
});
