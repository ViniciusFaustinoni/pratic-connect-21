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
    // Erros de "removeChild" são causados por scripts externos (ex: Lovable preview token)
    // manipulando o DOM. Não são erros reais da aplicação — ignorar silenciosamente.
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('removeChild') || msg.includes('insertBefore') || msg.includes('The node to be removed is not a child')) {
      return { hasError: false };
    }
    return {
      hasError: true,
      message: msg,
    };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    const msg = error instanceof Error ? error.message : String(error);
    // Ignorar erros de DOM causados por scripts externos
    if (msg.includes('removeChild') || msg.includes('insertBefore') || msg.includes('The node to be removed is not a child')) {
      // eslint-disable-next-line no-console
      console.warn("[AppErrorBoundary] Ignored DOM manipulation error (likely external script):", msg);
      return;
    }
    // Log detalhado para diagnóstico
    const stack = error instanceof Error ? error.stack : undefined;
    // eslint-disable-next-line no-console
    console.error("[AppErrorBoundary] error:", msg);
    if (stack) console.error("[AppErrorBoundary] stack:", stack);
    console.error("[AppErrorBoundary] componentStack:", errorInfo.componentStack);
    const invariantMatch = msg.match(/Minified React error #(\d+)/);
    if (invariantMatch) {
      console.error(`[AppErrorBoundary] React error decoder: https://react.dev/errors/${invariantMatch[1]}`);
    }

    // Auto-retry único: erros transitórios de primeira render (ex.: race de hidratação,
    // chunk lazy stale após deploy) costumam se resolver com um reload. Só tentamos uma
    // vez por janela de 60s para evitar loop.
    try {
      const RETRY_KEY = 'app-eb-retried-at';
      const last = Number(sessionStorage.getItem(RETRY_KEY) || '0');
      const now = Date.now();
      if (!last || now - last > 60_000) {
        sessionStorage.setItem(RETRY_KEY, String(now));
        // Pequeno delay para garantir que o log seja flushado antes do reload.
        setTimeout(() => window.location.reload(), 150);
      }
    } catch {
      // sessionStorage indisponível — segue sem auto-retry.
    }
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
