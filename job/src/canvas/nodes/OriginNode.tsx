import type { Node, NodeProps } from '@xyflow/react';
import './nodes.css';

export type OriginFlowNode = Node<{ muted: boolean }, 'origin'>;

export function OriginNode({ data }: NodeProps<OriginFlowNode>) {
  return (
    <article className="vxa-origin-node" data-muted={data.muted ? 'true' : 'false'} aria-label="Ponto de partida da experiência">
      <span className="vxa-origin-node__eyebrow">VEXRYZER / PROCESS INTELLIGENCE</span>
      <strong>Começa com o trabalho que mais consome o seu time.</strong>
      <span>Sem formulário técnico. Primeiro entendemos o processo.</span>
    </article>
  );
}
