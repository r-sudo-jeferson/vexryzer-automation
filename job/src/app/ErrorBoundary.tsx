import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { failed: boolean }

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) console.error('VXA render boundary', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="vxa-fatal" role="alert">
        <span>RECUPERAÇÃO DA EXPERIÊNCIA</span>
        <h1>A experiência visual encontrou um problema.</h1>
        <p>Nenhuma informação foi enviada ou perdida. Reinicie a experiência para voltar a um estado seguro da visualização.</p>
        <button type="button" onClick={() => window.location.replace(window.location.pathname)}>Reiniciar experiência</button>
      </main>
    );
  }
}
