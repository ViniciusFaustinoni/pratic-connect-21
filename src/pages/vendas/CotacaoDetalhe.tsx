import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCotacao, useCotacaoActions, useAtualizarStatusCotacao, useExcluirCotacao, useDuplicarCotacao } from '@/hooks/useCotacoes';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, AlertCircle, Shield, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

// Hooks
import { useHistoricoCotacao, registrarEventoCotacao } from '@/hooks/useCotacaoHistorico';
import { useCotacoesRealtime } from '@/hooks/useCotacoesRealtime';

// Componentes novos
import { CotacaoHeader } from '@/components/cotacoes/CotacaoHeader';
import { CotacaoAcoes } from '@/components/cotacoes/CotacaoAcoes';
import { CotacaoTimeline } from '@/components/cotacoes/CotacaoTimeline';
import { CotacaoClienteVeiculo } from '@/components/cotacoes/CotacaoClienteVeiculo';
import { CotacaoVendedor } from '@/components/cotacoes/CotacaoVendedor';
import { PlanoCardComparativo, type PlanoComparativo } from '@/components/cotacoes/PlanoCardComparativo';
import { PlanoDetalhesModal } from '@/components/cotacoes/PlanoDetalhesModal';

// Componentes existentes
import { EnviarEmailModal } from '@/components/cotacoes/EnviarEmailModal';
import { VincularLeadModal } from '@/components/cotacoes/VincularLeadModal';
import { ContratoWizard } from '@/components/contratos/ContratoWizard';
import { CotacaoFormDialog } from '@/components/cotacoes/CotacaoFormDialog';
import { isCoberturaRemovida } from '@/data/restricoesCategorias';
import { gerarPdfCotacaoComparativa } from '@/lib/gerarPdfCotacao';
import type { StatusCotacao } from '@/types/vendas';

// ============================================
// UTILITÁRIOS
// ============================================
const formatCurrency = (value: number | null | undefined) => {
  if (!value) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function CotacaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile, roles } = useAuth();

  // Verificar se é diretor para permissão de exclusão
  const isDiretor = roles?.includes('diretor');

  // Realtime para notificações
  useCotacoesRealtime();

  // Estados dos modais
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showVincularModal, setShowVincularModal] = useState(false);
  const [showContratoWizard, setShowContratoWizard] = useState(false);
  const [showEditarModal, setShowEditarModal] = useState(false);
  const [planoDetalhesModal, setPlanoDetalhesModal] = useState<PlanoComparativo | null>(null);
  const [isGerando, setIsGerando] = useState(false);

  // Hooks de dados
  const { data: cotacao, isLoading, error } = useCotacao(id);
  const { data: historico, isLoading: isLoadingHistorico } = useHistoricoCotacao(id);
  const { reenviarCotacao, atualizarStatus, isReenviando, isAtualizando } = useCotacaoActions();
  const atualizarStatusMutation = useAtualizarStatusCotacao();
  const excluirMutation = useExcluirCotacao();
  const duplicarMutation = useDuplicarCotacao();

  // ============================================
  // HANDLERS
  // ============================================
  
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

_Cotação válida por 7 dias_

