import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { ProcessNodeModel } from '../domain.ts';
import type { ZoomBand } from '../semantic-zoom.ts';
import './nodes.css';

export type ProcessFlowNode = Node<{ model: ProcessNodeModel; zoomBand: ZoomBand; muted: boolean }, 'process'>;

const kindLabels: Record<ProcessNodeModel['kind'], string> = {
  source: 'Entrada', manual_action: 'Humano', transformation: 'Transformação', system: 'Sistema', output: 'Saída',
  evidence: 'Evidência', effort: 'Esforço', uncertainty: 'A confirmar', estimate: 'Estimativa', request_receipt: 'Solicitação',
};
const provenanceLabels: Record<ProcessNodeModel['provenance'], string> = {
  user_stated: 'Informado', ai_inferred: 'Hipótese', user_confirmed: 'Confirmado',
};

export function ProcessNode({ data, selected }: NodeProps<ProcessFlowNode>) {
  const { model, zoomBand, muted } = data;
  const detail = zoomBand === 'near';
  const medium = zoomBand !== 'far';
  return (
    <article className="vxa-node" data-kind={model.kind} data-zoom={zoomBand} data-muted={muted ? 'true' : 'false'} data-selected={selected ? 'true' : 'false'} aria-label={`${kindLabels[model.kind]}: ${model.label}. ${model.summary}`}>
      <Handle className="vxa-node__handle" type="target" position={Position.Left} isConnectable={false} />
      <div className="vxa-node__rail" aria-hidden="true" />
      <div className="vxa-node__content">
        <div className="vxa-node__meta"><span className="vxa-node__kind">{kindLabels[model.kind]}</span>{detail ? <span className="vxa-node__provenance">{provenanceLabels[model.provenance]}</span> : null}</div>
        <h3>{model.label}</h3>
        {medium ? <p>{model.summary}</p> : null}
        {detail && model.kind === 'manual_action' && model.effort ? <span className="vxa-node__datum">~{model.effort.minutesPerOccurrence} min / ocorrência</span> : null}
        {detail && model.kind === 'system' && model.systemName ? <span className="vxa-node__datum">{model.systemName}</span> : null}
        {detail && model.kind === 'uncertainty' && model.question ? <span className="vxa-node__datum">{model.question}</span> : null}
      </div>
      <Handle className="vxa-node__handle" type="source" position={Position.Right} isConnectable={false} />
    </article>
  );
}
