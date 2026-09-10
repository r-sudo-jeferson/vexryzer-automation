import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AskAiPanel } from '../../src/app/AskAiPanel.tsx';

function renderPanel(overrides: Partial<React.ComponentProps<typeof AskAiPanel>> = {}) {
  const props: React.ComponentProps<typeof AskAiPanel> = {
    status: 'idle',
    narration: null,
    nextQuestion: null,
    errorCode: null,
    artifacts: [],
    onSubmit: vi.fn(async () => true),
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
        onSubmit={failedSubmit}
        onResetSession={() => {}}
      />,
    );
    const input = screen.getByLabelText('Sua rotina, gargalo ou pergunta') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'Não perca este texto' } });
    fireEvent.submit(input.closest('form')!);
    await Promise.resolve();
    expect(input.value).toBe('Não perca este texto');

    const acceptedSubmit = vi.fn(async () => true);
    rerender(
      <AskAiPanel
        status="idle"
        narration={null}
        nextQuestion={null}
        errorCode={null}
        artifacts={[]}
        onSubmit={acceptedSubmit}
        onResetSession={() => {}}
      />,
    );
    fireEvent.submit(input.closest('form')!);
    await Promise.resolve();
    expect(input.value).toBe('');
  });

  it('announces bounded requesting and validation-failure states without fake streaming', () => {
    const { rerender } = render(
      <AskAiPanel
        status="requesting"
        narration={null}
        nextQuestion={null}
        errorCode={null}
        artifacts={[]}
        onSubmit={async () => false}
        onResetSession={() => {}}
      />,
    );
    expect(screen.getByText(/organizando o contexto e validando/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enviar para ASK AI' })).toBeDisabled();

    rerender(
      <AskAiPanel
        status="error"
        narration={null}
        nextQuestion={null}
        errorCode="AGENT_EXECUTION_FAILED"
        artifacts={[]}
        onSubmit={async () => false}
        onResetSession={() => {}}
      />,
    );
    expect(screen.getByText('Resposta não aplicada')).toBeTruthy();
    expect(screen.getByText(/não passou pelo ciclo de validação/i)).toBeTruthy();
  });

  it('renders conceptual/prototype truth explicitly and never executes artifact content', () => {
    (globalThis as Record<string, unknown>).__VXA_ARTIFACT_EXECUTED__ = false;
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
    expect((globalThis as Record<string, unknown>).__VXA_ARTIFACT_EXECUTED__).toBe(false);
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
        onSubmit={async () => false}
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
        onSubmit={async () => false}
        onResetSession={onResetSession}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Iniciar nova sessão segura' })).toBeNull();
  });
});
