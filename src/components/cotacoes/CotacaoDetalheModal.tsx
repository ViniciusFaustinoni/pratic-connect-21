import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCotacao, useCotacaoActions, useAtualizarStatusCotacao, useExcluirCotacao, useDuplicarCotacao } from '@/hooks/useCotacoes';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Shield, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

import { useHistoricoCotacao, registrarEventoCotacao } from '@/hooks/useCotacaoHistorico';
import { useCotacoesRealtime } from '@/hooks/useCotacoesRealtime';
import { useCotaParticipacaoDefault, useCotaMinimaDefault } from '@/hooks/useConteudosSistema';

import { CotacaoHeader } from '@/components/cotacoes/CotacaoHeader';
import { CotacaoAcoes } from '@/components/cotacoes/CotacaoAcoes';
import { CotacaoTimeline } from '@/components/cotacoes/CotacaoTimeline';
import { CotacaoClienteVeiculo } from '@/components/cotacoes/CotacaoClienteVeiculo';
import { CotacaoVendedor } from '@/components/cotacoes/CotacaoVendedor';
import { PlanoCardComparativo, type PlanoComparativo } from '@/components/cotacoes/PlanoCardComparativo';
import { PlanoDetalhesModal } from '@/components/cotacoes/PlanoDetalhesModal';
import { TrocaTitularidadeBadge } from '@/components/cotacoes/TrocaTitularidadeBadge';
import { useTrocaPlanoAtual } from '@/hooks/useTrocaPlanoAtual';
import { History } from 'lucide-react';

import { EnviarEmailModal } from '@/components/cotacoes/EnviarEmailModal';
import { VincularLeadModal } from '@/components/cotacoes/VincularLeadModal';
import { ContratoWizard } from '@/components/contratos/ContratoWizard';
import { CotacaoFormDialog } from '@/components/cotacoes/CotacaoFormDialog';
import { DuplicarCotacaoDialog, type DuplicarCotacaoConfirmPayload } from '@/components/cotacoes/DuplicarCotacaoDialog';
import { isCoberturaRemovida } from '@/data/restricoesCategorias';
import { gerarPdfCotacaoComparativa } from '@/lib/gerarPdfCotacao';
import type { StatusCotacao } from '@/types/vendas';

