import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Ban, Copy, ExternalLink, Check, RefreshCw, Loader2 } from 'lucide-react';
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
  /** CPF (11 dígitos) ou UUID do associado — usado para reconsultar o SGA na hora.
   * Se vier UUID, o componente lê o CPF do cache da query `['associado-cpf-from-uuid', uuid]`
   * (já preenchida pelo hook `useVerificarDebitosAssociado`). */
  cpf?: string;
  /** Callback opcional disparado quando uma reverificação confirma quitação (parcial ou total). */
  onAtualizado?: (info: { totalAntes: number; totalDepois: number }) => void;
}

/**
 * Card reusável para exibir débitos em aberto vindos do SGA.
 * Mostra cada boleto com botão de copiar linha digitável, abrir boleto e
 * **verificar pagamento agora** (consulta o SGA na hora, sem esperar o cron).
 */
export function DebitosCard({
  debitos,
  saldoTotal,
  bloqueante = true,
  titulo,
  descricao,
  cpf,
  onAtualizado,
}: DebitosCardProps) {
  const qc = useQueryClient();
  const [copiado, setCopiado] = useState<string | null>(null);
  const [verificandoKey, setVerificandoKey] = useState<string | null>(null);
  const [verificandoTodos, setVerificandoTodos] = useState(false);
  // Snapshot dos nossos_numeros antes da reverificação, para detectar quais sumiram
  const snapshotRef = useRef<Set<string>>(new Set());

  if (!debitos || debitos.length === 0) return null;

  // Resolve cpf — pode vir CPF direto ou UUID (lê do cache do hook useVerificarDebitosAssociado)
  const isUuid = !!cpf && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cpf);
  const cpfDoCache = isUuid ? (qc.getQueryData(['associado-cpf-from-uuid', cpf]) as string | undefined) : undefined;
  const cpfLimpo = ((isUuid ? cpfDoCache : cpf) || '').replace(/\D/g, '');
  const podeVerificar = cpfLimpo.length === 11;

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

  const reconsultarSGA = async () => {
    // A chave usada pelo useBuscaSGA é ['sga-busca', cpf, placa]
    await qc.invalidateQueries({ queryKey: ['sga-busca', cpfLimpo] });
    // Pequena espera para o refetch propagar antes de avaliar
    await new Promise((r) => setTimeout(r, 600));
  };

  const totalAntes = saldoTotal;

  const handleVerificarBoleto = async (nossoNumero: string | null, key: string) => {
    if (!podeVerificar) {
      toast.error('CPF não disponível para reconsulta no SGA');
      return;
    }
    setVerificandoKey(key);
    snapshotRef.current = new Set(
      debitos.flatMap((d) => d.boletos.map((b) => b.nosso_numero || '').filter(Boolean))
    );
    try {
      await reconsultarSGA();

      // Lê a query atualizada do cache para checar se o boleto sumiu
      const cacheData: any = qc.getQueryData(['sga-busca', cpfLimpo, '']);
      const aindaAberto = (() => {
        if (!nossoNumero) return null; // sem nosso_numero, não dá pra confirmar individualmente
        const veics = (cacheData?.veiculos || []) as any[];
        for (const v of veics) {
          for (const b of v?.boletos_abertos || []) {
            if (b?.nosso_numero === nossoNumero) return true;
          }
        }
        return false;
      })();

      if (aindaAberto === false) {
        toast.success('Boleto quitado! Liberando o fluxo.');
      } else if (aindaAberto === true) {
        toast.info('Pagamento ainda não identificado no SGA. Tente novamente em alguns minutos.');
      } else {
        toast.info('Reconsulta concluída. Veja a lista atualizada.');
      }

      const novoTotal = Number(cacheData?.saldo_devedor_total ?? totalAntes);
      onAtualizado?.({ totalAntes, totalDepois: novoTotal });
    } catch (e) {
      console.error('[DebitosCard] erro ao verificar boleto:', e);
      toast.error('Falha ao reconsultar o SGA');
    } finally {
      setVerificandoKey(null);
    }
  };

  const handleVerificarTodos = async () => {
    if (!podeVerificar) {
      toast.error('CPF não disponível para reconsulta no SGA');
      return;
    }
    setVerificandoTodos(true);
    try {
      await reconsultarSGA();
      const cacheData: any = qc.getQueryData(['sga-busca', cpfLimpo, '']);
      const novoTotal = Number(cacheData?.saldo_devedor_total ?? totalAntes);
      if (novoTotal <= 0.01) {
        toast.success('Todos os boletos foram quitados!');
      } else if (novoTotal < totalAntes) {
        toast.success(
          `Saldo atualizado: ${formatarMoeda(novoTotal)} (antes ${formatarMoeda(totalAntes)})`
        );
      } else {
        toast.info('Pagamento ainda não identificado no SGA. Tente novamente em alguns minutos.');
      }
      onAtualizado?.({ totalAntes, totalDepois: novoTotal });
    } catch (e) {
      console.error('[DebitosCard] erro ao verificar todos:', e);
      toast.error('Falha ao reconsultar o SGA');
    } finally {
      setVerificandoTodos(false);
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
                <ul className="space-y-2">
                  {d.boletos.map((b, j) => {
                    const key = `${i}-${j}`;
                    const venc = b.data_vencimento
                      ? new Date(b.data_vencimento).toLocaleDateString('pt-BR')
                      : '—';
                    const isVerificando = verificandoKey === key;
                    return (
                      <li
                        key={b.nosso_numero || key}
                        className="rounded border border-border/40 bg-background/40 p-2 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Badge variant="secondary" className="text-[10px]">
                              {b.situacao_label}
                            </Badge>
                            <span className="text-muted-foreground">Venc. {venc}</span>
                            <span className="font-medium text-foreground">
                              {formatarMoeda(b.valor)}
                            </span>
                          </div>
                        </div>

                        {b.linha_digitavel && (
                          <div className="font-mono text-[11px] break-all bg-background/60 rounded px-2 py-1 border border-border/30">
                            {b.linha_digitavel}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-1.5">
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
                          {podeVerificar && (
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              disabled={isVerificando || verificandoTodos}
                              onClick={() => handleVerificarBoleto(b.nosso_numero, key)}
                            >
                              {isVerificando ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Verificando…
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="h-3 w-3" />
                                  Verificar pagamento
                                </>
                              )}
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

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <p className="text-xs">
            {bloqueante
              ? 'Após pagar, clique em '
              : 'Pagou? Clique em '}
            <strong>Verificar pagamento</strong>
            {' para liberar o fluxo na hora — sem esperar até o próximo dia.'}
          </p>
          {podeVerificar && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              disabled={verificandoTodos || !!verificandoKey}
              onClick={handleVerificarTodos}
            >
              {verificandoTodos ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Verificando todos…
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3" />
                  Verificar todos
                </>
              )}
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
