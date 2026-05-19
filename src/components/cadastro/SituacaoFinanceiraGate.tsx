import { useState } from 'react';
import { ShieldAlert, ShieldCheck, RefreshCw, AlertTriangle, Loader2, KeyRound, Copy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useSituacaoFinanceiraCadastro } from '@/hooks/useSituacaoFinanceiraCadastro';
import { usePermissions } from '@/hooks/usePermissions';
import { useRegistrarAvisoSGA } from '@/hooks/useRegistrarAvisoSGA';
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
  const { isDiretor } = usePermissions();
  const registrarAviso = useRegistrarAvisoSGA();
  const [bypassOpen, setBypassOpen] = useState(false);
  const [motivo, setMotivo] = useState('');

  // Notifica o pai
  const liberado = !!data?.liberado;
  // efeito leve via render (evita useEffect dependendo de onChange)
  if (data && onChange) {
    queueMicrotask(() => onChange(liberado));
  }

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
      <Card className="border-amber-500/40 bg-amber-50 dark:bg-amber-950/20">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Não foi possível consultar o SGA
            </p>
            <p className="text-xs text-amber-800/80 dark:text-amber-200/70">
              A análise pode prosseguir, mas tente novamente para ter um diagnóstico atualizado.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => reconsultar.mutate()} disabled={reconsultar.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${reconsultar.isPending ? 'animate-spin' : ''}`} />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
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
  if (check.origem_resultado === 'inconclusivo') {
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
              <Button size="sm" variant="outline" onClick={() => setBypassOpen(true)}>
                <KeyRound className="h-4 w-4 mr-2" />
                Ignorar e Prosseguir
              </Button>
            </div>
          </CardContent>
        </Card>

        <Dialog open={bypassOpen} onOpenChange={setBypassOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bypass de verificação inconclusiva (auditado)</DialogTitle>
              <DialogDescription>
                Confirme que verificou manualmente os boletos do CPF no painel SGA.
                Esta ação será registrada com seu nome.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: verificado no SGA, sem boletos vencidos em nenhuma matrícula…"
              rows={4}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setBypassOpen(false)}>Cancelar</Button>
              <Button
                disabled={motivo.trim().length < 5 || bypass.isPending}
                onClick={() =>
                  bypass.mutate(motivo.trim(), {
                    onSuccess: async () => {
                      try {
                        await registrarAviso.mutateAsync({
                          tipo: 'cadastro_situacao_financeira_pendente',
                          titulo: 'Bypass de verificação inconclusiva no Cadastro',
                          mensagem: 'Gate inconclusivo (SGA sem sinal). Verificado manualmente.',
                          decisao: 'ignorado_prosseguiu',
                          motivo: motivo.trim(),
                          contrato_id: contratoId ?? null,
                          cpf: data?.check?.cpf ?? null,
                          detalhes: {
                            origem_resultado: 'inconclusivo',
                            solicitacao_troca_id: solicitacaoTrocaId ?? null,
                          },
                        });
                      } catch (e) {
                        console.warn('[SituacaoFinanceiraGate] falha ao espelhar bypass em cotacao_avisos_sga', e);
                      }
                      toast.success('Bypass registrado — análise liberada');
                      setBypassOpen(false);
                      setMotivo('');
                    },
                    onError: (e: any) => toast.error(e?.message || 'Falha ao registrar bypass'),
                  })
                }
              >
                Confirmar bypass
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
            <Button size="sm" variant="outline" onClick={() => setBypassOpen(true)}>
              <KeyRound className="h-4 w-4 mr-2" />
              Ignorar e Prosseguir
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={bypassOpen} onOpenChange={setBypassOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bypass de inadimplência (auditado)</DialogTitle>
            <DialogDescription>
              Esta ação será registrada com seu nome e ficará disponível na auditoria SGA.
              Descreva o motivo da liberação manual.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: pagamento confirmado por cópia de comprovante anexado…"
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBypassOpen(false)}>Cancelar</Button>
            <Button
              disabled={motivo.trim().length < 5 || bypass.isPending}
              onClick={() =>
                bypass.mutate(motivo.trim(), {
                  onSuccess: async () => {
                    // Registrar também em cotacao_avisos_sga para o histórico ir pro SGA
                    try {
                      await registrarAviso.mutateAsync({
                        tipo: 'cadastro_situacao_financeira_pendente',
                        titulo: 'Bypass de inadimplência no Cadastro',
                        mensagem: `Saldo devedor ${data?.check?.saldo_devedor ?? 0} (${data?.check?.qtd_boletos_abertos ?? 0} boleto(s)).`,
                        decisao: 'ignorado_prosseguiu',
                        motivo: motivo.trim(),
                        contrato_id: contratoId ?? null,
                        cpf: data?.check?.cpf ?? null,
                        detalhes: {
                          saldo_devedor: data?.check?.saldo_devedor,
                          qtd_boletos_abertos: data?.check?.qtd_boletos_abertos,
                          solicitacao_troca_id: solicitacaoTrocaId ?? null,
                        },
                      });
                    } catch (e) {
                      console.warn('[SituacaoFinanceiraGate] falha ao espelhar bypass em cotacao_avisos_sga', e);
                    }
                    toast.success('Bypass registrado — análise liberada');
                    setBypassOpen(false);
                    setMotivo('');
                  },
                  onError: (e: any) => toast.error(e?.message || 'Falha ao registrar bypass'),
                })
              }
            >
              Confirmar bypass
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
