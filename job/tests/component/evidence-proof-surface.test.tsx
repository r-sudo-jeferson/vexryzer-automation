import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  OpportunityProofView,
  ValueProofView,
} from '../../src/canvas/EvidenceProofSurface.tsx';
import type {
  CanvasOpportunity,
  CanvasQuantification,
} from '../../src/canvas/reactive-graph-adapter.ts';

const quantification: Readonly<CanvasQuantification> = Object.freeze({
  calculationId: 'calc-capacity',
  resultValue: 44,
  resultUnit: 'hour/month',
  expression: '220 ocorrencias * 12 min / 60',
  computedBy: 'application',
  basedOnRevision: 7,
  inputObservationIds: Object.freeze(['obs-volume']),
  inputs: Object.freeze([
    Object.freeze({ id: 'obs-volume', source: 'user', status: 'confirmed' }),
  ]),
});

const opportunity: Readonly<CanvasOpportunity> = Object.freeze({
  id: 'opp-capacity',
  kind: 'monthly_capacity',
  objective: 'Medir a capacidade consumida pela conferencia manual.',
  evidenceIds: Object.freeze(['fact-loop']),
  missingInputs: Object.freeze(['minutos por conferencia', 'pessoas envolvidas']),
  status: 'surfaced',
  evidence: Object.freeze([
    Object.freeze({ id: 'fact-loop', kind: 'fact', source: 'inference', status: 'proposed' }),
  ]),
});

describe('spatial WP07 proof nodes', () => {
  it('renders verified value with deterministic application lineage', () => {
    render(<ValueProofView quantification={quantification} zoomBand="near" />);
    const article = screen.getByRole('article', { name: /Quantificação verificada/i });
    expect(article.textContent).toContain('44');
    expect(article.textContent).toContain('h/mês');
    expect(article.textContent).toContain('Cálculo determinístico da aplicação');
    expect(article.textContent).toContain('220 ocorrencias * 12 min / 60');
    expect(article.textContent).toContain('1 observação de entrada');
  });

  it('keeps missing-input opportunity explicitly non-numeric with named inputs', () => {
    render(<OpportunityProofView opportunity={opportunity} zoomBand="near" />);
    const article = screen.getByRole('article', { name: /Capacidade mensal/i });
    expect(article.textContent).toContain('Sem valor calculado');
    expect(article.textContent).toContain('minutos por conferencia');
    expect(article.textContent).toContain('pessoas envolvidas');
    expect(article.textContent).toContain('hipótese de inferência');
    expect(article.getAttribute('aria-label')).toContain('Sem valor calculado');
    expect(article.textContent).not.toMatch(/44|220|12/);
  });

  it('exposes status and provenance as text rather than color-only semantics', () => {
    render(<OpportunityProofView opportunity={opportunity} zoomBand="medium" />);
    expect(screen.getByText('Capacidade mensal')).toBeDefined();
    expect(screen.getByText('Apresentada')).toBeDefined();
    expect(screen.getByText(/hipótese de inferência/i)).toBeDefined();
  });

  it('keeps far semantic zoom concise without replacing the underlying proof identity', () => {
    render(<OpportunityProofView opportunity={opportunity} zoomBand="far" />);
    const article = screen.getByRole('article', { name: /Capacidade mensal/i });
    expect(article.textContent).toContain('Medir a capacidade');
    expect(article.getAttribute('data-zoom')).toBe('far');
  });
});
