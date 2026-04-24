import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type ContaCorrentePeriodo = 'mes_atual' | 'mes_anterior' | 'ultimos_30' | 'ano_atual' | 'personalizado';

export interface ContaCorrenteComissoesFilters {
  periodo: ContaCorrentePeriodo;
  dataInicio: string;
  dataFim: string;
  status: string;
  vendedorId: string;
  planoId: string;
  linha: string;
  search: string;
  page: number;
  pageSize: number;
}

export interface ContaCorrenteComissaoItem {
  id: string;
  vendedor_id: string;
  contrato_id: string | null;
  associado_id: string | null;
  created_at: string;
  pago_em: string | null;
  status: string;
  tipo_comissao: string | null;
  tipo_calculo: string | null;
  parcela_numero: number | null;
  parcela_total: number | null;
  valor_base: number;
  valor_comissao: number;
  valor_total: number;
  nivel_nome: string | null;
  role_destinatario: string | null;
  calculo_snapshot: any | null;
  vendedor_nome: string;
  vendedor_email: string | null;
  origem_nome: string | null;
  contrato_numero: string | null;
  associado_nome: string | null;
  plano_id: string | null;
  plano_nome: string | null;
  plano_linha: string | null;
  saldo_apos: number;
}

export interface ContaCorrenteResumo {
  saldoAtual: number;
  totalPago: number;
  totalAReceber: number;
  totalPendente: number;
  totalPeriodo: number;
  quantidade: number;
}

const today = new Date();
const isoDate = (date: Date) => date.toISOString().slice(0, 10);

const getDefaultRange = () => ({
  dataInicio: isoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
  dataFim: isoDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
});

