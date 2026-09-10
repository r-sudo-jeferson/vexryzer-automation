import { useCallback, useEffect, useMemo } from 'react';
import { useMachine } from '@xstate/react';
import { appMachine, type AppMachineEvent } from './app-machine.ts';
import { transitionExperience, type ExperienceMode } from './experience-state.ts';
import { decodeViewState, encodeViewState } from './view-state.ts';
import { createAskAiClient } from './ask-ai-client.ts';
import { AskAiPanel } from './AskAiPanel.tsx';
import { AutomationCanvas } from '../canvas/AutomationCanvas.tsx';
import { processFixtures, type ProcessFixture } from '../canvas/fixtures.ts';
import { createProcessGraph } from '../canvas/domain.ts';
import { projectReactiveCanvas } from '../canvas/reactive-graph-adapter.ts';
import { useReducedMotionPolicy } from '../accessibility/useReducedMotionPolicy.ts';
import { usePerformanceInstrumentation } from '../performance/usePerformanceInstrumentation.ts';
import './app.css';

const EMPTY_PROCESS_GRAPH = createProcessGraph([], []);

function resolveFixture(): ProcessFixture {
  const value = new URLSearchParams(window.location.search).get('fixture');
  if (value === 'error') throw new Error('Visual recovery fixture');
  if (
    value === 'origin'
    || value === 'single'
    || value === 'longContent'
    || value === 'stress'
    || value === 'duplicateLabels'
    || value === 'provenance'
    || value === 'adversarialText'
  ) return processFixtures[value];
  return processFixtures.standard;
}

