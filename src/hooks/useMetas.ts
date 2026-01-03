import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Meta {
  id: string;
  vendedor_id: string;
  mes: number;
  ano: number;
  meta_leads: number;
  meta_cotacoes: number;
  meta_contratos: number;
  meta_valor: number;
  realizado_leads: number;
  realizado_cotacoes: number;
  realizado_contratos: number;
  realizado_valor: number;
  created_at: string;
  updated_at: string;
  vendedor?: {
    id: string;
    nome: string;
    avatar_url: string | null;
  };
}

export interface MetaInput {
  id?: string;
  vendedor_id: string;
  mes: number;
  ano: number;
  meta_leads: number;
  meta_cotacoes: number;
  meta_contratos: number;
  meta_valor: number;
}

export function useMetas(mes: number, ano: number) {
  const queryClient = useQueryClient();

  // Buscar metas do período com dados do vendedor
  const { data: metas, isLoading, refetch } = useQuery({
    queryKey: ['metas', mes, ano],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('metas_vendas')
        .select(`
          *,
          vendedor:profiles!vendedor_id(id, nome, avatar_url)
        `)
        .eq('mes', mes)
        .eq('ano', ano)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as Meta[];
    },
  });

  // Calcular valores realizados para um vendedor
  const calcularRealizado = async (vendedorId: string, mes: number, ano: number) => {
    const inicioMes = new Date(ano, mes - 1, 1);
    const fimMes = new Date(ano, mes, 0, 23, 59, 59);

    const [leadsResult, cotacoesResult, contratosResult] = await Promise.all([
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('vendedor_id', vendedorId)
        .gte('created_at', inicioMes.toISOString())
        .lte('created_at', fimMes.toISOString()),
      supabase
        .from('cotacoes')
        .select('id', { count: 'exact', head: true })
        .eq('vendedor_id', vendedorId)
        .gte('created_at', inicioMes.toISOString())
        .lte('created_at', fimMes.toISOString()),
      supabase
        .from('contratos')
        .select('id, valor_mensal')
        .eq('vendedor_id', vendedorId)
        .in('status', ['assinado', 'ativo'])
        .gte('created_at', inicioMes.toISOString())
        .lte('created_at', fimMes.toISOString()),
    ]);

    const valorTotal = contratosResult.data?.reduce(
      (sum, c) => sum + (Number(c.valor_mensal) || 0),
      0
    ) || 0;

    return {
      leads: leadsResult.count || 0,
      cotacoes: cotacoesResult.count || 0,
      contratos: contratosResult.data?.length || 0,
      valor: valorTotal,
    };
  };

  // Atualizar valores realizados de todas as metas
  const atualizarRealizados = async () => {
    if (!metas || metas.length === 0) return;

    for (const meta of metas) {
      const realizado = await calcularRealizado(meta.vendedor_id, mes, ano);

      await supabase
        .from('metas_vendas')
        .update({
          realizado_leads: realizado.leads,
          realizado_cotacoes: realizado.cotacoes,
          realizado_contratos: realizado.contratos,
          realizado_valor: realizado.valor,
        })
        .eq('id', meta.id);
    }

    queryClient.invalidateQueries({ queryKey: ['metas', mes, ano] });
  };

  // Mutation para salvar/atualizar meta
  const salvarMeta = useMutation({
    mutationFn: async (dados: MetaInput) => {
      // Calcular realizado antes de salvar
      const realizado = await calcularRealizado(dados.vendedor_id, dados.mes, dados.ano);

      const metaData = {
        vendedor_id: dados.vendedor_id,
        mes: dados.mes,
        ano: dados.ano,
        meta_leads: dados.meta_leads,
        meta_cotacoes: dados.meta_cotacoes,
        meta_contratos: dados.meta_contratos,
        meta_valor: dados.meta_valor,
        realizado_leads: realizado.leads,
        realizado_cotacoes: realizado.cotacoes,
        realizado_contratos: realizado.contratos,
        realizado_valor: realizado.valor,
      };

      if (dados.id) {
        const { error } = await supabase
          .from('metas_vendas')
          .update(metaData)
          .eq('id', dados.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('metas_vendas')
          .insert(metaData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Meta salva com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['metas'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar meta: ' + error.message);
    },
  });

  // Mutation para deletar meta
  const deletarMeta = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('metas_vendas')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Meta removida com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['metas'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover meta: ' + error.message);
    },
  });

  return {
    metas,
    isLoading,
    refetch,
    salvarMeta,
    deletarMeta,
    atualizarRealizados,
    calcularRealizado,
  };
}