export function getContaCorrentePeriodoRange(periodo: ContaCorrentePeriodo) {
  const now = new Date();
  if (periodo === 'mes_anterior') {
    return {
      dataInicio: isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      dataFim: isoDate(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  }
  if (periodo === 'ultimos_30') {
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    return { dataInicio: isoDate(start), dataFim: isoDate(now) };
  }
  if (periodo === 'ano_atual') {
    return {
      dataInicio: isoDate(new Date(now.getFullYear(), 0, 1)),
      dataFim: isoDate(new Date(now.getFullYear(), 11, 31)),
    };
  }
  return getDefaultRange();
}

const initialRange = getDefaultRange();

const nameOf = (item: any) => item?.nome || item?.full_name || item?.email || 'Sem nome';
const moneyValue = (value: unknown) => Number(value || 0);
const isPago = (item: Pick<ContaCorrenteComissaoItem, 'status' | 'pago_em'>) => item.status === 'paga' || item.status === 'pago' || !!item.pago_em;
const isAReceber = (status: string) => status === 'aprovada' || status === 'pendente';

export function useContaCorrenteComissoes() {
  const [filters, setFilters] = useState<ContaCorrenteComissoesFilters>({
    periodo: 'mes_atual',
    dataInicio: initialRange.dataInicio,
    dataFim: initialRange.dataFim,
    status: 'todos',
    vendedorId: 'todos',
    planoId: 'todos',
    linha: 'todas',
    search: '',
    page: 1,
    pageSize: 20,
  });

  const visibleUsersQuery = useQuery({
    queryKey: ['conta-corrente-comissoes', 'usuarios-visiveis'],
    queryFn: async () => {
      const { data: visibleIds, error: scopeError } = await (supabase as any).rpc('fn_comissoes_usuarios_visiveis');
      if (scopeError) throw scopeError;
      const ids = (visibleIds || []).map((row: any) => row.user_id).filter(Boolean);
      if (ids.length === 0) return [];

      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('id, nome, full_name, email')
        .in('id', ids)
        .order('nome');
      if (error) throw error;
      return (data || []) as { id: string; nome: string | null; full_name: string | null; email: string | null }[];
    },
  });

  const listasQuery = useQuery({
    queryKey: ['conta-corrente-comissoes', 'listas'],
    queryFn: async () => {
      const { data: planos, error } = await (supabase as any)
        .from('planos')
        .select('id, nome, linha')
        .order('linha')
        .order('nome');
      if (error) throw error;
      const linhas = Array.from(new Set((planos || []).map((p: any) => p.linha).filter(Boolean))).sort();
      return { planos: planos || [], linhas } as { planos: { id: string; nome: string; linha: string | null }[]; linhas: string[] };
    },
  });

  const query = useQuery({
    queryKey: ['conta-corrente-comissoes', 'extrato', filters],
    queryFn: async () => {
      let builder = (supabase as any)
        .from('comissoes')
        .select(`
          id, vendedor_id, contrato_id, associado_id, created_at, pago_em, status, tipo_comissao, tipo_calculo,
          parcela_numero, parcela_total, valor_base, valor_comissao, valor_total, nivel_nome, role_destinatario,
          calculo_snapshot, plano_id,
          vendedor:profiles!comissoes_vendedor_id_fkey(nome, full_name, email),
          plano:planos(id, nome, linha),
          associado:associados(nome),
          contrato:contratos(numero, vendedor:profiles!contratos_vendedor_id_fkey(nome, full_name, email))
        `)
        .gte('created_at', `${filters.dataInicio}T00:00:00`)
        .lte('created_at', `${filters.dataFim}T23:59:59`)
        .order('created_at', { ascending: true })
        .limit(5000);

      if (filters.status !== 'todos') builder = builder.eq('status', filters.status);
      if (filters.vendedorId !== 'todos') builder = builder.eq('vendedor_id', filters.vendedorId);
      if (filters.planoId !== 'todos') builder = builder.eq('plano_id', filters.planoId);
      if (filters.linha !== 'todas') builder = builder.eq('plano.linha', filters.linha);

      const { data, error } = await builder;
      if (error) throw error;

      const search = filters.search.trim().toLowerCase();
      let saldo = 0;
      const mapped: ContaCorrenteComissaoItem[] = (data || []).map((row: any) => {
        const valor = moneyValue(row.valor_total ?? row.valor_comissao);
        if (row.status !== 'cancelada' && row.status !== 'cancelado' && isPago(row)) saldo += valor;

        return {
          id: row.id,
          vendedor_id: row.vendedor_id,
          contrato_id: row.contrato_id,
          associado_id: row.associado_id,
          created_at: row.created_at,
          pago_em: row.pago_em,
          status: row.status,
          tipo_comissao: row.tipo_comissao,
          tipo_calculo: row.tipo_calculo,
          parcela_numero: row.parcela_numero,
          parcela_total: row.parcela_total,
          valor_base: moneyValue(row.valor_base),
          valor_comissao: moneyValue(row.valor_comissao),
          valor_total: valor,
          nivel_nome: row.nivel_nome,
          role_destinatario: row.role_destinatario,
          calculo_snapshot: row.calculo_snapshot,
          vendedor_nome: nameOf(row.vendedor),
          vendedor_email: row.vendedor?.email || null,
          origem_nome: nameOf(row.contrato?.vendedor) || null,
          contrato_numero: row.contrato?.numero || null,
          associado_nome: row.associado?.nome || null,
          plano_id: row.plano_id,
          plano_nome: row.plano?.nome || null,
          plano_linha: row.plano?.linha || null,
          saldo_apos: saldo,
        };
      }).filter((item) => {
        if (!search) return true;
        return [item.vendedor_nome, item.vendedor_email, item.associado_nome, item.contrato_numero, item.plano_nome, item.plano_linha, item.role_destinatario, item.nivel_nome]
          .some((value) => String(value || '').toLowerCase().includes(search));
      });

      const from = (filters.page - 1) * filters.pageSize;
      return { allItems: mapped, items: mapped.slice(from, from + filters.pageSize), total: mapped.length };
    },
  });

  const resumo = useMemo<ContaCorrenteResumo>(() => {
    const items = query.data?.allItems || [];
    return items.reduce((acc, item) => {
      const valor = moneyValue(item.valor_total);
      acc.totalPeriodo += valor;
      acc.quantidade += 1;
      if (isPago(item)) acc.totalPago += valor;
      if (isAReceber(item.status)) acc.totalAReceber += valor;
      if (item.status === 'pendente') acc.totalPendente += valor;
      acc.saldoAtual = item.saldo_apos;
      return acc;
    }, { saldoAtual: 0, totalPago: 0, totalAReceber: 0, totalPendente: 0, totalPeriodo: 0, quantidade: 0 });
  }, [query.data?.allItems]);

  return {
    filters,
    setFilters,
    items: query.data?.items || [],
    total: query.data?.total || 0,
    totalPages: Math.max(1, Math.ceil((query.data?.total || 0) / filters.pageSize)),
    resumo,
    isLoading: query.isLoading,
    usuarios: visibleUsersQuery.data || [],
    planos: listasQuery.data?.planos || [],
    linhas: listasQuery.data?.linhas || [],
  };
}
