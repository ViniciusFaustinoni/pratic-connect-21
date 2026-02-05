import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Comissao, ComissaoResumo, ComissaoPagamento } from '@/types/comissoes';

export function useMinhasComissoes() {
  const { user } = useAuth();

  const { data: comissoes, isLoading } = useQuery({
    queryKey: ['minhas-comissoes', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('comissoes')
        .select(`
          *,
          contrato:contratos!comissoes_contrato_id_fkey(
            id,
            numero,
            associado:associados(nome),
            veiculo:veiculos(placa)
          ),
          config:comissoes_config(nome, tipo_vendedor, percentual_base)
        `)
        .eq('vendedor_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Comissao[];
    },
    enabled: !!user?.id,
  });

  const { data: resumoMensal } = useQuery({
    queryKey: ['minhas-comissoes-resumo', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      const { data, error } = await supabase
        .from('comissoes')
        .select('status, valor_total')
        .eq('vendedor_id', user.id)
        .eq('mes_referencia', currentMonth)
        .eq('ano_referencia', currentYear);

      if (error) throw error;

      const resumo: ComissaoResumo = {
        totalPendente: 0,
        totalAprovada: 0,
        totalPago: 0,
        quantidadePendente: 0,
        quantidadeAprovada: 0,
        quantidadePago: 0,
      };

      data?.forEach(c => {
        if (c.status === 'pendente') {
          resumo.totalPendente += c.valor_total || 0;
          resumo.quantidadePendente++;
        } else if (c.status === 'aprovada') {
          resumo.totalAprovada += c.valor_total || 0;
          resumo.quantidadeAprovada++;
        } else if (c.status === 'paga') {
          resumo.totalPago += c.valor_total || 0;
          resumo.quantidadePago++;
        }
      });

      return resumo;
    },
    enabled: !!user?.id,
  });

  const { data: ultimosPagamentos } = useQuery({
    queryKey: ['meus-pagamentos', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('comissoes_pagamentos')
        .select('*')
        .eq('vendedor_id', user.id)
        .order('data_pagamento', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data as ComissaoPagamento[];
    },
    enabled: !!user?.id,
  });

  const { data: totalAcumulado } = useQuery({
    queryKey: ['minhas-comissoes-total', user?.id],
    queryFn: async () => {
      if (!user?.id) return { total: 0, quantidade: 0 };

      const { data, error } = await supabase
        .from('comissoes')
        .select('valor_total')
        .eq('vendedor_id', user.id)
        .eq('status', 'paga');

      if (error) throw error;

      return {
        total: data?.reduce((sum, c) => sum + (c.valor_total || 0), 0) || 0,
        quantidade: data?.length || 0,
      };
    },
    enabled: !!user?.id,
  });

  return {
    comissoes,
    resumoMensal,
    ultimosPagamentos,
    totalAcumulado,
    isLoading,
  };
}