const formatCurrency = (value: number | null | undefined) => {
  if (!value) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

interface CotacaoDetalheModalProps {
  cotacaoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CotacaoDetalheModal({ cotacaoId, open, onOpenChange }: CotacaoDetalheModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { hasPerm } = usePermissions();
  const isDiretor = hasPerm('canDeleteCotacao');

  useCotacoesRealtime();

  const { data: cotaPercDefault = 6 } = useCotaParticipacaoDefault();
  const { data: cotaMinDefault = 1200 } = useCotaMinimaDefault();
  const cotaFallbackStr = `${cotaPercDefault}% (mín R$ ${cotaMinDefault.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`;

  const [tab, setTab] = useState('resumo');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showVincularModal, setShowVincularModal] = useState(false);
  const [showContratoWizard, setShowContratoWizard] = useState(false);
  const [showEditarModal, setShowEditarModal] = useState(false);
  const [planoDetalhesModal, setPlanoDetalhesModal] = useState<PlanoComparativo | null>(null);
  const [isGerando, setIsGerando] = useState(false);
  const [showDuplicarDialog, setShowDuplicarDialog] = useState(false);

  const { data: cotacao, isLoading, error } = useCotacao(cotacaoId || undefined);
  useHistoricoCotacao(cotacaoId || undefined);
  const { atualizarStatus, isAtualizando } = useCotacaoActions();
  const atualizarStatusMutation = useAtualizarStatusCotacao();
  const excluirMutation = useExcluirCotacao();
  const duplicarMutation = useDuplicarCotacao();

  const handleWhatsApp = async () => {
    if (!cotacao) return;
    const mensagem = `
🚗 *COTAÇÃO DE PROTEÇÃO VEICULAR*

Olá ${cotacao.leads?.nome?.split(' ')[0] || 'Cliente'}!

*Veículo:* ${cotacao.veiculo_marca || ''} ${cotacao.veiculo_modelo || ''} ${cotacao.veiculo_ano || ''}
*Valor FIPE:* ${formatCurrency(cotacao.valor_fipe)}

*Plano:* ${cotacao.planos?.nome || 'Plano Selecionado'}
*Adesão:* ${formatCurrency(cotacao.valor_adesao)}
*Mensalidade:* ${formatCurrency(cotacao.valor_total_mensal)}

Ficou com alguma dúvida? Estou à disposição!
    `.trim();

    const telefone = cotacao.leads?.telefone?.replace(/\D/g, '');
    const url = telefone
      ? `https://wa.me/55${telefone}?text=${encodeURIComponent(mensagem)}`
      : `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');

    registrarEventoCotacao({
      cotacaoId: cotacao.id,
      acao: 'whatsapp_enviado',
      autorId: profile?.id,
      autorNome: profile?.nome,
    });

    if (cotacao.status === 'rascunho') {
      atualizarStatus({ id: cotacao.id, status: 'enviada' });
      if (cotacao.lead_id) {
        await supabase
          .from('leads')
          .update({ etapa: 'cotacao_enviada', updated_at: new Date().toISOString() })
          .eq('id', cotacao.lead_id);
      }
    }
  };

  const handleMudarStatus = (status: StatusCotacao) => {
    if (!cotacaoId || !cotacao) return;
    const statusAnterior = cotacao.status;
    atualizarStatus({ id: cotacaoId, status });
    registrarEventoCotacao({
      cotacaoId,
      acao: 'status_alterado',
      detalhes: { status_anterior: statusAnterior, novo_status: status },
      autorId: profile?.id,
      autorNome: profile?.nome,
    });
  };

  const handleExcluir = () => {
    if (!cotacaoId) return;
    excluirMutation.mutate({ cotacaoId }, {
      onSuccess: () => {
        toast.success('Cotação excluída');
        onOpenChange(false);
      },
    });
  };

  const handleDuplicar = () => {
    if (!cotacao) return;
    setShowDuplicarDialog(true);
  };

  const handleConfirmarDuplicacao = async (payload: DuplicarCotacaoConfirmPayload) => {
    if (!cotacao) return;
    try {
      const novaCotacao: any = await duplicarMutation.mutateAsync({
        cotacaoId: cotacao.id,
        motivo: payload.motivo,
        acaoOriginal: payload.acaoOriginal,
      });

      if (payload.acaoOriginal === 'manter') {
        registrarEventoCotacao({
          cotacaoId: cotacao.id,
          acao: 'duplicada',
          detalhes: {
            nova_cotacao_id: novaCotacao.id,
            nova_cotacao_numero: novaCotacao.numero,
            motivo: payload.motivo,
          },
          autorId: profile?.id,
          autorNome: profile?.nome,
        });
      }

      setShowDuplicarDialog(false);
      onOpenChange(false);
      setTimeout(() => {
        navigate(`/vendas/cotacoes?abrir=${novaCotacao.id}`);
      }, 100);
    } catch {
      // toast já tratado
    }
  };

  const contratoAssinado = !!(cotacao?.contrato && ['assinado', 'ativo'].includes(cotacao.contrato.status));

  const handleEditar = () => {
    if (!contratoAssinado) setShowEditarModal(true);
  };

  const handleCopiarLink = () => {
    if (!cotacao) return;
    registrarEventoCotacao({
      cotacaoId: cotacao.id,
      acao: 'link_copiado',
      autorId: profile?.id,
      autorNome: profile?.nome,
    });
  };

  const handleBaixarPDF = async () => {
    if (!cotacao) return;
    setIsGerando(true);
    try {
      const planosComparacao = (cotacao.dados_extras as { planos_comparacao?: PlanoComparativo[] } | null)?.planos_comparacao || [];

      const planosParaPdf = planosComparacao.length > 0
        ? planosComparacao.map(p => ({
            nome: p.nome,
            valorMensal: p.valorMensal,
            valorAdesao: p.valorAdesao ?? cotacao.valor_adesao ?? 0,
            coberturas: p.coberturas || [],
            naoInclui: p.naoInclui || [],
            coberturaFipe: p.coberturaFipe || 100,
            cota: p.cota || cotaFallbackStr,
            cotaPercentual: p.cotaPercentual,
            cotaMinima: p.cotaMinima,
            cotaDesagio: p.cotaDesagio,
            cotaMinimaDesagio: p.cotaMinimaDesagio,
            adicionalMensal: p.adicionalMensal,
            anoMinimo: p.anoMinimo,
            alertaDesagio: p.alertaDesagio,
            coberturasRemovidas: p.coberturasRemovidas,
          }))
        : [{
            nome: cotacao.planos?.nome || 'Plano',
            valorMensal: cotacao.valor_total_mensal || 0,
            valorAdesao: cotacao.valor_adesao || 0,
            coberturas: [],
            naoInclui: [],
            coberturaFipe: 100,
            cota: cotaFallbackStr,
          }];

      await gerarPdfCotacaoComparativa({
        numero: cotacao.numero || `COT-${cotacao.id.slice(0, 8)}`,
        created_at: cotacao.created_at,
        validade_dias: 7,
        nome_solicitante: cotacao.leads?.nome || 'Cliente',
        telefone1_solicitante: cotacao.leads?.telefone || '',
        email_solicitante: cotacao.leads?.email || '',
        veiculo_marca: cotacao.veiculo_marca || '',
        veiculo_modelo: cotacao.veiculo_modelo || '',
        veiculo_ano: cotacao.veiculo_ano || null,
        veiculo_placa: cotacao.veiculo_placa || null,
        valor_fipe: cotacao.valor_fipe || null,
        planosComparar: planosParaPdf,
      });

      registrarEventoCotacao({
        cotacaoId: cotacao.id,
        acao: 'pdf_baixado',
        autorId: profile?.id,
        autorNome: profile?.nome,
      });

      toast.success('PDF gerado com sucesso!');
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      toast.error('Erro ao gerar PDF');
    } finally {
      setIsGerando(false);
    }
  };

  const handleAceitarEContrato = () => {
    if (!cotacao) return;
    if (cotacao.status !== 'aceita') {
      atualizarStatusMutation.mutate(
        { id: cotacao.id, status: 'aceita' },
        { onSuccess: () => setShowContratoWizard(true) }
      );
    } else {
      setShowContratoWizard(true);
    }
  };

  const planosComparacao = (cotacao?.dados_extras as { planos_comparacao?: PlanoComparativo[] } | null)?.planos_comparacao || [];
  const categoriaVeiculo = (cotacao as { categoria_veiculo?: string } | undefined)?.categoria_veiculo;

  const planosExibir: PlanoComparativo[] = planosComparacao.length > 0
    ? planosComparacao
    : cotacao?.planos
      ? [{
          id: cotacao.planos.id,
          nome: cotacao.planos.nome || 'Plano',
          valorMensal: cotacao.valor_total_mensal || 0,
          valorAdesao: cotacao.valor_adesao,
          coberturas: [],
        }]
      : [];

  const getPlanoRecomendado = () => {
    const comDestaque = planosExibir.find(p => p.destaque);
    if (comDestaque) return comDestaque.id;
    if (planosExibir.length === 3) return planosExibir[1].id;
    return null;
  };
  const planoRecomendadoId = getPlanoRecomendado();

  const renderPlanos = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {planosExibir.length > 1 ? 'Planos para Comparação' : 'Plano Selecionado'}
          </CardTitle>
          {planosExibir.length < 3 && (
            <Button variant="outline" size="sm" disabled>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {planosExibir.length > 0 ? (
          <div className={cn(
            "grid gap-4",
            planosExibir.length === 1 && "md:grid-cols-1 max-w-md mx-auto",
            planosExibir.length === 2 && "md:grid-cols-2",
            planosExibir.length >= 3 && "md:grid-cols-2 lg:grid-cols-3"
          )}>
            {planosExibir.map((plano, idx) => (
              <PlanoCardComparativo
                key={plano.id}
                plano={plano}
                valorAdesao={cotacao?.valor_adesao || 0}
                isRecomendado={plano.id === planoRecomendadoId}
                isSelecionado={false}
                indice={planosExibir.length > 1 ? idx : undefined}
                categoriaVeiculo={categoriaVeiculo}
                onVerDetalhes={setPlanoDetalhesModal}
                isCoberturaRemovida={isCoberturaRemovida}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum plano selecionado</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0">
        {isLoading && (
          <div className="p-6 space-y-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-10 w-80" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}

        {!isLoading && (error || !cotacao) && (
          <div className="flex min-h-[40vh] items-center justify-center p-6">
            <Card className="max-w-md text-center">
              <CardContent className="pt-6">
                <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
                <h2 className="mt-4 text-xl font-semibold">Cotação não encontrada</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  A cotação solicitada não existe ou foi removida.
                </p>
                <Button className="mt-4" variant="outline" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {!isLoading && cotacao && (
          <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 min-h-0">
            {/* Header fixo */}
            <div className="border-b px-6 pt-6 pb-4 space-y-4">
              <CotacaoHeader cotacao={cotacao} />
              <TrocaTitularidadeBadge
                cotacaoId={cotacao.id}
                tipoEntrada={(cotacao.dados_extras as { tipo_entrada?: string } | null)?.tipo_entrada}
              />
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="resumo">Resumo</TabsTrigger>
                <TabsTrigger value="planos">Planos</TabsTrigger>
                <TabsTrigger value="cliente">Cliente & Veículo</TabsTrigger>
                <TabsTrigger value="historico">Histórico</TabsTrigger>
              </TabsList>
            </div>

            {/* Conteúdo rolável */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <TabsContent value="resumo" className="mt-0 space-y-6">
                <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                  <div className="space-y-6">
                    {renderPlanos()}
                  </div>
                  <div className="space-y-4">
                    <CotacaoAcoes
                      cotacao={cotacao}
                      onBaixarPDF={handleBaixarPDF}
                      onEnviarWhatsApp={handleWhatsApp}
                      onEnviarEmail={() => setShowEmailModal(true)}
                      onDuplicar={handleDuplicar}
                      onEditar={handleEditar}
                      onMudarStatus={handleMudarStatus}
                      onExcluir={handleExcluir}
                      onAceitarEContrato={handleAceitarEContrato}
                      onCopiarLink={handleCopiarLink}
                      isAtualizando={isAtualizando || atualizarStatusMutation.isPending}
                      isExcluindo={excluirMutation.isPending}
                      isGerando={isGerando}
                      isDuplicando={duplicarMutation.isPending}
                      canDelete={
                        isDiretor ||
                        (cotacao?.vendedor_id === profile?.id && !contratoAssinado && cotacao?.status === 'rascunho')
                      }
                      deleteReason={
                        contratoAssinado
                          ? 'Cotações com contrato ativo não podem ser excluídas'
                          : !(isDiretor || cotacao?.vendedor_id === profile?.id)
                            ? 'Apenas o vendedor responsável ou diretores podem excluir'
                            : cotacao?.status !== 'rascunho' && !isDiretor
                              ? 'O consultor só pode excluir cotações em rascunho'
                              : undefined
                      }
                      contratoAssinado={contratoAssinado}
                    />
                    <CotacaoVendedor vendedor={cotacao.vendedor} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="planos" className="mt-0">
                {renderPlanos()}
              </TabsContent>

              <TabsContent value="cliente" className="mt-0">
                <CotacaoClienteVeiculo
                  cotacao={cotacao}
                  onVincularLead={() => setShowVincularModal(true)}
                  onTrocarLead={() => setShowVincularModal(true)}
                />
              </TabsContent>

              <TabsContent value="historico" className="mt-0">
                <CotacaoTimeline cotacao={cotacao} />
              </TabsContent>
            </div>

            {/* Modais filhos */}
            <PlanoDetalhesModal
              open={!!planoDetalhesModal}
              onOpenChange={(o) => !o && setPlanoDetalhesModal(null)}
              plano={planoDetalhesModal}
              valorAdesao={cotacao.valor_adesao || 0}
              categoriaVeiculo={categoriaVeiculo}
              isCoberturaRemovida={isCoberturaRemovida}
            />

            <EnviarEmailModal
              open={showEmailModal}
              onOpenChange={setShowEmailModal}
              cotacao={cotacao}
            />

            <VincularLeadModal
              open={showVincularModal}
              onOpenChange={setShowVincularModal}
              cotacaoId={cotacao.id}
              leadAtualId={cotacao.lead_id}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ['cotacoes', cotacaoId] });
              }}
            />

            {cotacao.lead_id && (
              <ContratoWizard
                open={showContratoWizard}
                onOpenChange={setShowContratoWizard}
                cotacaoId={cotacao.id}
                onContratoCreated={(contratoId) => {
                  setShowContratoWizard(false);
                  onOpenChange(false);
                  navigate(`/vendas/contratos/${contratoId}`);
                }}
              />
            )}

            {!contratoAssinado && (
              <CotacaoFormDialog
                open={showEditarModal}
                onOpenChange={setShowEditarModal}
                cotacaoParaEditar={cotacao}
                onSuccess={() => {
                  setShowEditarModal(false);
                  queryClient.invalidateQueries({ queryKey: ['cotacoes', cotacaoId] });
                  registrarEventoCotacao({
                    cotacaoId: cotacao.id,
                    acao: 'editada',
                    autorId: profile?.id,
                    autorNome: profile?.nome,
                  });
                  toast.success('Cotação atualizada com sucesso!');
                }}
              />
            )}

            <DuplicarCotacaoDialog
              open={showDuplicarDialog}
              onOpenChange={setShowDuplicarDialog}
              cotacao={cotacao ? {
                id: cotacao.id,
                numero: cotacao.numero,
                vendedor_id: cotacao.vendedor_id,
                status: cotacao.status,
              } : null}
              vendedorOriginalNome={cotacao?.vendedor?.nome || null}
              currentUserId={profile?.id}
              isSubmitting={duplicarMutation.isPending}
              onConfirm={handleConfirmarDuplicacao}
            />
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
