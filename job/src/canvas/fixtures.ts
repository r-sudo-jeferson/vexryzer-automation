import { createProcessGraph, type ProcessGraph, type ProcessNodeModel } from './domain.ts';

export interface ProcessFixture {
  readonly id: 'origin' | 'standard' | 'longContent' | 'stress';
  readonly label: string;
  readonly graph: ProcessGraph;
}

const standardNodes: ProcessNodeModel[] = [
  { id: 'source-inbox', kind: 'source', label: 'Documentos recebidos', summary: 'Arquivos chegam por e-mail e canais diferentes.', provenance: 'fixture' },
  { id: 'manual-review', kind: 'manual_action', label: 'Conferência manual', summary: 'Uma pessoa confere dados, nomes e competência antes de seguir.', provenance: 'fixture', effort: { minutesPerOccurrence: 18 } },
  { id: 'system-entry', kind: 'system', label: 'Lançamento no sistema', summary: 'Os dados revisados são registrados no sistema contábil.', provenance: 'fixture', systemName: 'Sistema contábil' },
  { id: 'output-report', kind: 'output', label: 'Entrega revisada', summary: 'O material final segue para conferência e envio ao cliente.', provenance: 'fixture' },
];

const standardEdges = [
  { id: 'edge-inbox-review', source: 'source-inbox', target: 'manual-review' },
  { id: 'edge-review-system', source: 'manual-review', target: 'system-entry' },
  { id: 'edge-system-output', source: 'system-entry', target: 'output-report' },
] as const;

const stressNodes: ProcessNodeModel[] = Array.from({ length: 20 }, (_, index) => {
  const step = index + 1;
  const id = `stress-${step}`;
  if (index === 0) return { id, kind: 'source', label: 'Entrada do lote', summary: 'Início do fluxo de estresse.', provenance: 'fixture' };
  if (index === 19) return { id, kind: 'output', label: 'Saída consolidada', summary: 'Fim do fluxo de estresse.', provenance: 'fixture' };
  if (index % 5 === 0) return { id, kind: 'uncertainty', label: `Ponto de dúvida ${step}`, summary: 'Informação ainda precisa ser confirmada.', provenance: 'fixture', question: 'Qual sistema participa desta etapa?' };
  if (index % 3 === 0) return { id, kind: 'system', label: `Sistema ${step}`, summary: 'Etapa automatizada em sistema externo.', provenance: 'fixture', systemName: `Sistema ${step}` };
  return { id, kind: 'manual_action', label: `Etapa manual ${step}`, summary: 'Atividade humana representativa para o teste de densidade.', provenance: 'fixture', effort: { minutesPerOccurrence: 6 + index } };
});

const stressEdges = stressNodes.slice(0, -1).map((node, index) => ({
  id: `stress-edge-${index + 1}`,
  source: node.id,
  target: stressNodes[index + 1]!.id,
}));

export const processFixtures: Readonly<Record<ProcessFixture['id'], ProcessFixture>> = Object.freeze({
  origin: { id: 'origin', label: 'Origin', graph: createProcessGraph([], []) },
  standard: { id: 'standard', label: 'Fluxo representativo', graph: createProcessGraph(standardNodes, standardEdges) },
  longContent: {
    id: 'longContent',
    label: 'Conteúdo longo',
    graph: createProcessGraph([
      { id: 'long-source', kind: 'source', label: 'Recebimento de documentos fiscais, comprovantes e planilhas enviados por múltiplos canais do cliente', summary: 'Fixture adversarial para verificar wrapping, densidade e legibilidade sem truncar informação essencial.', provenance: 'fixture' },
      { id: 'long-output', kind: 'output', label: 'Entrega final', summary: 'Saída representativa.', provenance: 'fixture' },
    ], [{ id: 'long-edge', source: 'long-source', target: 'long-output' }]),
  },
  stress: { id: 'stress', label: '20 nós', graph: createProcessGraph(stressNodes, stressEdges) },
});
