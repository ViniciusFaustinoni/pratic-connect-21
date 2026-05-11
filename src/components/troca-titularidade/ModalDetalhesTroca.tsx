import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Car, User, FileSignature, CheckCircle2, XCircle, Send, ClipboardCheck, ShieldCheck, ExternalLink, AlertTriangle, Search } from 'lucide-react';
import { useSolicitacaoTroca, useAprovarTrocaCadastro, useAprovarTrocaMonitoramento, useReprovarTroca, useEnviarTermoCancelamento, type StatusTroca } from '@/hooks/useSolicitacoesTroca';
import { TimelineAprovacao } from './TimelineAprovacao';
import { RelatorioFinanceiroAntigo } from './RelatorioFinanceiroAntigo';
import { MiniCardVistoriaTroca } from './MiniCardVistoriaTroca';
import { VeiculoCompletoCard } from './VeiculoCompletoCard';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { formatCPF, formatPhone } from '@/types/termo-filiacao';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  solicitacaoId: string | null;
  modo: 'cadastro' | 'monitoramento' | 'readonly';
}

const STATUS_LABELS: Record<StatusTroca, { label: string; variant: 'default'|'secondary'|'destructive'|'outline' }> = {
  cotacao_em_andamento: { label: 'Cotação em andamento', variant: 'outline' },
  aguardando_cadastro: { label: 'Aguardando Cadastro', variant: 'secondary' },
  aguardando_monitoramento: { label: 'Aguardando Monitoramento', variant: 'secondary' },
  aguardando_vistoria: { label: 'Em Vistoria', variant: 'secondary' },
  liberada_para_assinatura: { label: 'Liberada p/ Assinatura', variant: 'default' },
  efetivada: { label: 'Efetivada', variant: 'default' },
  reprovada_cadastro: { label: 'Reprovada (Cadastro)', variant: 'destructive' },
  reprovada_monitoramento: { label: 'Reprovada (Monitoramento)', variant: 'destructive' },
  cancelada: { label: 'Cancelada', variant: 'destructive' },
};

