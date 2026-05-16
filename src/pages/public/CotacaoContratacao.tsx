import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Car, CheckCircle2, CalendarCheck, Calendar, Clock, MapPin, PartyPopper, Shield, ShieldCheck, Loader2, Puzzle, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCotacaoContratacao } from '@/hooks/useCotacaoContratacao';
import { useAgendamentoExistente } from '@/hooks/useAgendamentoExistente';
import { StepperCotacao, type Step } from '@/components/cotacao-publica/StepperCotacao';
import { EscolhaPlano } from '@/components/cotacao-publica/EscolhaPlano';
import { EtapaDadosPessoaisDocumentos } from '@/components/cotacao-publica/EtapaDadosPessoaisDocumentos';
import { EtapaAssinaturaContrato } from '@/components/cotacao-publica/EtapaAssinaturaContrato';
import { EtapaAssinaturaSubstituicao } from '@/components/cotacao-publica/EtapaAssinaturaSubstituicao';
import { EtapaVistoria } from '@/components/cotacao-publica/EtapaVistoria';
import { EtapaPagamentoCotacao } from '@/components/cotacao-publica/EtapaPagamentoCotacao';
import { AgendamentoVistoriaCompleta } from '@/components/cotacao-publica/AgendamentoVistoriaCompleta';
import { DocumentosPendentesPublico } from '@/components/cotacao-publica/DocumentosPendentesPublico';
import { AgendamentoBaseResumo } from '@/components/cotacao-publica/AgendamentoBaseResumo';
import { AgendamentoSubstituicao } from '@/components/cotacao-publica/AgendamentoSubstituicao';
import { NavegacaoEtapas } from '@/components/cotacao-publica/NavegacaoEtapas';
import { TelaAnaliseTrocaTitularidade } from '@/components/troca-titularidade/TelaAnaliseTrocaTitularidade';
import { useSolicitacaoTrocaPublicaPorCotacao } from '@/hooks/useSolicitacaoTrocaPublica';
import type { DadosPessoaisForm } from '@/components/cotacao-publica/FormularioDadosPessoais';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { formatarMoeda } from '@/utils/format';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { EtapaCriacaoSenhaCotacao } from '@/components/cotacao-publica/EtapaCriacaoSenhaCotacao';

import { useDetectarTipoVeiculo } from '@/hooks/useDetectarTipoVeiculo';
import { detectarTipoVeiculo } from '@/data/vistoriaConfigCompleta';
import { exigeRastreador } from '@/types/termo-filiacao';

function detectarTipoVeiculoDaCotacao(cotacao: any): 'carro' | 'moto' {
  // 1. Verificar categoria explícita
  const cat = cotacao.categoria || cotacao.veiculo_categoria;
  if (cat) {
    const catLower = cat.toLowerCase();
    if (catLower === 'moto' || catLower.includes('motocicleta') || catLower.includes('ciclomotor')) return 'moto';
    return 'carro';
  }
  // 2. Fallback: keywords síncrono
  const tipo = detectarTipoVeiculo(undefined, cotacao.veiculo_modelo, cotacao.veiculo_marca);
  return tipo === 'moto' ? 'moto' : 'carro';
}

// NOVO FLUXO: 1-Plano, 2-Docs, 3-Contrato (Autentique), 4-Vistoria, 5-Pagamento
// Quando autovistoria: adiciona 6ª etapa "Instalação" (índice 5) para agendamento físico do rastreador
const STEPS_BASE: Step[] = [
  { id: 'plano', label: 'Escolha do Plano', description: 'Selecione seu plano' },
  { id: 'documentos', label: 'Documentos', description: 'Envie seus dados' },
  { id: 'contrato', label: 'Contrato', description: 'Assine digitalmente' },
  { id: 'vistoria', label: 'Vistoria', description: 'Tire as fotos' },
  { id: 'pagamento', label: 'Pagamento', description: 'Ative sua cobertura' },
];
const STEP_INSTALACAO: Step = { id: 'instalacao', label: 'Instalação', description: 'Agende o rastreador' };

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.3 } },
};

