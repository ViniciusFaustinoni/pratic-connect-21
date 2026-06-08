import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
// BRT manual formatting to avoid date-fns-tz dependency

export interface BypassAplicadoItem {
  codigo: string;
  nome_autorizador?: string | null;
  justificativa?: string | null;
  operador_nome?: string | null;
  operador_user_id?: string | null;
  aplicado_em?: string | null;
  solicitacao_troca_id?: string | null;
}

interface Props {
  bypassAplicado?: BypassAplicadoItem[] | null;
  /** Se true, aplica visual ainda mais chamativo (usado na tela de aprovação do Monitoramento). */
  destaque?: boolean;
  className?: string;
}

const CODIGO_LABEL: Record<string, string> = {
  JANELA_TROCA_EXPIRADA: 'Troca aprovada FORA DA JANELA canônica',
  TROCA_CONVERTIDA_EM_COTACAO: 'Troca convertida em cotação normal',
};

function formatarDataBRT(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

/**
 * Banner permanente que mostra qualquer bypass de janela / conversão aplicado
 * no contrato (jsonb contratos.bypass_aplicado). Renderizado em Cadastro,
 * Monitoramento, ModalDetalhesTroca e ficha do associado para que a decisão
 * fique visível ao longo de toda a vida do contrato.
 */
export function BypassAplicadoBanner({ bypassAplicado, destaque = false, className }: Props) {
  const lista = Array.isArray(bypassAplicado) ? bypassAplicado : [];
  if (lista.length === 0) return null;

  return (
    <div className={className}>
      {lista.map((item, idx) => {
        const label = CODIGO_LABEL[item.codigo] || item.codigo || 'Bypass aplicado';
        return (
          <Alert
            key={`${item.codigo}-${idx}`}
            className={
              destaque
                ? 'border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/30 mb-3 shadow-md'
                : 'border-amber-500/60 bg-amber-50 dark:bg-amber-950/20 mb-3'
            }
          >
            <AlertTriangle className={destaque ? 'h-5 w-5 text-amber-600' : 'h-4 w-4 text-amber-600'} />
            <AlertTitle className="text-amber-900 dark:text-amber-200 font-semibold">
              {destaque ? '⚠ ATENÇÃO — ' : ''}
              {label}
            </AlertTitle>
            <AlertDescription className="text-amber-900 dark:text-amber-100 space-y-1 mt-1">
              <div>
                <span className="font-medium">Autorizado por:</span>{' '}
                <strong>{item.nome_autorizador || '—'}</strong>
              </div>
              <div>
                <span className="font-medium">Operador (Cadastro):</span>{' '}
                {item.operador_nome || '—'}
              </div>
              <div>
                <span className="font-medium">Aplicado em:</span>{' '}
                {formatarDataBRT(item.aplicado_em)} (BRT)
              </div>
              {item.justificativa && (
                <div className="pt-1">
                  <span className="font-medium">Justificativa:</span>{' '}
                  <span className="italic">{item.justificativa}</span>
                </div>
              )}
            </AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
}

export default BypassAplicadoBanner;
