import { useCallback, useEffect, useMemo } from 'react';
import { useMachine } from '@xstate/react';
import { motion } from 'motion/react';
import { appMachine, type AppMachineEvent } from './app-machine.ts';
import { transitionExperience, type ExperienceMode } from './experience-state.ts';
import { decodeViewState, encodeViewState } from './view-state.ts';
import { AutomationCanvas } from '../canvas/AutomationCanvas.tsx';
import { processFixtures, type ProcessFixture } from '../canvas/fixtures.ts';
import { useReducedMotionPolicy } from '../accessibility/useReducedMotionPolicy.ts';
import { usePerformanceInstrumentation } from '../performance/usePerformanceInstrumentation.ts';
import './app.css';

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
  const mode: ExperienceMode = snapshot.matches('origin') ? 'origin' : snapshot.matches('process') ? 'process' : 'focus';
  const focusedNodeId = snapshot.context.focusedNodeId;
  const validNodeIds = useMemo(() => fixture.graph.nodes.map((node) => node.id), [fixture]);

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
    const current = { mode, focusedNodeId };
    const next = transitionExperience(current, event);
    send(event);
    const hash = encodeViewState(next);
    if (hash !== window.location.hash) history.pushState(null, '', `${location.pathname}${location.search}${hash}`);
  }, [focusedNodeId, mode, send]);

  const focusedIndex = fixture.graph.nodes.findIndex((node) => node.id === focusedNodeId);
  const focusByIndex = (index: number) => {
    const node = fixture.graph.nodes[index];
    if (node) navigate({ type: 'FOCUS_NODE', nodeId: node.id });
  };

  return (
    <div className="vxa-shell" data-motion={motionPolicy.reduced ? 'reduced' : 'standard'}>
      <a className="vxa-skip" href="#vxa-primary">Ir para a experiência</a>
      <header className="vxa-header">
        <a className="vxa-brand" href="/" aria-label="Vexryzer Automation — início">
          <span className="vxa-brand__mark" aria-hidden="true">V</span>
          <span>VEXRYZER <b>AUTOMATION</b></span>
        </a>
        <div className="vxa-header__meta">
          <span>PROCESS INTELLIGENCE</span>
          <span className="vxa-status-dot">DEMONSTRAÇÃO VISUAL</span>
        </div>
      </header>

      <main id="vxa-primary" className="vxa-main" tabIndex={-1}>
        <section className="vxa-intro" aria-labelledby="vxa-title">
          <motion.div
            className="vxa-intro__copy"
            initial={{ y: motionPolicy.reduced ? 0 : 14 }}
            animate={{ y: 0 }}
            transition={{ duration: motionPolicy.reduced ? 0.09 : 0.45 }}
          >
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
              <span className="vxa-actions__note">Experiência visual · interação local sem envio de dados</span>
            </div>
          </motion.div>

          <aside className="vxa-principle" aria-label="Princípio da experiência">
            <span>01 / ENTENDER</span>
            <p>Primeiro o processo fica visível. Inteligência, valor e evidência entram depois — sem reescrever a interação.</p>
          </aside>
        </section>

        <section className="vxa-stage" aria-label="Infinite Canvas">
          <AutomationCanvas
            fixture={fixture}
            mode={mode}
            focusedNodeId={focusedNodeId}
            motionPolicy={motionPolicy}
            onFocusNode={(nodeId) => mode !== 'origin' && navigate({ type: 'FOCUS_NODE', nodeId })}
          />

          <nav className="vxa-director" aria-label="Navegação dirigida do processo">
            <div className="vxa-director__heading">
              <span>PROCESSO</span>
              <strong>{mode === 'origin' ? 'Pronto para revelar' : `${fixture.graph.nodes.length} etapas mapeadas`}</strong>
            </div>
            <div className="vxa-director__steps">
              {mode === 'origin' ? (
                <p className="vxa-empty">As etapas aparecem quando você entra no processo. O Canvas não exige gesto ou conhecimento técnico para começar.</p>
              ) : fixture.graph.nodes.length === 0 ? (
                <p className="vxa-empty">Este cenário não contém etapas. Você pode voltar à origem e explorar outro processo.</p>
              ) : fixture.graph.nodes.map((node, index) => (
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
            {mode === 'focus' && fixture.graph.nodes.length > 0 ? (
              <div className="vxa-director__controls">
                <button type="button" onClick={() => focusByIndex(Math.max(0, focusedIndex - 1))} disabled={focusedIndex <= 0}>Anterior</button>
                <button type="button" onClick={() => navigate({ type: 'EXIT_FOCUS' })}>Ver processo</button>
                <button type="button" onClick={() => focusByIndex(Math.min(fixture.graph.nodes.length - 1, focusedIndex + 1))} disabled={focusedIndex >= fixture.graph.nodes.length - 1}>Próxima</button>
              </div>
            ) : null}
          </nav>
        </section>
      </main>

      <footer className="vxa-footer">
        <span>VEXRYZER / PROCESS INTELLIGENCE</span>
        <span>{motionPolicy.reduced ? 'MOVIMENTO REDUZIDO' : 'MOVIMENTO INTENCIONAL'} · INTERAÇÃO LOCAL</span>
      </footer>
    </div>
  );
}
