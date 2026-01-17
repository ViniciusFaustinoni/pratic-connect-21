import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';
import type { DadosPessoaisForm } from '@/components/cotacao-publica/FormularioDadosPessoais';
import type { PlanoOpcao } from '@/components/cotacao-publica/EscolhaPlano';

type Cotacao = Tables<'cotacoes'>;

export type StatusContratacao = 
  | 'aguardando'
  | 'plano_escolhido'
  | 'dados_preenchidos'
  | 'documentos_ok'
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
}

export function useCotacaoContratacao(token: string | undefined) {
  const queryClient = useQueryClient();
  const [etapaAtual, setEtapaAtual] = useState(0);

  // Buscar cotação pelo token público
  const { data: cotacao, isLoading, error } = useQuery({
    queryKey: ['cotacao-contratacao', token],
    queryFn: async (): Promise<CotacaoContratacao> => {
      if (!token) throw new Error('Token não informado');

      const { data, error } = await supabase
        .from('cotacoes')
        .select(`
          *,
          planos:planos!plano_id(*),
          plano_escolhido:planos!plano_escolhido_id(*)
        `)
        .eq('token_publico', token)
        .single();

      if (error) throw error;

      // Atualizar visualizado_em se for primeira visualização
      if (data && !data.visualizado_em) {
        await supabase
          .from('cotacoes')
          .update({ visualizado_em: new Date().toISOString() })
          .eq('id', data.id);
      }

      return data as unknown as CotacaoContratacao;
    },
    enabled: !!token,
  });

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
  const determinarEtapa = useCallback((status: string | null) => {
    switch (status) {
      case 'aguardando':
        return 0; // Escolha de plano
      case 'plano_escolhido':
        return 1; // Dados pessoais
      case 'dados_preenchidos':
        return 2; // Documentos
      case 'documentos_ok':
        return 3; // Vistoria
      case 'vistoria_ok':
        return 4; // Pagamento
      case 'pagamento_ok':
        return 5; // Assinatura
      case 'contrato_gerado':
        return 6; // Conclusão
      default:
        return 0;
    }
  }, []);

  // Atualizar plano escolhido
  const selecionarPlano = useMutation({
    mutationFn: async (planoId: string) => {
      if (!cotacao) throw new Error('Cotação não encontrada');

      const { error } = await supabase
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

  // Salvar dados pessoais
  const salvarDadosPessoais = useMutation({
    mutationFn: async (dados: DadosPessoaisForm) => {
      if (!cotacao) throw new Error('Cotação não encontrada');

      const { error } = await supabase
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
        })
        .eq('id', cotacao.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotacao-contratacao', token] });
      setEtapaAtual(2);
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

      const { error } = await supabase
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
      setEtapaAtual(3);
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

      const { error } = await supabase
        .from('cotacoes')
        .update({
          tipo_vistoria: tipoVistoria,
          status_contratacao: 'vistoria_ok',
          vistoria_concluida_em: new Date().toISOString(),
        })
        .eq('id', cotacao.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotacao-contratacao', token] });
      setEtapaAtual(4);
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
      const { error: updateError } = await supabase
        .from('cotacoes')
        .update({ status_contratacao: 'pagamento_ok' })
        .eq('id', cotacao.id);

      if (updateError) throw updateError;

      // 2. Gerar contrato via edge function
      const { data, error: fnError } = await supabase.functions.invoke('contrato-gerar', {
        body: { cotacao_id: cotacao.id },
      });

      if (fnError) throw fnError;

      // 3. Atualizar cotação com ID do contrato gerado
      if (data?.contrato?.id) {
        await supabase
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotacao-contratacao', token] });
      setEtapaAtual(5);
      toast.success('Contrato gerado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao processar pagamento: ' + error.message);
    },
  });

  return {
    cotacao,
    isLoading,
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
  };
}