export function ModalDetalhesTroca({ open, onOpenChange, solicitacaoId, modo }: Props) {
  const { data: solicitacao, isLoading } = useSolicitacaoTroca(solicitacaoId || undefined);
  const [observacao, setObservacao] = useState('');
  const [motivoReprovar, setMotivoReprovar] = useState('');
  const [confirmandoReprovar, setConfirmandoReprovar] = useState(false);

  const aprovarCadastro = useAprovarTrocaCadastro();
  const aprovarMonitoramento = useAprovarTrocaMonitoramento();
  const reprovar = useReprovarTroca();
  const enviarTermo = useEnviarTermoCancelamento();

  // Débito pendente do antigo (gate da aprovação do Cadastro)
  const { data: debitoPendente } = useQuery({
    queryKey: ['troca-debito-antigo', solicitacao?.associado_antigo_id],
    queryFn: async () => {
      if (!solicitacao?.associado_antigo_id) return null;
      const { data } = await (supabase as any)
        .from('relacionamento_debitos_pendentes')
        .select('id, valor_total, quantidade_boletos, status')
        .eq('associado_id', solicitacao.associado_antigo_id)
        .eq('status', 'aberto')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: open && !!solicitacao?.associado_antigo_id && modo === 'cadastro',
    refetchInterval: 30000,
  });

  const handleAprovar = async () => {
    if (!solicitacao) return;
    if (modo === 'cadastro') {
      await aprovarCadastro.mutateAsync({ solicitacao_id: solicitacao.id, observacao });
    } else {
      await aprovarMonitoramento.mutateAsync({ solicitacao_id: solicitacao.id, acao: 'aprovar', observacao });
    }
    onOpenChange(false);
  };

  const handleSolicitarVistoria = async () => {
    if (!solicitacao) return;
    await aprovarMonitoramento.mutateAsync({ solicitacao_id: solicitacao.id, acao: 'solicitar_vistoria', observacao });
    onOpenChange(false);
  };

  const handleReprovar = async () => {
    if (!solicitacao || !motivoReprovar.trim() || modo === 'readonly') return;
    await reprovar.mutateAsync({ solicitacao_id: solicitacao.id, motivo: motivoReprovar, etapa: modo });
    onOpenChange(false);
  };

  const podeAgir = solicitacao && modo !== 'readonly' && (
    (modo === 'cadastro' && solicitacao.status === 'aguardando_cadastro') ||
    (modo === 'monitoramento' && solicitacao.status === 'aguardando_monitoramento')
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Solicitação de Troca de Titularidade</DialogTitle>
          <DialogDescription>
            {modo === 'cadastro' ? 'Análise pelo Cadastro' : modo === 'monitoramento' ? 'Análise pelo Monitoramento' : 'Acompanhamento da solicitação'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3"><Skeleton className="h-32 w-full" /><Skeleton className="h-40 w-full" /></div>
        ) : !solicitacao ? (
          <p className="text-muted-foreground">Solicitação não encontrada</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <Badge variant={STATUS_LABELS[solicitacao.status].variant}>
                {STATUS_LABELS[solicitacao.status].label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Criada em {new Date(solicitacao.created_at).toLocaleString('pt-BR')}
              </span>
            </div>

            {/* Próximo passo — só faz sentido enquanto a solicitação ainda está abrindo */}
            {solicitacao.status === 'cotacao_em_andamento' && (() => {
              const termoEnviado = !!solicitacao.termo_cancelamento_enviado_em;
              const termoAssinado = !!solicitacao.termo_cancelamento_assinado_em;
              const titulo = !termoEnviado
                ? 'Próximo passo: enviar Termo de Cancelamento'
                : !termoAssinado
                ? 'Aguardando assinatura do termo pelo titular antigo'
                : 'Aguardando processamento';
              const descricao = !termoEnviado
                ? `O Cadastro precisa abrir a aba "Termo" e enviar o Termo de Cancelamento via Autentique para ${solicitacao.associado_antigo?.nome || 'o titular antigo'}. Assim que ele assinar (biometria facial), a solicitação cai automaticamente em "Aguardando Cadastro" e o botão Aprovar libera neste mesmo drawer.`
                : !termoAssinado
                ? `Termo enviado em ${solicitacao.termo_cancelamento_enviado_em ? new Date(solicitacao.termo_cancelamento_enviado_em).toLocaleString('pt-BR') : '-'}. Após a assinatura por biometria facial, a solicitação migra para "Aguardando Cadastro" e o botão Aprovar libera automaticamente.`
                : 'Aguardando o webhook do Autentique migrar a solicitação para Aguardando Cadastro.';
              return (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{titulo}</AlertTitle>
                  <AlertDescription>{descricao}</AlertDescription>
                </Alert>
              );
            })()}

            {modo === 'cadastro' && debitoPendente && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Débito pendente do titular antigo</AlertTitle>
                <AlertDescription>
                  Saldo de R$ {Number(debitoPendente.valor_total || 0).toFixed(2)} em {debitoPendente.quantidade_boletos || 0} boleto(s) no SGA. A aprovação será liberada automaticamente após a quitação (verificação diária).
                </AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue="dados">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="dados">Dados</TabsTrigger>
                <TabsTrigger value="termo">Termo</TabsTrigger>
                <TabsTrigger value="analise">Análise prévia</TabsTrigger>
                <TabsTrigger value="financeiro">Financeiro Antigo</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>

              <TabsContent value="dados" className="space-y-3 pt-3">
                <div className="rounded border p-3 space-y-2">
                  <h4 className="font-semibold flex items-center gap-2"><User className="h-4 w-4" /> Titular Antigo</h4>
                  <p className="text-sm">{solicitacao.associado_antigo?.nome}</p>
                  <p className="text-xs text-muted-foreground">CPF: {formatCPF(solicitacao.associado_antigo?.cpf)} • {solicitacao.associado_antigo?.email || '-'} • {formatPhone(solicitacao.associado_antigo?.telefone)}</p>
                </div>
                <div className="rounded border p-3 space-y-2">
                  <h4 className="font-semibold flex items-center gap-2"><User className="h-4 w-4" /> Novo Titular</h4>
                  <p className="text-sm">{solicitacao.novo_titular_dados?.nome}</p>
                  <p className="text-xs text-muted-foreground">CPF: {formatCPF(solicitacao.novo_titular_dados?.cpf)} • {solicitacao.novo_titular_dados?.email || '-'} • {formatPhone(solicitacao.novo_titular_dados?.telefone)}</p>
                </div>
                <VeiculoCompletoCard veiculoId={solicitacao.veiculo_id} />
                {solicitacao.cotacao && (
                  <div className="rounded border p-3 space-y-2">
                    <h4 className="font-semibold">Cotação vinculada</h4>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Nº {solicitacao.cotacao.numero || solicitacao.cotacao.id.slice(0, 8)} — {solicitacao.cotacao.status}</span>
                      {solicitacao.cotacao.token_publico && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={`/cotacao/${solicitacao.cotacao.token_publico}`} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3 w-3 mr-1" /> Abrir cotação
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="analise" className="pt-3 space-y-3">
                <div className="rounded border p-3 space-y-2">
                  <h4 className="font-semibold flex items-center gap-2"><Search className="h-4 w-4" /> Análise prévia do novo titular</h4>
                  {!solicitacao.analise_previa_resultado ? (
                    <p className="text-sm text-muted-foreground">
                      A análise prévia é gerada automaticamente quando o Cadastro aprova a solicitação (consulta dupla: base local + SGA Hinova). Ainda não há snapshot.
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">
                        Gerado em {solicitacao.analise_previa_em ? new Date(solicitacao.analise_previa_em).toLocaleString('pt-BR') : '-'}
                      </p>
                      <div className="rounded bg-muted/40 p-2">
                        <p className="text-xs font-medium mb-1">Base local</p>
                        <pre className="text-[11px] whitespace-pre-wrap break-all max-h-48 overflow-auto">
                          {JSON.stringify(solicitacao.analise_previa_resultado.base_local, null, 2)}
                        </pre>
                      </div>
                      <div className="rounded bg-muted/40 p-2">
                        <p className="text-xs font-medium mb-1">SGA Hinova</p>
                        <pre className="text-[11px] whitespace-pre-wrap break-all max-h-48 overflow-auto">
                          {JSON.stringify(solicitacao.analise_previa_resultado.sga, null, 2)}
                        </pre>
                      </div>
                    </>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="financeiro" className="pt-3">
                <RelatorioFinanceiroAntigo
                  associadoId={solicitacao.associado_antigo_id}
                  codigoHinova={(solicitacao.associado_antigo as any)?.codigo_hinova ?? null}
                  cpf={solicitacao.associado_antigo?.cpf ?? null}
                />
              </TabsContent>

              <TabsContent value="termo" className="pt-3 space-y-3">
                <div className="rounded border p-3 space-y-2">
                  <h4 className="font-semibold flex items-center gap-2"><FileSignature className="h-4 w-4" /> Termo de Cancelamento</h4>
                  {solicitacao.termo_cancelamento_assinado_em ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-sm">Assinado em {new Date(solicitacao.termo_cancelamento_assinado_em).toLocaleString('pt-BR')}</span>
                    </div>
                  ) : solicitacao.termo_cancelamento_enviado_em ? (
                    <p className="text-sm text-amber-600">Enviado em {new Date(solicitacao.termo_cancelamento_enviado_em).toLocaleString('pt-BR')} — aguardando assinatura</p>
                  ) : (
                    <Button
                      onClick={() => enviarTermo.mutate(solicitacao.id)}
                      disabled={enviarTermo.isPending}
                      size="sm"
                    >
                      {enviarTermo.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                      Enviar Termo de Cancelamento (Autentique)
                    </Button>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="timeline" className="pt-3 space-y-3">
                <TimelineAprovacao
                  status={solicitacao.status}
                  termoAssinadoEm={solicitacao.termo_cancelamento_assinado_em}
                  aprovadoCadastroEm={solicitacao.aprovado_cadastro_em}
                  aprovadoMonitoramentoEm={solicitacao.aprovado_monitoramento_em}
                  efetivadaEm={solicitacao.efetivada_em}
                />
                {solicitacao.servico_vistoria_id && (
                  <MiniCardVistoriaTroca servicoId={solicitacao.servico_vistoria_id} />
                )}
              </TabsContent>
            </Tabs>

            {podeAgir && !confirmandoReprovar && (
              <div className="border-t pt-4 space-y-3">
                <div>
                  <Label htmlFor="obs">Observação (opcional)</Label>
                  <Textarea id="obs" value={observacao} onChange={e => setObservacao(e.target.value)} rows={2} />
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  <Button variant="destructive" onClick={() => setConfirmandoReprovar(true)}>
                    <XCircle className="h-4 w-4 mr-2" /> Reprovar
                  </Button>
                  {modo === 'monitoramento' && (
                    <Button variant="outline" onClick={handleSolicitarVistoria} disabled={aprovarMonitoramento.isPending}>
                      {aprovarMonitoramento.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ClipboardCheck className="h-4 w-4 mr-2" />}
                      Solicitar Vistoria
                    </Button>
                  )}
                  {(() => {
                    const bloqueadoPorAssinatura = modo === 'cadastro' && !solicitacao.termo_cancelamento_assinado_em;
                    const bloqueadoPorDebito = modo === 'cadastro' && !!debitoPendente;
                    const bloqueado = bloqueadoPorAssinatura || bloqueadoPorDebito;
                    const motivoBloqueio = bloqueadoPorAssinatura
                      ? 'Aguardando assinatura do termo de cancelamento pelo titular antigo.'
                      : bloqueadoPorDebito
                      ? 'Titular antigo possui débitos em aberto no SGA. Aprovação liberada automaticamente após quitação.'
                      : '';
                    const btn = (
                      <Button
                        onClick={handleAprovar}
                        disabled={aprovarCadastro.isPending || aprovarMonitoramento.isPending || bloqueado}
                      >
                        {(aprovarCadastro.isPending || aprovarMonitoramento.isPending) ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : modo === 'cadastro' ? <ClipboardCheck className="h-4 w-4 mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                        Aprovar
                      </Button>
                    );
                    if (!bloqueado) return btn;
                    return (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild><span tabIndex={0}>{btn}</span></TooltipTrigger>
                          <TooltipContent>{motivoBloqueio}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Footer explicativo quando não há ação disponível (botão Aprovar oculto) */}
            {!podeAgir && !confirmandoReprovar && modo !== 'readonly' && (
              <div className="border-t pt-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Aprovação ainda não disponível</AlertTitle>
                  <AlertDescription>
                    {modo === 'cadastro' && solicitacao.status === 'cotacao_em_andamento' && (
                      <>O botão <strong>Aprovar</strong> aparece aqui assim que o titular antigo assinar o Termo de Cancelamento (a solicitação muda para <em>Aguardando Cadastro</em>). Use a aba <strong>Termo</strong> para enviar.</>
                    )}
                    {modo === 'cadastro' && solicitacao.status !== 'cotacao_em_andamento' && solicitacao.status !== 'aguardando_cadastro' && (
                      <>Esta solicitação não está mais sob análise do Cadastro (status atual: <strong>{STATUS_LABELS[solicitacao.status].label}</strong>). Acompanhe pela Timeline.</>
                    )}
                    {modo === 'monitoramento' && solicitacao.status !== 'aguardando_monitoramento' && (
                      <>O botão <strong>Aprovar</strong> só aparece quando a solicitação está em <em>Aguardando Monitoramento</em>. Status atual: <strong>{STATUS_LABELS[solicitacao.status].label}</strong>.</>
                    )}
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {confirmandoReprovar && (
              <div className="border-t pt-4 space-y-3">
                <Label htmlFor="motivo">Motivo da reprovação *</Label>
                <Textarea id="motivo" value={motivoReprovar} onChange={e => setMotivoReprovar(e.target.value)} rows={3} placeholder="Explique o motivo..." />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setConfirmandoReprovar(false)}>Cancelar</Button>
                  <Button variant="destructive" onClick={handleReprovar} disabled={!motivoReprovar.trim() || reprovar.isPending}>
                    {reprovar.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                    Confirmar Reprovação
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
