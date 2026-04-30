import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';

interface Props {
  associadoId?: string;
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  error: Error | null;
  componentStack: string | null;
}

/**
 * Error boundary local para a tela de detalhe do associado.
 * Captura crashes (incluindo "Rendered more hooks than during the previous render"),
 * mostra mensagem amigável e permite copiar diagnóstico.
 */
export class AssociadoDetalheErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Log estruturado para facilitar debug em produção
    console.error('[AssociadoDetalheErrorBoundary]', {
      associadoId: this.props.associadoId,
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
    this.setState({ componentStack: info.componentStack });
  }

  private handleReset = () => {
    this.setState({ error: null, componentStack: null });
    this.props.onReset?.();
  };

  private handleCopyDiagnostic = async () => {
    const { error, componentStack } = this.state;
    const payload = [
      `Associado ID: ${this.props.associadoId ?? '(desconhecido)'}`,
      `Erro: ${error?.message ?? '(sem mensagem)'}`,
      '',
      'Stack:',
      error?.stack ?? '(sem stack)',
      '',
      'Component stack:',
      componentStack ?? '(indisponível)',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(payload);
      toast.success('Diagnóstico copiado para a área de transferência');
    } catch {
      toast.error('Não foi possível copiar — abra o console do navegador');
    }
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="p-4">
        <Alert variant="destructive" className="border-destructive/50">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Falha ao carregar este associado</AlertTitle>
          <AlertDescription className="space-y-3">
            <p className="text-sm">
              Ocorreu um erro ao montar a tela. Os demais associados não são afetados.
            </p>
            <p className="text-xs font-mono bg-destructive/10 rounded p-2 break-all">
              {this.state.error.message}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={this.handleReset}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Tentar novamente
              </Button>
              <Button size="sm" variant="ghost" onClick={this.handleCopyDiagnostic}>
                <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar diagnóstico
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }
}
