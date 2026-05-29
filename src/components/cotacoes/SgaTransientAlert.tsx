import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, WifiOff } from 'lucide-react';

interface SgaTransientAlertProps {
  motivo?: string | null;
  onRetry: () => void;
  loading?: boolean;
  /** Texto principal opcional (default: "SGA temporariamente indisponível"). */
  titulo?: string;
  /** Texto secundário opcional explicando contexto. */
  descricao?: string;
  className?: string;
  compact?: boolean;
}

/**
 * Banner âmbar reutilizável para sinalizar erros transitórios da API SGA (Hinova).
 * Usar SEMPRE que `useBuscaSGA` (ou seus wrappers) retornar `erro_transitorio: true`
 * em vez de afirmar "nenhum resultado" — assim o usuário não toma decisão errada.
 */
export function SgaTransientAlert({
  motivo,
  onRetry,
  loading = false,
  titulo = 'SGA temporariamente indisponível',
  descricao,
  className,
  compact = false,
}: SgaTransientAlertProps) {
  const motivoLegivel = (() => {
    if (!motivo) return null;
    switch (motivo) {
      case 'auth_falhou':
      case 'auth_invalida':
        return 'falha de autenticação no Hinova';
      case 'janela_horaria':
        return 'fora da janela de atendimento do Hinova';
      case 'rate_limit':
        return 'limite de requisições do Hinova atingido';
      case 'timeout':
        return 'tempo esgotado na resposta do Hinova';
      case 'erro_inesperado':
        return 'erro inesperado no Hinova';
      default:
        return motivo;
    }
  })();

  return (
    <Alert
      className={[
        'border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700',
        className || '',
      ].join(' ')}
    >
      <WifiOff className="h-4 w-4 text-amber-600" />
      <AlertDescription className="text-sm text-amber-900 dark:text-amber-200 space-y-2">
        <div>
          <p className="font-medium">{titulo}</p>
          {!compact && (
            <p className="text-xs mt-0.5">
              {descricao ||
                'Não foi possível confirmar agora se este CPF/placa tem cadastro no SGA. Não significa que não exista — tente novamente em instantes.'}
              {motivoLegivel ? <span className="ml-1 opacity-80">({motivoLegivel})</span> : null}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1 border-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40"
          onClick={onRetry}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Reconsultando…
            </>
          ) : (
            <>
              <RefreshCw className="h-3 w-3" />
              Tentar novamente
            </>
          )}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