Ficou com alguma dúvida? Estou à disposição!
    `.trim();

    const telefone = cotacao.leads?.telefone?.replace(/\D/g, '');
    const url = telefone 
      ? `https://wa.me/55${telefone}?text=${encodeURIComponent(mensagem)}`
      : `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
    
    window.open(url, '_blank');
    
    // Registrar no histórico
    registrarEventoCotacao({
      cotacaoId: cotacao.id,
      acao: 'whatsapp_enviado',
      autorId: profile?.id,
      autorNome: profile?.nome,
    });
    
    // Atualizar status para 'enviada'
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
    if (!id || !cotacao) return;
    
    const statusAnterior = cotacao.status;
    atualizarStatus({ id, status });
    
    // Registrar no histórico
    registrarEventoCotacao({
      cotacaoId: id,
      acao: 'status_alterado',
      detalhes: { status_anterior: statusAnterior, novo_status: status },
      autorId: profile?.id,
      autorNome: profile?.nome,
    });
  };

  const handleExcluir = () => {
    if (!id) return;
    excluirMutation.mutate(id, {
      onSuccess: () => {
        toast.success('Cotação excluída');
        navigate('/vendas/cotacoes');
      },
    });
  };

  const handleDuplicar = () => {
    if (!cotacao) return;
    
    duplicarMutation.mutate(cotacao.id, {
      onSuccess: (novaCotacao) => {
        // Registrar evento no histórico da cotação original
        registrarEventoCotacao({
          cotacaoId: cotacao.id,
          acao: 'duplicada',
          detalhes: { nova_cotacao_id: novaCotacao.id, nova_cotacao_numero: novaCotacao.numero },
          autorId: profile?.id,
          autorNome: profile?.nome,
        });
        
        // Navegar para a nova cotação
        navigate(`/vendas/cotacoes/${novaCotacao.id}`);
      },
    });
  };

  const handleEditar = () => {
    if (cotacao?.status === 'rascunho') {
      setShowEditarModal(true);
    }
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
      
      // Se não tem planos em dados_extras, usar o plano principal
      const planosParaPdf = planosComparacao.length > 0 
        ? planosComparacao.map(p => ({
            nome: p.nome,
            valorMensal: p.valorMensal,
            valorAdesao: p.valorAdesao ?? cotacao.valor_adesao ?? 0,
            coberturas: p.coberturas || [],
            naoInclui: p.naoInclui || [],
            coberturaFipe: p.coberturaFipe || 100,
            cota: p.cota || '6% (mín R$ 1.200,00)',
            // Campos expandidos para novo layout
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
            cota: '6% (mín R$ 1.200,00)',
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
      
      // Registrar no histórico
      registrarEventoCotacao({
        cotacaoId: cotacao.id,
        acao: 'pdf_baixado',
        autorId: profile?.id,
        autorNome: profile?.nome,
      });
      
      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
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


  // ============================================
  // LOADING STATE
  // ============================================
  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-64" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-64" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // ERROR STATE
  // ============================================
  if (error || !cotacao) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <Card className="max-w-md text-center">
          <CardContent className="pt-6">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
            <h2 className="mt-4 text-xl font-semibold">Cotação não encontrada</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              A cotação solicitada não existe ou foi removida.
            </p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => navigate('/vendas/cotacoes')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para lista
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Extrair planos para comparação
  const planosComparacao = (cotacao.dados_extras as { planos_comparacao?: PlanoComparativo[] } | null)?.planos_comparacao || [];
  const categoriaVeiculo = (cotacao as { categoria_veiculo?: string }).categoria_veiculo;
  
  // Se não tem planos em dados_extras, criar array com plano principal
  const planosExibir: PlanoComparativo[] = planosComparacao.length > 0 
    ? planosComparacao 
    : cotacao.planos 
      ? [{
          id: cotacao.planos.id,
          nome: cotacao.planos.nome || 'Plano',
          valorMensal: cotacao.valor_total_mensal || 0,
          valorAdesao: cotacao.valor_adesao,
          coberturas: [],
        }]
      : [];

  // Verificar plano recomendado (destaque ou segundo plano se houver 3)
  const getPlanoRecomendado = () => {
    const comDestaque = planosExibir.find(p => p.destaque);
    if (comDestaque) return comDestaque.id;
    if (planosExibir.length === 3) return planosExibir[1].id; // Meio
    return null;
  };
  const planoRecomendadoId = getPlanoRecomendado();

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="space-y-6 p-6">
      {/* BREADCRUMB */}
      <nav className="text-sm text-muted-foreground">
        <ol className="flex items-center gap-1">
          <li>
            <Link to="/dashboard" className="hover:text-foreground">Home</Link>
          </li>
          <li>/</li>
          <li>
            <Link to="/vendas/dashboard" className="hover:text-foreground">Vendas</Link>
          </li>
          <li>/</li>
          <li>
            <Link to="/vendas/cotacoes" className="hover:text-foreground">Cotações</Link>
          </li>
          <li>/</li>
          <li className="text-foreground font-medium">
            {cotacao.numero || `COT-${cotacao.id.slice(0, 8).toUpperCase()}`}
          </li>
        </ol>
      </nav>

      {/* BOTÃO VOLTAR */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/vendas/cotacoes')}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar
      </Button>

      {/* HEADER COM RESUMO EXECUTIVO */}
      <CotacaoHeader cotacao={cotacao} />

      {/* LAYOUT 2 COLUNAS */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* COLUNA PRINCIPAL */}
        <div className="space-y-6">
          {/* PLANOS PARA COMPARAÇÃO */}
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
                      valorAdesao={cotacao.valor_adesao || 0}
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

          {/* DADOS DO CLIENTE E VEÍCULO */}
          <CotacaoClienteVeiculo
            cotacao={cotacao}
            onVincularLead={() => setShowVincularModal(true)}
            onTrocarLead={() => setShowVincularModal(true)}
          />
        </div>

        {/* COLUNA LATERAL */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:h-fit">
          {/* AÇÕES RÁPIDAS */}
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
            canDelete={isDiretor}
          />

          {/* TIMELINE */}
          <CotacaoTimeline cotacao={cotacao} />

          {/* VENDEDOR */}
          <CotacaoVendedor vendedor={cotacao.vendedor} />
        </div>
      </div>

      {/* MODAIS */}
      <PlanoDetalhesModal
        open={!!planoDetalhesModal}
        onOpenChange={(open) => !open && setPlanoDetalhesModal(null)}
        plano={planoDetalhesModal}
        valorAdesao={cotacao.valor_adesao || 0}
        categoriaVeiculo={categoriaVeiculo}
        isCoberturaRemovida={isCoberturaRemovida}
      />

      {cotacao && (
        <EnviarEmailModal
          open={showEmailModal}
          onOpenChange={setShowEmailModal}
          cotacao={cotacao}
        />
      )}

      <VincularLeadModal
        open={showVincularModal}
        onOpenChange={setShowVincularModal}
        cotacaoId={cotacao.id}
        leadAtualId={cotacao.lead_id}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['cotacoes', id] });
        }}
      />

      {cotacao.lead_id && (
        <ContratoWizard
          open={showContratoWizard}
          onOpenChange={setShowContratoWizard}
          cotacaoId={cotacao.id}
          onContratoCreated={(contratoId) => {
            setShowContratoWizard(false);
            navigate(`/vendas/contratos/${contratoId}`);
          }}
        />
      )}

      {/* Modal de Edição */}
      {cotacao.status === 'rascunho' && (
        <CotacaoFormDialog
          open={showEditarModal}
          onOpenChange={setShowEditarModal}
          cotacaoParaEditar={cotacao}
          onSuccess={() => {
            setShowEditarModal(false);
            queryClient.invalidateQueries({ queryKey: ['cotacoes', id] });
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
    </div>
  );
}
