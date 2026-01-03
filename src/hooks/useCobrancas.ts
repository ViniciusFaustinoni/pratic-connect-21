import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface CobrancaFilters {
  status?: string;
  tipo?: string;
  mes?: number;
  ano?: number;
  associado_id?: string;
}

export function useCobrancas(filters?: CobrancaFilters) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Lista de cobranças
  const cobrancasQuery = useQuery({
    queryKey: ['cobrancas', filters],
    queryFn: async () => {
      let query = supabase
        .from('cobrancas')
        .select(`
          *,
          associado:associados(id, nome, cpf, telefone)
        `)
        .order('data_vencimento', { ascending: false });

      if (filters?.status && filters.status !== 'todos') {
        query = query.eq('status', filters.status);
      }
      if (filters?.tipo && filters.tipo !== 'todos') {
        query = query.eq('tipo', filters.tipo);
      }
      if (filters?.mes && filters?.ano) {
        query = query.eq('referencia_mes', filters.mes).eq('referencia_ano', filters.ano);
      }
      if (filters?.associado_id) {
        query = query.eq('associado_id', filters.associado_id);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data;
    }
  });

  // Criar cobrança
  const criarCobrancaMutation = useMutation({
    mutationFn: async (dados: {
      associado_id: string;
      tipo: string;
      valor: number;
      data_vencimento: string;
      descricao?: string;
      referencia_mes?: number;
      referencia_ano?: number;
      veiculo_id?: string;
      contrato_id?: string;
    }) => {
      const valorFinal = dados.valor;
      
      const { data, error } = await supabase
        .from('cobrancas')
        .insert({
          ...dados,
          valor_final: valorFinal,
          status: 'aguardando_pagamento',
          criado_por: user?.id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Cobrança criada!');
      queryClient.invalidateQueries({ queryKey: ['cobrancas'] });
    },
    onError: (error) => {
      toast.error('Erro ao criar cobrança');
      console.error(error);
    }
  });

  // Registrar pagamento
  const registrarPagamentoMutation = useMutation({
    mutationFn: async ({ cobrancaId, valorPago, dataPagamento, formaPagamento }: {
      cobrancaId: string;
      valorPago: number;
      dataPagamento: string;
      formaPagamento: string;
    }) => {
      const { error } = await supabase
        .from('cobrancas')
        .update({
          status: 'pago',
          valor_pago: valorPago,
          data_pagamento: dataPagamento,
          forma_pagamento: formaPagamento,
          updated_at: new Date().toISOString()
        })
        .eq('id', cobrancaId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Pagamento registrado!');
      queryClient.invalidateQueries({ queryKey: ['cobrancas'] });
      queryClient.invalidateQueries({ queryKey: ['cobranca'] });
    },
    onError: (error) => {
      toast.error('Erro ao registrar pagamento');
      console.error(error);
    }
  });

  // Cancelar cobrança
  const cancelarCobrancaMutation = useMutation({
    mutationFn: async ({ cobrancaId, motivo }: { cobrancaId: string; motivo: string }) => {
      const { error } = await supabase
        .from('cobrancas')
        .update({
          status: 'cancelado',
          motivo_cancelamento: motivo,
          cancelado_por: user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', cobrancaId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Cobrança cancelada');
      queryClient.invalidateQueries({ queryKey: ['cobrancas'] });
    }
  });

  // Estatísticas
  const estatisticasQuery = useQuery({
    queryKey: ['cobrancas-estatisticas', filters?.mes, filters?.ano],
    queryFn: async () => {
      const mes = filters?.mes || new Date().getMonth() + 1;
      const ano = filters?.ano || new Date().getFullYear();
      
      const { data } = await supabase
        .from('cobrancas')
        .select('valor_final, valor_pago, status')
        .eq('referencia_mes', mes)
        .eq('referencia_ano', ano);
      
      const total = data?.length || 0;
      const pagas = data?.filter(c => c.status === 'pago').length || 0;
      const vencidas = data?.filter(c => c.status === 'vencido').length || 0;
      const valorTotal = data?.reduce((acc, c) => acc + (Number(c.valor_final) || 0), 0) || 0;
      const valorRecebido = data?.reduce((acc, c) => acc + (Number(c.valor_pago) || 0), 0) || 0;
      
      return {
        total,
        pagas,
        vencidas,
        pendentes: total - pagas - vencidas,
        valorTotal,
        valorRecebido,
        valorPendente: valorTotal - valorRecebido
      };
    }
  });

  return {
    cobrancas: cobrancasQuery.data,
    estatisticas: estatisticasQuery.data,
    isLoading: cobrancasQuery.isLoading,
    criarCobranca: criarCobrancaMutation.mutate,
    registrarPagamento: registrarPagamentoMutation.mutate,
    cancelarCobranca: cancelarCobrancaMutation.mutate,
    isCriando: criarCobrancaMutation.isPending,
  };
}

// Hook para buscar uma cobrança específica
export function useCobranca(id: string | undefined) {
  return useQuery({
    queryKey: ['cobranca', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('cobrancas')
        .select(`
          *,
          associado:associados(id, nome, cpf, telefone)
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });
}

// Hook para cobranças do associado logado
export function useMinhasCobrancas() {
  return useQuery({
    queryKey: ['minhas-cobrancas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas')
        .select('*')
        .order('data_vencimento', { ascending: false })
        .limit(24);
      if (error) throw error;
      return data;
    }
  });
}
