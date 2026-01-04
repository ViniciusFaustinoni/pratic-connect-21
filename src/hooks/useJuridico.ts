import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useJuridico() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Estatísticas do dashboard jurídico
  const statsQuery = useQuery({
    queryKey: ['juridico-stats'],
    queryFn: async () => {
      const dataLimite = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const [processosAtivos, prazosProximos, consultasPendentes] = await Promise.all([
        supabase
          .from('processos')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'ativo'),
        supabase
          .from('processos_prazos')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pendente')
          .lte('data_fim', dataLimite),
        supabase
          .from('consultas_juridicas')
          .select('*', { count: 'exact', head: true })
          .in('status', ['pendente', 'em_analise'])
      ]);

      return {
        processosAtivos: processosAtivos.count || 0,
        prazosProximos: prazosProximos.count || 0,
        consultasPendentes: consultasPendentes.count || 0
      };
    }
  });

  // Criar processo
  const criarProcessoMutation = useMutation({
    mutationFn: async (dados: Record<string, unknown>) => {
      const insertData = {
        ...dados,
        criado_por: user?.id
      };
      
      const { data, error } = await supabase
        .from('processos')
        .insert(insertData as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Processo criado!');
      queryClient.invalidateQueries({ queryKey: ['processos'] });
      queryClient.invalidateQueries({ queryKey: ['juridico-stats'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar processo: ' + error.message);
    }
  });

  // Registrar andamento
  const registrarAndamentoMutation = useMutation({
    mutationFn: async (dados: {
      processo_id: string;
      data: string;
      descricao: string;
      tipo: string;
      gera_prazo?: boolean;
      prazo_data?: string;
      prazo_descricao?: string;
    }) => {
      const { gera_prazo, prazo_data, prazo_descricao, ...andamentoData } = dados;

      const { data: andamento, error } = await supabase
        .from('processos_andamentos')
        .insert({
          ...andamentoData,
          registrado_por: user?.id
        })
        .select()
        .single();

      if (error) throw error;

      // Criar prazo se necessário
      if (gera_prazo && prazo_data) {
        await supabase.from('processos_prazos').insert({
          processo_id: dados.processo_id,
          andamento_id: andamento.id,
          descricao: prazo_descricao || dados.descricao,
          data_inicio: dados.data,
          data_fim: prazo_data,
          status: 'pendente'
        });
      }

      return andamento;
    },
    onSuccess: () => {
      toast.success('Andamento registrado!');
      queryClient.invalidateQueries({ queryKey: ['processos'] });
      queryClient.invalidateQueries({ queryKey: ['processos_prazos'] });
      queryClient.invalidateQueries({ queryKey: ['juridico-stats'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao registrar andamento: ' + error.message);
    }
  });

  // Cumprir prazo
  const cumprirPrazoMutation = useMutation({
    mutationFn: async ({ prazoId, observacao }: { prazoId: string; observacao?: string }) => {
      const { error } = await supabase
        .from('processos_prazos')
        .update({
          status: 'cumprido',
          cumprido_em: new Date().toISOString(),
          cumprido_por: user?.id,
          observacao_cumprimento: observacao
        })
        .eq('id', prazoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Prazo cumprido!');
      queryClient.invalidateQueries({ queryKey: ['processos_prazos'] });
      queryClient.invalidateQueries({ queryKey: ['juridico-stats'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao cumprir prazo: ' + error.message);
    }
  });

  return {
    // Stats
    stats: statsQuery.data,
    isLoadingStats: statsQuery.isLoading,
    refetchStats: statsQuery.refetch,

    // Criar Processo
    criarProcesso: criarProcessoMutation.mutate,
    criarProcessoAsync: criarProcessoMutation.mutateAsync,
    isCriandoProcesso: criarProcessoMutation.isPending,

    // Registrar Andamento
    registrarAndamento: registrarAndamentoMutation.mutate,
    registrarAndamentoAsync: registrarAndamentoMutation.mutateAsync,
    isRegistrandoAndamento: registrarAndamentoMutation.isPending,

    // Cumprir Prazo
    cumprirPrazo: cumprirPrazoMutation.mutate,
    cumprirPrazoAsync: cumprirPrazoMutation.mutateAsync,
    isCumprindoPrazo: cumprirPrazoMutation.isPending,
  };
}
