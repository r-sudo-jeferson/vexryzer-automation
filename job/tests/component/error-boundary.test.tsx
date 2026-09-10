import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../../src/app/ErrorBoundary.tsx';

function Broken(): never {
  throw new Error('render failed');
}

describe('ErrorBoundary', () => {
  it('shows a bounded recovery state when rendering fails', () => {
    render(<ErrorBoundary><Broken /></ErrorBoundary>);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('A experiência visual encontrou um problema.');
    const restart = screen.getByRole('button', { name: 'Reiniciar experiência' });
    expect(restart.tagName).toBe('BUTTON');
  });
});
