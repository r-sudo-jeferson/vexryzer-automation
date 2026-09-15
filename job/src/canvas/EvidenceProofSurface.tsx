import type { Node, NodeProps } from '@xyflow/react';
import type { CanvasOpportunity, CanvasQuantification } from './reactive-graph-adapter.ts';
import type { ZoomBand } from './semantic-zoom.ts';
import {
  canvasUnitLabel,
  quantificationProofSummary,
  summarizeEvidenceLineage,
} from './nodes/ProcessNode.tsx';
import './nodes/nodes.css';

export type OpportunityProofFlowNode = Node<{
  opportunity: Readonly<CanvasOpportunity>;
  zoomBand: ZoomBand;
}, 'opportunity-proof'>;

export type ValueProofFlowNode = Node<{
  quantification: Readonly<CanvasQuantification>;
  zoomBand: ZoomBand;
}, 'value-proof'>;

const OPPORTUNITY_KIND_LABELS: Record<CanvasOpportunity['kind'], string> = {
  monthly_capacity: 'Capacidade mensal',
  monthly_workload: 'Carga mensal',
  monthly_cost: 'Custo mensal',
  rework_volume: 'Retrabalho',
  other: 'Oportunidade',
};
const OPPORTUNITY_STATUS_LABELS: Record<CanvasOpportunity['status'], string> = {
  surfaced: 'Apresentada',
  active: 'Em acompanhamento',
  invalidated: 'Invalidada',
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
}

export function opportunityProofAccessibleLabel(opportunity: Readonly<CanvasOpportunity>): string {
  const missing = opportunity.missingInputs.length === 0
    ? 'Sem pendências de informação.'
    : ` Sem valor calculado. Falta informar: ${opportunity.missingInputs.join('; ')}.`;
  return `${OPPORTUNITY_KIND_LABELS[opportunity.kind]}: ${opportunity.objective}`
    + ` Estado: ${OPPORTUNITY_STATUS_LABELS[opportunity.status]}.${missing}`
    + ` Proveniência: ${summarizeEvidenceLineage(opportunity.evidence)}`;
}

export function valueProofAccessibleLabel(quantification: Readonly<CanvasQuantification>): string {
  return `Quantificação verificada: ${formatNumber(quantification.resultValue)} `
    + `${canvasUnitLabel(quantification.resultUnit)}. ${quantificationProofSummary(quantification)}`;
}
export function ValueProofView({
  quantification,
  zoomBand,
}: {
  quantification: Readonly<CanvasQuantification>;
  zoomBand: ZoomBand;
}) {
  return (
    <article
      className="vxa-value-proof"
      data-zoom={zoomBand}
      aria-label={valueProofAccessibleLabel(quantification)}
    >
      <span className="vxa-proof-node__eyebrow">VALOR VERIFICADO</span>
      <span className="vxa-value-proof__value">
        <strong>{formatNumber(quantification.resultValue)}</strong>
        <span>{canvasUnitLabel(quantification.resultUnit)}</span>
      </span>
      <small className="vxa-proof-node__lineage">
        {quantificationProofSummary(quantification)}
      </small>
    </article>
  );
}
export function OpportunityProofView({
  opportunity,
  zoomBand,
}: {
  opportunity: Readonly<CanvasOpportunity>;
  zoomBand: ZoomBand;
}) {
  return (
    <article
      className="vxa-opportunity-proof"
      data-kind={opportunity.kind}
      data-status={opportunity.status}
      data-zoom={zoomBand}
      aria-label={opportunityProofAccessibleLabel(opportunity)}
    >
      <span className="vxa-proof-node__meta">
        <span className="vxa-proof-node__kind">{OPPORTUNITY_KIND_LABELS[opportunity.kind]}</span>
        <span className="vxa-proof-node__status">{OPPORTUNITY_STATUS_LABELS[opportunity.status]}</span>
      </span>
      <strong className="vxa-opportunity-proof__objective">{opportunity.objective}</strong>
      {opportunity.missingInputs.length > 0 ? (
        <span className="vxa-opportunity-proof__missing">
          <span>Sem valor calculado — falta informar:</span>
          <ul aria-label="Informações que faltam">
            {opportunity.missingInputs.map((input) => (
              <li key={`${opportunity.id}-${input}`}>{input}</li>
            ))}
          </ul>
        </span>
      ) : (
        <span className="vxa-opportunity-proof__missing">Sem pendências de informação.</span>
      )}
      <small className="vxa-proof-node__lineage">
        {summarizeEvidenceLineage(opportunity.evidence)}
      </small>
    </article>
  );
}
export function OpportunityProofNode({ data }: NodeProps<OpportunityProofFlowNode>) {
  return (
    <OpportunityProofView
      opportunity={data.opportunity}
      zoomBand={data.zoomBand}
    />
  );
}

export function ValueProofNode({ data }: NodeProps<ValueProofFlowNode>) {
  return (
    <ValueProofView
      quantification={data.quantification}
      zoomBand={data.zoomBand}
    />
  );
}
