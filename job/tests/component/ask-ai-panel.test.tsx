import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AskAiPanel } from '../../src/app/AskAiPanel.tsx';

function renderPanel(overrides: Partial<ComponentProps<typeof AskAiPanel>> = {}) {
  const props: ComponentProps<typeof AskAiPanel> = {
    status: 'idle',
    narration: null,
    nextQuestion: null,
    errorCode: null,
    artifacts: [],
    corrections: [],
    onSubmit: vi.fn(async () => true),
    onApplyCorrection: vi.fn(async () => true),
    onResetSession: vi.fn(),
    ...overrides,
  };
  render(<AskAiPanel {...props} />);
  return props;
}

describe('ASK AI panel', () => {
  it('submits with Enter but preserves Shift+Enter and IME composition', async () => {
    const onSubmit = vi.fn(async () => true);
    renderPanel({ onSubmit });
    const input = screen.getByLabelText('Sua rotina, gargalo ou pergunta');

    fireEvent.change(input, { target: { value: 'Fechamento manual' } });
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.compositionEnd(input);
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledWith('Fechamento manual');
  });

  it('clears text only when the request is accepted', async () => {
    const failedSubmit = vi.fn(async () => false);
    const { rerender } = render(
      <AskAiPanel
        status="idle"
        narration={null}
        nextQuestion={null}
        errorCode={null}
        artifacts={[]}
        corrections={[]}
        onSubmit={failedSubmit}
        onApplyCorrection={async () => true}
        onResetSession={() => {}}
      />,
    );
    const input = screen.getByLabelText('Sua rotina, gargalo ou pergunta') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'Não perca este texto' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => {
      expect(failedSubmit).toHaveBeenCalledTimes(1);
      expect(input.value).toBe('Não perca este texto');
    });

    const acceptedSubmit = vi.fn(async () => true);
    rerender(
      <AskAiPanel
        status="idle"
        narration={null}
        nextQuestion={null}
        errorCode={null}
        artifacts={[]}
        corrections={[]}
        onSubmit={acceptedSubmit}
        onApplyCorrection={async () => true}
        onResetSession={() => {}}
      />,
    );
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => {
      expect(acceptedSubmit).toHaveBeenCalledTimes(1);
      expect(input.value).toBe('');
    });
  });

  it('announces bounded requesting and validation-failure states without fake streaming', () => {
    const { rerender } = render(
      <AskAiPanel
        status="requesting"
        narration={null}
        nextQuestion={null}
        errorCode={null}
        artifacts={[]}
        corrections={[]}
        onSubmit={async () => false}
        onApplyCorrection={async () => true}
        onResetSession={() => {}}
      />,
    );
    expect(screen.getByText(/organizando o contexto e validando/i)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Enviar para ASK AI' }) as HTMLButtonElement).disabled).toBe(true);

    rerender(
      <AskAiPanel
        status="error"
        narration={null}
        nextQuestion={null}
        errorCode="AGENT_EXECUTION_FAILED"
        artifacts={[]}
        corrections={[]}
        onSubmit={async () => false}
        onApplyCorrection={async () => true}
        onResetSession={() => {}}
      />,
    );
    expect(screen.getByText('Resposta não aplicada')).toBeTruthy();
    expect(screen.getByText(/não passou pelo ciclo de validação/i)).toBeTruthy();
  });

  it('renders pending correction as an explicit user decision and never auto-applies it', () => {
    const onApplyCorrection = vi.fn(async () => true);
    renderPanel({
      onApplyCorrection,
      corrections: [{
        sourceCorrectionId: 'correction-one',
        correction: {
          id: 'correction-one',
          targetEvidenceId: 'fact-old',
          reason: 'O prazo informado parece ter mudado.',
          replacementValue: '3 dias',
          supportingTurnIds: ['turn-one'],
        },
        status: 'pending',
        invalidatedReason: null,
      }],
    });

    expect(screen.getByText('O prazo informado parece ter mudado.')).toBeTruthy();
    expect(screen.getByText(/Valor proposto: 3 dias/)).toBeTruthy();
    expect(onApplyCorrection).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar correção' }));
    expect(onApplyCorrection).toHaveBeenCalledWith('correction-one');
  });

  it('does not render invalidated correction as a pending decision', () => {
    renderPanel({
      corrections: [{
        sourceCorrectionId: 'correction-old',
        correction: {
          id: 'correction-old',
          targetEvidenceId: 'fact-old',
          reason: 'Correção já resolvida.',
          replacementValue: '3 dias',
          supportingTurnIds: ['turn-one'],
        },
        status: 'invalidated',
        invalidatedReason: 'canonical-evidence-invalidated',
      }],
    });
    expect(screen.queryByRole('button', { name: 'Aplicar correção' })).toBeNull();
  });

  it('renders conceptual/prototype truth explicitly and never executes artifact content', () => {
    (globalThis as Record<string, unknown>)['__VXA_ARTIFACT_EXECUTED__'] = false;
    renderPanel({
      artifacts: [{
        id: 'artifact-hostile',
        kind: 'prototype',
        title: '<img src=x onerror="globalThis.__VXA_ARTIFACT_EXECUTED__=true">',
        summary: '<script>globalThis.__VXA_ARTIFACT_EXECUTED__=true</script>',
        evidenceIds: [],
        status: 'prototype',
        truthStatus: 'active',
        invalidatedReason: null,
        surfaceId: 'artifact-artifact-hostile',
        landmarkLabel: 'Protótipo hostil',
      }],
    });

    expect(screen.getByText(/<img src=x onerror=/)).toBeTruthy();
    expect(screen.getByText(/<script>/)).toBeTruthy();
    expect((globalThis as Record<string, unknown>)['__VXA_ARTIFACT_EXECUTED__']).toBe(false);
  });

  it('offers explicit safe-session reset only for continuity failures', () => {
    const onResetSession = vi.fn();
    const { rerender } = render(
      <AskAiPanel
        status="error"
        narration={null}
        nextQuestion={null}
        errorCode="SESSION_CONFLICT"
        artifacts={[]}
        corrections={[]}
        onSubmit={async () => false}
        onApplyCorrection={async () => true}
        onResetSession={onResetSession}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar nova sessão segura' }));
    expect(onResetSession).toHaveBeenCalledTimes(1);

    rerender(
      <AskAiPanel
        status="error"
        narration={null}
        nextQuestion={null}
        errorCode="STORE_UNAVAILABLE"
        artifacts={[]}
        corrections={[]}
        onSubmit={async () => false}
        onApplyCorrection={async () => true}
        onResetSession={onResetSession}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Iniciar nova sessão segura' })).toBeNull();
  });
});
