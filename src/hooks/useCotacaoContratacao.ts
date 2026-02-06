import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';
import type { DadosPessoaisForm } from '@/components/cotacao-publica/FormularioDadosPessoais';
import type { PlanoOpcao } from '@/components/cotacao-publica/EscolhaPlano';
import type { RealtimeChannel } from '@supabase/supabase-js';

type Cotacao = Tables<'cotacoes'>;

export type StatusContratacao = 
  | 'aguardando'
  | 'plano_escolhido'
  | 'dados_preenchidos'
  | 'documentos_ok'
  | 'contrato_assinado'
  | 'vistoria_ok'
  | 'pagamento_ok'
  | 'contrato_gerado';

interface PlanoComparacao {
  id: string;
  nome: string;
  codigo?: string;
  valorMensal: number;
  valorAdesao?: number;
  coberturas?: string[];
  destaque?: boolean;
  nivel?: 'basic' | 'premium' | 'exclusive';
}

interface DadosExtrasCotacao {
  planos_comparacao?: PlanoComparacao[];
  [key: string]: unknown;
}

export interface CotacaoContratacao extends Omit<Cotacao, 'dados_extras'> {
  planos?: Tables<'planos'> | null;
  plano_escolhido?: Tables<'planos'> | null;
  dados_extras?: DadosExtrasCotacao | null;
  contrato?: {
    id: string;
    associado_id: string;
    associados?: {
      id: string;
      status: string;
    } | null;
  } | null;
}

// Interface para documentos pendentes
export interface DocumentoPendentePublico {
  id: string;
  associado_id: string;
  tipo_documento: string;
  descricao: string | null;
  status: string;
  observacao_solicitacao: string | null;
  created_at: string;
}

