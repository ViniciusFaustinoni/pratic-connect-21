import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface VendedorResumo {
  vendedor_id: string;
  vendedor_nome: string;
  saldo_atual: number;
  a_pagar_mes: number;
  antecipacoes_abertas: number;
  debitos_abatimento: number;
  proxima_parcela_data: string | null;
}

export interface DashboardCards {
  a_pagar_mes: number;
  a_pagar_parcelas: number;
  a_pagar_vendedores: number;
  antecipacoes_abertas: number;
  antecipacoes_count: number;
  debitos_pendentes: number;
  debitos_count: number;
  total_pago_mes: number;
  total_pago_count: number;
}

export function useDashboardVendaExterna() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  const now = new Date();
  const mesAtualInicio = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const mesAtualFim = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

  // Cards globais
  const cardsQuery = useQuery({
    queryKey: ['dashboard-ve-cards', mesAtualInicio],
    queryFn: async (): Promise<DashboardCards> => {
      // A pagar este mês
      const { data: aPagar } = await supabase
        .from('cc_vendedor_lancamentos')
        .select('valor_liquido, vendedor_id')
        .eq('status', 'a_pagar' as any)
        .eq('tipo', 'credito' as any)
        .gte('data_lancamento', mesAtualInicio)
        .lt('data_lancamento', mesAtualFim);

      const aPagarItems = (aPagar || []) as any[];
      const vendedoresSet = new Set(aPagarItems.map((r: any) => r.vendedor_id));

      // Antecipações em aberto
      const { data: antecipacoes, count: antCount } = await supabase
        .from('cc_vendedor_lancamentos')
        .select('valor_liquido', { count: 'exact' })
        .eq('status', 'antecipado' as any)
        .eq('tipo', 'credito' as any);

      // Débitos pendentes
      const { data: debitos, count: debCount } = await supabase
        .from('cc_vendedor_lancamentos')
        .select('valor_liquido', { count: 'exact' })
        .eq('tipo', 'debito' as any)
        .in('categoria', ['volante', 'estorno'] as any)
        .not('status', 'in', '("pago","cancelado")' as any);

      // Total pago no mês
      const { data: pagos, count: pagoCount } = await supabase
        .from('cc_vendedor_lancamentos')
        .select('valor_liquido', { count: 'exact' })
        .eq('status', 'pago' as any)
        .eq('tipo', 'credito' as any)
        .gte('data_pagamento', mesAtualInicio)
        .lt('data_pagamento', mesAtualFim);

      return {
        a_pagar_mes: aPagarItems.reduce((s: number, r: any) => s + Number(r.valor_liquido), 0),
        a_pagar_parcelas: aPagarItems.length,
        a_pagar_vendedores: vendedoresSet.size,
        antecipacoes_abertas: (antecipacoes || []).reduce((s: number, r: any) => s + Number(r.valor_liquido), 0),
        antecipacoes_count: antCount || 0,
        debitos_pendentes: (debitos || []).reduce((s: number, r: any) => s + Number(r.valor_liquido), 0),
        debitos_count: debCount || 0,
        total_pago_mes: (pagos || []).reduce((s: number, r: any) => s + Number(r.valor_liquido), 0),
        total_pago_count: pagoCount || 0,
      };
    },
  });

  // Lista de vendedores com métricas
  const vendedoresQuery = useQuery({
    queryKey: ['dashboard-ve-vendedores', mesAtualInicio],
    queryFn: async (): Promise<VendedorResumo[]> => {
      // Get all distinct vendors from cc_vendedor_lancamentos
      const { data: lancamentos } = await supabase
        .from('cc_vendedor_lancamentos')
        .select('vendedor_id, tipo, categoria, valor_liquido, valor_bruto, status, data_lancamento')
        .neq('status', 'cancelado' as any);

      if (!lancamentos || lancamentos.length === 0) return [];

      const vendedorIds = [...new Set((lancamentos as any[]).map((l: any) => l.vendedor_id))];

      // Get vendor names
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nome')
        .in('id', vendedorIds);

      const nomeMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { nomeMap[p.id] = p.nome; });

      const vendedorMap: Record<string, VendedorResumo> = {};
      
      for (const vid of vendedorIds) {
        vendedorMap[vid] = {
          vendedor_id: vid,
          vendedor_nome: nomeMap[vid] || 'Vendedor',
          saldo_atual: 0,
          a_pagar_mes: 0,
          antecipacoes_abertas: 0,
          debitos_abatimento: 0,
          proxima_parcela_data: null,
        };
      }

      for (const l of lancamentos as any[]) {
        const v = vendedorMap[l.vendedor_id];
        if (!v) continue;

        // Saldo
        if (l.tipo === 'credito') v.saldo_atual += Number(l.valor_liquido);
        else v.saldo_atual -= Number(l.valor_liquido);

        // A pagar este mês
        if (l.status === 'a_pagar' && l.tipo === 'credito' &&
            l.data_lancamento >= mesAtualInicio && l.data_lancamento < mesAtualFim) {
          v.a_pagar_mes += Number(l.valor_liquido);
        }

        // Antecipações
        if (l.status === 'antecipado' && l.tipo === 'credito') {
          v.antecipacoes_abertas += Number(l.valor_liquido);
        }

        // Débitos em abatimento
        if (l.tipo === 'debito' && ['volante', 'estorno'].includes(l.categoria) &&
            !['pago', 'cancelado'].includes(l.status)) {
          v.debitos_abatimento += Number(l.valor_liquido);
        }

        // Próxima parcela a_pagar
        if (l.status === 'a_pagar' && l.tipo === 'credito') {
          if (!v.proxima_parcela_data || l.data_lancamento < v.proxima_parcela_data) {
            v.proxima_parcela_data = l.data_lancamento;
          }
        }
      }

      return Object.values(vendedorMap).sort((a, b) => b.a_pagar_mes - a.a_pagar_mes);
    },
  });

  // Parcelas pendentes de um vendedor (para antecipação)
  const useParcelasPendentes = (vendedorId: string) => useQuery({
    queryKey: ['cc-parcelas-pendentes', vendedorId],
    queryFn: async () => {
      const { data } = await supabase
        .from('cc_vendedor_lancamentos')
        .select('*')
        .eq('vendedor_id', vendedorId)
        .eq('status', 'pendente' as any)
        .eq('tipo', 'credito' as any)
        .eq('categoria', 'recorrente' as any)
        .order('parcela_numero', { ascending: true });
      return (data || []) as any[];
    },
    enabled: !!vendedorId,
  });

  // Parcelas a_pagar de um vendedor (para pagamento)
  const useParcelasAPagar = (vendedorId: string) => useQuery({
    queryKey: ['cc-parcelas-apagar', vendedorId],
    queryFn: async () => {
      const { data } = await supabase
        .from('cc_vendedor_lancamentos')
        .select('*')
        .eq('vendedor_id', vendedorId)
        .eq('status', 'a_pagar' as any)
        .eq('tipo', 'credito' as any)
        .order('data_lancamento', { ascending: true });
      return (data || []) as any[];
    },
    enabled: !!vendedorId,
  });

  // Mutation: antecipar parcelas
  const anteciparParcelas = useMutation({
    mutationFn: async ({ parcelaIds, vendedorNome }: { parcelaIds: string[]; vendedorNome: string }) => {
      const { error } = await supabase
        .from('cc_vendedor_lancamentos')
        .update({ status: 'antecipado', updated_at: new Date().toISOString() } as any)
        .in('id', parcelaIds);
      if (error) throw error;
      return { count: parcelaIds.length, vendedorNome };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-ve-cards'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-ve-vendedores'] });
      queryClient.invalidateQueries({ queryKey: ['cc-parcelas-pendentes'] });
      queryClient.invalidateQueries({ queryKey: ['cc-lancamentos'] });
      queryClient.invalidateQueries({ queryKey: ['cc-saldo'] });
      toast.success(`${data.count} parcelas antecipadas para ${data.vendedorNome}.`);
    },
    onError: (e) => toast.error('Erro ao antecipar: ' + (e as Error).message),
  });

  // Mutation: registrar pagamento em lote
  const registrarPagamentoLote = useMutation({
    mutationFn: async ({ parcelaIds, dataPagamento, observacao, vendedorNome }: {
      parcelaIds: string[]; dataPagamento: string; observacao?: string; vendedorNome: string;
    }) => {
      const { error } = await supabase
        .from('cc_vendedor_lancamentos')
        .update({
          status: 'pago',
          data_pagamento: dataPagamento,
          observacao_pagamento: observacao || null,
          pago_por: profile?.id || null,
          updated_at: new Date().toISOString(),
        } as any)
        .in('id', parcelaIds);
      if (error) throw error;

      // Get total
      const { data } = await supabase
        .from('cc_vendedor_lancamentos')
        .select('valor_liquido')
        .in('id', parcelaIds);
      const total = (data || []).reduce((s: number, r: any) => s + Number(r.valor_liquido), 0);
      return { count: parcelaIds.length, vendedorNome, total };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-ve-cards'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-ve-vendedores'] });
      queryClient.invalidateQueries({ queryKey: ['cc-parcelas-apagar'] });
      queryClient.invalidateQueries({ queryKey: ['cc-lancamentos'] });
      queryClient.invalidateQueries({ queryKey: ['cc-saldo'] });
      toast.success(`Pagamento registrado — ${data.count} parcelas — ${data.vendedorNome}`);
    },
    onError: (e) => toast.error('Erro ao registrar pagamento: ' + (e as Error).message),
  });

  return {
    cards: cardsQuery.data,
    isLoadingCards: cardsQuery.isLoading,
    vendedores: vendedoresQuery.data || [],
    isLoadingVendedores: vendedoresQuery.isLoading,
    useParcelasPendentes,
    useParcelasAPagar,
    anteciparParcelas,
    registrarPagamentoLote,
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-ve-cards'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-ve-vendedores'] });
    },
  };
}
