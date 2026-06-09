import { useState } from 'react';
import { ShieldAlert, ShieldCheck, RefreshCw, AlertTriangle, Loader2, KeyRound, Copy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useSituacaoFinanceiraCadastro } from '@/hooks/useSituacaoFinanceiraCadastro';
import { usePermissions } from '@/hooks/usePermissions';
import { useRegistrarAvisoSGA } from '@/hooks/useRegistrarAvisoSGA';
import { registrarLog } from '@/hooks/useAuditLog';
import { toast } from 'sonner';

interface Props {
  contratoId?: string | null;
  solicitacaoTrocaId?: string | null;
  /** Callback notificando o pai sobre o estado de liberação. */
  onChange?: (liberado: boolean) => void;
}

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';

export function SituacaoFinanceiraGate({ contratoId, solicitacaoTrocaId, onChange }: Props) {
  const { data, isLoading, isError, reconsultar, bypass } =
    useSituacaoFinanceiraCadastro({ contratoId, solicitacaoTrocaId });
  const { isDiretor, isCoordenadorMonitoramento } = usePermissions();
  const podeBypass = !!(isDiretor || isCoordenadorMonitoramento);
  const registrarAviso = useRegistrarAvisoSGA();
  const [bypassOpen, setBypassOpen] = useState(false);
  const [bypassOrigem, setBypassOrigem] = useState<'inconclusivo' | 'inadimplente' | 'erro_consulta_sga'>('inadimplente');
  const [nomeAutorizador, setNomeAutorizador] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [responsabilidade, setResponsabilidade] = useState(false);

  const abrirBypass = (origem: 'inconclusivo' | 'inadimplente' | 'erro_consulta_sga') => {
    setBypassOrigem(origem);
    setNomeAutorizador('');
    setJustificativa('');
    setResponsabilidade(false);
    setBypassOpen(true);
  };

  // Notifica o pai
  const liberado = !!data?.liberado;
  // efeito leve via render (evita useEffect dependendo de onChange)
  if (data && onChange) {
    queueMicrotask(() => onChange(liberado));
  }

  const tituloDialog =
    bypassOrigem === 'inconclusivo'
      ? 'Bypass de verificação inconclusiva (auditado)'
      : bypassOrigem === 'erro_consulta_sga'
        ? 'Prosseguir sem consulta ao SGA (auditado)'
        : 'Bypass de inadimplência (auditado)';

  const descricaoDialog =
    bypassOrigem === 'inconclusivo'
      ? 'Confirme que verificou manualmente os boletos do CPF no painel SGA. Esta ação ficará registrada no histórico da proposta e na auditoria SGA.'
      : bypassOrigem === 'erro_consulta_sga'
        ? 'A consulta ao SGA falhou. Prossiga apenas se confirmou a situação financeira por outro meio. Esta ação ficará registrada no histórico da proposta e na auditoria SGA.'
        : 'O associado possui pendência financeira no SGA. A liberação manual ficará registrada no histórico da proposta e na auditoria SGA.';

  const placeholderJustificativa =
    bypassOrigem === 'inconclusivo'
      ? 'Ex.: verificado no painel SGA em todas as matrículas do CPF, sem boletos vencidos. Autorizado por gerente comercial em ligação.'
      : bypassOrigem === 'erro_consulta_sga'
        ? 'Ex.: SGA indisponível; situação confirmada pelo financeiro às 14h via WhatsApp, sem débitos em aberto.'
        : 'Ex.: pagamento confirmado por cópia de comprovante anexado ao protocolo X; autorizado pelo gerente comercial.';

  const bypassFormValido =
    nomeAutorizador.trim().length >= 3 &&
    justificativa.trim().length >= 20 &&
    responsabilidade;

  const onConfirmBypass = () => {
    if (!bypassFormValido) {
      toast.error('Preencha os campos obrigatórios', {
        description: 'Autorizador (≥3), justificativa (≥20) e confirmação de responsabilidade.',
      });
      return;
    }
    const motivoTrim = justificativa.trim();
    const autorizadorTrim = nomeAutorizador.trim();
    bypass.mutate({ motivo: motivoTrim, nome_autorizador: autorizadorTrim }, {
      onSuccess: async () => {
        try {
          await registrarAviso.mutateAsync({
            tipo: 'cadastro_situacao_financeira_pendente',
            titulo: `Bypass (${bypassOrigem}) no Cadastro`,
            mensagem:
              bypassOrigem === 'inadimplente'
                ? `Saldo devedor ${data?.check?.saldo_devedor ?? 0} (${data?.check?.qtd_boletos_abertos ?? 0} boleto(s)).`
                : bypassOrigem === 'inconclusivo'
                  ? 'Gate inconclusivo (SGA sem sinal). Verificado manualmente.'
                  : 'Consulta ao SGA falhou. Operador prosseguiu manualmente.',
            decisao: 'ignorado_prosseguiu',
            motivo: motivoTrim,
            contrato_id: contratoId ?? null,
            cpf: data?.check?.cpf ?? null,
            detalhes: {
              origem_resultado: bypassOrigem,
              nome_autorizador: autorizadorTrim,
              saldo_devedor: data?.check?.saldo_devedor,
              qtd_boletos_abertos: data?.check?.qtd_boletos_abertos,
              solicitacao_troca_id: solicitacaoTrocaId ?? null,
            },
          });
        } catch (e) {
          console.warn('[SituacaoFinanceiraGate] falha ao espelhar bypass em cotacao_avisos_sga', e);
        }
        try {
          await registrarLog({
            acao: 'aprovar',
            modulo: 'cotacoes',
            descricao: `[CADASTRO_BYPASS_FINANCEIRO] ${contratoId ?? solicitacaoTrocaId ?? '—'} (${bypassOrigem}) - Autorizado por ${autorizadorTrim}: ${motivoTrim}`,
            entidade_id: contratoId ?? solicitacaoTrocaId ?? undefined,
            tabela: contratoId ? 'contratos' : 'solicitacoes_troca_titularidade',
          });
        } catch (e) {
          console.warn('[SituacaoFinanceiraGate] falha ao gravar logs_auditoria', e);
        }
        toast.success('Bypass registrado — análise liberada');
        setBypassOpen(false);
        setNomeAutorizador('');
        setJustificativa('');
        setResponsabilidade(false);
      },
      onError: (e: any) => toast.error(e?.message || 'Falha ao registrar bypass'),
    });
  };

  const bypassDialog = (
    <Dialog open={bypassOpen} onOpenChange={setBypassOpen}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {tituloDialog}
          </DialogTitle>
          <DialogDescription>{descricaoDialog}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="bypass-fin-autorizador">Nome de quem autorizou *</Label>
            <input
              id="bypass-fin-autorizador"
              value={nomeAutorizador}
              onChange={(e) => setNomeAutorizador(e.target.value)}
              placeholder="Ex.: João Silva (Gerente Comercial)"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground">{nomeAutorizador.trim().length} / 3 caracteres mínimos</p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="bypass-fin-justificativa">Justificativa *</Label>
            <Textarea
              id="bypass-fin-justificativa"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder={placeholderJustificativa}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">{justificativa.trim().length} / 20 caracteres mínimos</p>
          </div>

          <label className="flex items-start gap-2 p-3 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 cursor-pointer">
            <input
              type="checkbox"
              checked={responsabilidade}
              onChange={(e) => setResponsabilidade(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-sm text-amber-900 dark:text-amber-100">
              Confirmo que tenho responsabilidade por esta decisão e que ela está autorizada por{' '}
              <strong>{nomeAutorizador.trim() || '— preencha o nome acima —'}</strong>.
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setBypassOpen(false)}>Cancelar</Button>
          <Button
            disabled={!bypassFormValido || bypass.isPending}
            onClick={onConfirmBypass}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {bypass.isPending ? 'Registrando…' : 'Confirmar bypass'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (isLoading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-4 flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold">Consultando situação financeira no SGA…</p>
            <p className="text-xs text-muted-foreground">Verificando boletos em aberto antes de liberar a análise.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <>
        <Card className="border-amber-500/40 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Não foi possível consultar o SGA
              </p>
              <p className="text-xs text-amber-800/80 dark:text-amber-200/70">
                Tente novamente para ter um diagnóstico atualizado. Sem uma consulta recente, a aprovação fica bloqueada.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button size="sm" variant="outline" onClick={() => reconsultar.mutate()} disabled={reconsultar.isPending}>
                <RefreshCw className={`h-4 w-4 mr-2 ${reconsultar.isPending ? 'animate-spin' : ''}`} />
                Tentar novamente
              </Button>
              {podeBypass && (
                <Button size="sm" variant="outline" onClick={() => abrirBypass('erro_consulta_sga')}>
                  <KeyRound className="h-4 w-4 mr-2" />
                  Ignorar e Prosseguir
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
        {bypassDialog}
      </>
    );
  }


  const check = data.check;
  const verificadoEm = new Date(check.verificado_em).toLocaleString('pt-BR');

  // Caso transitório / associado novo no SGA
  if (check.origem_resultado === 'transitorio' || check.origem_resultado === 'associado_inexistente_sga') {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-4 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-success" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Liberado para análise</p>
            <p className="text-xs text-muted-foreground">
              {check.origem_resultado === 'transitorio'
                ? `SGA temporariamente indisponível (${check.motivo ?? 'transitorio'}). Verificado em ${verificadoEm}.`
                : `Associado ainda não está cadastrado no SGA. Verificado em ${verificadoEm}.`}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => reconsultar.mutate()} disabled={reconsultar.isPending}>
            <RefreshCw className={`h-4 w-4 ${reconsultar.isPending ? 'animate-spin' : ''}`} />
          </Button>
        </CardContent>
      </Card>
    );
  }

  // INCONCLUSIVO — SGA respondeu mas não trouxe sinal suficiente (todos os
  // veículos com situacao_financeira=null e sem boletos vencidos). Hoje o
  // sistema tratava isso como "OK"; agora bloqueia para verificação manual.
  if ((check.origem_resultado as string) === 'inconclusivo') {
    return (
      <>
        <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  Verificação financeira inconclusiva
                </p>
                <p className="text-xs text-amber-800/80 dark:text-amber-200/70 mt-1">
                  O SGA respondeu, mas não trouxe sinal de situação financeira para os veículos
                  enumerados ({check.motivo || 'sem detalhes'}). Confira manualmente os boletos
                  do CPF no painel SGA antes de aprovar — boletos vencidos podem estar em outras
                  matrículas que esta consulta não capturou. Verificado em {verificadoEm}.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={() => reconsultar.mutate(undefined, {
                  onSuccess: (d) => {
                    if (d.liberado) toast.success('Verificação atualizada — análise liberada');
                    else toast.info('Ainda sem sinal financeiro suficiente no SGA');
                  },
                  onError: () => toast.error('Falha ao consultar SGA'),
                })}
                disabled={reconsultar.isPending}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${reconsultar.isPending ? 'animate-spin' : ''}`} />
                Consultar SGA novamente
              </Button>
              {podeBypass && (
                <Button size="sm" variant="outline" onClick={() => abrirBypass('inconclusivo')}>
                  <KeyRound className="h-4 w-4 mr-2" />
                  Ignorar e Prosseguir
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {bypassDialog}
      </>
    );
  }


  // Bypass anterior já liberou
  if (check.bypass) {
    return (
      <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
        <CardContent className="p-4 flex items-start gap-3">
          <KeyRound className="h-5 w-5 text-amber-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Liberado por decisão registrada
            </p>
            <p className="text-xs text-amber-800/80 dark:text-amber-200/70">
              Motivo: {check.bypass_motivo} · {verificadoEm}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Adimplente
  if (!check.tem_debito) {
    return (
      <Card className="border-success/40 bg-success/5">
        <CardContent className="p-4 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-success" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Situação financeira OK no SGA</p>
            <p className="text-xs text-muted-foreground">Sem boletos vencidos em aberto. Verificado em {verificadoEm}.</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => reconsultar.mutate()} disabled={reconsultar.isPending}>
            <RefreshCw className={`h-4 w-4 ${reconsultar.isPending ? 'animate-spin' : ''}`} />
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Inadimplente — bloqueio
  const boletos: any[] = (check.payload?.veiculos || [])
    .flatMap((v: any) => (v.boletos_abertos || []).map((b: any) => ({ ...b, placa: v.placa })))
    .filter((b: any) => {
      if (!b?.data_vencimento) return false;
      const d = new Date(b.data_vencimento);
      const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
      return d < hoje;
    })
    .sort((a: any, b: any) => (a.data_vencimento || '').localeCompare(b.data_vencimento || ''));

  // Veículos com situação INADIMPLENTE direto no SGA (independente de boletos detalhados)
  const veiculosInadimplentes: any[] = (check.payload?.veiculos || [])
    .filter((v: any) => String(v?.situacao_financeira || '').toUpperCase() === 'INADIMPLENTE');

  const copiar = async (texto: string, label = 'Linha digitável') => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(`${label} copiada`);
    } catch {
      toast.error('Falha ao copiar');
    }
  };

  return (
    <>
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-destructive">
                  Pendência financeira no SGA
                </p>
                {check.qtd_boletos_abertos > 0 && (
                  <Badge variant="destructive">{check.qtd_boletos_abertos} boleto(s) vencido(s)</Badge>
                )}
                {check.saldo_devedor > 0 && (
                  <Badge variant="outline" className="border-destructive/40 text-destructive">
                    Saldo: {formatBRL(check.saldo_devedor)}
                  </Badge>
                )}
                {veiculosInadimplentes.length > 0 && (
                  <Badge variant="destructive">
                    {veiculosInadimplentes.length} veículo(s) INADIMPLENTE(S) no SGA
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                A análise documental fica bloqueada até o associado regularizar.
                Verificado em {verificadoEm}.
              </p>
            </div>
          </div>

          {/* Veículos INADIMPLENTES sem boletos detalhados retornados */}
          {veiculosInadimplentes.length > 0 && boletos.length === 0 && (
            <div className="rounded border border-destructive/30 bg-background overflow-hidden">
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-1.5">Placa</th>
                      <th className="text-left px-3 py-1.5">Marca/Modelo</th>
                      <th className="text-left px-3 py-1.5">Situação SGA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {veiculosInadimplentes.map((v, i) => (
                      <tr key={i} className="border-t border-border/50">
                        <td className="px-3 py-1.5 font-mono">{v.placa || '—'}</td>
                        <td className="px-3 py-1.5">
                          {[v.marca, v.modelo].filter(Boolean).join(' ') || '—'}
                        </td>
                        <td className="px-3 py-1.5">
                          <Badge variant="destructive" className="text-[10px]">
                            {v.situacao_financeira}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground px-3 py-2 border-t border-border/50">
                O SGA não retornou os boletos individuais — o associado precisa abrir os boletos diretamente no SGA / app do associado para regularizar.
              </p>
            </div>
          )}

          {boletos.length > 0 && (
            <div className="rounded border border-destructive/30 bg-background overflow-hidden">
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-1.5">Placa</th>
                      <th className="text-left px-3 py-1.5">Vencimento</th>
                      <th className="text-right px-3 py-1.5">Valor</th>
                      <th className="text-left px-3 py-1.5">Situação</th>
                      <th className="text-left px-3 py-1.5">Linha digitável</th>
                    </tr>
                  </thead>
                  <tbody>
                    {boletos.slice(0, 20).map((b, i) => (
                      <tr key={i} className="border-t border-border/50">
                        <td className="px-3 py-1.5 font-mono">{b.placa || '—'}</td>
                        <td className="px-3 py-1.5">{formatDate(b.data_vencimento)}</td>
                        <td className="px-3 py-1.5 text-right">{formatBRL(Number(b.valor) || 0)}</td>
                        <td className="px-3 py-1.5">{b.situacao_label || '—'}</td>
                        <td className="px-3 py-1.5">
                          {b.linha_digitavel ? (
                            <button
                              type="button"
                              onClick={() => copiar(String(b.linha_digitavel))}
                              className="inline-flex items-center gap-1 font-mono text-[11px] hover:text-foreground text-muted-foreground"
                              title="Copiar linha digitável"
                            >
                              <Copy className="h-3 w-3" />
                              {String(b.linha_digitavel).slice(0, 14)}…
                            </button>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => reconsultar.mutate(undefined, {
                onSuccess: (d) => {
                  if (d.liberado) toast.success('Situação regularizada — análise liberada');
                  else toast.info('Ainda há pendências no SGA');
                },
                onError: () => toast.error('Falha ao consultar SGA'),
              })}
              disabled={reconsultar.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${reconsultar.isPending ? 'animate-spin' : ''}`} />
              Consultar SGA novamente
            </Button>
            {podeBypass && (
              <Button size="sm" variant="outline" onClick={() => abrirBypass('inadimplente')}>
                <KeyRound className="h-4 w-4 mr-2" />
                Ignorar e Prosseguir
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {bypassDialog}
    </>
  );
}

