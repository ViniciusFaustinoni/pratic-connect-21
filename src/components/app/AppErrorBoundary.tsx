import React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  message?: string;
};

/**
 * Captura erros de render (incluindo loops que disparam "Maximum update depth").
 * Loga o componentStack para facilitar identificar o componente causador.
 */
export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    // Mantém logs bem explícitos para acharmos o componente que está causando o loop.
    // eslint-disable-next-line no-console
    console.error("[AppErrorBoundary] error:", error);
    // eslint-disable-next-line no-console
    console.error("[AppErrorBoundary] componentStack:", errorInfo.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-xl w-full rounded-lg border bg-card p-6 text-card-foreground">
          <h1 className="text-lg font-semibold">Ocorreu um erro ao carregar a página</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {this.state.message || "Erro inesperado"}
          </p>
          <button
            onClick={this.handleReload}
            className="mt-4 inline-flex h-9 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium"
            type="button"
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}