export default function CotacaoContratacao() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    cotacao,
    isLoading,
    error,
    planosDisponiveis,
    etapaAtual,
    setEtapaAtual,
    determinarEtapa,
    selecionarPlano,
    salvarDadosPessoais,
    isPending,
    // Novos campos para documentos pendentes
    associadoId,
    associadoStatus,
    contratoLinkToken,
    contratoFallback,
    docsPendentes,
    isLoadingDocs,
    refetch,
    refetchDocs,
  } = useCotacaoContratacao(token);

  // Verificar se já existe agendamento nas tabelas operacionais (fonte da verdade)
  const { hasVistoriaAgendada, hasInstalacaoAgendada, hasAgendamentoBase, isLoading: isLoadingAgendamento } = useAgendamentoExistente(cotacao?.id);
  
  // Estado local para travar UI após agendamento bem-sucedido
  const [agendamentoConcluido, setAgendamentoConcluido] = useState(false);

  const { data: instalacaoPublica } = useQuery({
    queryKey: ['cotacao-contratacao-instalacao', cotacao?.id, contratoFallback?.id, associadoId],
    queryFn: async () => {
      if (!cotacao?.id && !contratoFallback?.id && !associadoId) return null;

      let query = publicSupabase
        .from('instalacoes')
        .select('id, status, data_agendada, hora_agendada, periodo, logradouro, numero, bairro, cidade, uf, created_at')
        .not('status', 'in', '(cancelada,concluida)');

      if (contratoFallback?.id) {
        query = query.eq('contrato_id', contratoFallback.id);
      } else if (cotacao?.id) {
        query = query.eq('cotacao_id', cotacao.id);
      } else if (associadoId) {
        query = query.eq('associado_id', associadoId);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('[CotacaoContratacao] Erro ao buscar instalação pública:', error);
        return null;
      }

      return data;
    },
    enabled: !!cotacao?.id || !!contratoFallback?.id || !!associadoId,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

  // Estado para navegação manual (quando usuário clica em etapas anteriores para revisar)
  const [navegacaoManual, setNavegacaoManual] = useState(false);

  const [planoSelecionadoId, setPlanoSelecionadoId] = useState<string | null>(null);

  const instalacaoAgendadaPublica = useMemo(() => {
    if (instalacaoPublica?.data_agendada) {
      return {
        data: instalacaoPublica.data_agendada,
        horario: instalacaoPublica.periodo || instalacaoPublica.hora_agendada || null,
        logradouro: instalacaoPublica.logradouro || null,
        numero: instalacaoPublica.numero || null,
        bairro: instalacaoPublica.bairro || null,
        cidade: instalacaoPublica.cidade || null,
        uf: instalacaoPublica.uf || null,
      };
    }

    if (cotacao?.vistoria_completa_data_agendada) {
      return {
        data: cotacao.vistoria_completa_data_agendada,
        horario: cotacao.vistoria_completa_periodo || cotacao.vistoria_completa_horario_agendado || null,
        logradouro: cotacao.vistoria_completa_endereco_logradouro || null,
        numero: cotacao.vistoria_completa_endereco_numero || null,
        bairro: cotacao.vistoria_completa_endereco_bairro || null,
        cidade: cotacao.vistoria_completa_endereco_cidade || null,
        uf: cotacao.vistoria_completa_endereco_estado || null,
      };
    }

    return null;
  }, [instalacaoPublica, cotacao]);

  // Substituição: detectar se é substituição e controlar etapa de "mesmo local"
  const dadosExtras = (cotacao as any)?.dados_extras as Record<string, any> | null;
  const isSubstituicao = dadosExtras?.tipo_entrada === 'substituicao';
  const isTrocaTitularidade = dadosExtras?.tipo_entrada === 'troca_titularidade';
  const solicitacaoTrocaId = (dadosExtras?.solicitacao_troca_id as string | undefined) || null;
  const { data: solicitacaoTroca, isLoading: loadingSolicitacaoTroca, isFetched: solicitacaoTrocaFetched } = useSolicitacaoTrocaPublicaPorCotacao(
    isTrocaTitularidade ? cotacao?.id : null,
    isTrocaTitularidade ? solicitacaoTrocaId : null,
  );
  // Cotação marcada como troca de titularidade mas sem solicitação vinculada =
  // estado órfão (vincular-cotacao-troca falhou na criação). Tentamos auto-curar
  // chamando a edge — `dados_extras.solicitacao_troca_id` carrega a referência.
  const trocaOrfaBruta = isTrocaTitularidade && solicitacaoTrocaFetched && !loadingSolicitacaoTroca && !solicitacaoTroca;
  const [autoVinculandoTroca, setAutoVinculandoTroca] = useState(false);
  const [autoVinculoFalhou, setAutoVinculoFalhou] = useState(false);
  useEffect(() => {
    if (!trocaOrfaBruta || autoVinculandoTroca || autoVinculoFalhou) return;
    const solicId = solicitacaoTrocaId || undefined;
    if (!solicId || !cotacao?.id) { setAutoVinculoFalhou(true); return; }
    setAutoVinculandoTroca(true);
    (async () => {
      try {
        const { data, error } = await publicSupabase.functions.invoke('vincular-cotacao-troca', {
          body: { solicitacao_id: solicId, cotacao_id: cotacao.id },
        });
        if (error || (data as any)?.error) throw error || new Error((data as any).error);
        // sucesso → invalidar para refetch
        await refetch?.();
      } catch (e) {
        console.error('[auto-vincular-troca] falhou:', e);
        setAutoVinculoFalhou(true);
      } finally {
        setAutoVinculandoTroca(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trocaOrfaBruta, solicitacaoTrocaId, cotacao?.id]);
  const trocaOrfa = trocaOrfaBruta && autoVinculoFalhou && !autoVinculandoTroca;
  // Troca: liberada para o público AVANÇAR até a autovistoria assim que o termo
  // de cancelamento estiver assinado. O Pagamento (etapa 4) permanece travado
  // até que o Monitoramento aprove (status `liberada_para_assinatura`/`efetivada`).
  // Cadastro precisa analisar manualmente as fotos+docs em /cadastro/processos
  // antes de promover para o Monitoramento — não há mais auto-aprovação.
  const trocaLiberada = !!solicitacaoTroca && (
    solicitacaoTroca.status === 'liberada_para_assinatura' ||
    solicitacaoTroca.status === 'efetivada' ||
    !!solicitacaoTroca.termo_cancelamento_assinado_em
  );
  const trocaPagamentoLiberado = !!solicitacaoTroca && (
    solicitacaoTroca.status === 'liberada_para_assinatura' ||
    solicitacaoTroca.status === 'efetivada'
  );
  const trocaReprovada = solicitacaoTroca?.status === 'reprovada_cadastro' || solicitacaoTroca?.status === 'reprovada_monitoramento';

  // Janela mesmo-dia: até 23:59:59.999 BRT do dia em que o termo de cancelamento
  // foi assinado, autovistoria/vistoria inicial é DISPENSADA — proteção do
  // titular antigo é estendida ao novo. Monitoramento avalia depois.
  const trocaDentroJanelaMesmoDia = useMemo(() => {
    if (!isTrocaTitularidade) return false;
    const assinado = solicitacaoTroca?.termo_cancelamento_assinado_em;
    if (!assinado) return false;
    const a = new Date(assinado);
    const fimDiaBRTemUTC = new Date(Date.UTC(
      a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate(),
      26, 59, 59, 999
    ));
    return new Date() <= fimDiaBRTemUTC;
  }, [isTrocaTitularidade, solicitacaoTroca?.termo_cancelamento_assinado_em]);
  const dispensaVistoriaTroca = trocaDentroJanelaMesmoDia;
  // FLUXO UNIFICADO: troca de titularidade segue o MESMO stepper da nova adesão
  // após o termo de cancelamento estar assinado: Plano → Docs → Contrato → Vistoria → Pagamento.
  // O passo de Pagamento sempre aparece — quando a adesão é isenta, o próprio
  // EtapaPagamentoCotacao detecta valor zero e dispara skipPaymentCheck automaticamente
  // (mesma regra usada na nova adesão). Não fazemos atalho aqui.
  
  const [substituicaoMesmoLocal, setSubstituicaoMesmoLocal] = useState<boolean | null>(null);

  // Determinar etapa baseada no status para saber o que está concluído
  // IMPORTANTE: Se tipo_vistoria já está preenchido, considera vistoria como concluída (etapa 4+)
  const etapaDoStatus = useMemo(() => {
    if (!cotacao?.status_contratacao) return 0;

    const etapaBase = determinarEtapa(cotacao.status_contratacao);

    // Se vistoria já foi escolhida/agendada (tipo_vistoria preenchido) e ainda está na etapa 3,
    // avança para a etapa 4 (pagamento) para não pedir agendamento novamente
    if (etapaBase === 3 && cotacao.tipo_vistoria) {
      return 4;
    }

    // AUTOVISTORIA ANTECIPADA + RASTREADOR OBRIGATÓRIO:
    // Cliente fez autovistoria opcional (libera R/F), Cadastro já avaliou e o veículo
    // exige instalação física do rastreador. Se ainda NÃO há instalação/agendamento,
    // forçar a etapa Instalação (índice 5) para o cliente agendar a visita do técnico.
    if (
      cotacao.tipo_vistoria === 'autovistoria' &&
      ['aguardando_aprovacao_monitoramento', 'vistoria_concluida', 'pagamento_ok'].includes(
        cotacao.status_contratacao
      )
    ) {
      const precisa = exigeRastreador({
        tipo: detectarTipoVeiculoDaCotacao(cotacao),
        valorFipe: Number((cotacao as any).veiculo_valor_fipe ?? (cotacao as any).valor_fipe ?? 0),
        combustivel: (cotacao as any).veiculo_combustivel || undefined,
      } as any).exige;
      const semInstalacao =
        !cotacao.vistoria_completa_data_agendada &&
        !hasInstalacaoAgendada &&
        !hasAgendamentoBase &&
        !agendamentoConcluido;
      if (precisa && semInstalacao) {
        return 5;
      }
    }

    return etapaBase;
  }, [
    cotacao?.status_contratacao,
    cotacao?.tipo_vistoria,
    cotacao?.vistoria_completa_data_agendada,
    determinarEtapa,
    hasInstalacaoAgendada,
    hasAgendamentoBase,
    agendamentoConcluido,
    cotacao,
  ]);

  // STEPS dinâmico:
  //  - autovistoria => adiciona "Instalação" como 6ª etapa
  // (Troca de titularidade segue a MESMA ordem da nova adesão — Pagamento sempre presente)
  const STEPS = useMemo<Step[]>(() => {
    if (cotacao?.tipo_vistoria === 'autovistoria') {
      return [...STEPS_BASE, STEP_INSTALACAO];
    }
    return STEPS_BASE;
  }, [cotacao?.tipo_vistoria]);

  // Ordem de navegação por índices INTERNOS (mesmos do determinarEtapa):
  // 0=plano, 1=docs, 2=contrato, 3=vistoria, 4=pagamento, 5=conclusão/instalação
  const navOrder = useMemo<number[]>(() => [0, 1, 2, 3, 4, 5], []);

  // Função para verificar se uma etapa específica já foi concluída
  // Isso garante o modo somente leitura mesmo quando o cliente volta para etapas anteriores
  const isEtapaConcluida = useCallback((etapaIndex: number): boolean => {
    if (!cotacao?.status_contratacao) return false;
    
    const statusConcluidos = {
      plano: ['plano_escolhido', 'dados_preenchidos', 'documentos_ok', 'contrato_assinado', 'vistoria_ok', 'pagamento_ok', 'contrato_gerado', 'ativo'],
      documentos: ['dados_preenchidos', 'documentos_ok', 'contrato_assinado', 'vistoria_ok', 'pagamento_ok', 'contrato_gerado', 'ativo'],
      contrato: ['contrato_assinado', 'vistoria_ok', 'pagamento_ok', 'contrato_gerado', 'ativo'],
      vistoria: ['vistoria_ok', 'pagamento_ok', 'contrato_gerado', 'ativo'],
      pagamento: ['pagamento_ok', 'contrato_gerado', 'ativo'],
    };
    
    switch (etapaIndex) {
      case 0: // Plano - concluído se plano_escolhido_id existe
        return !!cotacao.plano_escolhido_id || statusConcluidos.plano.includes(cotacao.status_contratacao);
      case 1: // Documentos - concluído se status >= dados_preenchidos
        return statusConcluidos.documentos.includes(cotacao.status_contratacao);
      case 2: // Contrato - concluído se status >= contrato_assinado
        return statusConcluidos.contrato.includes(cotacao.status_contratacao);
      case 3: // Vistoria - concluído se tipo_vistoria está preenchido OU status >= vistoria_ok
              // OU troca de titularidade dentro da janela mesmo-dia (vistoria dispensada)
        return dispensaVistoriaTroca || !!cotacao.tipo_vistoria || statusConcluidos.vistoria.includes(cotacao.status_contratacao);
      case 4: // Pagamento - concluído se status >= pagamento_ok
        return statusConcluidos.pagamento.includes(cotacao.status_contratacao);
      case 5: // Instalação (apenas autovistoria) - concluída quando instalação agendada ou status final
        if (cotacao.tipo_vistoria !== 'autovistoria') return false;
        return (
          !!cotacao.vistoria_completa_data_agendada ||
          hasInstalacaoAgendada ||
          agendamentoConcluido ||
          cotacao.status_contratacao === 'ativo'
        );
      default:
        return false;
    }
  }, [cotacao?.status_contratacao, cotacao?.plano_escolhido_id, cotacao?.tipo_vistoria, cotacao?.vistoria_completa_data_agendada, hasInstalacaoAgendada, agendamentoConcluido, dispensaVistoriaTroca]);

  // NÃO redirecionar automaticamente — manter o associado na página da cotação
  // mesmo quando já está ativo, para que ele possa continuar o fluxo de contratação

  // Sincronizar etapa com status da cotação (apenas se não está em navegação manual)
  useEffect(() => {
    // Não sincronizar se usuário está navegando manualmente (revisando etapas anteriores)
    if (navegacaoManual) return;

    if (cotacao?.status_contratacao) {
      let etapa = determinarEtapa(cotacao.status_contratacao);

      // Se vistoria já foi escolhida/agendada, avança para pagamento
      if (etapa === 3 && cotacao.tipo_vistoria) {
        etapa = 4;
      }

      // Troca dentro da janela mesmo-dia: pula etapa de vistoria automaticamente
      if (etapa === 3 && dispensaVistoriaTroca) {
        etapa = 4;
      }

      setEtapaAtual(etapa);
    }
  }, [cotacao?.status_contratacao, cotacao?.tipo_vistoria, dispensaVistoriaTroca, determinarEtapa, setEtapaAtual, navegacaoManual]);

  // Handler unificado pós-assinatura do contrato (etapa 2 → próxima)
  // Em troca de titularidade segue a navOrder (Pagamento na sequência), igual à nova adesão.
  const handleContratoAssinado = useCallback(async (proximaEtapaPadrao: number) => {
    if (isTrocaTitularidade) {
      const idx = navOrder.indexOf(2);
      const next = idx >= 0 && idx < navOrder.length - 1 ? navOrder[idx + 1] : proximaEtapaPadrao;
      setEtapaAtual(next);
      return;
    }
    setEtapaAtual(proximaEtapaPadrao);
  }, [isTrocaTitularidade, setEtapaAtual, navOrder]);

  // Handler para navegação no Stepper
  const handleStepClick = useCallback((step: number) => {
    const idxStep = navOrder.indexOf(step);
    const idxStatus = navOrder.indexOf(etapaDoStatus);
    if (idxStep >= 0 && idxStep <= idxStatus) {
      setNavegacaoManual(true);
      setEtapaAtual(step);
    }
  }, [etapaDoStatus, setEtapaAtual, navOrder]);

  // Handler para avançar para próxima etapa (segue navOrder)
  const handleAvancar = useCallback(() => {
    const idxAtual = navOrder.indexOf(etapaAtual);
    const idxStatus = navOrder.indexOf(etapaDoStatus);
    const proximo = idxAtual >= 0 && idxAtual < navOrder.length - 1 ? navOrder[idxAtual + 1] : etapaAtual;
    const proxIdx = navOrder.indexOf(proximo);
    if (idxAtual >= 0 && idxAtual < idxStatus) {
      setEtapaAtual(proximo);
    }
    if (proxIdx >= idxStatus) {
      setNavegacaoManual(false);
    }
  }, [etapaAtual, etapaDoStatus, setEtapaAtual, navOrder]);

  // Handler para voltar para etapa anterior (segue navOrder)
  const handleVoltar = useCallback(() => {
    const idx = navOrder.indexOf(etapaAtual);
    if (idx > 0) {
      setNavegacaoManual(true);
      setEtapaAtual(navOrder[idx - 1]);
    }
  }, [etapaAtual, setEtapaAtual, navOrder]);

  // Pré-selecionar plano se já escolhido
  useEffect(() => {
    if (cotacao?.plano_escolhido_id) {
      setPlanoSelecionadoId(cotacao.plano_escolhido_id);
    }
  }, [cotacao?.plano_escolhido_id]);

  const handleSelecionarPlano = () => {
    if (!planoSelecionadoId) return;
    const plano = planosDisponiveis.find((p) => p.id === planoSelecionadoId);
    if (!plano) return;
    selecionarPlano(plano);
  };

  const handleSalvarDados = (dados: DadosPessoaisForm) => {
    salvarDadosPessoais(dados);
  };

  // Loading
  if (isLoading) {
    return (
      <div className="dark min-h-screen public-premium-bg p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-24 w-full rounded-xl bg-white/5" />
          <div className="grid md:grid-cols-[280px_1fr] gap-6">
            <Skeleton className="h-80 rounded-xl bg-white/5" />
            <Skeleton className="h-[500px] rounded-xl bg-white/5" />
          </div>
        </div>
      </div>
    );
  }

  // Error / Not Found
  if (error || !cotacao) {
    return (
      <div className="dark min-h-screen public-premium-bg flex items-center justify-center p-4">
        {/* Ambient glow effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-accent/5 blur-[100px]" />
        </div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="relative z-10"
        >
          <Card className="max-w-md w-full border-destructive/30 bg-card/80 backdrop-blur-xl">
            <CardContent className="pt-8 pb-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <h1 className="text-xl font-bold mb-2 text-foreground">Cotação não encontrada</h1>
              <p className="text-muted-foreground">
                Esta cotação não existe, expirou ou o link está incorreto.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const hasDocsPendentes = !!associadoId && docsPendentes.length > 0;
  const shouldPrioritizeDocsPendentes = !!associadoId && (hasDocsPendentes || associadoStatus === 'documentacao_pendente');

  if (shouldPrioritizeDocsPendentes) {
    return (
      <div className="dark min-h-screen public-premium-bg flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-2xl"
        >
          {hasDocsPendentes ? (
            <DocumentosPendentesPublico
              associadoId={associadoId}
              docsPendentes={docsPendentes}
              onTodosEnviados={() => {
                refetch();
                refetchDocs();
              }}
            />
          ) : isLoadingDocs ? (
            <Card className="border-amber-500/30 bg-card/80 backdrop-blur-xl">
              <CardContent className="py-10 text-center space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
                  <Loader2 className="h-7 w-7 animate-spin text-amber-500" />
                </div>
                <div>
                  <Badge className="mb-3 bg-amber-500/20 text-amber-400 border-amber-500/30">
                    Documentação pendente
                  </Badge>
                  <h1 className="text-xl font-bold text-foreground">Carregando documentos solicitados</h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    O setor de cadastro solicitou ajustes. Estamos atualizando a lista para você enviar os arquivos corretos.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-amber-500/30 bg-card/80 backdrop-blur-xl">
              <CardContent className="py-10 text-center space-y-4">
                <Badge className="mb-3 bg-amber-500/20 text-amber-400 border-amber-500/30">
                  Documentação pendente
                </Badge>
                <h1 className="text-xl font-bold text-foreground">Nenhum documento pendente encontrado</h1>
                <p className="text-sm text-muted-foreground">
                  Atualize a página em alguns instantes ou entre em contato com o Cadastro para reenviar o link correto.
                </p>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    );
  }

  // Contrato já ativado — pedir ao associado para criar a senha de acesso ao app
  if (cotacao.status_contratacao === 'ativo' && token) {
    return (
      <EtapaCriacaoSenhaCotacao
        token={token}
        numeroCotacao={cotacao.numero}
        cpf={(cotacao as any).cpf || (cotacao as any).solicitante_cpf}
        email={cotacao.email_solicitante}
      />
    );
  }

  // Contrato já gerado
  if (cotacao.status_contratacao === 'contrato_gerado' && cotacao.contrato_gerado_id) {
    return (
      <div className="dark min-h-screen public-premium-bg flex items-center justify-center p-4">
        {/* Ambient glow effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full bg-success/10 blur-[120px]" />
          <div className="absolute bottom-1/3 right-1/4 w-72 h-72 rounded-full bg-primary/10 blur-[100px]" />
        </div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, type: 'spring' }}
          className="relative z-10"
        >
          <Card className="max-w-md w-full border-success/30 bg-card/80 backdrop-blur-xl">
            <CardContent className="pt-8 pb-8 text-center">
              <motion.div 
                className="w-20 h-20 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              >
                <CheckCircle2 className="h-10 w-10 text-success" />
              </motion.div>
              <h1 className="text-2xl font-bold mb-2 text-foreground">Contrato Gerado!</h1>
              <p className="text-muted-foreground mb-6">
                Seu contrato foi gerado com sucesso. Em breve você receberá um e-mail para assinatura.
              </p>
              <Badge variant="outline" className="text-lg px-6 py-2 border-success/30 text-success">
                {cotacao.numero}
              </Badge>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Default values para formulário de dados pessoais
  const dadosPessoaisDefault: Partial<DadosPessoaisForm> = {
    nome: cotacao.nome_solicitante || '',
    email: cotacao.email_solicitante || '',
    telefone: cotacao.telefone1_solicitante || '',
    cpf: cotacao.cliente_cpf || '',
    data_nascimento: cotacao.cliente_data_nascimento || '',
    cep: cotacao.cliente_cep || '',
    logradouro: cotacao.cliente_logradouro || '',
    numero: cotacao.cliente_numero || '',
    complemento: cotacao.cliente_complemento || '',
    bairro: cotacao.cliente_bairro || '',
    cidade: cotacao.cliente_cidade || '',
    uf: cotacao.cliente_uf || '',
  };

  // Cotação de troca órfã (sem solicitação vinculada): bloquear o fluxo com erro claro
  // em vez de deixar o cliente avançar até a etapa de Pagamento e ver "Contrato não encontrado".
  if (trocaOrfa) {
    return (
      <div className="dark min-h-screen public-premium-bg flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-destructive/30 bg-card/80 backdrop-blur-xl">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Cotação não vinculada à troca</h1>
            <p className="text-sm text-muted-foreground">
              Esta cotação foi criada para uma troca de titularidade, mas não está
              vinculada à solicitação correspondente. Entre em contato com o seu
              consultor ou o suporte para refazer a vinculação.
            </p>
            {cotacao?.numero && (
              <Badge variant="outline" className="text-sm px-4 py-1 border-destructive/30 text-destructive">
                {cotacao.numero}
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="dark min-h-screen public-premium-bg relative">
      {/* Ambient glow - simplified */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.12),transparent)]" />
      </div>

      {/* Header Premium com Logo */}
      <motion.header 
        className="header-premium-glow text-white sticky top-0 z-20"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, type: 'spring' }}
      >
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-white/20 blur-xl rounded-full" />
              <img 
                src="/logos/logo-icon-light.png" 
                alt="PRATIC" 
                className="h-12 w-12 object-contain rounded-lg bg-white/10 p-1 relative z-10"
              />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">PRATIC</h1>
              <p className="text-xs text-white/60">Proteção Veicular</p>
            </div>
          </div>
          <Badge 
            variant="outline" 
            className="border-white/20 text-white bg-white/5 backdrop-blur-sm px-4"
          >
            Cotação {cotacao.numero}
          </Badge>
        </div>
      </motion.header>

      {/* Vehicle Info Bar */}
      <motion.div 
        className="bg-card/50 backdrop-blur-md border-b border-border/50 relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3 text-sm flex-wrap">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Car className="h-4 w-4" />
              <span className="font-medium text-foreground">
                {cotacao.veiculo_marca} {cotacao.veiculo_modelo}
              </span>
            </div>
            {cotacao.veiculo_ano && (
              <Badge variant="secondary" className="text-xs bg-white/5 border-white/10">
                {cotacao.veiculo_ano}
              </Badge>
            )}
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8 relative z-10">
        <div className="space-y-8">
          {/* Stepper - Horizontal no Desktop, compacto no Mobile */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <Card className="p-4 stepper-card-premium">
              {(() => {
                // Mapeamento entre índice INTERNO (sempre 6 etapas: plano, documentos, contrato, vistoria, pagamento, instalacao)
                // e o índice VISÍVEL no Stepper (que pode ter "vistoria" omitida).
                const internalIds = ['plano','documentos','contrato','vistoria','pagamento','instalacao'] as const;
                const internalToVisible = (i: number) => {
                  const id = internalIds[i];
                  const v = STEPS.findIndex((s) => s.id === id);
                  if (v >= 0) return v;
                  // Etapa interna "vistoria" não existe no STEPS visível -> aponta para a próxima visível (pagamento)
                  return STEPS.findIndex((s) => s.id === 'pagamento');
                };
                const visibleToInternal = (i: number) => {
                  const id = STEPS[i]?.id;
                  return internalIds.indexOf(id as any);
                };
                return (
                  <StepperCotacao
                    steps={STEPS}
                    currentStep={internalToVisible(etapaAtual)}
                    onStepClick={(i) => handleStepClick(visibleToInternal(i))}
                    maxReachableStep={internalToVisible(etapaDoStatus)}
                  />
                );
              })()}
            </Card>
          </motion.div>

          {/* Step Content - Largura Total */}
          <div className="w-full">
            <AnimatePresence mode="wait">
              {/* Etapa 0: Escolha do Plano */}
              {etapaAtual === 0 && (
                <motion.div
                  key="plano"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                <EscolhaPlano
                    planos={planosDisponiveis}
                    planoSelecionadoId={planoSelecionadoId}
                    onSelectPlano={setPlanoSelecionadoId}
                    onConfirmar={handleSelecionarPlano}
                    isLoading={isPending}
                    categoriaVeiculo={(cotacao as { categoria_veiculo?: string }).categoria_veiculo}
                    readOnly={isEtapaConcluida(0)}
                  />
                  <NavegacaoEtapas
                    etapaAtual={etapaAtual}
                    etapaMaxima={etapaDoStatus}
                    totalEtapas={STEPS.length}
                    onVoltar={handleVoltar}
                    onAvancar={handleAvancar}
                    navegacaoManual={navegacaoManual}
                  />
                </motion.div>
              )}

              {/* Etapa 1: Documentos e Dados (Unificado) */}
              {etapaAtual === 1 && (
                <motion.div
                  key="documentos"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                <EtapaDadosPessoaisDocumentos
                    cotacaoId={cotacao.id}
                    onSubmit={handleSalvarDados}
                    defaultValues={dadosPessoaisDefault}
                    isLoading={isPending}
                    readOnly={isEtapaConcluida(1)}
                    placaEsperada={cotacao.veiculo_placa || undefined}
                  />
                  <NavegacaoEtapas
                    etapaAtual={etapaAtual}
                    etapaMaxima={etapaDoStatus}
                    totalEtapas={STEPS.length}
                    onVoltar={handleVoltar}
                    onAvancar={handleAvancar}
                    navegacaoManual={navegacaoManual}
                  />
                </motion.div>
              )}

              {/* Etapa 2: Assinatura do Contrato (NOVA ETAPA) */}
              {etapaAtual === 2 && (
                <motion.div
                  key="contrato"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                {isTrocaTitularidade && !trocaLiberada ? (
                  <TelaAnaliseTrocaTitularidade
                    status={(solicitacaoTroca?.status as any) || 'aguardando_cadastro'}
                    motivoReprovacao={solicitacaoTroca?.motivo_reprovacao}
                    termoAssinadoEm={solicitacaoTroca?.termo_cancelamento_assinado_em}
                    aprovadoCadastroEm={solicitacaoTroca?.aprovado_cadastro_em}
                    aprovadoMonitoramentoEm={solicitacaoTroca?.aprovado_monitoramento_em}
                    tipoVistoriaTroca={(solicitacaoTroca as any)?.tipo_vistoria_troca}
                    expiradaEm={(solicitacaoTroca as any)?.expirada_em}
                  />
                ) : isSubstituicao ? (
                  <EtapaAssinaturaSubstituicao
                    cotacaoId={cotacao.id}
                    tokenPublico={token || cotacao.token_publico || ''}
                    clienteNome={cotacao.nome_solicitante || ''}
                    clienteEmail={cotacao.email_solicitante || ''}
                    onContratoAssinado={() => handleContratoAssinado(3)}
                    readOnly={isEtapaConcluida(2)}
                    contratoInicial={contratoFallback ? {
                      id: contratoFallback.id,
                      numero: (contratoFallback as any).numero,
                      autentique_url: (contratoFallback as any).autentique_url,
                      autentique_documento_id: (contratoFallback as any).autentique_documento_id,
                      status: (contratoFallback as any).status,
                    } : undefined}
                    veiculoAntigoPlaca={dadosExtras?.veiculo_antigo_placa}
                    veiculoAntigoModelo={dadosExtras?.veiculo_antigo_modelo}
                  />
                ) : (
                  <EtapaAssinaturaContrato
                    cotacaoId={cotacao.id}
                    tokenPublico={token || cotacao.token_publico || ''}
                    clienteNome={cotacao.nome_solicitante || ''}
                    clienteEmail={cotacao.email_solicitante || ''}
                    onContratoAssinado={() => handleContratoAssinado(3)}
                    readOnly={isEtapaConcluida(2)}
                    contratoInicial={contratoFallback ? {
                      id: contratoFallback.id,
                      numero: (contratoFallback as any).numero,
                      autentique_url: (contratoFallback as any).autentique_url,
                      autentique_documento_id: (contratoFallback as any).autentique_documento_id,
                      status: (contratoFallback as any).status,
                    } : undefined}
                  />
                )}
                  {!(isTrocaTitularidade && !trocaLiberada) && (
                    <NavegacaoEtapas
                      etapaAtual={etapaAtual}
                      etapaMaxima={etapaDoStatus}
                      totalEtapas={STEPS.length}
                      onVoltar={handleVoltar}
                      onAvancar={handleAvancar}
                      navegacaoManual={navegacaoManual}
                    />
                  )}
                </motion.div>
              )}

              {/* Etapa 3: Vistoria */}
              {etapaAtual === 3 && (
                <motion.div
                  key="vistoria"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  {/* Troca de titularidade dentro da janela mesmo-dia: vistoria dispensada */}
                  {dispensaVistoriaTroca ? (
                    <Card className="border-primary/30 bg-card/80 backdrop-blur-xl">
                      <CardContent className="py-12 text-center space-y-6">
                        <motion.div
                          className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                        >
                          <ShieldCheck className="h-10 w-10 text-primary" />
                        </motion.div>
                        <div>
                          <Badge className="bg-primary/20 text-primary border-primary/30 mb-4">
                            Vistoria Dispensada
                          </Badge>
                          <h2 className="text-2xl font-bold mb-3 text-foreground">
                            Sem necessidade de vistoria inicial
                          </h2>
                          <p className="text-muted-foreground max-w-md mx-auto">
                            Como a troca de titularidade está sendo feita ainda no dia da assinatura do termo,
                            a proteção do titular antigo é estendida a você. O Monitoramento avaliará a
                            pontuação do rastreador na análise final e decidirá se uma vistoria é necessária.
                          </p>
                        </div>
                        <Button
                          onClick={() => {
                            const idx = navOrder.indexOf(3);
                            const next = idx >= 0 && idx < navOrder.length - 1 ? navOrder[idx + 1] : 4;
                            setEtapaAtual(next);
                          }}
                        >
                          Continuar
                        </Button>
                      </CardContent>
                    </Card>
                  ) : isSubstituicao && substituicaoMesmoLocal === null && !cotacao?.vistoria_concluida_em && !cotacao?.tipo_vistoria ? (
                    <AgendamentoSubstituicao
                      veiculoAntigoPlaca={dadosExtras?.veiculo_antigo_placa || '???'}
                      veiculoAntigoModelo={dadosExtras?.veiculo_antigo_modelo || ''}
                      veiculoNovoDescricao={[cotacao.veiculo_marca, cotacao.veiculo_modelo, cotacao.veiculo_ano].filter(Boolean).join(' ')}
                      onConfirm={(mesmoLocal) => setSubstituicaoMesmoLocal(mesmoLocal)}
                    />
                  ) : cotacao?.vistoria_concluida_em ? (
                    <Card className="border-success/30 bg-card/80 backdrop-blur-xl">
                      <CardContent className="py-12 text-center space-y-6">
                        <motion.div 
                          className="w-20 h-20 mx-auto rounded-full bg-success/10 flex items-center justify-center"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                        >
                          <CheckCircle2 className="h-10 w-10 text-success" />
                        </motion.div>
                        
                        <div>
                          <Badge className="bg-success/20 text-success border-success/30 mb-4">
                            Vistoria Concluída
                          </Badge>
                          <h2 className="text-2xl font-bold mb-3 text-foreground">
                            VISTORIA CONCLUÍDA
                          </h2>
                          <p className="text-muted-foreground max-w-md mx-auto">
                            Aguardando análise cadastral. Em breve você receberá a confirmação e será redirecionado automaticamente.
                          </p>
                        </div>

                        {/* Indicador de carregamento */}
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          <p className="text-sm text-muted-foreground">
                            Processando sua solicitação...
                          </p>
                        </div>

                        {/* Checklist visual */}
                        <div className="bg-muted/30 rounded-lg p-4 max-w-md mx-auto text-left space-y-3">
                          <div className="flex items-center gap-3">
                            <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                            <span className="text-sm text-muted-foreground">Vistoria presencial realizada</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Loader2 className="h-5 w-5 animate-spin text-primary flex-shrink-0" />
                            <span className="text-sm text-muted-foreground">Análise cadastral em andamento</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <EtapaVistoria
                      cotacaoId={cotacao.id}
                      tipoVeiculo={detectarTipoVeiculoDaCotacao(cotacao)}
                      tipoInstalacao={(cotacao as any).tipo_instalacao as 'rota' | 'base' | null}
                      clienteNome={cotacao.nome_solicitante || ''}
                      clienteTelefone={cotacao.telefone1_solicitante || undefined}
                      clienteEmail={cotacao.email_solicitante || undefined}
                      veiculoPlaca={cotacao.veiculo_placa || undefined}
                      veiculoDescricao={[cotacao.veiculo_marca, cotacao.veiculo_modelo, cotacao.veiculo_ano].filter(Boolean).join(' ') || undefined}
                      enderecoInicial={{
                        cep: cotacao.cliente_cep || '',
                        logradouro: cotacao.cliente_logradouro || '',
                        numero: cotacao.cliente_numero || '',
                        complemento: cotacao.cliente_complemento || '',
                        bairro: cotacao.cliente_bairro || '',
                        cidade: cotacao.cliente_cidade || '',
                        estado: cotacao.cliente_uf || '',
                      }}
                      onComplete={() => {
                        const idx = navOrder.indexOf(3);
                        const next = idx >= 0 && idx < navOrder.length - 1 ? navOrder[idx + 1] : 4;
                        setEtapaAtual(next);
                      }}
                      onAgendar={() => {
                        const idx = navOrder.indexOf(3);
                        const next = idx >= 0 && idx < navOrder.length - 1 ? navOrder[idx + 1] : 4;
                        setEtapaAtual(next);
                      }}
                      readOnly={isEtapaConcluida(3)}
                      tipoVistoriaRealizada={cotacao.tipo_vistoria as 'autovistoria' | 'agendada' | undefined}
                      subFipe={!exigeRastreador({
                        tipo: detectarTipoVeiculoDaCotacao(cotacao),
                        valorFipe: Number((cotacao as any).veiculo_valor_fipe ?? (cotacao as any).valor_fipe ?? 0),
                        combustivel: (cotacao as any).veiculo_combustivel || undefined,
                      } as any).exige}
                    />
                  )}
                  <NavegacaoEtapas
                    etapaAtual={etapaAtual}
                    etapaMaxima={etapaDoStatus}
                    totalEtapas={STEPS.length}
                    onVoltar={handleVoltar}
                    onAvancar={handleAvancar}
                    navegacaoManual={navegacaoManual}
                  />
                </motion.div>
              )}

              {/* Etapa 4: Pagamento */}
              {etapaAtual === 4 && (
                <motion.div
                  key="pagamento"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                {isTrocaTitularidade && !trocaPagamentoLiberado ? (
                  <TelaAnaliseTrocaTitularidade
                    status={(solicitacaoTroca?.status as any) || 'aguardando_cadastro'}
                    motivoReprovacao={solicitacaoTroca?.motivo_reprovacao}
                    termoAssinadoEm={solicitacaoTroca?.termo_cancelamento_assinado_em}
                    aprovadoCadastroEm={solicitacaoTroca?.aprovado_cadastro_em}
                    aprovadoMonitoramentoEm={solicitacaoTroca?.aprovado_monitoramento_em}
                    tipoVistoriaTroca={(solicitacaoTroca as any)?.tipo_vistoria_troca}
                    expiradaEm={(solicitacaoTroca as any)?.expirada_em}
                  />
                ) : (
                  <>
                <EtapaPagamentoCotacao
                    cotacaoId={cotacao.id}
                    valorAdesao={cotacao.valor_adesao || 0}
                    clienteNome={cotacao.nome_solicitante || ''}
                    clienteEmail={cotacao.email_solicitante || ''}
                    clienteCpf={cotacao.cliente_cpf || ''}
                    onPagamentoConfirmado={async () => {
                      await queryClient.invalidateQueries({ queryKey: ['cotacao-contratacao', token] });
                      await refetch();
                      setEtapaAtual(5);
                    }}
                    readOnly={isEtapaConcluida(4)}
                    tipoVistoria={cotacao.tipo_vistoria as 'autovistoria' | 'agendada'}
                    vistoriaAgendada={instalacaoAgendadaPublica ? {
                      data: instalacaoAgendadaPublica.data,
                      horario: instalacaoAgendadaPublica.horario || undefined,
                      logradouro: instalacaoAgendadaPublica.logradouro || undefined,
                      numero: instalacaoAgendadaPublica.numero || undefined,
                      bairro: instalacaoAgendadaPublica.bairro || undefined,
                      cidade: instalacaoAgendadaPublica.cidade || undefined,
                      estado: instalacaoAgendadaPublica.uf || undefined,
                    } : undefined}
                  />
                  <NavegacaoEtapas
                    etapaAtual={etapaAtual}
                    etapaMaxima={etapaDoStatus}
                    totalEtapas={STEPS.length}
                    onVoltar={handleVoltar}
                    onAvancar={handleAvancar}
                    navegacaoManual={navegacaoManual}
                  />
                  </>
                )}
                </motion.div>
              )}

              {/* Etapa 5: Conclusão */}
              {etapaAtual === 5 && (
                <motion.div
                  key="conclusao"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  {/* PROTEÇÃO 360º ATIVADA - Tela de boas-vindas */}
                  {cotacao?.status_contratacao === 'ativo' ? (
                    <Card className="border-green-500/30 bg-card/80 backdrop-blur-xl">
                      <CardContent className="py-12 text-center space-y-6">
                        <motion.div 
                          className="w-20 h-20 mx-auto rounded-full bg-green-500/10 flex items-center justify-center"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                        >
                          <PartyPopper className="h-10 w-10 text-green-500" />
                        </motion.div>
                        
                        <div>
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 mb-4">
                            Proteção 360º Ativada
                          </Badge>
                          <h2 className="text-2xl font-bold mb-3 text-foreground">
                            Bem-vindo à PRATIC!
                          </h2>
                          <p className="text-muted-foreground max-w-md mx-auto">
                            Seu veículo <strong className="text-foreground">{cotacao?.veiculo_placa}</strong> está protegido com <strong className="text-green-400">Proteção 360º</strong>.
                            Instalação e vistoria foram concluídas com sucesso!
                          </p>
                        </div>

                        {/* Checklist visual */}
                        <div className="bg-muted/30 rounded-lg p-4 max-w-md mx-auto text-left space-y-3">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                            <span className="text-sm text-muted-foreground">Documentos verificados</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                            <span className="text-sm text-muted-foreground">Contrato assinado</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                            <span className="text-sm text-muted-foreground">Vistoria aprovada</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                            <span className="text-sm text-muted-foreground">Rastreador instalado</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-primary flex-shrink-0" />
                            <span className="text-sm font-medium text-primary">Proteção 360º ativada</span>
                          </div>
                        </div>

                        <div className="pt-4">
                          <p className="text-sm text-muted-foreground mb-3">
                            Baixe nosso aplicativo para acessar todos os serviços:
                          </p>
                          <div className="flex justify-center gap-4">
                            <div className="bg-muted/50 rounded-lg px-4 py-2 text-sm">
                              📱 Em breve na App Store
                            </div>
                            <div className="bg-muted/50 rounded-lg px-4 py-2 text-sm">
                              📱 Em breve no Google Play
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : docsPendentes && docsPendentes.length > 0 && associadoId ? (
                    <DocumentosPendentesPublico
                      associadoId={associadoId}
                      docsPendentes={docsPendentes}
                      onTodosEnviados={() => {
                        // Recarregar dados para atualizar estado
                        refetch();
                        refetchDocs();
                      }}
                    />
                  ) : cotacao?.tipo_vistoria === 'autovistoria' ? (
                    // ========== FLUXO AUTOVISTORIA ==========
                    // Verificar se já agendou instalação: campo da cotação OU registro na tabela OU estado local
                    (cotacao?.vistoria_completa_data_agendada || hasInstalacaoAgendada || agendamentoConcluido) ? (
                      // Instalação já agendada - mostrar tela de análise
                      <Card className="border-primary/30 bg-card/80 backdrop-blur-xl">
                        <CardContent className="py-12 text-center space-y-6">
                          <motion.div 
                            className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                          >
                            <Clock className="h-10 w-10 text-primary" />
                          </motion.div>
                          
                          <div>
                            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 mb-4">
                              Em Análise Cadastral
                            </Badge>
                            <h2 className="text-2xl font-bold mb-3 text-foreground">
                              Sua proposta está sendo analisada
                            </h2>
                            <p className="text-muted-foreground max-w-md mx-auto">
                              Seus documentos, contrato assinado e imagens da vistoria estão sendo analisados pelo nosso setor de cadastro. Você será notificado sobre a aprovação em breve.
                            </p>
                          </div>

                          {/* Checklist visual do que foi concluído */}
                          <div className="bg-muted/30 rounded-lg p-4 max-w-md mx-auto text-left space-y-3">
                            <p className="text-sm font-medium text-foreground mb-3">O que já foi recebido:</p>
                            
                            <div className="flex items-center gap-3">
                              <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                              <span className="text-sm text-muted-foreground">Contrato assinado digitalmente</span>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                              <span className="text-sm text-muted-foreground">Autovistoria realizada (fotos do veículo)</span>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                              <span className="text-sm text-muted-foreground">Pagamento de adesão confirmado</span>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                              <span className="text-sm text-muted-foreground">Instalação do rastreador agendada</span>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <Clock className="h-5 w-5 text-amber-500 flex-shrink-0" />
                              <span className="text-sm text-muted-foreground">Aguardando aprovação cadastral para ativar cobertura</span>
                            </div>
                          </div>

                          {/* Detalhes do agendamento da instalação */}
                          {instalacaoAgendadaPublica?.data && (
                            <div className="bg-muted/30 rounded-lg p-4 max-w-md mx-auto text-left space-y-3">
                              <div className="flex items-center gap-2 mb-3">
                                <CalendarCheck className="h-5 w-5 text-primary" />
                                <span className="font-medium text-foreground">Instalação Agendada</span>
                              </div>
                              
                              <div className="flex items-center gap-3">
                                <Calendar className="h-5 w-5 text-primary flex-shrink-0" />
                                <div>
                                  <p className="text-sm text-muted-foreground">Data</p>
                                  <p className="font-medium">
                                    {format(new Date(instalacaoAgendadaPublica.data + 'T12:00:00'), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                  </p>
                                </div>
                              </div>
                              
                              {instalacaoAgendadaPublica?.horario && (
                                <div className="flex items-center gap-3">
                                  <Clock className="h-5 w-5 text-primary flex-shrink-0" />
                                  <div>
                                    <p className="text-sm text-muted-foreground">Horário</p>
                                    <p className="font-medium">{instalacaoAgendadaPublica.horario}</p>
                                  </div>
                                </div>
                              )}
                              
                              {instalacaoAgendadaPublica?.logradouro && (
                                <div className="flex items-start gap-3">
                                  <MapPin className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                                  <div>
                                    <p className="text-sm text-muted-foreground">Local</p>
                                    <p className="font-medium">
                                      {instalacaoAgendadaPublica.logradouro}
                                      {instalacaoAgendadaPublica.numero && `, ${instalacaoAgendadaPublica.numero}`}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {instalacaoAgendadaPublica.bairro}
                                      {instalacaoAgendadaPublica.cidade && ` - ${instalacaoAgendadaPublica.cidade}`}
                                      {instalacaoAgendadaPublica.uf && `/${instalacaoAgendadaPublica.uf}`}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Encaixe de horários ativado */}
                          {cotacao?.vistoria_permite_encaixe && (
                            <div className="flex items-start gap-3 bg-primary/10 border border-primary/30 rounded-lg p-4 max-w-md mx-auto">
                              <div className="p-2 rounded-full bg-primary/20 flex-shrink-0">
                                <Puzzle className="h-5 w-5 text-primary" />
                              </div>
                              <div className="text-left">
                                <span className="font-semibold text-primary">Encaixe de Horários Ativado</span>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Se um instalador estiver próximo antes do horário agendado, 
                                  ele poderá realizar a instalação antecipadamente. 
                                  Você será notificado previamente.
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Aviso importante */}
                          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 max-w-md mx-auto">
                            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-left text-amber-200">
                              <strong>Próximo passo:</strong> Após a aprovação do setor de cadastro, a <strong>cobertura de Roubo e Furto</strong> será ativada. 
                              A cobertura <strong>TOTAL</strong> será ativada após a instalação do rastreador.
                            </p>
                          </div>

                          <p className="text-sm text-muted-foreground">
                            Você receberá um e-mail com a atualização do status da sua proposta.
                          </p>
                        </CardContent>
                      </Card>
                    ) : isLoadingAgendamento ? (
                      // Carregando verificação de agendamento existente
                      <Card className="border-border/50 bg-card/80 backdrop-blur-xl">
                        <CardContent className="py-12 text-center space-y-4">
                          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                          <p className="text-muted-foreground">Verificando status do agendamento...</p>
                        </CardContent>
                      </Card>
                    ) : (
                      // Autovistoria concluída, mas ainda precisa agendar instalação
                      <AgendamentoVistoriaCompleta
                        cotacaoId={cotacao.id}
                        tipoVistoria="autovistoria"
                        tipoInstalacao={(cotacao as any).tipo_instalacao as 'rota' | 'base' | null}
                        clienteNome={cotacao?.vistoria_completa_responsavel_nome || cotacao?.nome_solicitante || ''}
                        clienteTelefone={cotacao?.vistoria_completa_responsavel_telefone || cotacao?.telefone1_solicitante}
                        clienteEmail={cotacao?.email_solicitante}
                        veiculoPlaca={cotacao?.veiculo_placa}
                        veiculoDescricao={`${cotacao?.veiculo_marca || ''} ${cotacao?.veiculo_modelo || ''}`.trim()}
                        enderecoInicial={{
                          cep: cotacao?.cliente_cep || '',
                          logradouro: cotacao?.cliente_logradouro || '',
                          numero: cotacao?.cliente_numero || '',
                          complemento: cotacao?.cliente_complemento || '',
                          bairro: cotacao?.cliente_bairro || '',
                          cidade: cotacao?.cliente_cidade || '',
                          estado: cotacao?.cliente_uf || '',
                        }}
                        onConfirmar={() => {
                          setAgendamentoConcluido(true);
                          queryClient.invalidateQueries({ queryKey: ['cotacao-contratacao'] });
                          queryClient.invalidateQueries({ queryKey: ['instalacao-existente'] });
                          queryClient.invalidateQueries({ queryKey: ['vistoria-existente'] });
                          queryClient.invalidateQueries({ queryKey: ['agendamento-base-existente'] });
                          refetch();
                        }}
                      />
                    )
                  ) : cotacao?.tipo_vistoria === 'agendada' ? (
                    // ========== FLUXO VISTORIA PRESENCIAL (AGENDADA) ==========
                    // Cliente já agendou na Etapa 3 - NUNCA mostrar formulário de agendamento aqui
                    // Aceita tanto colunas vistoria_* (presencial direto) quanto vistoria_completa_* (rota pós-pagamento)
                    (cotacao?.vistoria_data_agendada || cotacao?.vistoria_completa_data_agendada) ? (
                      // Tem dados do agendamento - mostrar detalhes
                      (() => {
                        const dataAg = cotacao?.vistoria_data_agendada || cotacao?.vistoria_completa_data_agendada;
                        const horarioAg = cotacao?.vistoria_horario_agendado || cotacao?.vistoria_completa_horario_agendado;
                        const periodoAg = cotacao?.vistoria_periodo || cotacao?.vistoria_completa_periodo;
                        const endLog = cotacao?.vistoria_endereco_logradouro || cotacao?.vistoria_completa_endereco_logradouro;
                        const endNum = cotacao?.vistoria_endereco_numero || cotacao?.vistoria_completa_endereco_numero;
                        const endBai = cotacao?.vistoria_endereco_bairro || cotacao?.vistoria_completa_endereco_bairro;
                        const endCid = cotacao?.vistoria_endereco_cidade || cotacao?.vistoria_completa_endereco_cidade;
                        const endUf = cotacao?.vistoria_endereco_estado || cotacao?.vistoria_completa_endereco_estado;
                        const periodoLabel = periodoAg === 'manha' ? 'Manhã (08:00 às 12:00)' : periodoAg === 'tarde' ? 'Tarde (13:00 às 17:00)' : null;
                        return (
                      <Card className="border-primary/30 bg-card/80 backdrop-blur-xl">
                        <CardContent className="py-12 text-center space-y-6">
                          <motion.div 
                            className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                          >
                            <CalendarCheck className="h-10 w-10 text-primary" />
                          </motion.div>
                          
                          <div>
                            <Badge className="bg-primary/20 text-primary border-primary/30 mb-4">
                              Agendamento Confirmado
                            </Badge>
                            <h2 className="text-2xl font-bold mb-3 text-foreground">
                              Vistoria Agendada com Sucesso!
                            </h2>
                          </div>

                          {/* Detalhes do agendamento */}
                          <div className="bg-muted/30 rounded-lg p-4 max-w-md mx-auto text-left space-y-3">
                            {dataAg && (
                              <div className="flex items-center gap-3">
                                <Calendar className="h-5 w-5 text-primary flex-shrink-0" />
                                <div>
                                  <p className="text-sm text-muted-foreground">Data{periodoLabel ? ' e período' : ''}</p>
                                  <p className="font-medium">
                                    {format(new Date(dataAg + 'T12:00:00'), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                    {periodoLabel ? ` — ${periodoLabel}` : ''}
                                  </p>
                                </div>
                              </div>
                            )}
                            
                            {horarioAg && !periodoLabel && (
                              <div className="flex items-center gap-3">
                                <Clock className="h-5 w-5 text-primary flex-shrink-0" />
                                <div>
                                  <p className="text-sm text-muted-foreground">Horário</p>
                                  <p className="font-medium">{horarioAg}</p>
                                </div>
                              </div>
                            )}
                            
                            {endLog && (
                              <div className="flex items-start gap-3">
                                <MapPin className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="text-sm text-muted-foreground">Local</p>
                                  <p className="font-medium">
                                    {endLog}
                                    {endNum && `, ${endNum}`}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {endBai}
                                    {endCid && ` - ${endCid}`}
                                    {endUf && `/${endUf}`}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Encaixe de horários ativado - Vistoria Presencial */}
                          {cotacao?.vistoria_permite_encaixe && (
                            <div className="flex items-start gap-3 bg-primary/10 border border-primary/30 rounded-lg p-4 max-w-md mx-auto">
                              <div className="p-2 rounded-full bg-primary/20 flex-shrink-0">
                                <Puzzle className="h-5 w-5 text-primary" />
                              </div>
                              <div className="text-left">
                                <span className="font-semibold text-primary">Encaixe de Horários Ativado</span>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Se um vistoriador estiver próximo antes do horário agendado, 
                                  ele poderá realizar a vistoria antecipadamente. 
                                  Você será notificado previamente.
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Aviso importante */}
                          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 max-w-md mx-auto">
                            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-left text-amber-200">
                              <strong>Importante:</strong> A cobertura do seu veículo será ativada 
                              após a realização da vistoria presencial.
                            </p>
                          </div>

                          <p className="text-sm text-muted-foreground">
                            Aguarde o contato do vistoriador no dia agendado.
                          </p>
                        </CardContent>
                      </Card>
                        );
                      })()
                    ) : isLoadingAgendamento ? (
                      <Card className="border-border/50 bg-card/80 backdrop-blur-xl">
                        <CardContent className="py-12 text-center space-y-4">
                          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                          <p className="text-muted-foreground">Verificando status...</p>
                        </CardContent>
                      </Card>
                    ) : (hasVistoriaAgendada || hasInstalacaoAgendada || hasAgendamentoBase) ? (
                      // Já existe registro operacional (vistoria/instalação/agendamento) — confirmação real
                      <Card className="border-primary/30 bg-card/80 backdrop-blur-xl">
                        <CardContent className="py-12 text-center space-y-4">
                          <motion.div
                            className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                          >
                            <CalendarCheck className="h-8 w-8 text-primary" />
                          </motion.div>
                          <h2 className="text-xl font-bold text-foreground">Agendamento Confirmado!</h2>
                          <p className="text-muted-foreground">
                            Sua vistoria foi registrada com sucesso.<br />
                            Aguarde o contato do vistoriador.
                          </p>
                        </CardContent>
                      </Card>
                    ) : (
                      // Cotação marcada como 'agendada' mas sem dados nem registro operacional —
                      // forçar coleta real de data/horário/endereço (evita limbo "fantasma" no monitoramento)
                      <AgendamentoVistoriaCompleta
                        cotacaoId={cotacao.id}
                        tipoVistoria="agendada"
                        tipoInstalacao={(cotacao as any).tipo_instalacao as 'rota' | 'base' | null}
                        clienteNome={cotacao?.vistoria_responsavel_nome || cotacao?.nome_solicitante || ''}
                        clienteTelefone={cotacao?.vistoria_responsavel_telefone || cotacao?.telefone1_solicitante}
                        clienteEmail={cotacao?.email_solicitante}
                        veiculoPlaca={cotacao?.veiculo_placa}
                        veiculoDescricao={`${cotacao?.veiculo_marca || ''} ${cotacao?.veiculo_modelo || ''}`.trim()}
                        enderecoInicial={{
                          cep: cotacao?.cliente_cep || '',
                          logradouro: cotacao?.cliente_logradouro || '',
                          numero: cotacao?.cliente_numero || '',
                          complemento: cotacao?.cliente_complemento || '',
                          bairro: cotacao?.cliente_bairro || '',
                          cidade: cotacao?.cliente_cidade || '',
                          estado: cotacao?.cliente_uf || '',
                        }}
                        onConfirmar={() => {
                          setAgendamentoConcluido(true);
                          queryClient.invalidateQueries({ queryKey: ['cotacao-contratacao'] });
                          queryClient.invalidateQueries({ queryKey: ['instalacao-existente'] });
                          queryClient.invalidateQueries({ queryKey: ['vistoria-existente'] });
                          queryClient.invalidateQueries({ queryKey: ['agendamento-base-existente'] });
                          refetch();
                        }}
                      />
                    )
                  ) : (cotacao?.tipo_vistoria === 'agendada_base' || hasAgendamentoBase) ? (
                    // ========== FLUXO AGENDAMENTO NA BASE ==========
                    <Card className="border-primary/30 bg-card/80 backdrop-blur-xl">
                      <CardContent className="py-12 text-center space-y-6">
                        <motion.div 
                          className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                        >
                          <Building2 className="h-10 w-10 text-primary" />
                        </motion.div>
                        
                        <div>
                          <Badge className="bg-primary/20 text-primary border-primary/30 mb-4">
                            Agendamento na Base Confirmado
                          </Badge>
                          <h2 className="text-2xl font-bold mb-3 text-foreground">
                            Vistoria Agendada com Sucesso!
                          </h2>
                          <p className="text-muted-foreground max-w-md mx-auto">
                            Compareça à base PRATIC na data e horário agendados 
                            com seu veículo para realizar a vistoria.
                          </p>
                        </div>

                        {/* Detalhes do agendamento - buscar de agendamentos_base */}
                        <AgendamentoBaseResumo cotacaoId={cotacao.id} />

                        {/* Aviso importante */}
                        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 max-w-md mx-auto">
                          <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-left text-amber-200">
                            <strong>Importante:</strong> A cobertura será ativada após a realização 
                            da vistoria presencial na base.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    // ========== FALLBACK: Tipo não definido ou estado inconsistente ==========
                    <Card className="border-border/50 bg-card/80 backdrop-blur-xl">
                      <CardContent className="py-12 text-center space-y-4">
                        <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                        <p className="text-muted-foreground">Verificando status da sua proposta...</p>
                      </CardContent>
                    </Card>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 mt-auto relative z-10 bg-card/30 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-6 text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} PRATIC - Proteção Veicular. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
