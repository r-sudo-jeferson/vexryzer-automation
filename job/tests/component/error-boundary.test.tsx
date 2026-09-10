import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../../src/app/ErrorBoundary.tsx';

function Broken(): never {
  throw new Error('render failed');
}

describe('ErrorBoundary', () => {
  it('shows a bounded recovery state when rendering fails', () => {
    render(<ErrorBoundary><Broken /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toHaveTextContent('A experiência visual encontrou um problema.');
    expect(screen.getByRole('button', { name: 'Reiniciar experiência' })).toBeVisible();
  });
});
