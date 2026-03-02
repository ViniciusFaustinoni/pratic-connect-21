import { useState } from 'react';
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
import { SolicitarDocumentosDialog } from '@/components/cadastro/SolicitarDocumentosDialog';
import { ReprovarPropostaDialog } from '@/components/cadastro/ReprovarPropostaDialog';
import { VisualizadorDocumentoModal } from '@/components/cadastro/VisualizadorDocumentoModal';
import { VistoriaObservacoesCard } from '@/components/cadastro/VistoriaObservacoesCard';
import {
  PropostaHeroHeader,
  PropostaMidiaGrid,
  PropostaDetalhesTabs,
} from '@/components/cadastro/proposta';
import type { DocumentoAnexadoCompleto } from '@/types/documentos';

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

  // Verificar se pode aprovar
  const podeAprovar = proposta?.status === 'assinado' && !proposta?.tem_documento_pendente;

  const handleAprovar = () => {
    setShowConfirmAprovar(true);
  };

  const handleConfirmarAprovacao = async () => {
    if (!id) return;
    setShowConfirmAprovar(false);
    
    // Salvar RENAVAM/CHASSI no veículo antes de aprovar (se preenchidos)
    if (proposta?.veiculo_id && (veiculoRenavam || veiculoChassi)) {
      const updateData: Record<string, string | null> = {};
      if (veiculoRenavam) updateData.renavam = veiculoRenavam;
      if (veiculoChassi) updateData.chassi = veiculoChassi;
      
      const { error: updateError } = await supabase
        .from('veiculos')
        .update(updateData)
        .eq('id', proposta.veiculo_id);
      
      if (updateError) {
        toast.error('Erro ao salvar dados do veículo', { description: updateError.message });
        return;
      }
    }
    
    await aprovarMutation.mutateAsync(id);
    // Navegar para próxima ou voltar para lista
    if (nextProposta) {
      navigate(`/cadastro/propostas/${nextProposta.id}`);
    } else {
      navigate('/cadastro/propostas');
    }
  };

  const handleSolicitarDocumentos = async (documentos: string[], observacoes: string) => {
    if (!proposta?.associado_id || !id) return;
    await solicitarDocsMutation.mutateAsync({
      contratoId: id,
      associadoId: proposta.associado_id,
      documentos,
      observacoes,
    });
    setShowSolicitarDocs(false);
    // Navegar para próxima ou voltar para lista
    if (nextProposta) {
      navigate(`/cadastro/propostas/${nextProposta.id}`);
    } else {
      navigate('/cadastro/propostas');
    }
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

  // Handler para aprovar documento individual em contratos_documentos
  const handleAprovarDocumento = async (docId: string) => {
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

  // Handler para reprovar documento individual em contratos_documentos
  const handleReprovarDocumento = async (docId: string, motivo: string) => {
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
      {/* ZONA 1: Header Hero */}
      <PropostaHeroHeader
        proposta={proposta}
        onAprovar={handleAprovar}
        onSolicitarDocs={() => setShowSolicitarDocs(true)}
        onReprovar={() => setShowReprovar(true)}
        onVoltar={() => navigate('/cadastro/propostas')}
        onProxima={nextProposta ? () => navigate(`/cadastro/propostas/${nextProposta.id}`) : undefined}
        isAprovando={aprovarMutation.isPending}
        isAutovistoria={isAutovistoria}
        podeAprovar={podeAprovar}
      />

      {/* Botão de ativação Softruck (quando aplicável) */}
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

      {/* ZONA 2: Grid de Mídia */}
      <PropostaMidiaGrid
        video360Url={proposta.vistoria?.video_360_url}
        fotos={proposta.vistoria?.fotos || []}
        assinaturaUrl={proposta.instalacao_info?.assinatura_cliente_url}
        assinaturaData={proposta.instalacao_info?.concluida_em}
        assinaturaPor={proposta.instalacao_info?.instalador_nome}
        documentosSolicitados={proposta.documentos_solicitados_enviados}
      />

      {/* Observações do Vistoriador (se houver) */}
      {proposta.vistoria && (proposta.vistoria.observacoes || proposta.vistoria.km_atual) && (
        <VistoriaObservacoesCard 
          observacoes={proposta.vistoria.observacoes}
          kmAtual={proposta.vistoria.km_atual}
        />
      )}

      {/* ZONA 3: Tabs de Detalhes */}
      <PropostaDetalhesTabs
        proposta={proposta}
        onViewDocumento={setDocumentoVisualizar}
        veiculoRenavam={veiculoRenavam}
        setVeiculoRenavam={setVeiculoRenavam}
        veiculoChassi={veiculoChassi}
        setVeiculoChassi={setVeiculoChassi}
        onAprovarDocumento={handleAprovarDocumento}
        onReprovarDocumento={handleReprovarDocumento}
      />

      {/* DIALOGS */}
      <SolicitarDocumentosDialog
        open={showSolicitarDocs}
        onOpenChange={setShowSolicitarDocs}
        onConfirm={handleSolicitarDocumentos}
        loading={solicitarDocsMutation.isPending}
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
              {isAutovistoria 
                ? 'Confirmar Liberação de Cobertura'
                : 'Confirmar Aprovação'
              }
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              {isAutovistoria ? (
                <div className="space-y-3">
                  <p>Ao aprovar, o sistema irá <strong>liberar apenas a cobertura de roubo e furto</strong>:</p>
                  
                  <div className="bg-success/10 border border-success/30 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-6 h-6 rounded-full bg-success/20 flex items-center justify-center">
                        <ShieldCheck className="h-3 w-3 text-success" />
                      </div>
                      <span>Ativar cobertura de <strong>Roubo e Furto</strong></span>
                    </div>
                  </div>
                  
                  <div className="bg-muted rounded-lg p-3 space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      Pendente (após instalação do rastreador):
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ShieldOff className="h-3 w-3" />
                      <span>Cobertura Total</span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    A cobertura total será ativada automaticamente após a instalação e ativação do rastreador.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p>Ao aprovar esta proposta, o sistema irá:</p>
                  
                  <div className="bg-muted rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-6 h-6 rounded-full bg-success/20 flex items-center justify-center">
                        <User className="h-3 w-3 text-success" />
                      </div>
                      <span>Ativar o associado no sistema</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <Smartphone className="h-3 w-3 text-purple-500" />
                      </div>
                      <span>Liberar acesso ao App do Associado</span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    O cliente receberá uma notificação sobre a aprovação.
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarAprovacao}
              className="bg-success hover:bg-success/90 text-white"
              disabled={aprovarMutation.isPending}
            >
              {isAutovistoria ? (
                <ShieldCheck className="h-4 w-4 mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              {aprovarMutation.isPending 
                ? 'Aprovando...' 
                : isAutovistoria
                  ? 'Liberar Cobertura de Roubo e Furto'
                  : 'Confirmar Aprovação'
              }
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
                  <li>Liberar a <strong className="text-foreground">cobertura total</strong> para o veículo {proposta?.veiculo_placa}</li>
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