export function useCotacaoContratacao(token: string | undefined) {
  const queryClient = useQueryClient();
  const [etapaAtual, setEtapaAtual] = useState(0);

  // Buscar cotação pelo token público usando cliente ANÔNIMO
  // Isso garante que funcione mesmo se o usuário estiver logado no painel
  const { data: cotacao, isLoading, error, refetch } = useQuery({
    queryKey: ['cotacao-contratacao', token],
    queryFn: async (): Promise<CotacaoContratacao> => {
      if (!token) throw new Error('Token não informado');

      // Query simplificada - sem JOINs com contratos/associados que têm RLS restritivo
      // O contrato é buscado separadamente via contratoFallback abaixo
      const { data, error } = await publicSupabase
        .from('cotacoes')
        .select(`
          *,
          planos:planos!plano_id(id, nome, codigo, coberturas, valor_adesao),
          plano_escolhido:planos!plano_escolhido_id(id, nome, codigo, coberturas, valor_adesao)
        `)
        .eq('token_publico', token)
        .maybeSingle();

      if (error) {
        console.error('[CotacaoContratacao] Erro ao buscar cotação:', error);
        throw error;
      }
      
      if (!data) {
        console.warn('[CotacaoContratacao] Nenhuma cotação encontrada para token:', token);
        throw new Error('Cotação não encontrada');
      }

      // Atualizar visualizado_em se for primeira visualização
      if (!data.visualizado_em) {
        await publicSupabase
          .from('cotacoes')
          .update({ visualizado_em: new Date().toISOString() })
          .eq('id', data.id);
      }

      return data as unknown as CotacaoContratacao;
    },
    enabled: !!token,
    retry: 2,
    retryDelay: 500,
  });

  // Query de fallback para buscar contrato via cotacao_token_publico
  // Isso resolve o problema quando o embed via FK é bloqueado por RLS para anon
  // IMPORTANTE: Inclui link_token para permitir redirecionamento para /acompanhar/:link_token
  const { data: contratoFallback } = useQuery({
    queryKey: ['contrato-publico-fallback', token],
    queryFn: async () => {
      if (!token) return null;
      
      console.log('[CotacaoContratacao] Buscando contrato via cotacao_token_publico...');
      
      const { data, error } = await publicSupabase
        .from('contratos')
        .select(`
          id,
          associado_id,
          link_token,
          associados:associados!fk_contratos_associado(
            id,
            status
          )
        `)
        .eq('cotacao_token_publico', token)
        .maybeSingle();

      if (error) {
        console.error('[CotacaoContratacao] Erro na query fallback:', error);
        return null;
      }
      
      console.log('[CotacaoContratacao] Contrato fallback encontrado:', data?.id, 'link_token:', data?.link_token);
      return data;
    },
    enabled: !!token,
    refetchInterval: 10000, // Reduzido para 10 segundos para detectar mudanças de status mais rápido
    refetchOnWindowFocus: true, // Revalidar ao voltar para a aba
    staleTime: 0, // Sempre considerar stale para garantir dados frescos
  });

  // Extrair associadoId do contrato vinculado - priorizar embed, usar fallback se necessário
  const associadoId = useMemo(() => {
    const fromEmbed = cotacao?.contrato?.associado_id;
    const fromFallback = contratoFallback?.associado_id;
    
    console.log('[CotacaoContratacao] associadoId - embed:', fromEmbed, 'fallback:', fromFallback);
    
    return fromEmbed || fromFallback || null;
  }, [cotacao?.contrato?.associado_id, contratoFallback?.associado_id]);

  // Status do associado - também com fallback
  const associadoStatus = useMemo(() => {
    const fromEmbed = cotacao?.contrato?.associados?.status;
    const fromFallback = contratoFallback?.associados?.status;
    
    return fromEmbed || fromFallback || null;
  }, [cotacao?.contrato?.associados?.status, contratoFallback?.associados?.status]);

  // Buscar documentos pendentes para o associado
  const { data: docsPendentes, isLoading: isLoadingDocs, refetch: refetchDocs } = useQuery({
    queryKey: ['docs-pendentes-public', associadoId],
    queryFn: async (): Promise<DocumentoPendentePublico[]> => {
      if (!associadoId) return [];

      const { data, error } = await publicSupabase
        .from('documentos_solicitados')
        .select('id, associado_id, tipo_documento, descricao, status, observacao_solicitacao, created_at')
        .eq('associado_id', associadoId)
        .eq('status', 'pendente')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[CotacaoContratacao] Erro ao buscar docs pendentes:', error);
        return [];
      }

      return (data || []) as DocumentoPendentePublico[];
    },
    enabled: !!associadoId,
    refetchInterval: 30000, // Revalidar a cada 30 segundos como fallback
  });

  // REALTIME: Subscrição para atualizações em tempo real
  // Inclui: documentos_solicitados, associados, cotacoes e vistorias
  useEffect(() => {
    if (!token) return;

    console.log('[CotacaoContratacao] Iniciando realtime para token:', token, 'associadoId:', associadoId, 'cotacaoId:', cotacao?.id);

    const channelName = `cotacao-contratacao-${token}`;
    let channel: RealtimeChannel = publicSupabase.channel(channelName);

    // 1. Subscrição para cotacoes (detecta vistoria_concluida_em, status_contratacao, etc)
    channel = channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'cotacoes',
        filter: `token_publico=eq.${token}`,
      },
      (payload) => {
        console.log('[CotacaoContratacao] Realtime: cotacao atualizada:', payload);
        refetch();
        queryClient.invalidateQueries({ queryKey: ['contrato-publico-fallback', token] });
      }
    );

    // 2. Subscrição para vistorias (por cotacao_id, se disponível)
    if (cotacao?.id) {
      channel = channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'vistorias',
          filter: `cotacao_id=eq.${cotacao.id}`,
        },
        (payload) => {
          console.log('[CotacaoContratacao] Realtime: vistoria atualizada:', payload);
          refetch();
          queryClient.invalidateQueries({ queryKey: ['vistoria-existente', cotacao.id] });
        }
      );
    }

    // 3. Subscrição para documentos_solicitados (por associado_id, se disponível)
    if (associadoId) {
      channel = channel.on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'documentos_solicitados',
          filter: `associado_id=eq.${associadoId}`,
        },
        (payload) => {
          console.log('[CotacaoContratacao] Realtime: documentos_solicitados mudou:', payload);
          refetchDocs();
        }
      );

      // 4. Subscrição para associados (por id, para detectar mudança de status)
      channel = channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'associados',
          filter: `id=eq.${associadoId}`,
        },
        async (payload) => {
          console.log('[CotacaoContratacao] Realtime: associado atualizado:', payload);
          
          // Forçar refetch imediato (não apenas invalidar) para garantir atualização instantânea
          await queryClient.refetchQueries({ queryKey: ['contrato-publico-fallback', token] });
          refetch();
        }
      );
    }

    channel.subscribe((status) => {
      console.log('[CotacaoContratacao] Realtime status:', status);
    });

    return () => {
      console.log('[CotacaoContratacao] Removendo subscription realtime');
      publicSupabase.removeChannel(channel);
    };
  }, [token, associadoId, cotacao?.id, refetchDocs, refetch, queryClient]);

  // Extrair planos disponíveis para escolha
  const planosDisponiveis: PlanoOpcao[] = (() => {
    if (!cotacao) return [];

    const dadosExtras = cotacao.dados_extras as DadosExtrasCotacao | null;
    const planosComparacao = dadosExtras?.planos_comparacao;

    if (planosComparacao && planosComparacao.length > 0) {
      return planosComparacao.map((p) => ({
        id: p.id,
        nome: p.nome,
        codigo: p.codigo,
        valorMensal: p.valorMensal,
        valorAdesao: p.valorAdesao,
        coberturas: p.coberturas,
        destaque: p.destaque,
        nivel: p.nivel,
      }));
    }

    // Se não tiver planos de comparação, usa o plano principal
    if (cotacao.planos) {
      return [{
        id: cotacao.planos.id,
        nome: cotacao.planos.nome,
        codigo: cotacao.planos.codigo,
        valorMensal: cotacao.valor_cota || 0,
        valorAdesao: cotacao.valor_adesao || 0,
        coberturas: cotacao.planos.coberturas as string[] | undefined,
      }];
    }

    return [];
  })();

  // Determinar etapa atual baseado no status
  // NOVO FLUXO: 0=Plano, 1=Documentos+Dados, 2=Contrato (Autentique), 3=Vistoria, 4=Pagamento
  const determinarEtapa = useCallback((status: string | null) => {
    switch (status) {
      case 'aguardando':
        return 0; // Escolha de plano
      case 'plano_escolhido':
        return 1; // Documentos e dados (unificado)
      case 'dados_preenchidos':
      case 'documentos_ok':
        return 2; // Assinatura do contrato (Autentique) - NOVA ETAPA
      case 'contrato_assinado':
        return 3; // Vistoria (movido)
      case 'vistoria_ok':
        return 4; // Pagamento (movido)
      case 'pagamento_ok':
      case 'contrato_gerado':
        return 5; // Conclusão
      default:
        return 0;
    }
  }, []);

  // Atualizar plano escolhido
  const selecionarPlano = useMutation({
    mutationFn: async (planoId: string) => {
      if (!cotacao) throw new Error('Cotação não encontrada');

      const { error } = await publicSupabase
        .from('cotacoes')
        .update({
          plano_escolhido_id: planoId,
          status_contratacao: 'plano_escolhido',
        })
        .eq('id', cotacao.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotacao-contratacao', token] });
      setEtapaAtual(1);
    },
    onError: (error: Error) => {
      toast.error('Erro ao selecionar plano: ' + error.message);
    },
  });

  // Gerar proposta/contrato automaticamente
  const gerarPropostaAutomatica = useMutation({
    mutationFn: async (cotacaoId: string) => {
      console.log('[useCotacaoContratacao] Gerando proposta automaticamente...');
      
      const { data, error } = await publicSupabase.functions.invoke('contrato-gerar', {
        body: { cotacao_id: cotacaoId },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao gerar proposta');

      // Atualizar cotação com ID do contrato gerado
      if (data?.contrato?.id) {
        await publicSupabase
          .from('cotacoes')
          .update({ contrato_gerado_id: data.contrato.id })
          .eq('id', cotacaoId);
      }

      console.log('[useCotacaoContratacao] Proposta gerada:', data.contrato?.numero);
      return data;
    },
  });

  // Salvar dados pessoais
  const salvarDadosPessoais = useMutation({
    mutationFn: async (dados: DadosPessoaisForm) => {
      if (!cotacao) throw new Error('Cotação não encontrada');

      // 1. Salvar dados pessoais + dados do veículo extraídos do CRLV
      const { error } = await publicSupabase
        .from('cotacoes')
        .update({
          nome_solicitante: dados.nome,
          email_solicitante: dados.email,
          telefone1_solicitante: dados.telefone,
          cliente_cpf: dados.cpf,
          cliente_data_nascimento: dados.data_nascimento,
          cliente_cep: dados.cep,
          cliente_logradouro: dados.logradouro,
          cliente_numero: dados.numero,
          cliente_complemento: dados.complemento,
          cliente_bairro: dados.bairro,
          cliente_cidade: dados.cidade,
          cliente_uf: dados.uf,
          status_contratacao: 'dados_preenchidos',
          
          // Dados de documentos pessoais (RG/CNH) extraídos via OCR
          cliente_rg: dados.rg || null,
          cliente_rg_orgao: dados.rg_orgao || null,
          cliente_cnh: dados.cnh || null,
          cliente_cnh_validade: dados.cnh_validade || null,
          cliente_cnh_categoria: dados.cnh_categoria || null,
          
          // Dados do veículo extraídos do CRLV via OCR (necessários para SGA Hinova e Termo)
          veiculo_chassi: dados.veiculo_chassi || null,
          veiculo_renavam: dados.veiculo_renavam || null,
          veiculo_cor: dados.veiculo_cor || null,
          veiculo_combustivel: dados.veiculo_combustivel || null,
          veiculo_ano_fabricacao: dados.veiculo_ano_fabricacao || null,
        })
        .eq('id', cotacao.id);

      if (error) throw error;

      // 2. Gerar proposta automaticamente se ainda não existir
      if (!cotacao.contrato_gerado_id) {
        try {
          await gerarPropostaAutomatica.mutateAsync(cotacao.id);
          console.log('[useCotacaoContratacao] Proposta gerada automaticamente após dados pessoais');
        } catch (propostaError) {
          console.error('[useCotacaoContratacao] Erro ao gerar proposta automática:', propostaError);
          // Não impede o fluxo - proposta pode ser gerada depois
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotacao-contratacao', token] });
      setEtapaAtual(2); // Ir para assinatura do contrato (etapa 2 no novo fluxo)
      toast.success('Dados salvos com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar dados: ' + error.message);
    },
  });

  // Atualizar status dos documentos
  const atualizarDocumentos = useMutation({
    mutationFn: async (docs: {
      cnh_frente?: string;
      cnh_verso?: string;
      crlv?: string;
      comprovante?: string;
      selfie?: string;
    }) => {
      if (!cotacao) throw new Error('Cotação não encontrada');

      const { error } = await publicSupabase
        .from('cotacoes')
        .update({
          doc_cnh_frente: docs.cnh_frente,
          doc_cnh_verso: docs.cnh_verso,
          doc_crlv: docs.crlv,
          doc_comprovante: docs.comprovante,
          doc_selfie: docs.selfie,
          status_contratacao: 'documentos_ok',
        })
        .eq('id', cotacao.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotacao-contratacao', token] });
      setEtapaAtual(2); // Ir para assinatura do contrato (etapa 2 no novo fluxo)
      toast.success('Documentos enviados com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao enviar documentos: ' + error.message);
    },
  });

  // Salvar tipo de vistoria
  const selecionarVistoria = useMutation({
    mutationFn: async (tipoVistoria: 'autovistoria' | 'agendada') => {
      if (!cotacao) throw new Error('Cotação não encontrada');

      const { error } = await publicSupabase
        .from('cotacoes')
        .update({
          tipo_vistoria: tipoVistoria,
          status_contratacao: 'vistoria_ok',
          // vistoria_concluida_em será setado apenas quando o vistoriador concluir a instalação
        })
        .eq('id', cotacao.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotacao-contratacao', token] });
      setEtapaAtual(4); // Ir para pagamento (etapa 4 no novo fluxo)
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar vistoria: ' + error.message);
    },
  });

  // Confirmar pagamento e gerar contrato
  const confirmarPagamento = useMutation({
    mutationFn: async () => {
      if (!cotacao) throw new Error('Cotação não encontrada');

      // 1. Atualizar status do pagamento
      const { error: updateError } = await publicSupabase
        .from('cotacoes')
        .update({ status_contratacao: 'pagamento_ok' })
        .eq('id', cotacao.id);

      if (updateError) throw updateError;

      // 2. Gerar contrato via edge function (usa publicSupabase para invocar)
      const { data, error: fnError } = await publicSupabase.functions.invoke('contrato-gerar', {
        body: { cotacao_id: cotacao.id },
      });

      if (fnError) throw fnError;

      // 3. Atualizar cotação com ID do contrato gerado
      if (data?.contrato?.id) {
        await publicSupabase
          .from('cotacoes')
          .update({
            contrato_gerado_id: data.contrato.id,
            status_contratacao: 'contrato_gerado',
            status: 'aceita',
          })
          .eq('id', cotacao.id);
      }

      return data;
    },
    onSuccess: async () => {
      // Aguardar invalidação e refetch para garantir dados atualizados antes de mudar de etapa
      await queryClient.invalidateQueries({ queryKey: ['cotacao-contratacao', token] });
      await queryClient.refetchQueries({ queryKey: ['cotacao-contratacao', token] });
      setEtapaAtual(5); // Ir para conclusão (etapa 5 no novo fluxo)
      toast.success('Pagamento confirmado! Sua cobertura está ativa.');
    },
    onError: (error: Error) => {
      toast.error('Erro ao processar pagamento: ' + error.message);
    },
  });

  // Link token para redirecionamento para /acompanhar/:link_token
  const contratoLinkToken = useMemo(() => {
    return contratoFallback?.link_token || null;
  }, [contratoFallback?.link_token]);

  return {
    cotacao,
    isLoading: isLoading || isLoadingDocs,
    error,
    planosDisponiveis,
    etapaAtual,
    setEtapaAtual,
    determinarEtapa,
    selecionarPlano: selecionarPlano.mutate,
    salvarDadosPessoais: salvarDadosPessoais.mutate,
    atualizarDocumentos: atualizarDocumentos.mutate,
    selecionarVistoria: selecionarVistoria.mutate,
    confirmarPagamento: confirmarPagamento.mutate,
    isPending: 
      selecionarPlano.isPending || 
      salvarDadosPessoais.isPending || 
      atualizarDocumentos.isPending ||
      selecionarVistoria.isPending ||
      confirmarPagamento.isPending,
    // Novos campos para documentos pendentes
    associadoId,
    associadoStatus,
    contratoLinkToken,
    docsPendentes: docsPendentes || [],
    refetch,
    refetchDocs,
  };
}
