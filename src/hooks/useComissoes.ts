import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Comissao, ComissaoResumo, StatusComissao } from '@/types/comissoes';

interface UseComissoesFilters {
  vendedorId?: string;
  mes?: number;
  ano?: number;
  status?: StatusComissao;
}

export function useComissoes(filters: UseComissoesFilters = {}) {
  const queryClient = useQueryClient();
  const { vendedorId, mes, ano, status } = filters;

  const { data: comissoes, isLoading } = useQuery({
    queryKey: ['comissoes', vendedorId, mes, ano, status],
    queryFn: async () => {
      let query = supabase
        .from('comissoes')
        .select(`
          *,
          vendedor:profiles!comissoes_vendedor_id_fkey(id, nome, avatar_url),
          contrato:contratos!comissoes_contrato_id_fkey(
            id,
            numero,
            associado:associados(nome),
            veiculo:veiculos(placa)
          ),
          config:comissoes_config(nome, tipo_vendedor, percentual_base)
        `)
        .order('created_at', { ascending: false });

      if (vendedorId) {
        query = query.eq('vendedor_id', vendedorId);
      }
      if (mes) {
        query = query.eq('mes_referencia', mes);
      }
      if (ano) {
        query = query.eq('ano_referencia', ano);
      }
      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Comissao[];
    },
  });

  const { data: resumo } = useQuery({
    queryKey: ['comissoes-resumo', mes, ano],
    queryFn: async () => {
      const currentMonth = mes || new Date().getMonth() + 1;
      const currentYear = ano || new Date().getFullYear();

      const { data, error } = await supabase
        .from('comissoes')
        .select('status, valor_total')
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
  });

  const aprovarComissao = useMutation({
    mutationFn: async (id: string) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('comissoes')
        .update({
          status: 'aprovada',
          aprovado_por: userData.user?.id,
          aprovado_em: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comissoes'] });
      queryClient.invalidateQueries({ queryKey: ['comissoes-resumo'] });
      toast.success('Comissão aprovada');
    },
    onError: (error: Error) => {
      toast.error('Erro ao aprovar: ' + error.message);
    },
  });

  const aprovarEmLote = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('comissoes')
        .update({
          status: 'aprovada',
          aprovado_por: userData.user?.id,
          aprovado_em: new Date().toISOString(),
        })
        .in('id', ids);

      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['comissoes'] });
      queryClient.invalidateQueries({ queryKey: ['comissoes-resumo'] });
      toast.success(`${ids.length} comissões aprovadas`);
    },
    onError: (error: Error) => {
      toast.error('Erro ao aprovar em lote: ' + error.message);
    },
  });

  const marcarComoPaga = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('comissoes')
        .update({
          status: 'paga',
          pago_em: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comissoes'] });
      queryClient.invalidateQueries({ queryKey: ['comissoes-resumo'] });
      toast.success('Comissão marcada como paga');
    },
  });

  const cancelarComissao = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo?: string }) => {
      const { error } = await supabase
        .from('comissoes')
        .update({
          status: 'cancelada',
          observacoes: motivo,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comissoes'] });
      queryClient.invalidateQueries({ queryKey: ['comissoes-resumo'] });
      toast.success('Comissão cancelada');
    },
  });

  return {
    comissoes,
    resumo,
    isLoading,
    aprovarComissao,
    aprovarEmLote,
    marcarComoPaga,
    cancelarComissao,
  };
}
