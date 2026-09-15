import type { Node, NodeProps } from '@xyflow/react';
import type { SpatialAgentPhase, SpatialAgentPlacement } from '../spatial-agent-presence.ts';
import './nodes.css';

export type SpatialAgentFlowNode = Node<{
  phase: SpatialAgentPhase;
  placement: SpatialAgentPlacement;
  reducedMotion: boolean;
  narration: string | null;
  question: string | null;
}, 'agent-presence'>;

const PHASE_LABEL: Readonly<Record<SpatialAgentPhase, string>> = Object.freeze({
  observing: 'LENDO O PROCESSO',
  thinking: 'ANALISANDO O ESPAÇO',
  asking: 'SUA VEZ',
  recovering: 'MODO SEGURO',
  error: 'NÃO PUBLICADO',
});

export function SpatialAgentPresenceView({
  phase,
  placement,
  reducedMotion,
  narration = null,
  question = null,
}: {
  phase: SpatialAgentPhase;
  placement: SpatialAgentPlacement;
  reducedMotion: boolean;
  narration?: string | null;
  question?: string | null;
}) {
  return (
    <aside
      className="vxa-spatial-agent"
      data-phase={phase}
      data-placement={placement}
      data-motion={reducedMotion ? 'reduced' : 'standard'}
      aria-hidden="true"
    >
      <span className="vxa-spatial-agent__orbit" aria-hidden="true">
        <i />
        <i />
        <b />
      </span>
      <span className="vxa-spatial-agent__copy">
        <small>VEXRYZER AI</small>
        <strong>{PHASE_LABEL[phase]}</strong>
      </span>
      <span className="vxa-spatial-agent__vector" aria-hidden="true" />
      {(phase === 'asking' || phase === 'recovering') && (narration !== null || question !== null) ? (
        <span className="vxa-spatial-agent__voice">
          {narration !== null ? <span className="vxa-spatial-agent__narration">{narration}</span> : null}
          {question !== null ? <strong className="vxa-spatial-agent__question">{question}</strong> : null}
        </span>
      ) : null}
    </aside>
  );
}

export function SpatialAgentNode({ data }: NodeProps<SpatialAgentFlowNode>) {
  return (
    <SpatialAgentPresenceView
      phase={data.phase}
      placement={data.placement}
      reducedMotion={data.reducedMotion}
      narration={data.narration}
      question={data.question}
    />
  );
}
