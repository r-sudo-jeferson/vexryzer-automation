import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { ProcessNodeModel } from '../domain.ts';
import type { CanvasNodeSemanticOverlay } from '../reactive-graph-adapter.ts';
import type { ZoomBand } from '../semantic-zoom.ts';
import './nodes.css';

export type ProcessFlowNode = Node<{
  model: ProcessNodeModel;
  zoomBand: ZoomBand;
  muted: boolean;
  overlay?: Readonly<CanvasNodeSemanticOverlay>;
}, 'process'>;

const kindLabels: Record<ProcessNodeModel['kind'], string> = {
  source: 'Entrada', manual_action: 'Humano', transformation: 'Transformação', system: 'Sistema', output: 'Saída',
  evidence: 'Evidência', effort: 'Esforço', uncertainty: 'A confirmar', estimate: 'Estimativa', request_receipt: 'Solicitação',
};
const provenanceLabels: Record<ProcessNodeModel['provenance'], string> = {
  user_stated: 'Informado', ai_inferred: 'Hipótese', user_confirmed: 'Confirmado',
};

function unitLabel(unit: string): string {
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

export function processNodeAccessibleLabel(
  model: ProcessNodeModel,
  overlay?: Readonly<CanvasNodeSemanticOverlay>,
): string {
  const semantic = overlay === undefined
    ? ''
    : [
        overlay.state === null ? '' : ` Estado: ${overlay.state}.`,
        ...overlay.annotations.map((text) => ` Anotação: ${text}`),
        ...overlay.quantifications.map((item) =>
          ` Quantificação verificada: ${formatNumber(item.resultValue)} ${unitLabel(item.resultUnit)}.`),
      ].join('');
  return `${kindLabels[model.kind]}: ${model.label}. ${model.summary} Proveniência: ${provenanceLabels[model.provenance]}.${semantic}`;
}

export function ProcessNode({ data, selected }: NodeProps<ProcessFlowNode>) {
  const { model, zoomBand, muted, overlay } = data;
  const detail = zoomBand === 'near';
  const medium = zoomBand !== 'far';
  return (
    <article
      className="vxa-node"
      data-kind={model.kind}
      data-zoom={zoomBand}
      data-muted={muted ? 'true' : 'false'}
      data-selected={selected ? 'true' : 'false'}
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
                <span>{unitLabel(item.resultUnit)}</span>
              </span>
            ))}
          </div>
        ) : null}
        {detail && overlay?.annotations.length ? (
          <ul className="vxa-node__annotations" aria-label="Anotações da análise">
            {overlay.annotations.map((text, index) => <li key={`${model.id}-annotation-${index}`}>{text}</li>)}
          </ul>
        ) : null}
      </div>
      <Handle className="vxa-node__handle" type="source" position={Position.Right} isConnectable={false} />
    </article>
  );
}
