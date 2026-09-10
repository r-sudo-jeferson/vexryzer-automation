import { useState, type FormEvent, type KeyboardEvent } from 'react';
import type { AgentExperienceStatus } from './app-machine.ts';
import type { ProjectedArtifact } from '../experience/reactive-experience-state.ts';

interface AskAiPanelProps {
  status: AgentExperienceStatus;
  narration: string | null;
  nextQuestion: string | null;
  errorCode: string | null;
  artifacts: readonly Readonly<ProjectedArtifact>[];
  onSubmit: (text: string) => Promise<void>;
  onResetSession: () => void;
}

function errorMessage(code: string | null): string {
  switch (code) {
    case 'NETWORK_UNAVAILABLE':
      return 'Sem conexão com a análise agora. Seu texto não foi tratado como concluído.';
    case 'STORE_UNAVAILABLE':
      return 'A sessão está temporariamente indisponível. Tente novamente sem alterar o que você descreveu.';
    case 'SESSION_BUSY':
      return 'A análise anterior ainda está fechando. Tente novamente em instantes.';
    case 'AGENT_EXECUTION_FAILED':
      return 'A resposta não passou pelo ciclo de validação. O sistema não publicou uma conclusão insegura.';
    case 'STALE_REVISION':
    case 'SESSION_CONFLICT':
    case 'REQUEST_REPLAY':
    case 'UNAUTHORIZED':
    case 'NOT_FOUND':
      return 'A sessão perdeu continuidade segura. Inicie uma nova análise para não misturar estados.';
    case 'CLIENT_SURFACE_REJECTED':
    case 'INVALID_SERVER_RESPONSE':
    case 'SESSION_ID_MISMATCH':
      return 'A resposta recebida não passou pela validação local e não foi aplicada ao processo.';
    default:
      return code === null ? '' : 'A análise não pôde ser concluída com segurança.';
  }
}

export function AskAiPanel({
  status,
  narration,
  nextQuestion,
  errorCode,
  artifacts,
  onSubmit,
  onResetSession,
}: AskAiPanelProps) {
  const [text, setText] = useState('');
  const [composing, setComposing] = useState(false);
  const busy = status === 'requesting';
  const canSubmit = !busy && text.trim().length > 0 && text.trim().length <= 4_000;

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const value = text.trim();
    if (!canSubmit || composing) return;
    await onSubmit(value);
    setText('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing || composing) return;
    event.preventDefault();
    void submit();
  };

  return (
    <section className="vxa-agent" aria-labelledby="vxa-agent-title" data-status={status}>
      <div className="vxa-agent__heading">
        <div>
          <span className="vxa-agent__eyebrow">ASK AI / CONTABILIDADE</span>
          <h2 id="vxa-agent-title">Descreva a rotina como ela acontece.</h2>
        </div>
        <span className="vxa-agent__state" aria-hidden="true">
          {busy ? 'ANALISANDO' : status === 'recovery' ? 'MODO SEGURO' : status === 'error' ? 'NÃO PUBLICADO' : 'PRONTO'}
        </span>
      </div>

      {(narration !== null || nextQuestion !== null || busy || status === 'error') ? (
        <div className="vxa-agent__response" aria-live="polite" aria-atomic="true">
          {busy ? (
            <>
              <span className="vxa-agent__pulse" aria-hidden="true" />
              <p>Estou organizando o contexto e validando o próximo movimento antes de alterar o Canvas.</p>
            </>
          ) : status === 'error' ? (
            <div>
              <strong>Resposta não aplicada</strong>
              <p>{errorMessage(errorCode)}</p>
            </div>
          ) : (
            <div>
              {narration !== null ? <p className="vxa-agent__narration">{narration}</p> : null}
              {nextQuestion !== null ? <p className="vxa-agent__question">{nextQuestion}</p> : null}
            </div>
          )}
        </div>
      ) : (
        <p className="vxa-agent__prompt">
          Pode ser confuso, manual ou cheio de exceções. Comece pelo ponto que mais consome atenção, prazo ou retrabalho.
        </p>
      )}

      {artifacts.length > 0 ? (
        <div className="vxa-agent__artifacts" aria-label="Conceitos gerados e validados">
          {artifacts.map((artifact) => (
            <article key={artifact.id} data-truth={artifact.truthStatus} data-maturity={artifact.status}>
              <span>{artifact.status === 'prototype' ? 'PROTÓTIPO' : 'CONCEITO'}</span>
              <strong>{artifact.title}</strong>
              <p>{artifact.summary}</p>
            </article>
          ))}
        </div>
      ) : null}

      <form className="vxa-agent__composer" onSubmit={(event) => void submit(event)}>
        <label htmlFor="vxa-agent-input">Sua rotina, gargalo ou pergunta</label>
        <div className="vxa-agent__input-shell">
          <textarea
            id="vxa-agent-input"
            value={text}
            rows={3}
            maxLength={4_000}
            disabled={busy}
            placeholder="Ex.: todo mês três pessoas conferem lançamentos manualmente antes do fechamento..."
            onChange={(event) => setText(event.target.value)}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => setComposing(false)}
            onKeyDown={handleKeyDown}
          />
          <button type="submit" disabled={!canSubmit} aria-label="Enviar para ASK AI">
            {busy ? 'Analisando…' : 'Analisar'}
            <span aria-hidden="true">↗</span>
          </button>
        </div>
        <div className="vxa-agent__composer-meta">
          <span>Enter envia · Shift+Enter quebra linha</span>
          <span>{text.length.toLocaleString('pt-BR')} / 4.000</span>
        </div>
      </form>

      {status === 'error' && ['STALE_REVISION', 'SESSION_CONFLICT', 'REQUEST_REPLAY', 'UNAUTHORIZED', 'NOT_FOUND'].includes(errorCode ?? '') ? (
        <button className="vxa-agent__reset" type="button" onClick={onResetSession}>
          Iniciar nova sessão segura
        </button>
      ) : null}
    </section>
  );
}
