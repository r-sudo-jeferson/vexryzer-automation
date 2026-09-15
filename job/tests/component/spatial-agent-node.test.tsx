import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SpatialAgentPresenceView } from '../../src/canvas/nodes/SpatialAgentNode.tsx';

describe('SpatialAgentPresenceView', () => {
  it('renders a living Canvas presence rather than an embedded chat control', () => {
    const { container } = render(
      <SpatialAgentPresenceView phase="thinking" placement="above" reducedMotion={false} />,
    );
    expect(screen.getByText('VEXRYZER AI')).toBeTruthy();
    expect(screen.getByText('ANALISANDO O ESPAÇO')).toBeTruthy();
    expect(container.querySelector('textarea')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('.vxa-spatial-agent')?.getAttribute('data-phase')).toBe('thinking');
  });

  it('encodes reduced motion without changing semantic presence state', () => {
    const { container } = render(
      <SpatialAgentPresenceView
        phase="asking"
        placement="right"
        reducedMotion
        narration="A conferência concentra trabalho recorrente."
        question="Quantas vezes isso acontece por mês?"
      />,
    );
    const presence = container.querySelector('.vxa-spatial-agent');
    expect(presence?.getAttribute('data-phase')).toBe('asking');
    expect(presence?.getAttribute('data-motion')).toBe('reduced');
    expect(screen.getByText('SUA VEZ')).toBeTruthy();
    expect(screen.getByText('A conferência concentra trabalho recorrente.')).toBeTruthy();
    expect(screen.getByText('Quantas vezes isso acontece por mês?')).toBeTruthy();
  });
});
