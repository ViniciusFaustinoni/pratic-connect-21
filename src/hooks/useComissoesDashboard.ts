import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isComissaoVitalicia, matchesTipoLancamentoComissao, type TipoLancamentoComissao } from '@/lib/comissoes-filtros';

export type ComissaoStatus = 'pendente' | 'aprovada' | 'paga' | 'contestada' | string;

export interface ComissaoDashboardItem {
  id: string;
  vendedor_id: string | null;
  contrato_id: string | null;
  associado_id: string | null;
  cobranca_id: string | null;
  nivel_nome: string | null;
  tipo_comissao: string | null;
  parcela_numero: number | null;
  valor_base: number | null;
  percentual_aplicado: number | null;
  tipo_calculo: string | null;
  valor_comissao: number | null;
  valor_total: number | null;
  status: ComissaoStatus;
  mes_referencia: number | null;
  ano_referencia: number | null;
  created_at: string | null;
  pago_em: string | null;
  usuario_nome: string;
  usuario_email: string;
  usuario_avatar_url: string | null;
}

export interface ComissoesDashboardFilters {
  dataInicio?: Date;
  dataFim?: Date;
  status?: string;
  tipoLancamento?: TipoLancamentoComissao;
}

export interface ComissaoKpis {
  totalAPagarMes: number;
  totalPagoMes: number;
  pendenteAprovacao: number;
  vitaliciasAtivas: number;
  topVendedores: Array<{ vendedor_id: string; nome: string; valor: number }>;
}

const money = (value: number | null | undefined) => Number(value || 0);

const startOfDayIso = (date: Date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value.toISOString();
};

const endOfDayIso = (date: Date) => {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value.toISOString();
};

export function useComissoesDashboard(filters: ComissoesDashboardFilters = {}) {
  const hoje = new Date();
  const dataInicio = filters.dataInicio || new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const dataFim = filters.dataFim || new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  const status = filters.status || 'todos';
  const tipoLancamento = filters.tipoLancamento || 'todos';

  const query = useQuery({
    queryKey: ['comissoes-dashboard', startOfDayIso(dataInicio), endOfDayIso(dataFim), status, tipoLancamento],
    queryFn: async () => {
      let builder = (supabase as any)
        .from('comissoes')
        .select('id, vendedor_id, contrato_id, associado_id, cobranca_id, nivel_nome, tipo_comissao, tipo_calculo, parcela_numero, valor_base, percentual_aplicado, valor_comissao, valor_total, status, mes_referencia, ano_referencia, created_at, pago_em')
        .gte('created_at', startOfDayIso(dataInicio))
        .lte('created_at', endOfDayIso(dataFim));

      if (status !== 'todos') builder = builder.eq('status', status);

      const { data: comissoes, error } = await builder
        .order('created_at', { ascending: false });
      if (error) throw error;

      const ids = Array.from(new Set((comissoes || []).map((c: any) => c.vendedor_id).filter(Boolean)));
      let profilesById = new Map<string, any>();
      if (ids.length > 0) {
        const { data: profiles, error: pErr } = await (supabase as any)
          .from('profiles')
          .select('id, nome, email, avatar_url')
          .in('id', ids);
        if (pErr) throw pErr;
        profilesById = new Map((profiles || []).map((p: any) => [p.id, p]));
      }

      return (comissoes || []).map((c: any) => {
        const profile = c.vendedor_id ? profilesById.get(c.vendedor_id) : null;
        return {
          ...c,
          valor_base: c.valor_base === null ? null : Number(c.valor_base),
          percentual_aplicado: c.percentual_aplicado === null ? null : Number(c.percentual_aplicado),
          tipo_calculo: c.tipo_calculo || null,
          valor_comissao: c.valor_comissao === null ? null : Number(c.valor_comissao),
          valor_total: c.valor_total === null ? null : Number(c.valor_total),
          usuario_nome: profile?.nome || 'Usuário não identificado',
          usuario_email: profile?.email || '',
          usuario_avatar_url: profile?.avatar_url || null,
        } as ComissaoDashboardItem;
      }).filter((item: ComissaoDashboardItem) => matchesTipoLancamentoComissao(item, tipoLancamento));
    },
  });

  const kpis = useMemo<ComissaoKpis>(() => {
    const items = query.data || [];
    const payableStatuses = new Set(['pendente', 'aprovada']);
    const paidStatuses = new Set(['paga', 'pago']);

    const totalAPagarMes = items
      .filter(i => payableStatuses.has(i.status))
      .reduce((sum, i) => sum + money(i.valor_total ?? i.valor_comissao), 0);

    const totalPagoMes = items
      .filter(i => paidStatuses.has(i.status) || !!i.pago_em)
      .reduce((sum, i) => sum + money(i.valor_total ?? i.valor_comissao), 0);

    const pendenteAprovacao = items.filter(i => i.status === 'pendente').length;
    const vitaliciasAtivas = items.filter(isComissaoVitalicia).length;

    const topMap = new Map<string, { vendedor_id: string; nome: string; valor: number }>();
    items.forEach((i) => {
      if (!i.vendedor_id) return;
      const current = topMap.get(i.vendedor_id) || { vendedor_id: i.vendedor_id, nome: i.usuario_nome, valor: 0 };
      current.valor += money(i.valor_total ?? i.valor_comissao);
      topMap.set(i.vendedor_id, current);
    });

    return {
      totalAPagarMes,
      totalPagoMes,
      pendenteAprovacao,
      vitaliciasAtivas,
      topVendedores: Array.from(topMap.values()).sort((a, b) => b.valor - a.valor).slice(0, 5),
    };
  }, [query.data]);

  return { ...query, items: query.data || [], kpis, dataInicio, dataFim, status, tipoLancamento };
}
