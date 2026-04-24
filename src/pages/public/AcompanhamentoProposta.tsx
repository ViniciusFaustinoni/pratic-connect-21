import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  Car, 
  CheckCircle2, 
  Clock, 
  Shield, 
  XCircle,
  FileCheck,
  Calendar,
  Wrench,
  PartyPopper,
  KeyRound,
  Navigation,
  MapPin,
  UserCheck,
  Bell,
  FileWarning,
  PenTool,
  Loader2,
  ClipboardCheck,
  Camera,
  Video,
  ExternalLink,
  ShieldCheck,
  FileText,
  Play
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { publicSupabase as supabase } from '@/integrations/supabase/publicClient';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { CriarContaAssociadoForm } from '@/components/public/CriarContaAssociadoForm';
import { DocumentosPendentesPublico } from '@/components/cotacao-publica/DocumentosPendentesPublico';
import { getOrientacoesRecusa } from '@/utils/orientacoesRecusa';
import type { DocumentoPendentePublico } from '@/hooks/useCotacaoContratacao';

import { toast } from 'sonner';

interface ChecklistItemData {
  id: string;
  label: string;
  status: 'ok' | 'nok' | 'pendente';
  observacao?: string;
  fotos?: string[];
}

interface VistoriaFotoData {
  arquivo_url: string;
  tipo: string;
  visivel_cliente: boolean;
}

interface ServicoInstalacao {
  id: string;
  status: string;
  assinatura_cliente_url: string | null;
  checklist_data: any;
  ressalvas_instalador: string | null;
  fotos_ressalva: string[] | null;
  video_360_url: string | null;
  quilometragem: number | null;
  vistoriaFotos: VistoriaFotoData[];
}

interface AssociadoData {
  id: string;
  nome: string;
  email: string;
  status: string;
  user_id: string | null;
  primeiro_acesso?: boolean;
  plano: { nome: string } | null;
  veiculos: {
    id: string;
    placa: string;
    modelo: string;
    marca: string;
    status: string;
    cobertura_roubo_furto: boolean;
    cobertura_total: boolean;
    motivo_recusa_veiculo?: string;
  }[];
  contrato: {
    id: string;
    status: string;
  } | null;
  instalacoes: {
    id: string;
    status: string;
    data_agendada: string | null;
    hora_agendada: string | null;
    rota_id: string | null;
    confirmacao_whatsapp?: string | null;
    instalador_responsavel: {
      nome: string;
    } | null;
  }[];
  servicoInstalacao?: ServicoInstalacao | null;
  cotacaoTokenPublico?: string | null;
  cotacaoStatusContratacao?: string | null;
  documentosPendentes: DocumentoPendentePublico[];
}

