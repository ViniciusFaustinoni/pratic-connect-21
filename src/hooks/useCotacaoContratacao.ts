import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { toast } from 'sonner';
import { validateCPF } from '@/lib/validations';
import type { Tables } from '@/integrations/supabase/types';
import type { DadosPessoaisForm } from '@/components/cotacao-publica/FormularioDadosPessoais';
import type { PlanoOpcao } from '@/components/cotacao-publica/EscolhaPlano';
import type { RealtimeChannel } from '@supabase/supabase-js';

type Cotacao = Tables<'cotacoes'>;

import { detectarTipoVeiculo } from '@/data/vistoriaConfigCompleta';

function detectarCategoriaPorModelo(modelo?: string | null, marca?: string | null): string {
  const tipo = detectarTipoVeiculo(undefined, modelo, marca);
  return tipo === 'moto' ? 'moto' : 'carro';
}

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
  nivel?: string;
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
        const updateData: any = { visualizado_em: new Date().toISOString() };
        // Se ainda está em rascunho, mover para 'enviada' (Link Enviado)
        if (data.status === 'rascunho') {
          updateData.status = 'enviada';
        }
        await publicSupabase
          .from('cotacoes')
          .update(updateData)
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
      
      // Buscar TODOS os contratos para priorizar assinado/ativo
      const { data: contratos, error } = await publicSupabase
        .from('contratos')
        .select(`
          id,
          associado_id,
          link_token,
          status,
          associados:associados!fk_contratos_associado(
            id,
            status
          )
        `)
        .eq('cotacao_token_publico', token)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[CotacaoContratacao] Erro na query fallback:', error);
        return null;
      }
      
      if (!contratos || contratos.length === 0) return null;
      
      // Priorizar contrato assinado/ativo sobre pendente
      const contratoAssinado = contratos.find((c: any) => c.status === 'assinado' || c.status === 'ativo');
      const result = contratoAssinado || contratos[0];
      
      console.log('[CotacaoContratacao] Contrato fallback:', result?.id, 'status:', result?.status, 'link_token:', result?.link_token);
      return result;
    },
    enabled: !!token,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    staleTime: 0,
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
      // Sempre usar cotacao.valor_adesao como fonte de verdade (definido pelo consultor)
      const adesaoCotacao = cotacao.valor_adesao;
      return planosComparacao.map((p) => ({
        id: p.id,
        nome: p.nome,
        codigo: p.codigo,
        valorMensal: p.valorMensal,
        valorAdesao: adesaoCotacao || p.valorAdesao,
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
      case 'vistoria_agendada':
        return 4; // Pagamento (vistoria já agendada na base)
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

  // Truncar valor para não exceder limite do banco
  const truncar = (valor: string | null | undefined, max: number): string | null => {
    if (!valor) return null;
    return valor.length > max ? valor.substring(0, max) : valor;
  };

  // Salvar dados pessoais
  const salvarDadosPessoais = useMutation({
    mutationFn: async (dados: DadosPessoaisForm) => {
      if (!cotacao) throw new Error('Cotação não encontrada');

      // Validar CPF antes de persistir
      const cpfLimpo = (dados.cpf || '').replace(/\D/g, '');
      if (cpfLimpo && !validateCPF(cpfLimpo)) {
        throw new Error('O CPF informado é inválido. Corrija os dígitos antes de continuar.');
      }
      const { error } = await publicSupabase
        .from('cotacoes')
        .update({
          nome_solicitante: dados.nome,
          email_solicitante: dados.email,
          telefone1_solicitante: truncar(dados.telefone, 30),
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
          cliente_rg: truncar(dados.rg, 50),
          cliente_rg_orgao: truncar(dados.rg_orgao, 50),
          cliente_cnh: truncar(dados.cnh, 50),
          cliente_cnh_validade: dados.cnh_validade || null,
          cliente_cnh_categoria: truncar(dados.cnh_categoria, 20),
          
          // Dados do veículo extraídos do CRLV via OCR (necessários para SGA Hinova e Termo)
          veiculo_chassi: dados.veiculo_chassi || null,
          veiculo_renavam: dados.veiculo_renavam || null,
          veiculo_cor: dados.veiculo_cor || null,
          veiculo_combustivel: truncar(dados.veiculo_combustivel, 50),
          veiculo_ano_fabricacao: dados.veiculo_ano_fabricacao || null,
          // Persistir categoria se ainda não definida
          ...((!cotacao.categoria) ? { categoria: detectarCategoriaPorModelo(cotacao.veiculo_modelo, cotacao.veiculo_marca) } : {}),
        })
        .eq('id', cotacao.id);

      if (error) throw error;

      // NOTA: Geração de contrato removida daqui. O contrato será gerado
      // exclusivamente na EtapaAssinaturaContrato para evitar loops de erro.
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

  // Confirmar pagamento (NÃO gera contrato — o contrato já deve existir via EtapaAssinatura)
  const confirmarPagamento = useMutation({
    mutationFn: async () => {
      if (!cotacao) throw new Error('Cotação não encontrada');

      // Apenas atualizar status — contrato já foi gerado na etapa de assinatura
      const updateData: Record<string, string> = {
        status_contratacao: 'pagamento_ok',
      };
      
      // Se cotação ainda não está 'aceita', marcar
      if (cotacao.status !== 'aceita') {
        updateData.status = 'aceita';
      }

      const { error: updateError } = await publicSupabase
        .from('cotacoes')
        .update(updateData)
        .eq('id', cotacao.id);

      if (updateError) throw updateError;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cotacao-contratacao', token] });
      await queryClient.refetchQueries({ queryKey: ['cotacao-contratacao', token] });
      setEtapaAtual(5);
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
