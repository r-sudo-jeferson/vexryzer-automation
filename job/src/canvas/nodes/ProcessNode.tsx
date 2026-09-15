import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { ProcessNodeModel } from '../domain.ts';
import type {
  CanvasAnnotationEvidence,
  CanvasEvidenceLineage,
  CanvasNodeSemanticOverlay,
  CanvasQuantification,
} from '../reactive-graph-adapter.ts';
import type { ZoomBand } from '../semantic-zoom.ts';
import './nodes.css';

export type ProcessFlowNode = Node<{
  model: ProcessNodeModel;
  zoomBand: ZoomBand;
  muted: boolean;
  agentAnchored: boolean;
  overlay?: Readonly<CanvasNodeSemanticOverlay>;
}, 'process'>;

const kindLabels: Record<ProcessNodeModel['kind'], string> = {
  source: 'Entrada', manual_action: 'Humano', transformation: 'Transformação', system: 'Sistema', output: 'Saída',
  evidence: 'Evidência', effort: 'Esforço', uncertainty: 'A confirmar', estimate: 'Estimativa', request_receipt: 'Solicitação',
};
const provenanceLabels: Record<ProcessNodeModel['provenance'], string> = {
  user_stated: 'Informado', ai_inferred: 'Hipótese', user_confirmed: 'Confirmado',
};

export function canvasUnitLabel(unit: string): string {
  const labels: Record<string, string> = {
    'hour/month': 'h/mês',
    'minute/month': 'min/mês',
    'currency/month': 'R$/mês',
    'currency/hour': 'R$/h',
    percent: '%',
  };
  return labels[unit] ?? unit;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
}

function evidenceSourceLabel(source: CanvasEvidenceLineage['source']): string {
  switch (source) {
    case 'user': return 'informação do usuário';
    case 'inference': return 'hipótese de inferência';
    case 'system': return 'registro do sistema';
    case 'application': return 'cálculo da aplicação';
  }
}

function evidenceStatusLabel(status: string): string {
  switch (status) {
    case 'confirmed': return 'confirmada';
    case 'proposed': return 'a confirmar';
    case 'conflicted': return 'em conflito';
    case 'superseded': return 'substituída';
    case 'valid': return 'válida';
    case 'invalidated': return 'invalidada';
    case 'surfaced': return 'apresentada';
    case 'active': return 'ativa';
    default: return status;
  }
}

export function summarizeEvidenceLineage(evidence: readonly Readonly<CanvasEvidenceLineage>[]): string {
  if (evidence.length === 0) return 'Proveniência a confirmar.';
  return evidence
    .map((item) => `${evidenceSourceLabel(item.source)} ${evidenceStatusLabel(item.status)}`)
    .join('; ') + '.';
}

export function annotationProvenanceSummary(entry: Readonly<CanvasAnnotationEvidence>): string {
  return summarizeEvidenceLineage(entry.evidence);
}

export function quantificationProofSummary(item: Readonly<CanvasQuantification>): string {
  const confirmed = item.inputs.filter((input) => input.status === 'confirmed').length;
  const total = item.inputs.length;
  const inputsLabel = total === 1 ? '1 observação de entrada' : `${total} observações de entrada`;
  return `Cálculo determinístico da aplicação, expressão ${item.expression}, ${inputsLabel}, ${confirmed} confirmadas.`;
}

function annotationEntries(
  overlay: Readonly<CanvasNodeSemanticOverlay>,
): readonly Readonly<CanvasAnnotationEvidence>[] {
  const lineage = overlay.annotationEvidence ?? [];
  if (lineage.length === overlay.annotations.length && overlay.annotations.length > 0) {
    return lineage;
  }
  return overlay.annotations.map((text) => Object.freeze({
    text,
    evidenceIds: Object.freeze([]),
    evidence: Object.freeze([]),
  }));
}

export function processNodeAccessibleLabel(
  model: ProcessNodeModel,
  overlay?: Readonly<CanvasNodeSemanticOverlay>,
): string {
  const semantic = overlay === undefined
    ? ''
    : [
        overlay.state === null ? '' : ` Estado: ${overlay.state}.`,
        ...annotationEntries(overlay).map((entry) => ` Anotação: ${entry.text} Proveniência: ${annotationProvenanceSummary(entry)}`),
        ...overlay.quantifications.map((item) =>
          ` Quantificação verificada: ${formatNumber(item.resultValue)} ${canvasUnitLabel(item.resultUnit)}. ${quantificationProofSummary(item)}`),
      ].join('');
  return `${kindLabels[model.kind]}: ${model.label}. ${model.summary} Proveniência: ${provenanceLabels[model.provenance]}.${semantic}`;
}

export function ProcessNode({ data, selected }: NodeProps<ProcessFlowNode>) {
  const { model, zoomBand, muted, agentAnchored, overlay } = data;
  const detail = zoomBand === 'near';
  const medium = zoomBand !== 'far';
  return (
    <article
      className="vxa-node"
      data-kind={model.kind}
      data-zoom={zoomBand}
      data-muted={muted ? 'true' : 'false'}
      data-selected={selected ? 'true' : 'false'}
      data-agent-anchor={agentAnchored ? 'true' : 'false'}
      data-semantic-state={overlay?.state ?? 'none'}
      data-revealed={overlay?.revealed ? 'true' : 'false'}
      aria-label={processNodeAccessibleLabel(model, overlay)}
    >
      <Handle className="vxa-node__handle" type="target" position={Position.Left} isConnectable={false} />
      <div className="vxa-node__rail" aria-hidden="true" />
      <div className="vxa-node__content">
        <div className="vxa-node__meta"><span className="vxa-node__kind">{kindLabels[model.kind]}</span><span className="vxa-node__provenance">{provenanceLabels[model.provenance]}</span></div>
        <h3>{model.label}</h3>
        {medium ? <p>{model.summary}</p> : null}
        {detail && model.kind === 'manual_action' && model.effort ? <span className="vxa-node__datum">~{model.effort.minutesPerOccurrence} min / ocorrência</span> : null}
        {detail && model.kind === 'system' && model.systemName ? <span className="vxa-node__datum">{model.systemName}</span> : null}
        {detail && model.kind === 'uncertainty' && model.question ? <span className="vxa-node__datum">{model.question}</span> : null}
        {medium && overlay?.quantifications.length ? (
          <div className="vxa-node__metrics" aria-label="Quantificações verificadas">
            {overlay.quantifications.map((item) => (
              <span key={item.calculationId}>
                <strong>{formatNumber(item.resultValue)}</strong>
                <span>{canvasUnitLabel(item.resultUnit)}</span>
              </span>
            ))}
            {overlay.quantifications.map((item) => (
              <small key={`${item.calculationId}-proof`} className="vxa-node__proof">{quantificationProofSummary(item)}</small>
            ))}
          </div>
        ) : null}
        {detail && overlay?.annotations.length ? (
          <ul className="vxa-node__annotations" aria-label="Anotações da análise">
            {annotationEntries(overlay).map((entry, index) => (
              <li key={`${model.id}-annotation-${index}`}>
                <span>{entry.text}</span>
                <small className="vxa-node__provenance-note">{annotationProvenanceSummary(entry)}</small>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <Handle className="vxa-node__handle" type="source" position={Position.Right} isConnectable={false} />
    </article>
  );
}
