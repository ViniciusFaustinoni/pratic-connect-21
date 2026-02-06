import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  FaixaAdesao,
  FaixaRecorrente,
  FaixaProducao,
  FaixaCrescimento,
  FaixaClassificacao,
  ParametroComissao,
} from '@/types/comissoes';

type TabelaFaixas =
  | 'comissoes_faixas_adesao'
  | 'comissoes_faixas_recorrente'
  | 'comissoes_faixas_producao'
  | 'comissoes_faixas_crescimento'
  | 'comissoes_faixas_classificacao';

export function useComissoesFaixas() {
  const queryClient = useQueryClient();

  // Query: Faixas de Adesão
  const faixasAdesaoQuery = useQuery({
    queryKey: ['comissoes-faixas-adesao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comissoes_faixas_adesao')
        .select('*')
        .order('quantidade_vendas_minima', { ascending: true });

      if (error) throw error;
      return data as FaixaAdesao[];
    },
  });

  // Query: Faixas de Recorrente
  const faixasRecorrenteQuery = useQuery({
    queryKey: ['comissoes-faixas-recorrente'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comissoes_faixas_recorrente')
        .select('*')
        .order('tipo_consultor', { ascending: true })
        .order('placas_minima', { ascending: true });

      if (error) throw error;
      return data as FaixaRecorrente[];
    },
  });

  // Query: Faixas de Produção
  const faixasProducaoQuery = useQuery({
    queryKey: ['comissoes-faixas-producao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comissoes_faixas_producao')
        .select('*')
        .order('placas_confirmadas_minima', { ascending: true });

      if (error) throw error;
      return data as FaixaProducao[];
    },
  });

  // Query: Faixas de Crescimento
  const faixasCrescimentoQuery = useQuery({
    queryKey: ['comissoes-faixas-crescimento'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comissoes_faixas_crescimento')
        .select('*')
        .order('tipo_consultor', { ascending: true })
        .order('placas_confirmadas', { ascending: true });

      if (error) throw error;
      return data as FaixaCrescimento[];
    },
  });

  // Query: Faixas de Classificação
  const faixasClassificacaoQuery = useQuery({
    queryKey: ['comissoes-faixas-classificacao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comissoes_faixas_classificacao')
        .select('*')
        .order('tipo_consultor', { ascending: true })
        .order('faixa_placas_base', { ascending: true })
        .order('posicao_ranking', { ascending: true });

      if (error) throw error;
      return data as FaixaClassificacao[];
    },
  });

  // Query: Parâmetros
  const parametrosQuery = useQuery({
    queryKey: ['comissoes-parametros'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comissoes_parametros')
        .select('*')
        .order('chave', { ascending: true });

      if (error) throw error;
      return data as ParametroComissao[];
    },
  });

  // Helper para invalidar queries
  const invalidateTable = (tabela: TabelaFaixas) => {
    const queryKeyMap: Record<TabelaFaixas, string> = {
      comissoes_faixas_adesao: 'comissoes-faixas-adesao',
      comissoes_faixas_recorrente: 'comissoes-faixas-recorrente',
      comissoes_faixas_producao: 'comissoes-faixas-producao',
      comissoes_faixas_crescimento: 'comissoes-faixas-crescimento',
      comissoes_faixas_classificacao: 'comissoes-faixas-classificacao',
    };
    queryClient.invalidateQueries({ queryKey: [queryKeyMap[tabela]] });
  };

  // Mutation: Adicionar faixa genérica
  const addFaixa = useMutation({
    mutationFn: async ({ tabela, dados }: { tabela: TabelaFaixas; dados: Record<string, unknown> }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from(tabela) as any)
        .insert([dados])
        .select()
        .single();

      if (error) throw error;
      return { data, tabela };
    },
    onSuccess: (result) => {
      invalidateTable(result.tabela);
      toast.success('Faixa adicionada com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao adicionar faixa: ' + error.message);
    },
  });

  // Mutation: Atualizar faixa genérica
  const updateFaixa = useMutation({
    mutationFn: async ({ tabela, id, dados }: { tabela: TabelaFaixas; id: string; dados: Record<string, unknown> }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from(tabela) as any)
        .update(dados)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { data, tabela };
    },
    onSuccess: (result) => {
      invalidateTable(result.tabela);
      toast.success('Faixa atualizada com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar faixa: ' + error.message);
    },
  });

  // Mutation: Deletar faixa genérica
  const deleteFaixa = useMutation({
    mutationFn: async ({ tabela, id }: { tabela: TabelaFaixas; id: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from(tabela) as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { tabela };
    },
    onSuccess: (result) => {
      invalidateTable(result.tabela);
      toast.success('Faixa removida com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover faixa: ' + error.message);
    },
  });

  // Mutation: Atualizar parâmetro
  const updateParametro = useMutation({
    mutationFn: async ({ chave, valor }: { chave: string; valor: string }) => {
      const { data, error } = await supabase
        .from('comissoes_parametros')
        .update({ valor, updated_at: new Date().toISOString() })
        .eq('chave', chave)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comissoes-parametros'] });
      toast.success('Parâmetro atualizado com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar parâmetro: ' + error.message);
    },
  });

  const isLoading =
    faixasAdesaoQuery.isLoading ||
    faixasRecorrenteQuery.isLoading ||
    faixasProducaoQuery.isLoading ||
    faixasCrescimentoQuery.isLoading ||
    faixasClassificacaoQuery.isLoading ||
    parametrosQuery.isLoading;

  return {
    // Data
    faixasAdesao: faixasAdesaoQuery.data ?? [],
    faixasRecorrente: faixasRecorrenteQuery.data ?? [],
    faixasProducao: faixasProducaoQuery.data ?? [],
    faixasCrescimento: faixasCrescimentoQuery.data ?? [],
    faixasClassificacao: faixasClassificacaoQuery.data ?? [],
    parametros: parametrosQuery.data ?? [],
    // Loading states
    isLoading,
    // Mutations
    addFaixa,
    updateFaixa,
    deleteFaixa,
    updateParametro,
  };
}
