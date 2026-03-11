import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useDiretoria() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  // Dashboard stats
  const dashboardQuery = useQuery({
    queryKey: ['diretoria-dashboard'],
    queryFn: async () => {
      const mesAtual = new Date();
      const inicioMes = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 1);
      const inicioMesStr = inicioMes.toISOString().split('T')[0];
      
      const [associados, cobrancas, sinistros] = await Promise.all([
        supabase.from('associados').select('status').eq('status', 'ativo'),
        supabase.from('cobrancas').select('valor_pago').eq('status', 'pago')
          .gte('data_pagamento', inicioMesStr),
        supabase.from('sinistros').select('valor_indenizacao')
          .in('status', ['aprovado', 'pago', 'encerrado'])
          .gte('data_ocorrencia', inicioMesStr)
      ]);
      
      const totalReceita = cobrancas.data?.reduce((sum, p) => sum + (p.valor_pago || 0), 0) || 0;
      const totalSinistros = sinistros.data?.reduce((sum, s) => sum + (s.valor_indenizacao || 0), 0) || 0;
      
      return {
        associadosAtivos: associados.data?.length || 0,
        receitaMes: totalReceita,
        sinistrosMes: totalSinistros,
        sinistralidade: totalReceita > 0 ? (totalSinistros / totalReceita) * 100 : 0
      };
    }
  });

  // Salvar configuração
  const salvarConfigMutation = useMutation({
    mutationFn: async ({ chave, valor }: { chave: string; valor: string }) => {
      // Verificar se profile existe antes de referenciar
      let updatedBy: string | null = null;
      if (profile?.id) {
        const { data: profileExists } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', profile.id)
          .maybeSingle();
        updatedBy = profileExists?.id || null;
      }
      const { error } = await supabase
        .from('configuracoes')
        .update({ 
          valor, 
          updated_at: new Date().toISOString(),
          updated_by: updatedBy
        })
        .eq('chave', chave);
      if (error) throw error;
      
      // Log de auditoria
      await supabase.from('logs_auditoria').insert({
        usuario_id: profile?.id,
        usuario_nome: profile?.nome,
        acao: 'configuracao',
        modulo: 'diretoria',
        descricao: `Alterou configuração: ${chave}`,
        dados_novos: { chave, valor }
      });
    },
    onSuccess: () => {
      toast.success('Configuração salva!');
      queryClient.invalidateQueries({ queryKey: ['configuracoes'] });
    },
    onError: () => {
      toast.error('Erro ao salvar configuração');
    }
  });

  // (Legacy calcularRateio removed — use FechamentoMensal pipeline)

  // Aprovar rateio
  const aprovarRateioMutation = useMutation({
    mutationFn: async (rateioId: string) => {
      const { error } = await supabase
        .from('rateios')
        .update({
          status: 'aprovado',
          aprovado_por: profile?.id,
          aprovado_em: new Date().toISOString()
        })
        .eq('id', rateioId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Rateio aprovado!');
      queryClient.invalidateQueries({ queryKey: ['rateios'] });
    },
    onError: () => {
      toast.error('Erro ao aprovar rateio');
    }
  });

  // Atualizar plano
  const atualizarPlanoMutation = useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: Record<string, unknown> }) => {
      const { error } = await supabase
        .from('planos')
        .update({ ...dados, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Plano atualizado!');
      queryClient.invalidateQueries({ queryKey: ['planos'] });
    },
    onError: () => {
      toast.error('Erro ao atualizar plano');
    }
  });

  return {
    dashboard: dashboardQuery.data,
    isLoadingDashboard: dashboardQuery.isLoading,
    salvarConfig: salvarConfigMutation.mutate,
    isSavingConfig: salvarConfigMutation.isPending,
    atualizarPlano: atualizarPlanoMutation.mutate,
    isAtualizandoPlano: atualizarPlanoMutation.isPending,
  };
}
