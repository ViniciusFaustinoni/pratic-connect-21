import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Car, User, FileSignature, CheckCircle2, XCircle, Send, ClipboardCheck, ShieldCheck, ExternalLink, AlertTriangle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useSolicitacaoTroca, useAprovarTrocaCadastro, useAprovarTrocaMonitoramento, useReprovarTroca, useEnviarTermoCancelamento, type StatusTroca } from '@/hooks/useSolicitacoesTroca';
import { TimelineAprovacao } from './TimelineAprovacao';
import { MiniCardVistoriaTroca } from './MiniCardVistoriaTroca';
import { VeiculoCompletoCard } from './VeiculoCompletoCard';
import { AnalisePreviaNovoTitularCard } from './AnalisePreviaNovoTitularCard';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCPF, formatPhone } from '@/types/termo-filiacao';
import { CotacaoFormDialog, type CotacaoBaseParaFormulario } from '@/components/cotacoes/CotacaoFormDialog';
import { AgendarManutencaoTrocaDialog } from './AgendarManutencaoTrocaDialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Wrench, Camera, ChevronDown } from 'lucide-react';

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
  aguardando_manutencao: { label: 'Aguardando Manutenção', variant: 'secondary' },
  expirada: { label: 'Expirada', variant: 'destructive' },
};