export function App() {
  const [snapshot, send] = useMachine(appMachine);
  const motionPolicy = useReducedMotionPolicy();
  usePerformanceInstrumentation();
  const fixture = useMemo(resolveFixture, []);
  const askAiClient = useMemo(() => createAskAiClient(), []);
  const mode: ExperienceMode = snapshot.matches('origin') ? 'origin' : snapshot.matches('process') ? 'process' : 'focus';
  const agentState = snapshot.context.agentState;

  const liveCanvas = useMemo(() => {
    if (agentState === null) return null;
    return projectReactiveCanvas(
      EMPTY_PROCESS_GRAPH,
      agentState.reactiveState,
      { verifiedCalculations: agentState.verifiedCalculations },
    );
  }, [agentState]);

  const liveActive = agentState !== null;
  const displayGraph = liveActive
    ? liveCanvas?.ok ? liveCanvas.model.graph : EMPTY_PROCESS_GRAPH
    : fixture.graph;
  const semanticOverlays = liveCanvas?.ok ? liveCanvas.model.overlays : [];
  const focusedNodeId = snapshot.context.focusedNodeId;
  const validNodeIds = useMemo(() => displayGraph.nodes.map((node) => node.id), [displayGraph]);
  const stepCount = displayGraph.nodes.length;
  const mappedStepLabel = `${stepCount} ${stepCount === 1 ? 'etapa mapeada' : 'etapas mapeadas'}`;

  const restoreFromLocation = useCallback(() => {
    const desired = decodeViewState(window.location.hash, validNodeIds);
    send({ type: 'RESET' });
    if (desired.mode === 'process' || desired.mode === 'focus') send({ type: 'ENTER_PROCESS' });
    if (desired.mode === 'focus' && desired.focusedNodeId) send({ type: 'FOCUS_NODE', nodeId: desired.focusedNodeId });
  }, [send, validNodeIds]);

  useEffect(() => {
    if (!window.location.hash) history.replaceState(null, '', `${location.pathname}${location.search}#origin`);
    else restoreFromLocation();
    window.addEventListener('popstate', restoreFromLocation);
    return () => window.removeEventListener('popstate', restoreFromLocation);
  }, [restoreFromLocation]);

  const navigate = useCallback((event: AppMachineEvent) => {
    if (
      event.type === 'ASK_REQUESTED'
      || event.type === 'ASK_ACCEPTED'
      || event.type === 'ASK_FAILED'
      || event.type === 'ASK_SESSION_RESET'
    ) {
      send(event);
      return;
    }
    const current = { mode, focusedNodeId };
    const next = transitionExperience(current, event);
    send(event);
    const hash = encodeViewState(next);
    if (hash !== window.location.hash) history.pushState(null, '', `${location.pathname}${location.search}${hash}`);
  }, [focusedNodeId, mode, send]);

  const applyAcceptedNavigation = useCallback((focusId: string | null) => {
    send({ type: 'ENTER_PROCESS' });
    if (focusId !== null) send({ type: 'FOCUS_NODE', nodeId: focusId });
    const hash = encodeViewState(focusId === null
      ? { mode: 'process', focusedNodeId: null }
      : { mode: 'focus', focusedNodeId: focusId });
    if (hash !== window.location.hash) {
      history.pushState(null, '', `${location.pathname}${location.search}${hash}`);
    }
  }, [send]);

  const handleAskSubmit = useCallback(async (text: string) => {
    send({ type: 'ASK_REQUESTED' });
    const result = await askAiClient.submit(text);
    if (!result.ok) {
      send({ type: 'ASK_FAILED', code: result.code });
      return;
    }

    const surface = projectReactiveCanvas(
      EMPTY_PROCESS_GRAPH,
      result.state.reactiveState,
      { verifiedCalculations: result.state.verifiedCalculations },
    );
    if (!surface.ok) {
      send({ type: 'ASK_FAILED', code: 'CLIENT_SURFACE_REJECTED' });
      return;
    }

    send({ type: 'ASK_ACCEPTED', response: result });
    const focusId = result.state.reactiveState.scene.focusIds.find((id) =>
      surface.model.graph.nodes.some((node) => node.id === id)) ?? null;
    applyAcceptedNavigation(focusId);
  }, [applyAcceptedNavigation, askAiClient, send]);

  const resetAgentSession = useCallback(() => {
    askAiClient.reset();
    send({ type: 'ASK_SESSION_RESET' });
    navigate({ type: 'RESET' });
  }, [askAiClient, navigate, send]);

  const focusedIndex = displayGraph.nodes.findIndex((node) => node.id === focusedNodeId);
  const focusByIndex = (index: number) => {
    const node = displayGraph.nodes[index];
    if (node) navigate({ type: 'FOCUS_NODE', nodeId: node.id });
  };

  const headerState = snapshot.context.agentStatus === 'requesting'
    ? 'ANALISANDO'
    : liveActive
      ? snapshot.context.agentStatus === 'recovery' ? 'MODO SEGURO' : 'ASK AI ATIVO'
      : 'ASK AI PRONTO';

  return (
    <div
      className="vxa-shell"
      data-mode={mode}
      data-motion={motionPolicy.reduced ? 'reduced' : 'standard'}
      data-agent-status={snapshot.context.agentStatus}
      data-live={liveActive ? 'true' : 'false'}
    >
      <a className="vxa-skip" href="#vxa-primary">Ir para a experiência</a>
      <header className="vxa-header">
        <a className="vxa-brand" href="/" aria-label="Vexryzer Automation — início">
          <span className="vxa-brand__mark" aria-hidden="true">V</span>
          <span>VEXRYZER <b>AUTOMATION</b></span>
        </a>
        <div className="vxa-header__meta">
          <span>PROCESS INTELLIGENCE</span>
          <span className="vxa-status-dot">{headerState}</span>
        </div>
      </header>

      <main id="vxa-primary" className="vxa-main" tabIndex={-1}>
        <section className="vxa-intro" aria-labelledby="vxa-title">
          <div className="vxa-intro__copy">
            <span className="vxa-kicker">AUTOMAÇÃO COMEÇA COM CLAREZA</span>
            <h1 id="vxa-title">Onde o seu time ainda trabalha como máquina?</h1>
            <p>Mostre o processo. A Vexryzer transforma trabalho repetitivo em uma visão operacional clara — antes de qualquer promessa técnica.</p>
            <div className="vxa-actions">
              {mode === 'origin' ? (
                <button className="vxa-button vxa-button--primary" type="button" onClick={() => navigate({ type: 'ENTER_PROCESS' })}>
                  Explorar um processo
                  <span aria-hidden="true">↗</span>
                </button>
              ) : (
                <button className="vxa-button vxa-button--ghost" type="button" onClick={() => navigate({ type: 'RESET' })}>
                  Voltar à origem
                </button>
              )}
              <span className="vxa-actions__note">O texto é enviado somente ao ASK AI; o Canvas muda apenas após validação.</span>
            </div>
          </div>

          <div className="vxa-intro__intelligence">
            <AskAiPanel
              status={snapshot.context.agentStatus}
              narration={snapshot.context.agentNarration}
              nextQuestion={snapshot.context.agentQuestion}
              errorCode={snapshot.context.agentErrorCode}
              artifacts={agentState?.reactiveState.artifacts ?? []}
              onSubmit={handleAskSubmit}
              onResetSession={resetAgentSession}
            />
            <aside className="vxa-principle" aria-label="Princípio da experiência">
              <span>01 / ENTENDER</span>
              <p>Primeiro o processo fica visível. Inteligência, valor e evidência entram depois — sem reescrever a interação.</p>
            </aside>
          </div>
        </section>

        <section className="vxa-stage" aria-label="Infinite Canvas">
          <AutomationCanvas
            fixture={fixture}
            {...(liveActive ? { graph: displayGraph, semanticOverlays } : {})}
            mode={mode}
            focusedNodeId={focusedNodeId}
            motionPolicy={motionPolicy}
            onFocusNode={(nodeId) => mode !== 'origin' && navigate({ type: 'FOCUS_NODE', nodeId })}
          />

          <nav className="vxa-director" aria-label="Navegação dirigida do processo">
            <div className="vxa-director__heading">
              <span>{liveActive ? 'PROCESSO ENTENDIDO' : 'PROCESSO'}</span>
              <strong>{mode === 'origin' ? 'Pronto para revelar' : mappedStepLabel}</strong>
            </div>
            <div className="vxa-director__steps">
              {mode === 'origin' ? (
                <p className="vxa-empty">As etapas aparecem quando você entra no processo. O Canvas não exige gesto ou conhecimento técnico para começar.</p>
              ) : displayGraph.nodes.length === 0 ? (
                <p className="vxa-empty">
                  {liveActive
                    ? 'Ainda não há uma etapa validada para materializar. Continue descrevendo a operação no ASK AI.'
                    : 'Este cenário não contém etapas. Você pode voltar à origem e explorar outro processo.'}
                </p>
              ) : displayGraph.nodes.map((node, index) => (
                <button
                  key={node.id}
                  type="button"
                  className="vxa-step"
                  data-active={focusedNodeId === node.id ? 'true' : 'false'}
                  onClick={() => navigate({ type: 'FOCUS_NODE', nodeId: node.id })}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <span>{node.label}</span>
                </button>
              ))}
            </div>
            {mode === 'focus' && displayGraph.nodes.length > 0 ? (
              <div className="vxa-director__controls">
                <button type="button" onClick={() => focusByIndex(Math.max(0, focusedIndex - 1))} disabled={focusedIndex <= 0}>Anterior</button>
                <button type="button" onClick={() => navigate({ type: 'EXIT_FOCUS' })}>Ver processo</button>
                <button type="button" onClick={() => focusByIndex(Math.min(displayGraph.nodes.length - 1, focusedIndex + 1))} disabled={focusedIndex >= displayGraph.nodes.length - 1}>Próxima</button>
              </div>
            ) : null}
          </nav>
        </section>
      </main>

      <footer className="vxa-footer">
        <span>VEXRYZER / PROCESS INTELLIGENCE</span>
        <span>{motionPolicy.reduced ? 'MOVIMENTO REDUZIDO' : 'MOVIMENTO INTENCIONAL'} · CANON SERVER-SIDE</span>
      </footer>
    </div>
  );
}
