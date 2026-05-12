import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  AlertTriangle,
  CheckCircle,
  ArrowLeft,
  Loader2,
  Zap,
  User,
  Smartphone,
  ShieldCheck,
  ShieldOff,
  XCircle,
  Ban,
  ExternalLink,
  ClipboardCheck,
  Copy,
  FileText,
  FileCheck,
  ArrowRightCircle,
  Info,
} from 'lucide-react';
import {
  useProposta,
  usePropostasPendentes,
  useAprovarProposta,
  useSolicitarDocumentos,
  useReprovarProposta,
} from '@/hooks/usePropostasPendentes';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAtivarRastreador } from '@/hooks/useAtivarRastreador';
import { useDetectarTipoVeiculo } from '@/hooks/useDetectarTipoVeiculo';
import { useGerarVistoriaLink } from '@/hooks/useVistoriaLinkPublica';
import { SolicitarDocumentosDialog } from '@/components/cadastro/SolicitarDocumentosDialog';
import { ReprovarPropostaDialog } from '@/components/cadastro/ReprovarPropostaDialog';
import { VisualizadorDocumentoModal } from '@/components/cadastro/VisualizadorDocumentoModal';
import {
  PropostaHeroHeader,
  PropostaDetalhesTabs,
  PropostaApprovalStepper,
} from '@/components/cadastro/proposta';
import type { DocumentoAnexadoCompleto } from '@/types/documentos';
import { isValidChassi, normalizeChassi } from '@/lib/chassi';

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function PropostaAnalise() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showSolicitarDocs, setShowSolicitarDocs] = useState(false);
  const [showReprovar, setShowReprovar] = useState(false);
  const [showConfirmAprovar, setShowConfirmAprovar] = useState(false);
  const [showConfirmAtivacaoSoftruck, setShowConfirmAtivacaoSoftruck] = useState(false);
  const [documentoVisualizar, setDocumentoVisualizar] = useState<DocumentoAnexadoCompleto | null>(null);
  const [linkPendenciasGerado, setLinkPendenciasGerado] = useState<string | null>(null);
  
  // Campos editáveis do veículo para SGA Hinova
  const [veiculoRenavam, setVeiculoRenavam] = useState('');
  const [veiculoChassi, setVeiculoChassi] = useState('');

  const { data: proposta, isLoading } = useProposta(id);
  const { data: todasPropostas } = usePropostasPendentes();

  const aprovarMutation = useAprovarProposta();
  const solicitarDocsMutation = useSolicitarDocumentos();
  const reprovarMutation = useReprovarProposta();
  const ativarRastreadorMutation = useAtivarRastreador();

  // Encontrar próxima proposta
  const currentIndex = todasPropostas?.findIndex((p) => p.id === id) ?? -1;
  const nextProposta = currentIndex >= 0 && todasPropostas ? todasPropostas[currentIndex + 1] : null;

  // Determinar se é autovistoria
  const isVistoriaBase = !!proposta?.vistoria_base_info;
  const isAutovistoria = (
    proposta?.vistoria?.modalidade === 'autovistoria' ||
    proposta?.vistoria?.tipo === 'autovistoria'
  ) && !proposta?.instalacao_info && !isVistoriaBase;

  // Tipo de veículo (carro/moto) para personalizar labels do dialog de reenvio
  const { tipoVeiculo } = useDetectarTipoVeiculo(
    proposta?.veiculo_marca,
    proposta?.veiculo_modelo
  );

  // Verificar se pode aprovar
  // NOVO: bloqueia aprovação enquanto vistoria/instalação não foi executada
  const aguardandoExecucao = proposta?.tipo_etapa_analise === 'agendamento_confirmado';

  // ============================================================
  // REGRA DE NEGÓCIO — Análise do Cadastro por tipo de plano
  // ============================================================
  // Plano COM Roubo e Furto → Cadastro avalia FOTOS + DOCUMENTOS
  //   (precisa validar estado físico do veículo para liberar a cobertura).
  // Plano SEM Roubo e Furto → Cadastro avalia SOMENTE DOCUMENTAÇÃO
  //   (assistência 24h, vidros, benefícios soltos — sem necessidade de
  //    inspecionar o veículo). A etapa "Fotos & Vistoria" some.
  // ------------------------------------------------------------
  const planoTemRouboFurto = !!proposta?.plano_tem_roubo_furto;

  const temFotosOuVideo =
    (proposta?.vistoria?.fotos?.length || 0) > 0 ||
    !!proposta?.vistoria?.video_360_url;

  // Vistoria AGENDADA (base ou no cliente) que ainda NÃO foi executada e ainda
  // NÃO possui fotos/vídeo do associado — registro fotográfico será feito pelo
  // técnico no atendimento presencial.
  const isVistoriaAgendadaSemFotos =
    !isAutovistoria &&
    !temFotosOuVideo &&
    (
      (proposta?.tipo_vistoria === 'agendada_base' &&
        proposta?.vistoria_base_info?.status !== 'realizado') ||
      (proposta?.tipo_vistoria === 'agendada' &&
        proposta?.instalacao_info?.concluida_em == null)
    );

  // Cadastro avalia fotos quando:
  //   1) o plano tem cobertura de Roubo/Furto (precisa inspecionar o veículo) E
  //   2) já existem fotos/vídeo a revisar (autovistoria entregue ou
  //      vistoria agendada já realizada).
  const cadastroAvaliaFotos = planoTemRouboFurto && temFotosOuVideo;

  // Aprovação documental basta quando:
  //   - plano sem R&F (independente de fotos), OU
  //   - vistoria agendada que ainda não foi realizada (sem fotos).
  const aprovarApenasDocumentos = !planoTemRouboFurto || isVistoriaAgendadaSemFotos;

  const podeAprovar =
    proposta?.status === 'assinado' &&
    !proposta?.tem_documento_pendente &&
    (!aguardandoExecucao || aprovarApenasDocumentos);

  // Estado final (já aprovado / reprovado / cancelado)
  const isAprovada = proposta?.status === 'ativo';
  const isReprovada = proposta?.status === 'reprovado';
  const isCancelada = proposta?.status === 'cancelado';
  const isFinalizada = isAprovada || isReprovada || isCancelada;

  // Buscar dados de aprovação/reprovação para banner
  const [estadoFinal, setEstadoFinal] = useState<{
    aprovado_em: string | null;
    aprovado_por_nome: string | null;
    motivo_reprovacao?: string | null;
  } | null>(null);

  useEffect(() => {
    if (!id || !isFinalizada) {
      setEstadoFinal(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: contrato } = await supabase
        .from('contratos')
        .select('aprovado_em, aprovado_por')
        .eq('id', id)
        .maybeSingle();
      let aprovadorNome: string | null = null;
      if (contrato?.aprovado_por) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('nome')
          .eq('id', contrato.aprovado_por)
          .maybeSingle();
        aprovadorNome = prof?.nome || null;
      }
      if (!cancelled) {
        setEstadoFinal({
          aprovado_em: contrato?.aprovado_em || null,
          aprovado_por_nome: aprovadorNome,
          motivo_reprovacao: null,
        });
      }
    })();
    return () => { cancelled = true; };
  }, [id, isFinalizada]);

  const handleAprovar = () => {
    setShowConfirmAprovar(true);
  };

  const gerarVistoriaLinkMut = useGerarVistoriaLink();

  const handleConfirmarAprovacao = async () => {
    if (!id) return;

    // Validação de chassi: se foi digitado nesta tela, precisa ser VIN válido (17 chars).
    const chassiInformado = veiculoChassi?.trim();
    if (chassiInformado && !isValidChassi(chassiInformado)) {
      toast.error('Chassi inválido', {
        description: 'O chassi precisa ter 17 caracteres no padrão VIN (sem I, O ou Q).',
      });
      return;
    }

    // Chassi sempre é preenchido manualmente — nenhuma comparação com OCR é feita aqui.

    setShowConfirmAprovar(false);

    try {
      await aprovarMutation.mutateAsync({
        contratoId: id,
        veiculoRenavam: veiculoRenavam || undefined,
        veiculoChassi: chassiInformado ? normalizeChassi(chassiInformado) : undefined,
      });

      // Após aprovação documental, gerar (ou reutilizar) o link público de vistoria.
      // Idempotente: se já existir, devolve o mesmo token. Não bloqueia o fluxo se falhar.
      try {
        const cotacaoId = (proposta as any)?.cotacao_id || (proposta as any)?.cotacao?.id;
        if (cotacaoId) {
          await gerarVistoriaLinkMut.mutateAsync({ cotacaoId });
        }
      } catch (linkErr) {
        console.warn('[PropostaAnalise] Falha ao gerar link de vistoria (não bloqueante):', linkErr);
      }

      if (nextProposta) {
        navigate(`/cadastro/propostas/${nextProposta.id}`);
      } else {
        navigate('/cadastro/propostas');
      }
    } catch (error: any) {
      console.error('[PropostaAnalise] Erro ao aprovar:', error);
      toast.error('Erro ao aprovar proposta', { 
        description: error?.message || 'Tente novamente. Se o problema persistir, atualize a página.' 
      });
    }
  };

  const handleSolicitarDocumentos = async (documentos: string[], observacoes: string) => {
    if (!proposta?.associado_id || !id) return;
    const result = await solicitarDocsMutation.mutateAsync({
      contratoId: id,
      associadoId: proposta.associado_id,
      documentos,
      observacoes,
    });
    setLinkPendenciasGerado(result.linkPendencias || null);
    setShowSolicitarDocs(false);
    queryClient.invalidateQueries({ queryKey: ['proposta', id] });
    queryClient.invalidateQueries({ queryKey: ['propostas-pendentes'] });
  };

  const handleReprovar = async (motivo: string, justificativa: string) => {
    if (!proposta?.associado_id || !id) return;
    await reprovarMutation.mutateAsync({
      contratoId: id,
      associadoId: proposta.associado_id,
      motivo,
      justificativa,
    });
    setShowReprovar(false);
    // Navegar para próxima ou voltar para lista
    if (nextProposta) {
      navigate(`/cadastro/propostas/${nextProposta.id}`);
    } else {
      navigate('/cadastro/propostas');
    }
  };

  // Handler para ativar rastreador Softruck
  const handleConfirmarAtivacaoSoftruck = async () => {
    if (!proposta?.instalacao_info?.rastreador_imei || 
        !proposta?.veiculo_id || 
        !proposta?.associado_id) {
      return;
    }
    
    setShowConfirmAtivacaoSoftruck(false);
    
    try {
      await ativarRastreadorMutation.mutateAsync({
        imei: proposta.instalacao_info.rastreador_imei,
        veiculoId: proposta.veiculo_id,
        associadoId: proposta.associado_id,
        associadoEmail: proposta.cliente_email || undefined,
      });
      
      // Refetch para atualizar estado
      queryClient.invalidateQueries({ queryKey: ['proposta', id] });
    } catch (error) {
      console.error('Erro ao ativar rastreador:', error);
    }
  };

  // Handler para aprovar documento individual
  // Suporta dois fluxos:
  //  - id começando com `solicitado-`  → atualiza `documentos_solicitados` + `documentos`
  //  - caso contrário                  → atualiza `contratos_documentos`
  const handleAprovarDocumento = async (docId: string) => {
    if (docId.startsWith('solicitado-')) {
      const solicitadoId = docId.replace(/^solicitado-/, '');
      const { data: sol, error: e0 } = await supabase
        .from('documentos_solicitados')
        .select('id, documento_id')
        .eq('id', solicitadoId)
        .maybeSingle();
      if (e0 || !sol) {
        toast.error('Erro ao aprovar documento reenviado', { description: e0?.message });
        return;
      }
      if (sol.documento_id) {
        await supabase.from('documentos').update({ status: 'aprovado' }).eq('id', sol.documento_id);
      }
      const { error } = await supabase
        .from('documentos_solicitados')
        .update({ status: 'aprovado' })
        .eq('id', solicitadoId);
      if (error) {
        toast.error('Erro ao aprovar documento reenviado', { description: error.message });
        return;
      }
      toast.success('Documento reenviado aprovado');
      queryClient.invalidateQueries({ queryKey: ['proposta', id] });
      queryClient.invalidateQueries({ queryKey: ['propostas-pendentes'] });
      return;
    }

    const { error } = await supabase
      .from('contratos_documentos')
      .update({ status: 'aprovado' })
      .eq('id', docId);
    
    if (error) {
      toast.error('Erro ao aprovar documento', { description: error.message });
      return;
    }
    toast.success('Documento aprovado');
    queryClient.invalidateQueries({ queryKey: ['proposta', id] });
    queryClient.invalidateQueries({ queryKey: ['propostas-pendentes'] });
  };

  // Handler para reprovar documento individual
  const handleReprovarDocumento = async (docId: string, motivo: string) => {
    if (docId.startsWith('solicitado-')) {
      const solicitadoId = docId.replace(/^solicitado-/, '');
      const { data: sol } = await supabase
        .from('documentos_solicitados')
        .select('id, documento_id')
        .eq('id', solicitadoId)
        .maybeSingle();
      if (sol?.documento_id) {
        await supabase.from('documentos').update({ status: 'reprovado' }).eq('id', sol.documento_id);
      }
      // Volta a solicitação para 'pendente' para o cliente reenviar novamente
      const { error } = await supabase
        .from('documentos_solicitados')
        .update({
          status: 'pendente',
          enviado_em: null,
          documento_id: null,
          observacao_cliente: motivo || null,
        })
        .eq('id', solicitadoId);
      if (error) {
        toast.error('Erro ao reprovar documento reenviado', { description: error.message });
        return;
      }
      toast.success('Documento reenviado reprovado — cliente será notificado para reenviar');
      queryClient.invalidateQueries({ queryKey: ['proposta', id] });
      queryClient.invalidateQueries({ queryKey: ['propostas-pendentes'] });
      return;
    }

    const { error } = await supabase
      .from('contratos_documentos')
      .update({ status: 'reprovado' })
      .eq('id', docId);
    
    if (error) {
      toast.error('Erro ao reprovar documento', { description: error.message });
      return;
    }
    toast.success('Documento reprovado');
    queryClient.invalidateQueries({ queryKey: ['proposta', id] });
    queryClient.invalidateQueries({ queryKey: ['propostas-pendentes'] });
  };

  // Verificar se pode ativar Softruck
  const podeAtivarSoftruck = proposta?.status === 'ativo' &&
    proposta?.instalacao_info?.rastreador_plataforma === 'softruck' &&
    !proposta?.instalacao_info?.rastreador_ativado &&
    !proposta?.veiculo_cobertura_total;

  const isAtivandoSoftruck = ativarRastreadorMutation.isPending;

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 p-4">
        <Skeleton className="h-48 w-full rounded-xl bg-muted" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-40 w-full rounded-lg bg-muted" />
          <Skeleton className="h-40 w-full rounded-lg bg-muted" />
          <Skeleton className="h-40 w-full rounded-lg bg-muted" />
        </div>
        <Skeleton className="h-64 w-full rounded-lg bg-muted" />
      </div>
    );
  }

  // Not found
  if (!proposta) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-warning" />
        <h2 className="text-xl font-semibold text-foreground">Proposta não encontrada</h2>
        <p className="text-muted-foreground mt-2">A proposta solicitada não existe ou foi removida.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate('/cadastro/propostas')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Lista
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 px-4 pb-8">
      {/* ZONA 1: Header Hero (sem botões de ação) */}
      <PropostaHeroHeader
        proposta={proposta}
        onVoltar={() => navigate('/cadastro/propostas')}
        onProxima={nextProposta ? () => navigate(`/cadastro/propostas/${nextProposta.id}`) : undefined}
      />

      {/* Banner de estado final (proposta já aprovada / reprovada / cancelada) */}
      {isFinalizada && (
        <div
          className={
            isAprovada
              ? 'rounded-lg border-2 border-success/40 bg-success/10 p-4 space-y-3'
              : isReprovada
                ? 'rounded-lg border-2 border-destructive/40 bg-destructive/10 p-4 space-y-3'
                : 'rounded-lg border-2 border-muted-foreground/30 bg-muted p-4 space-y-3'
          }
        >
          <div className="flex items-start gap-3">
            {isAprovada ? (
              <CheckCircle className="h-6 w-6 text-success mt-0.5 shrink-0" />
            ) : isReprovada ? (
              <XCircle className="h-6 w-6 text-destructive mt-0.5 shrink-0" />
            ) : (
              <Ban className="h-6 w-6 text-muted-foreground mt-0.5 shrink-0" />
            )}
            <div className="flex-1">
              <p
                className={
                  isAprovada
                    ? 'font-semibold text-success'
                    : isReprovada
                      ? 'font-semibold text-destructive'
                      : 'font-semibold text-foreground'
                }
              >
                {isAprovada
                  ? 'Proposta aprovada — cadastro concluído'
                  : isReprovada
                    ? 'Proposta reprovada'
                    : 'Proposta cancelada'}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isAprovada && estadoFinal?.aprovado_em && (
                  <>
                    Aprovada em{' '}
                    {new Date(estadoFinal.aprovado_em).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {estadoFinal.aprovado_por_nome && <> por <strong className="text-foreground">{estadoFinal.aprovado_por_nome}</strong></>}.
                  </>
                )}
                {isAprovada && !estadoFinal?.aprovado_em && (
                  <>O associado já está ativo no sistema.</>
                )}
                {isReprovada && <>Esta proposta foi reprovada e não está mais disponível para análise.</>}
                {isCancelada && <>Esta proposta foi cancelada.</>}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            {isAprovada && proposta.associado_id && (
              <Button
                className="flex-1 bg-success hover:bg-success/90 text-white"
                onClick={() => navigate(`/cadastro/associados/${proposta.associado_id}`)}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Ver associado
              </Button>
            )}
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate('/cadastro/propostas')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para lista
            </Button>
          </div>
        </div>
      )}

      {/* Banner: aguardando execução da vistoria/instalação (analista pode revisar docs mas não aprovar) */}
      {!isFinalizada && aguardandoExecucao && !aprovarApenasDocumentos && (
        <div className="rounded-lg border-2 border-info/40 bg-info/10 p-4">
          <div className="flex items-start gap-3">
            <ClipboardCheck className="h-5 w-5 text-info mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-info">Análise documental disponível</p>
              {proposta?.plano_tem_roubo_furto ? (
                <p className="text-sm text-muted-foreground mt-1">
                  Você pode revisar documentos e contrato agora. A <strong>aprovação final</strong> será liberada após a execução da vistoria/instalação agendada.
                  Em seguida, o monitoramento dará o <strong>segundo check</strong> para liberar a Proteção 360 e o app do associado.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">
                  Você pode revisar documentos e contrato agora. A <strong>aprovação final</strong> será liberada após a execução da vistoria.
                  Este plano de assistência <strong>não inclui</strong> instalação de rastreador nem segundo check de monitoramento.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {podeAtivarSoftruck && (
        <div className="rounded-lg border-2 border-warning/30 bg-warning/10 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-warning">Ativação Pendente</p>
              <p className="text-sm text-muted-foreground">
                O rastreador foi instalado mas ainda não foi ativado na plataforma Softruck.
              </p>
            </div>
          </div>
          
          <Button
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            size="lg"
            onClick={() => setShowConfirmAtivacaoSoftruck(true)}
            disabled={isAtivandoSoftruck}
          >
            {isAtivandoSoftruck ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Ativando na Softruck...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Ativar Rastreador Softruck
              </>
            )}
          </Button>
        </div>
      )}

      {linkPendenciasGerado && (
        <div className="rounded-lg border-2 border-warning/30 bg-warning/10 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-warning mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-warning">Link público para envio das pendências</p>
              <p className="text-sm text-muted-foreground mt-1">
                Você também pode enviar manualmente este link ao associado para anexar as documentações pendentes.
              </p>
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <div className="flex-1 truncate rounded-md border bg-card px-3 py-2 text-xs text-muted-foreground">
                  {linkPendenciasGerado}
                </div>
                <Button
                  variant="outline"
                  className="border-warning/50 text-warning hover:bg-warning/10"
                  onClick={async () => {
                    await navigator.clipboard.writeText(linkPendenciasGerado);
                    toast.success('Link público copiado');
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar link
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ZONA 2: Stepper de Aprovação por Etapas */}
      <PropostaApprovalStepper
        proposta={proposta}
        documentos={(proposta.documentos || []) as unknown as DocumentoAnexadoCompleto[]}
        onViewDocumento={setDocumentoVisualizar}
        onAprovarDocumento={handleAprovarDocumento}
        onReprovarDocumento={handleReprovarDocumento}
        onAprovar={handleAprovar}
        onSolicitarDocs={() => setShowSolicitarDocs(true)}
        onReprovar={() => setShowReprovar(true)}
        isAprovando={aprovarMutation.isPending}
        isAutovistoria={isAutovistoria}
        podeAprovar={podeAprovar}
        cadastroAvaliaFotos={cadastroAvaliaFotos}
        planoTemRouboFurto={planoTemRouboFurto}
      />

      {/* ZONA 3: Tabs de Detalhes (sempre visíveis) */}
      <PropostaDetalhesTabs
        proposta={proposta}
        veiculoRenavam={veiculoRenavam}
        setVeiculoRenavam={setVeiculoRenavam}
        veiculoChassi={veiculoChassi}
        setVeiculoChassi={setVeiculoChassi}
      />

      {/* DIALOGS */}
      <SolicitarDocumentosDialog
        open={showSolicitarDocs}
        onOpenChange={setShowSolicitarDocs}
        onConfirm={handleSolicitarDocumentos}
        loading={solicitarDocsMutation.isPending}
        isAutovistoria={isAutovistoria}
        tipoVeiculo={tipoVeiculo}
      />

      <ReprovarPropostaDialog
        open={showReprovar}
        onOpenChange={setShowReprovar}
        onConfirm={handleReprovar}
        loading={reprovarMutation.isPending}
      />

      {/* Modal de visualização de documento */}
      {documentoVisualizar && (
        <VisualizadorDocumentoModal
          documento={documentoVisualizar}
          open={!!documentoVisualizar}
          onClose={() => setDocumentoVisualizar(null)}
          onAprovar={handleAprovarDocumento}
          onReprovar={handleReprovarDocumento}
        />
      )}

      {/* Dialog de confirmação de aprovação */}
      <AlertDialog open={showConfirmAprovar} onOpenChange={setShowConfirmAprovar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {isAutovistoria ? (
                <ShieldCheck className="h-5 w-5 text-success" />
              ) : (
                <CheckCircle className="h-5 w-5 text-success" />
              )}
              Confirmar Aprovação
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Esta etapa é <strong>apenas a análise documental</strong>. Ao confirmar, o sistema irá:
                </p>

                <div className="bg-muted rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-6 h-6 rounded-full bg-success/20 flex items-center justify-center">
                      <FileCheck className="h-3 w-3 text-success" />
                    </div>
                    <span>Marcar a documentação como aprovada pelo Cadastro</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-6 h-6 rounded-full bg-info/20 flex items-center justify-center">
                      <ArrowRightCircle className="h-3 w-3 text-info" />
                    </div>
                    <span>Encaminhar a proposta para a fila de <strong>Monitoramento › Aprovação de Associados</strong></span>
                  </div>
                </div>

                <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                  <Info className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    A <strong>ativação do associado</strong>, o envio como pendente para o <strong>SGA</strong> e a <strong>liberação do acesso ao App</strong> ocorrem somente após a aprovação do Monitoramento, depois da instalação/vistoria concluída.
                  </span>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarAprovacao}
              className="bg-success hover:bg-success/90 text-white"
              disabled={aprovarMutation.isPending}
            >
              <FileCheck className="h-4 w-4 mr-2" />
              {aprovarMutation.isPending ? 'Aprovando...' : 'Aprovar Documentação'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmação de ativação Softruck */}
      <AlertDialog open={showConfirmAtivacaoSoftruck} onOpenChange={setShowConfirmAtivacaoSoftruck}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <Zap className="h-5 w-5 text-primary" />
              Confirmar Ativação do Rastreador
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-muted-foreground">
                <p>Esta ação irá:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Ativar o rastreador na plataforma <strong className="text-foreground">SOFTRUCK</strong></li>
                  <li>Liberar a <strong className="text-foreground">Proteção 360º</strong> para o veículo {proposta?.veiculo_placa}</li>
                  <li>Criar veículo/device na Softruck se necessário</li>
                </ul>
                <p className="font-medium text-foreground">Deseja continuar?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleConfirmarAtivacaoSoftruck}
              disabled={isAtivandoSoftruck}
            >
              {isAtivandoSoftruck ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ativando...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Confirmar Ativação
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