export function ModalDetalhesTroca({ open, onOpenChange, solicitacaoId, modo }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: solicitacao, isLoading } = useSolicitacaoTroca(solicitacaoId || undefined);
  const [observacao, setObservacao] = useState('');
  const [motivoReprovar, setMotivoReprovar] = useState('');
  const [confirmandoReprovar, setConfirmandoReprovar] = useState(false);
  const [criandoCotacao, setCriandoCotacao] = useState(false);
  const [formCotacaoOpen, setFormCotacaoOpen] = useState(false);
  const [manutencaoOpen, setManutencaoOpen] = useState(false);

  const aprovarCadastro = useAprovarTrocaCadastro();
  const aprovarMonitoramento = useAprovarTrocaMonitoramento();
  const reprovar = useReprovarTroca();
  const enviarTermo = useEnviarTermoCancelamento();

  // Monta cotacaoBase para o formulário padrão a partir da solicitação +
  // dados do veículo. NÃO cria cotação avulsa antes — a cotação só nasce
  // quando o usuário escolher um plano e salvar.
  const cotacaoBaseTroca: CotacaoBaseParaFormulario | null = useMemo(() => {
    if (!solicitacao) return null;
    const v = solicitacao.veiculo;
    const novo = solicitacao.novo_titular_dados || ({} as any);
    return {
      valor_fipe: (v?.valor_fipe as number | null) ?? null,
      valor_adicional: null,
      valor_adesao: null,
      validade_dias: 15,
      veiculo_marca: v?.marca ?? null,
      veiculo_modelo: v?.modelo ?? null,
      veiculo_ano: (v?.ano_modelo ?? v?.ano_fabricacao) ?? null,
      veiculo_placa: v?.placa ?? null,
      codigo_fipe: (v?.codigo_fipe as string | null) ?? null,
      categoria: null,
      regiao: null,
      nome_solicitante: novo?.nome ?? null,
      telefone1_solicitante: novo?.telefone ?? null,
      email_solicitante: novo?.email ?? null,
      lead_id: null,
      plano_id: null,
    };
  }, [solicitacao]);

  const handleRealizarCotacao = () => {
    if (!solicitacao) return;
    if (!solicitacao.termo_cancelamento_assinado_em) {
      toast.error('Aguardando assinatura do termo de cancelamento pelo titular antigo.');
      return;
    }
    // Abre o modal padrão de cotação pré-preenchido. A cotação só será criada
    // (e vinculada à solicitação via `vincular-cotacao-troca`) ao salvar.
    setFormCotacaoOpen(true);
  };

  // (Removido) Checagem de débito do antigo titular: a troca não exige mais
  // adimplência. A aprovação do Cadastro depende apenas do termo assinado.

  const handleAprovar = async () => {
    if (!solicitacao) return;
    if (modo === 'cadastro') {
      await aprovarCadastro.mutateAsync({ solicitacao_id: solicitacao.id, observacao });
    } else {
      await aprovarMonitoramento.mutateAsync({ solicitacao_id: solicitacao.id, acao: 'aprovar', observacao });
    }
    onOpenChange(false);
  };

  const handleSolicitarVistoria = async (tipo: 'somente_fotos' | 'fotos_com_rastreador') => {
    if (!solicitacao) return;
    await aprovarMonitoramento.mutateAsync({
      solicitacao_id: solicitacao.id,
      acao: 'solicitar_vistoria',
      observacao,
      tipo_vistoria_troca: tipo,
    });
    onOpenChange(false);
  };

  const handleReprovar = async () => {
    if (!solicitacao || !motivoReprovar.trim() || modo === 'readonly') return;
    await reprovar.mutateAsync({ solicitacao_id: solicitacao.id, motivo: motivoReprovar, etapa: modo });
    onOpenChange(false);
  };

  // Vistoria foi concluída pelo novo titular no link público?
  // (autovistoria com fotos OU presencial agendada/concluída)
  const vistoriaClienteConcluida = !!solicitacao?.cotacao?.tipo_vistoria || !!solicitacao?.cotacao?.vistoria_concluida_em;

  const podeAgir = solicitacao && modo !== 'readonly' && (
    (modo === 'cadastro' && solicitacao.status === 'aguardando_cadastro') ||
    (modo === 'monitoramento' && solicitacao.status === 'aguardando_monitoramento') ||
    // Após a vistoria ser concluída pelo cliente, monitoramento pode aprovar
    (modo === 'monitoramento' && solicitacao.status === 'aguardando_vistoria' && vistoriaClienteConcluida)
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

            {/* (Removido) Alerta de débito pendente do antigo titular */}

            <Tabs defaultValue="dados">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="dados">Dados</TabsTrigger>
                <TabsTrigger value="termo">Termo</TabsTrigger>
                <TabsTrigger value="analise">Análise prévia</TabsTrigger>
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
                {solicitacao.cotacao ? (
                  <div className="rounded border p-3 space-y-2">
                    <h4 className="font-semibold">Cotação vinculada</h4>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Nº {solicitacao.cotacao.numero || solicitacao.cotacao.id.slice(0, 8)} — {solicitacao.cotacao.status}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { onOpenChange(false); navigate(`/vendas/cotacoes?abrir=${solicitacao.cotacao!.id}`); }}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" /> Abrir cotação
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded border p-3 space-y-3 bg-muted/30">
                    <div>
                      <h4 className="font-semibold flex items-center gap-2"><FileText className="h-4 w-4" /> Cotação</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {solicitacao.termo_cancelamento_assinado_em
                          ? 'Termo de cancelamento assinado. Clique abaixo para gerar a cotação do novo titular (consulta FIPE atualizada).'
                          : 'A cotação será gerada manualmente assim que o titular antigo assinar o termo de cancelamento.'}
                      </p>
                    </div>
                    {(() => {
                      const podeGerar = !!solicitacao.termo_cancelamento_assinado_em;
                      const btn = (
                        <Button
                          onClick={handleRealizarCotacao}
                          disabled={!podeGerar || criandoCotacao}
                          className="w-full sm:w-auto"
                        >
                          {criandoCotacao ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                          Realizar Cotação
                        </Button>
                      );
                      if (podeGerar) return btn;
                      return (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild><span tabIndex={0}>{btn}</span></TooltipTrigger>
                            <TooltipContent>Aguardando assinatura do termo de cancelamento pelo titular antigo.</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })()}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="analise" className="pt-3 space-y-3">
                <AnalisePreviaNovoTitularCard
                  solicitacaoId={solicitacao.id}
                  enabled={open && ['cotacao_em_andamento', 'aguardando_cadastro', 'aguardando_monitoramento', 'aguardando_vistoria'].includes(solicitacao.status)}
                />
              </TabsContent>

              {/* (Removida) Aba "Financeiro Antigo" — checagem financeira não se aplica mais */}

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
                {modo === 'cadastro' && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Aprovação manual = fallback legado</AlertTitle>
                    <AlertDescription>
                      A aprovação do Cadastro agora é <strong>automática</strong> assim que a cotação é
                      vinculada (com o termo de cancelamento já assinado). Use este botão apenas para
                      itens antigos que ficaram presos antes da mudança.
                    </AlertDescription>
                  </Alert>
                )}
                <div>
                  <Label htmlFor="obs">Observação (opcional)</Label>
                  <Textarea id="obs" value={observacao} onChange={e => setObservacao(e.target.value)} rows={2} />
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  <Button variant="destructive" onClick={() => setConfirmandoReprovar(true)}>
                    <XCircle className="h-4 w-4 mr-2" /> Reprovar
                  </Button>
                  {modo === 'monitoramento' && solicitacao.status === 'aguardando_monitoramento' && (
                    <>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" disabled={aprovarMonitoramento.isPending}>
                            {aprovarMonitoramento.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ClipboardCheck className="h-4 w-4 mr-2" />}
                            Solicitar Vistoria <ChevronDown className="h-3 w-3 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64">
                          <DropdownMenuLabel>Tipo de vistoria</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleSolicitarVistoria('somente_fotos')}>
                            <Camera className="h-4 w-4 mr-2" />
                            <div>
                              <p className="text-sm font-medium">Somente fotos</p>
                              <p className="text-xs text-muted-foreground">Veículo sem rastreador novo</p>
                            </div>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSolicitarVistoria('fotos_com_rastreador')}>
                            <ShieldCheck className="h-4 w-4 mr-2" />
                            <div>
                              <p className="text-sm font-medium">Fotos + instalação de rastreador</p>
                              <p className="text-xs text-muted-foreground">Veículo precisa de rastreador novo</p>
                            </div>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button variant="outline" onClick={() => setManutencaoOpen(true)} disabled={aprovarMonitoramento.isPending}>
                        <Wrench className="h-4 w-4 mr-2" />
                        Agendar manutenção
                      </Button>
                    </>
                  )}
                  {(() => {
                    const bloqueadoPorAssinatura = modo === 'cadastro' && !solicitacao.termo_cancelamento_assinado_em;
                    const bloqueado = bloqueadoPorAssinatura;
                    const motivoBloqueio = bloqueadoPorAssinatura
                      ? 'Aguardando assinatura do termo de cancelamento pelo titular antigo.'
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
                    {modo === 'monitoramento' && solicitacao.status === 'aguardando_vistoria' && !vistoriaClienteConcluida && (
                      <>Vistoria solicitada — aguardando o <strong>novo titular</strong> concluir a vistoria pelo link público de contratação. O botão <strong>Aprovar</strong> reaparece automaticamente assim que a vistoria for finalizada.</>
                    )}
                    {modo === 'monitoramento' && solicitacao.status !== 'aguardando_monitoramento' && solicitacao.status !== 'aguardando_vistoria' && (
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

      {/* Modal padrão de cotação, pré-preenchido com dados da troca.
          A cotação só é persistida ao salvar (escolha de plano) e é vinculada
          automaticamente à solicitação pela edge `vincular-cotacao-troca`. */}
      {solicitacao && cotacaoBaseTroca && (
        <CotacaoFormDialog
          open={formCotacaoOpen}
          onOpenChange={(o) => {
            setFormCotacaoOpen(o);
            if (!o) {
              // Refrescar a solicitação caso a cotação tenha sido vinculada
              qc.invalidateQueries({ queryKey: ['solicitacao-troca', solicitacao.id] });
              qc.invalidateQueries({ queryKey: ['solicitacoes-troca'] });
            }
          }}
          cotacaoBase={cotacaoBaseTroca}
          origemTroca={{
            solicitacaoId: solicitacao.id,
            associadoAntigoId: solicitacao.associado_antigo_id,
            veiculoOrigemId: solicitacao.veiculo_id,
          }}
        />
      )}

      {solicitacao && (
        <AgendarManutencaoTrocaDialog
          open={manutencaoOpen}
          onOpenChange={setManutencaoOpen}
          solicitacaoId={solicitacao.id}
          veiculoId={solicitacao.veiculo_id}
          onAgendado={() => {
            qc.invalidateQueries({ queryKey: ['solicitacao-troca', solicitacao.id] });
            qc.invalidateQueries({ queryKey: ['solicitacoes-troca'] });
            onOpenChange(false);
          }}
        />
      )}
    </Dialog>
  );
}
