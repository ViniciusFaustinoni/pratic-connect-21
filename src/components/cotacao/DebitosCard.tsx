import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Ban, Copy, ExternalLink, Check } from 'lucide-react';
import { toast } from 'sonner';
import { formatarMoeda } from '@/utils/format';
import type { DebitoVeiculo } from '@/hooks/useVerificarDebitosAssociado';

interface DebitosCardProps {
  debitos: DebitoVeiculo[];
  saldoTotal: number;
  /** Quando true, exibe variante destrutiva (bloqueio); senão variante warning. */
  bloqueante?: boolean;
  /** Texto opcional substituindo o título padrão. */
  titulo?: string;
  /** Texto adicional explicativo (subtítulo). */
  descricao?: string;
}

/**
 * Card reusável para exibir débitos em aberto vindos do SGA.
 * Mostra cada boleto com botão de copiar linha digitável e abrir boleto.
 */
export function DebitosCard({
  debitos,
  saldoTotal,
  bloqueante = true,
  titulo,
  descricao,
}: DebitosCardProps) {
  const [copiado, setCopiado] = useState<string | null>(null);

  if (!debitos || debitos.length === 0) return null;

  const handleCopy = async (linha: string, key: string) => {
    try {
      await navigator.clipboard.writeText(linha);
      setCopiado(key);
      toast.success('Linha digitável copiada');
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  const Icon = bloqueante ? Ban : AlertTriangle;
  const tituloFinal =
    titulo ||
    (bloqueante
      ? 'Inclusão bloqueada — saldo devedor encontrado no SGA'
      : 'Atenção — saldo devedor encontrado no SGA');

  return (
    <Alert
      variant={bloqueante ? 'destructive' : 'default'}
      className={
        bloqueante
          ? 'border-destructive/50 bg-destructive/10'
          : 'border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-700'
      }
    >
      <Icon className={bloqueante ? 'h-4 w-4' : 'h-4 w-4 text-yellow-600'} />
      <AlertDescription
        className={
          bloqueante
            ? 'text-sm space-y-3'
            : 'text-sm text-yellow-800 dark:text-yellow-300 space-y-3'
        }
      >
        <div>
          <p className="font-medium">{tituloFinal}</p>
          {descricao && <p className="mt-1">{descricao}</p>}
          <p className="mt-1">
            Saldo total devedor: <strong>{formatarMoeda(saldoTotal)}</strong>
          </p>
        </div>

        <div className="space-y-3">
          {debitos.map((d, i) => (
            <div
              key={`${d.placa}-${i}`}
              className="rounded-md border border-border/50 bg-background/40 p-3 space-y-2"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-sm">
                  <strong className="text-foreground">
                    {d.marca} {d.modelo}
                  </strong>
                  <span className="text-muted-foreground"> · Placa </span>
                  <Badge variant="outline" className="text-xs uppercase">
                    {d.placa}
                  </Badge>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">{d.quantidade} boleto(s) · </span>
                  <strong>{formatarMoeda(d.total)}</strong>
                </div>
              </div>

              {d.boletos.length > 0 && (
                <ul className="space-y-1.5">
                  {d.boletos.map((b, j) => {
                    const key = `${i}-${j}`;
                    const venc = b.data_vencimento
                      ? new Date(b.data_vencimento).toLocaleDateString('pt-BR')
                      : '—';
                    return (
                      <li
                        key={b.nosso_numero || key}
                        className="flex items-center justify-between gap-2 text-xs flex-wrap"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Badge variant="secondary" className="text-[10px]">
                            {b.situacao_label}
                          </Badge>
                          <span className="text-muted-foreground">Venc. {venc}</span>
                          <span className="font-medium text-foreground">
                            {formatarMoeda(b.valor)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {b.linha_digitavel && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => handleCopy(b.linha_digitavel!, key)}
                            >
                              {copiado === key ? (
                                <>
                                  <Check className="h-3 w-3" />
                                  Copiado
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  Copiar linha
                                </>
                              )}
                            </Button>
                          )}
                          {b.link_boleto && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              asChild
                            >
                              <a
                                href={b.link_boleto}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Boleto
                              </a>
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>

        {bloqueante && (
          <p className="text-xs">
            É necessário quitar todos os boletos antes de prosseguir com a contratação.
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