function useAcompanhamentoProposta(token: string | undefined) {
  return useQuery({
    queryKey: ['acompanhamento-proposta', token],
    queryFn: async (): Promise<AssociadoData | null> => {
      if (!token) return null;

      // Buscar contrato pelo link_token
      const { data: contrato, error: contratoError } = await supabase
        .from('contratos')
        .select('id, associado_id, status, veiculo_id, cotacao_id')
        .eq('link_token', token)
        .maybeSingle();

      if (contratoError) {
        console.error('Erro ao buscar contrato:', contratoError);
        return null;
      }

      if (!contrato?.associado_id) return null;

      // Buscar dados do associado incluindo email
      const { data: associado, error: assocError } = await supabase
        .from('associados')
        .select(`
          id,
          nome,
          email,
          status,
          user_id,
          plano:planos (nome)
        `)
        .eq('id', contrato.associado_id)
        .single();

      if (assocError || !associado) return null;

      // Buscar primeiro_acesso do profile se user_id existir
      let primeiroAcesso: boolean | undefined;
      if (associado.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('primeiro_acesso')
          .eq('user_id', associado.user_id)
          .maybeSingle();
        primeiroAcesso = profile?.primeiro_acesso ?? undefined;
      }

      // Buscar veículos
      const { data: veiculos } = await supabase
        .from('veiculos')
        .select('id, placa, modelo, marca, status, cobertura_roubo_furto, cobertura_total, motivo_recusa_veiculo')
        .eq('associado_id', contrato.associado_id);

      // Buscar instalações COM dados do vistoriador
      const { data: instalacoes } = await supabase
        .from('instalacoes')
        .select(`
          id, 
          status, 
          data_agendada,
          hora_agendada,
          rota_id,
          instalador_responsavel:profiles!instalador_responsavel_id(nome)
        `)
        .eq('associado_id', contrato.associado_id)
        .order('created_at', { ascending: false })
        .limit(1);

      // Buscar confirmação de agendamento (do serviço mais recente)
      let confirmacaoWhatsapp: string | null = null;
      if (instalacoes?.[0]?.id) {
        const { data: servico } = await supabase
          .from('servicos')
          .select('confirmacao_whatsapp')
          .eq('instalacao_origem_id', instalacoes[0].id)
          .maybeSingle();
        
        confirmacaoWhatsapp = servico?.confirmacao_whatsapp || null;
      }

      // Buscar serviço de instalação vinculado ao contrato (para assinatura + checklist/laudo)
      let servicoInstalacao: ServicoInstalacao | null = null;
      const { data: servicoData } = await supabase
        .from('servicos')
        .select(`
          id, status, assinatura_cliente_url,
          checklist_data, ressalvas_instalador, fotos_ressalva,
          video_360_url, quilometragem
        `)
        .eq('contrato_id', contrato.id)
        .eq('tipo', 'instalacao')
        .in('status', ['concluida', 'em_analise'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (servicoData) {
        // Buscar fotos da vistoria
        let vistoriaFotos: VistoriaFotoData[] = [];
        if (contrato.veiculo_id) {
          const { data: vistoria } = await supabase
            .from('vistorias')
            .select('id')
            .eq('veiculo_id', contrato.veiculo_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (vistoria?.id) {
            const { data: fotos } = await supabase
              .from('vistoria_fotos')
              .select('arquivo_url, tipo, visivel_cliente')
              .eq('vistoria_id', vistoria.id)
              .eq('visivel_cliente', true);
            vistoriaFotos = (fotos || []) as VistoriaFotoData[];
          }
        }

        servicoInstalacao = {
          ...servicoData,
          checklist_data: servicoData.checklist_data ?? null,
          ressalvas_instalador: servicoData.ressalvas_instalador ?? null,
          fotos_ressalva: servicoData.fotos_ressalva ?? null,
          video_360_url: servicoData.video_360_url ?? null,
          quilometragem: servicoData.quilometragem ?? null,
          vistoriaFotos,
        } as ServicoInstalacao;
      }

      // Buscar dados da cotação para verificar se o fluxo está completo
      let cotacaoTokenPublico: string | null = null;
      let cotacaoStatusContratacao: string | null = null;
      if (contrato.cotacao_id) {
        const { data: cotacaoData } = await supabase
          .from('cotacoes')
          .select('token_publico, status_contratacao')
          .eq('id', contrato.cotacao_id)
          .maybeSingle();
        cotacaoTokenPublico = (cotacaoData as any)?.token_publico || null;
        cotacaoStatusContratacao = (cotacaoData as any)?.status_contratacao || null;
      }

      const { data: documentosPendentes } = await supabase
        .from('documentos_solicitados')
        .select('id, associado_id, tipo_documento, descricao, status, observacao_solicitacao, created_at')
        .eq('associado_id', contrato.associado_id)
        .eq('status', 'pendente')
        .order('created_at', { ascending: true });

      return {
        ...associado,
        primeiro_acesso: primeiroAcesso,
        plano: associado.plano as any,
        veiculos: veiculos || [],
        contrato: {
          id: contrato.id,
          status: contrato.status || 'pendente',
        },
        instalacoes: (instalacoes || []).map(i => ({ ...i, confirmacao_whatsapp: confirmacaoWhatsapp })),
        servicoInstalacao,
        cotacaoTokenPublico,
        cotacaoStatusContratacao,
        documentosPendentes: (documentosPendentes || []) as DocumentoPendentePublico[],
      };
    },
    enabled: !!token,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
}

function getStatusInfo(associado: AssociadoData) {
  const veiculo = associado.veiculos[0];
  const instalacao = associado.instalacoes[0];
  const contrato = associado.contrato;
  const servico = associado.servicoInstalacao;


  if (associado.status === 'recusado' && veiculo?.motivo_recusa_veiculo?.toLowerCase().includes('monitoramento')) {
    return {
      status: 'reprovado_monitoramento',
      icon: XCircle,
      color: 'destructive',
      title: 'Instalação Reprovada pelo Monitoramento',
      description: 'A validação final identificou uma pendência na instalação. Nossa equipe entrará em contato para orientar os próximos passos.',
      showDetails: true,
      showCriarConta: false,
      showEmRota: false,
      showEmAndamento: false,
      showAtribuidaRota: false,
      showRecusaOrientacoes: true,
      motivoRecusa: veiculo.motivo_recusa_veiculo || '',
    };
  }

  if (associado.status === 'recusado' || contrato?.status === 'cancelado') {
    return {
      status: 'reprovado_cadastro',
      icon: XCircle,
      color: 'destructive',
      title: 'Cadastro Reprovado',
      description: 'Sua proposta não foi aprovada na análise cadastral. Entre em contato para mais informações.',
      showDetails: true,
      showCriarConta: false,
      showEmRota: false,
      showEmAndamento: false,
      showAtribuidaRota: false,
    };
  }

  // PRIORIDADE 1: Veículo recusado pelo instalador/vistoriador
  if (veiculo?.status === 'recusado') {
    return {
      status: 'veiculo_recusado',
      icon: AlertTriangle,
      color: 'warning',
      title: 'Pendência Identificada no Veículo',
      description: 'Nosso técnico identificou uma pendência que precisa ser resolvida antes de seguirmos com a proteção.',
      showDetails: true,
      showCriarConta: false,
      showEmRota: false,
      showEmAndamento: false,
      showAtribuidaRota: false,
      showRecusaOrientacoes: true,
      motivoRecusa: veiculo.motivo_recusa_veiculo || '',
    };
  }

  // PRIORIDADE 2: Instalação em andamento
  if (instalacao?.status === 'em_andamento') {
    return {
      status: 'em_andamento',
      icon: Wrench,
      color: 'success',
      title: 'Instalação em Andamento',
      description: 'O técnico está realizando a instalação do rastreador no seu veículo.',
      showDetails: true,
      showInstalacao: true,
      showCriarConta: false,
      showEmRota: false,
      showEmAndamento: true,
    };
  }

  // PRIORIDADE 3: Técnico a caminho (em_rota)
  if (instalacao?.status === 'em_rota') {
    const nomeVistoriador = instalacao.instalador_responsavel?.nome || 'Técnico';
    return {
      status: 'em_rota',
      icon: Navigation,
      color: 'primary',
      title: 'Técnico a Caminho!',
      description: 'O técnico já iniciou o deslocamento até você. Prepare-se para recebê-lo!',
      showDetails: true,
      showInstalacao: true,
      showCriarConta: false,
      showEmRota: true,
      showEmAndamento: false,
      showAtribuidaRota: false,
      nomeVistoriador,
    };
  }

  // PRIORIDADE 4: Instalação atribuída a uma rota
  if (instalacao?.rota_id && instalacao?.status === 'agendada') {
    const nomeVistoriador = instalacao.instalador_responsavel?.nome || 'Técnico';
    return {
      status: 'atribuida_rota',
      icon: UserCheck,
      color: 'primary',
      title: 'Instalação Agendada!',
      description: `O vistoriador ${nomeVistoriador} foi designado para realizar sua instalação.`,
      showDetails: true,
      showInstalacao: true,
      showCriarConta: false,
      showEmRota: false,
      showEmAndamento: false,
      showAtribuidaRota: true,
      nomeVistoriador,
    };
  }

  // Instalação concluída, aguardando validação final do Monitoramento
  if (servico?.status === 'concluida' && !veiculo?.cobertura_total) {
    return {
      status: 'aguardando_monitoramento',
      icon: ShieldCheck,
      color: 'primary',
      title: 'Instalação em Análise Final',
      description: 'A instalação foi concluída. Nosso monitoramento está validando os dados para ativar sua Proteção 360º.',
      showDetails: true,
      showInstalacao: true,
      showCriarConta: false,
      showEmRota: false,
      showEmAndamento: false,
      showAtribuidaRota: false,
    };
  }

  // ATIVO MAS SEM CONTA CRIADA OU PRIMEIRO ACESSO
  if (associado.status === 'ativo' && (!associado.user_id || associado.primeiro_acesso === true)) {
    return {
      status: 'criar_conta',
      icon: KeyRound,
      color: 'success',
      title: 'Crie sua Conta!',
      description: 'Seu cadastro foi aprovado! Crie seu login para acessar o app PRATIC.',
      showDetails: true,
      showCriarConta: true,
      showEmRota: false,
      showEmAndamento: false,
      showAtribuidaRota: false,
    };
  }

  // ATIVO COM COBERTURA PARCIAL
  if (associado.status === 'ativo' && veiculo?.cobertura_roubo_furto && !veiculo?.cobertura_total && associado.user_id) {
    return {
      status: 'cobertura_parcial',
      icon: Shield,
      color: 'primary',
      title: 'Cobertura Parcial Ativa',
      description: 'Sua proteção contra roubo e furto está ativa! Acesse o app e aguarde a instalação do rastreador para Proteção 360º.',
      showDetails: true,
      showCriarConta: false,
      showEmRota: false,
      showEmAndamento: false,
      showAtribuidaRota: false,
      showInstalacao: true,
    };
  }

  // Ativo com cobertura total
  if (associado.status === 'ativo' && veiculo?.cobertura_total) {
    return {
      status: 'ativo_total',
      icon: PartyPopper,
      color: 'success',
      title: 'Proteção 360º Ativa!',
      description: 'Parabéns! Seu veículo está com Proteção 360º ativa.',
      showDetails: true,
      showCriarConta: false,
      showEmRota: false,
      showEmAndamento: false,
      showAtribuidaRota: false,
    };
  }

  // Cobertura roubo/furto ativa
  if (veiculo?.cobertura_roubo_furto && !veiculo?.cobertura_total) {
    return {
      status: 'roubo_furto',
      icon: Shield,
      color: 'primary',
      title: 'Cobertura Roubo e Furto Ativa',
      description: 'Seu veículo já está protegido contra roubo e furto. Aguardando instalação do rastreador para Proteção 360º.',
      showDetails: true,
      showInstalacao: true,
      showCriarConta: false,
      showEmRota: false,
      showEmAndamento: false,
      showAtribuidaRota: false,
    };
  }

  // Pendente vistoria — diferenciar "agendamento confirmado" (em análise cadastral)
  // vs "sem agendamento" (aguardando vistoria)
  if (associado.status === 'pendente_vistoria') {
    const temAgendamento = !!instalacao?.data_agendada;
    if (temAgendamento) {
      return {
        status: 'em_analise_cadastral',
        icon: ClipboardCheck,
        color: 'info',
        title: 'Em Análise Cadastral',
        description: 'Recebemos seu agendamento e documentação. Nosso analista está revisando seu cadastro. Após aprovação, sua vistoria/instalação será executada conforme agendado.',
        showDetails: true,
        showInstalacao: true,
        showCriarConta: false,
        showEmRota: false,
        showEmAndamento: false,
        showAtribuidaRota: false,
      };
    }
    return {
      status: 'pendente_vistoria',
      icon: Camera,
      color: 'warning',
      title: 'Aguardando Vistoria',
      description: 'Sua proposta foi recebida! Aguardando a realização da vistoria do veículo.',
      showDetails: true,
      showCriarConta: false,
      showEmRota: false,
      showEmAndamento: false,
      showAtribuidaRota: false,
    };
  }

  // Aguardando instalação
  if (associado.status === 'aguardando_instalacao') {
    return {
      status: 'aguardando_instalacao',
      icon: Wrench,
      color: 'warning',
      title: 'Aguardando Instalação',
      description: instalacao?.data_agendada
        ? 'Seu cadastro foi aprovado. A instalação do rastreador será realizada conforme o agendamento.'
        : 'Seu cadastro foi aprovado. Agora vamos liberar o serviço de instalação do rastreador.',
      showDetails: true,
      showInstalacao: true,
      showCriarConta: false,
      showEmRota: false,
      showEmAndamento: false,
      showAtribuidaRota: false,
    };
  }

  // Documentação pendente
  if (associado.status === 'documentacao_pendente') {
    return {
      status: 'documentacao_pendente',
      icon: FileWarning,
      color: 'warning',
      title: 'Documentos Pendentes',
      description: 'O analista solicitou documentos adicionais para prosseguir com sua filiação.',
      showDetails: true,
      showDocumentosPendentes: true,
      showCriarConta: false,
      showEmRota: false,
      showEmAndamento: false,
      showAtribuidaRota: false,
    };
  }

  // Em análise
  if (associado.status === 'em_analise') {
    return {
      status: 'em_analise',
      icon: Clock,
      color: 'warning',
      title: 'Proposta em Análise',
      description: 'Seus documentos, contrato e imagens da vistoria estão sendo analisados pelo setor de cadastro.',
      showDetails: true,
      showCriarConta: false,
      showEmRota: false,
      showEmAndamento: false,
      showAtribuidaRota: false,
    };
  }

  // Default
  return {
    status: 'pendente',
    icon: FileCheck,
    color: 'muted',
    title: 'Proposta Recebida',
    description: 'Aguardando processamento da sua proposta.',
    showDetails: true,
    showCriarConta: false,
    showEmRota: false,
    showEmAndamento: false,
    showAtribuidaRota: false,
  };
}

function formatTipoFoto(tipo: string): string {
  const map: Record<string, string> = {
    frente: 'Frente',
    traseira: 'Traseira',
    lateral_esquerda: 'Lat. Esquerda',
    lateral_direita: 'Lat. Direita',
    painel: 'Painel',
    chassi: 'Chassi',
    motor: 'Motor',
    documento: 'Documento',
    placa: 'Placa',
    vidro: 'Vidro',
    pneu: 'Pneu',
    interior: 'Interior',
    teto: 'Teto',
    avaria: 'Avaria',
  };
  return map[tipo] || tipo.replace(/_/g, ' ');
}

export default function AcompanhamentoProposta() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: associado, isLoading, error } = useAcompanhamentoProposta(token);

  // Se o fluxo de contratação ainda não foi concluído, redirecionar de volta para a cotação
  const statusFluxoIncompleto = ['plano_escolhido', 'dados_preenchidos', 'documentos_ok', 'contrato_gerado'];
  useEffect(() => {
    if (
      associado?.cotacaoStatusContratacao &&
      statusFluxoIncompleto.includes(associado.cotacaoStatusContratacao) &&
      associado.cotacaoTokenPublico
    ) {
      console.log('[AcompanhamentoProposta] Fluxo incompleto, redirecionando para cotação:', associado.cotacaoStatusContratacao);
      navigate(`/cotacao/${associado.cotacaoTokenPublico}`, { replace: true });
    }
  }, [associado?.cotacaoStatusContratacao, associado?.cotacaoTokenPublico, navigate]);

  // Checklist items parsed
  const checklistItems = useMemo<ChecklistItemData[]>(() => {
    if (!associado?.servicoInstalacao?.checklist_data) return [];
    const data = associado.servicoInstalacao.checklist_data;
    if (data.items && Array.isArray(data.items)) {
      return data.items;
    }
    return Object.entries(data)
      .filter(([key]) => key !== 'items')
      .map(([id, val]: [string, any]) => ({
        id,
        label: val.label || id.replace(/_/g, ' '),
        status: val.status || 'pendente',
        observacao: val.observacao,
        fotos: val.fotos,
      }));
  }, [associado?.servicoInstalacao?.checklist_data]);

  // Fotos galeria (excluindo tipos internos)
  const fotosGaleria = useMemo(() => {
    if (!associado?.servicoInstalacao?.vistoriaFotos) return [];
    const tiposExcluidos = ['instalacao', 'local_rastreador', 'assinatura_cliente'];
    return associado.servicoInstalacao.vistoriaFotos
      .filter(f => !tiposExcluidos.includes(f.tipo))
      .map((f) => ({
        url: f.arquivo_url,
        label: formatTipoFoto(f.tipo),
        tipo: f.tipo,
      }));
  }, [associado?.servicoInstalacao?.vistoriaFotos]);

  // Realtime subscription
  useEffect(() => {
    if (!associado?.id) return;

    const channel = supabase
      .channel(`acompanhamento-cliente-${associado.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'instalacoes', filter: `associado_id=eq.${associado.id}` },
        () => { queryClient.invalidateQueries({ queryKey: ['acompanhamento-proposta', token] }); }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'associados', filter: `id=eq.${associado.id}` },
        () => { queryClient.invalidateQueries({ queryKey: ['acompanhamento-proposta', token] }); }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'veiculos', filter: `associado_id=eq.${associado.id}` },
        () => { queryClient.invalidateQueries({ queryKey: ['acompanhamento-proposta', token] }); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'documentos_solicitados', filter: `associado_id=eq.${associado.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['acompanhamento-proposta', token] });
          queryClient.invalidateQueries({ queryKey: ['docs-solicitados-pendentes', associado.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [associado?.id, associado?.contrato?.id, token, queryClient]);

  if (isLoading) {
    return (
      <div className="dark min-h-screen public-premium-bg p-4 md:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <Skeleton className="h-24 w-full rounded-xl bg-white/5" />
          <Skeleton className="h-[400px] rounded-xl bg-white/5" />
        </div>
      </div>
    );
  }

  if (error || !associado) {
    return (
      <div className="dark min-h-screen public-premium-bg flex items-center justify-center p-4">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-[120px]" />
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
              <h1 className="text-xl font-bold mb-2 text-foreground">Proposta não encontrada</h1>
              <p className="text-muted-foreground">
                Este link é inválido ou a proposta não existe mais.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(associado);
  const veiculo = associado.veiculos[0];
  const instalacao = associado.instalacoes[0];
  const StatusIcon = statusInfo.icon;
  const servico = associado.servicoInstalacao;
  const hasDocsPendentes = associado.documentosPendentes.length > 0;
  const shouldPrioritizeDocsPendentes = hasDocsPendentes || associado.status === 'documentacao_pendente';

  const showChecklistSection = !!(statusInfo as any).showChecklist && servico;
  const itensOk = checklistItems.filter(i => i.status === 'ok').length;
  const itensNok = checklistItems.filter(i => i.status === 'nok').length;

  const colorClasses = {
    success: {
      bg: 'bg-success/10',
      border: 'border-success/30',
      text: 'text-success',
      badge: 'bg-success/20 text-success border-success/30',
    },
    primary: {
      bg: 'bg-primary/10',
      border: 'border-primary/30',
      text: 'text-primary',
      badge: 'bg-primary/20 text-primary border-primary/30',
    },
    info: {
      bg: 'bg-primary/10',
      border: 'border-primary/30',
      text: 'text-primary',
      badge: 'bg-primary/20 text-primary border-primary/30',
    },
    warning: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      text: 'text-amber-400',
      badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    },
    destructive: {
      bg: 'bg-destructive/10',
      border: 'border-destructive/30',
      text: 'text-destructive',
      badge: 'bg-destructive/20 text-destructive border-destructive/30',
    },
    muted: {
      bg: 'bg-muted/30',
      border: 'border-border',
      text: 'text-muted-foreground',
      badge: 'bg-muted text-muted-foreground border-border',
    },
  };

  const colors = colorClasses[statusInfo.color as keyof typeof colorClasses];

  if (shouldPrioritizeDocsPendentes) {
    return (
      <div className="dark min-h-screen public-premium-bg flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl">
          {hasDocsPendentes ? (
            <DocumentosPendentesPublico
              associadoId={associado.id}
              docsPendentes={associado.documentosPendentes}
              onTodosEnviados={() => {
                queryClient.invalidateQueries({ queryKey: ['acompanhamento-proposta', token] });
              }}
            />
          ) : (
            <Card className="border-warning/30 bg-card/80 backdrop-blur-xl">
              <CardContent className="py-10 text-center space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warning/10">
                  <Loader2 className="h-7 w-7 animate-spin text-warning" />
                </div>
                <div>
                  <Badge className="mb-3 bg-warning/20 text-warning border-warning/30">Documentação pendente</Badge>
                  <h1 className="text-xl font-bold text-foreground">Carregando documentos solicitados</h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    O setor de cadastro solicitou ajustes. Estamos atualizando a lista para você enviar os arquivos corretos.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="dark min-h-screen public-premium-bg relative">
      {/* Ambient glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.12),transparent)]" />
      </div>

      {/* Header */}
      <motion.header 
        className="header-premium-glow text-white sticky top-0 z-20"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, type: 'spring' }}
      >
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
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
          <Badge variant="outline" className="border-white/20 text-white bg-white/5 backdrop-blur-sm px-4">
            Acompanhamento
          </Badge>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          {/* Status Principal */}
          <Card className={`${colors.border} bg-card/80 backdrop-blur-xl`}>
            <CardContent className="py-8 text-center space-y-6">
              <motion.div 
                className={`w-20 h-20 mx-auto rounded-full ${colors.bg} flex items-center justify-center`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
              >
                <StatusIcon className={`h-10 w-10 ${colors.text}`} />
              </motion.div>
              
              <div>
                <Badge className={`${colors.badge} mb-4`}>
                  {statusInfo.title}
                </Badge>
                <h2 className="text-xl font-bold mb-3 text-foreground">
                  Olá, {associado.nome.split(' ')[0]}!
                </h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {statusInfo.description}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Formulário de Criação de Conta */}
          {statusInfo.showCriarConta && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <CriarContaAssociadoForm 
                associadoId={associado.id}
                nomeAssociado={associado.nome}
                emailCadastrado={associado.email}
              />
            </motion.div>
          )}

          {/* Documentos Pendentes */}
          {((statusInfo as any).showDocumentosPendentes || associado.status === 'documentacao_pendente') && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <DocumentosPendentes 
                associadoId={associado.id}
                onTodosEnviados={() => {
                  queryClient.invalidateQueries({ queryKey: ['acompanhamento-proposta', token] });
                }}
              />
            </motion.div>
          )}

          {/* Orientações pós-Recusa */}
          {(statusInfo as any).showRecusaOrientacoes && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <Card className="bg-amber-500/5 border-amber-500/30">
                <CardContent className="py-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                      <Wrench className="h-5 w-5 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">O que fazer agora?</h3>
                      <p className="text-sm text-muted-foreground">Siga as orientações abaixo para regularizar</p>
                    </div>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-foreground leading-relaxed">
                      {getOrientacoesRecusa((statusInfo as any).motivoRecusa || 'outro')}
                    </p>
                  </div>
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
                    <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Próximos passos
                    </h4>
                    <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                      <li>Resolva a pendência indicada acima</li>
                      <li>Guarde comprovantes do serviço realizado</li>
                      <li>Faça uma <strong className="text-foreground">nova cotação</strong> pelo app ou entre em contato conosco</li>
                    </ol>
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      💡 Como os valores de proteção são atualizados mensalmente com base na tabela FIPE, será necessário gerar uma nova cotação — e pode ser até mais vantajoso!
                    </p>
                  </div>
                  <div className="text-center pt-2">
                    <p className="text-sm text-muted-foreground">
                      Dúvidas? Entre em contato pelo WhatsApp ou ligue para nossa central 💙
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Técnico a Caminho */}
          {statusInfo.showEmRota && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}>
              <Card className="bg-primary/5 border-primary/30 overflow-hidden">
                <CardContent className="py-6">
                  <div className="flex items-center gap-4">
                    <div className="relative flex-shrink-0">
                      <div className="absolute inset-0 bg-primary/30 rounded-full animate-ping" />
                      <div className="relative w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
                        <Navigation className="h-7 w-7 text-primary animate-pulse" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        Técnico a Caminho
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        O profissional está se deslocando até o endereço agendado
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-2">
                    <p className="text-xs font-medium text-foreground">Prepare-se para a chegada:</p>
                    <ul className="text-sm text-muted-foreground space-y-2">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                        Tenha o veículo acessível e estacionado
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                        Tenha os documentos do veículo em mãos
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                        Aguarde no local combinado
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Vistoriador Designado */}
          {(statusInfo as any).showAtribuidaRota && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}>
              <Card className="bg-primary/5 border-primary/30 overflow-hidden">
                <CardContent className="py-6">
                  <div className="flex items-center gap-4">
                    <div className="relative flex-shrink-0">
                      <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
                        <UserCheck className="h-7 w-7 text-primary" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground">Vistoriador Designado</h3>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-primary">{(statusInfo as any).nomeVistoriador}</span> 
                        {' '}irá realizar sua instalação
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-2">
                    <p className="text-xs font-medium text-foreground">Próximos passos:</p>
                    <ul className="text-sm text-muted-foreground space-y-2">
                      <li className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary flex-shrink-0" />
                        Aguarde o vistoriador iniciar o deslocamento
                      </li>
                      <li className="flex items-center gap-2">
                        <Bell className="h-4 w-4 text-primary flex-shrink-0" />
                        Você será notificado quando ele estiver a caminho
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Instalação em Andamento */}
          {(statusInfo as any).showEmAndamento && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}>
              <Card className="bg-success/5 border-success/30">
                <CardContent className="py-6">
                  <div className="flex items-center gap-4">
                    <div className="relative flex-shrink-0">
                      <div className="absolute inset-0 bg-success/20 rounded-full animate-pulse" />
                      <div className="relative w-14 h-14 rounded-full bg-success/20 flex items-center justify-center">
                        <Wrench className="h-7 w-7 text-success" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground">Instalação em Andamento</h3>
                      <p className="text-sm text-muted-foreground">
                        O técnico está instalando o rastreador no seu veículo. Aguarde a conclusão.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-success/10 rounded-lg">
                    <p className="text-sm text-success text-center font-medium">
                      ⏱️ Tempo estimado: 30-60 minutos
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Detalhes do Veículo */}
          {statusInfo.showDetails && veiculo && (
            <Card className="bg-card/80 backdrop-blur-xl border-border/50">
              <CardContent className="py-6 space-y-4">
                <div className="flex items-center gap-3 text-foreground">
                  <Car className="h-5 w-5 text-primary" />
                  <span className="font-medium">{veiculo.marca} {veiculo.modelo}</span>
                  <Badge variant="secondary" className="text-xs">{veiculo.placa}</Badge>
                </div>
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-3">
                    {veiculo.cobertura_roubo_furto ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : (
                      <Clock className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className={veiculo.cobertura_roubo_furto ? 'text-foreground' : 'text-muted-foreground'}>
                      Cobertura Roubo e Furto
                    </span>
                    {veiculo.cobertura_roubo_furto && (
                      <Badge className="bg-success/20 text-success border-success/30 text-xs">Ativa</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {veiculo.cobertura_total ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : (
                      <Clock className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className={veiculo.cobertura_total ? 'text-foreground' : 'text-muted-foreground'}>
                      Proteção 360º (após instalação)
                    </span>
                    {veiculo.cobertura_total && (
                      <Badge className="bg-success/20 text-success border-success/30 text-xs">Ativa</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info de Instalação */}
          {(statusInfo as any).showInstalacao && instalacao && (
            <Card className="bg-card/80 backdrop-blur-xl border-border/50">
              <CardContent className="py-6 space-y-4">
                <div className="flex items-center gap-3 text-foreground">
                  <Wrench className="h-5 w-5 text-primary" />
                  <span className="font-medium">Instalação do Rastreador</span>
                </div>
                {instalacao.status === 'concluida' ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="text-success">Instalação concluída</span>
                  </div>
                ) : instalacao.data_agendada ? (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Agendada para</p>
                      <p className="font-medium">
                        {format(new Date(instalacao.data_agendada), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-warning" />
                    <span className="text-muted-foreground">Aguardando agendamento</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}


          {/* ============================================ */}
          {/* SEÇÃO: Checklist + Avarias + Mídia + Laudo   */}
          {/* ============================================ */}
          {showChecklistSection && servico && (
            <>

              {/* Quilometragem */}
              {servico.quilometragem && (
                <div className="text-center">
                  <Badge variant="outline" className="text-xs">
                    Quilometragem: {servico.quilometragem.toLocaleString('pt-BR')} km
                  </Badge>
                </div>
              )}

              {/* Checklist de Serviços */}
              {checklistItems.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                  <Card className="bg-card/80 backdrop-blur-xl border-border/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center justify-between text-base">
                        <span className="flex items-center gap-2 text-foreground">
                          <ClipboardCheck className="h-5 w-5 text-primary" />
                          Checklist de Serviços
                        </span>
                        <div className="flex gap-1.5">
                          {itensOk > 0 && (
                            <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-xs">
                              {itensOk} OK
                            </Badge>
                          )}
                          {itensNok > 0 && (
                            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
                              {itensNok} Ressalva
                            </Badge>
                          )}
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {checklistItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30"
                        >
                          {item.status === 'ok' ? (
                            <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" />
                          ) : item.status === 'nok' ? (
                            <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 mt-0.5 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{item.label}</p>
                            {item.observacao && (
                              <p className="text-xs text-muted-foreground mt-1">{item.observacao}</p>
                            )}
                            {item.fotos && item.fotos.length > 0 && (
                              <div className="flex gap-2 mt-2">
                                {item.fotos.map((url, i) => (
                                  <img
                                    key={i}
                                    src={url}
                                    alt={`Evidência ${i + 1}`}
                                    className="h-12 w-12 rounded object-cover border border-border cursor-pointer"
                                    onClick={() => window.open(url, '_blank')}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Avarias Identificadas */}
              {(servico.ressalvas_instalador || (servico.fotos_ressalva && servico.fotos_ressalva.length > 0)) && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                  <Card className="bg-card/80 backdrop-blur-xl border-amber-500/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base text-foreground">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        Avarias Identificadas
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {servico.ressalvas_instalador && (
                        <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                          <p className="text-sm text-foreground whitespace-pre-wrap">{servico.ressalvas_instalador}</p>
                        </div>
                      )}
                      {servico.fotos_ressalva && servico.fotos_ressalva.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Fotos de evidência:</p>
                          <div className="grid grid-cols-3 gap-2">
                            {servico.fotos_ressalva.map((url, i) => (
                              <img
                                key={i}
                                src={url}
                                alt={`Avaria ${i + 1}`}
                                className="aspect-square rounded-lg object-cover border border-border cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => window.open(url, '_blank')}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Mídia Visual */}
              {(fotosGaleria.length > 0 || servico.video_360_url) && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
                  <Card className="bg-card/80 backdrop-blur-xl border-border/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base text-foreground">
                        <Camera className="h-5 w-5 text-primary" />
                        Registro Fotográfico
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {fotosGaleria.length > 0 && (
                        <div className="grid grid-cols-3 gap-2">
                          {fotosGaleria.map((foto, i) => (
                            <div
                              key={i}
                              className="relative aspect-square cursor-pointer group"
                              onClick={() => window.open(foto.url, '_blank')}
                            >
                              <img
                                src={foto.url}
                                alt={foto.label}
                                className="h-full w-full rounded-lg object-cover border border-border group-hover:opacity-90 transition-opacity"
                              />
                              <div className="absolute bottom-0 left-0 right-0 bg-black/60 rounded-b-lg px-1.5 py-1">
                                <p className="text-[10px] text-white truncate">{foto.label}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {servico.video_360_url && (
                        <div className="mt-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Video className="h-4 w-4 text-purple-500" />
                            <span className="text-sm font-medium text-foreground">Vídeo 360°</span>
                            <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/30 text-xs">
                              <Play className="h-3 w-3 mr-1" />
                              360°
                            </Badge>
                          </div>
                          <div className="rounded-lg overflow-hidden border border-border">
                            <video
                              src={servico.video_360_url}
                              controls
                              playsInline
                              preload="metadata"
                              className="w-full aspect-video object-contain bg-black"
                            >
                              Seu navegador não suporta vídeos.
                            </video>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Disclaimer */}
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground text-center">
                  Ao assinar o laudo, você confirma que está ciente de todas as atividades 
                  e condições registradas durante a instalação do rastreador.
                </p>
              </div>
            </>
          )}

          {/* Plano */}
          {associado.plano && (
            <Card className="bg-card/80 backdrop-blur-xl border-border/50">
              <CardContent className="py-4">
                <div className="flex items-center gap-3 text-foreground">
                  <Shield className="h-5 w-5 text-primary" />
                  <span className="font-medium">Plano:</span>
                  <span className="text-muted-foreground">{associado.plano.nome}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </main>


      {/* Footer */}
      <footer className="border-t border-border/30 mt-auto relative z-10 bg-card/30 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-6 text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} PRATIC - Proteção Veicular. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
