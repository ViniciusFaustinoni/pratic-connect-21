import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useRH() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Estatísticas RH
  const statsQuery = useQuery({
    queryKey: ['rh-stats'],
    queryFn: async () => {
      const [ativos, ferias, afastados] = await Promise.all([
        supabase.from('funcionarios').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
        supabase.from('funcionarios').select('*', { count: 'exact', head: true }).eq('status', 'ferias'),
        supabase.from('funcionarios').select('*', { count: 'exact', head: true }).eq('status', 'afastado')
      ]);
      
      return {
        ativos: ativos.count || 0,
        ferias: ferias.count || 0,
        afastados: afastados.count || 0
      };
    }
  });

  // Registrar ponto
  const registrarPontoMutation = useMutation({
    mutationFn: async (dados: {
      funcionario_id: string;
      data: string;
      entrada_1?: string;
      saida_1?: string;
      entrada_2?: string;
      saida_2?: string;
      tipo_dia?: string;
      justificativa?: string;
    }) => {
      const { data, error } = await supabase
        .from('ponto_registros')
        .upsert(dados, { onConflict: 'funcionario_id,data' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Ponto registrado!');
      queryClient.invalidateQueries({ queryKey: ['ponto-registros'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao registrar ponto: ' + error.message);
    }
  });

  // Aprovar férias
  const aprovarFeriasMutation = useMutation({
    mutationFn: async (feriasId: string) => {
      const { error } = await supabase
        .from('ferias')
        .update({
          status: 'aprovada',
          aprovado_por: user?.id,
          aprovado_em: new Date().toISOString()
        })
        .eq('id', feriasId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Férias aprovadas!');
      queryClient.invalidateQueries({ queryKey: ['ferias'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao aprovar férias: ' + error.message);
    }
  });

  // Registrar afastamento
  const registrarAfastamentoMutation = useMutation({
    mutationFn: async (dados: {
      funcionario_id: string;
      tipo: string;
      data_inicio: string;
      data_fim?: string;
      motivo: string;
      cid?: string;
      documento_url?: string;
    }) => {
      // Atualizar status do funcionário
      await supabase
        .from('funcionarios')
        .update({ status: 'afastado' })
        .eq('id', dados.funcionario_id);
      
      // Criar afastamento
      const { data, error } = await supabase
        .from('afastamentos')
        .insert({
          ...dados,
          status: 'ativo',
          registrado_por: user?.id
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Afastamento registrado!');
      queryClient.invalidateQueries({ queryKey: ['funcionarios'] });
      queryClient.invalidateQueries({ queryKey: ['afastamentos'] });
      queryClient.invalidateQueries({ queryKey: ['rh-stats'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao registrar afastamento: ' + error.message);
    }
  });

  // Registrar movimentação (promoção, reajuste)
  const registrarMovimentacaoMutation = useMutation({
    mutationFn: async (dados: {
      funcionario_id: string;
      tipo: string;
      cargo_novo_id?: string;
      departamento_novo_id?: string;
      salario_novo?: number;
      data_vigencia: string;
      motivo?: string;
    }) => {
      // Buscar dados atuais
      const { data: funcionario } = await supabase
        .from('funcionarios')
        .select('cargo_id, departamento_id, salario_atual')
        .eq('id', dados.funcionario_id)
        .single();
      
      // Criar histórico
      await supabase.from('funcionarios_historico').insert({
        funcionario_id: dados.funcionario_id,
        tipo: dados.tipo,
        cargo_anterior_id: funcionario?.cargo_id,
        departamento_anterior_id: funcionario?.departamento_id,
        salario_anterior: funcionario?.salario_atual,
        cargo_novo_id: dados.cargo_novo_id,
        departamento_novo_id: dados.departamento_novo_id,
        salario_novo: dados.salario_novo,
        data_vigencia: dados.data_vigencia,
        motivo: dados.motivo,
        registrado_por: user?.id
      });
      
      // Atualizar funcionário
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (dados.cargo_novo_id) updateData.cargo_id = dados.cargo_novo_id;
      if (dados.departamento_novo_id) updateData.departamento_id = dados.departamento_novo_id;
      if (dados.salario_novo) updateData.salario_atual = dados.salario_novo;
      
      await supabase
        .from('funcionarios')
        .update(updateData)
        .eq('id', dados.funcionario_id);
    },
    onSuccess: () => {
      toast.success('Movimentação registrada!');
      queryClient.invalidateQueries({ queryKey: ['funcionario'] });
      queryClient.invalidateQueries({ queryKey: ['funcionarios'] });
      queryClient.invalidateQueries({ queryKey: ['funcionario-historico'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao registrar movimentação: ' + error.message);
    }
  });

  return {
    stats: statsQuery.data,
    isLoadingStats: statsQuery.isLoading,
    registrarPonto: registrarPontoMutation.mutate,
    registrarPontoAsync: registrarPontoMutation.mutateAsync,
    isRegistrandoPonto: registrarPontoMutation.isPending,
    aprovarFerias: aprovarFeriasMutation.mutate,
    aprovarFeriasAsync: aprovarFeriasMutation.mutateAsync,
    isAprovandoFerias: aprovarFeriasMutation.isPending,
    registrarAfastamento: registrarAfastamentoMutation.mutate,
    registrarAfastamentoAsync: registrarAfastamentoMutation.mutateAsync,
    isRegistrandoAfastamento: registrarAfastamentoMutation.isPending,
    registrarMovimentacao: registrarMovimentacaoMutation.mutate,
    registrarMovimentacaoAsync: registrarMovimentacaoMutation.mutateAsync,
    isRegistrandoMovimentacao: registrarMovimentacaoMutation.isPending,
  };
}
