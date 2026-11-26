import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/** Mostra uma tela amigável se algum componente falhar, em vez de uma página em branco. */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error("[SunHost]", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-screen">
          <div>
            <span className="eyebrow">Algo saiu do roteiro</span>
            <h1>Ops! Não foi possível mostrar esta página.</h1>
            <p>Tente recarregar. Se o problema continuar, volte para o início.</p>
            {this.state.error?.message && <pre>{this.state.error.message}</pre>}
            <div className="form-actions">
              <button className="btn btn-primary" onClick={() => window.location.reload()}>
                Recarregar
              </button>
              <a className="btn btn-outline" href="/">
                Ir para o início
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
