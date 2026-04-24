import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { baixarReciboComissao, type ReciboComissaoItem } from '@/lib/comissoes-recibo';
import { matchesTipoLancamentoComissao } from '@/lib/comissoes-filtros';
import { toast } from 'sonner';

export interface PagamentosComissoesFilters {
  dataInicio: string;
  dataFim: string;
  status: string;
  vendedorId: string;
  gradeId: string;
  planoId: string;
  tipoLancamento: string;
  parcela: string;
  search: string;
  page: number;
  pageSize: number;
}

export interface PagamentoComissaoItem extends ReciboComissaoItem {
  created_at: string;
  status: string;
  role_destinatario?: string | null;
  nivel_nome?: string | null;
  valor_total: number;
  valor_comissao: number;
  vendedor_origem_nome?: string | null;
  pagamento_created_at?: string | null;
}

const today = new Date();
const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

const nameOf = (item: any) => item?.nome || item?.full_name || item?.email || null;

export function usePagamentosComissoes() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<PagamentosComissoesFilters>({
    dataInicio: firstDay,
    dataFim: lastDay,
    status: 'todos',
    vendedorId: 'todos',
    gradeId: 'todos',
    planoId: 'todos',
    tipoLancamento: 'todos',
    parcela: 'todas',
    search: '',
    page: 1,
    pageSize: 20,
  });

  const listasQuery = useQuery({
    queryKey: ['pagamentos-comissoes-listas'],
    queryFn: async () => {
      const [grades, planos, vendedores] = await Promise.all([
        (supabase as any).from('grades_comissao').select('id, nome').order('nome'),
        (supabase as any).from('planos').select('id, nome').order('nome'),
        (supabase as any).from('profiles').select('id, nome, full_name, email').order('nome'),
      ]);
      if (grades.error) throw grades.error;
      if (planos.error) throw planos.error;
      if (vendedores.error) throw vendedores.error;
      return { grades: grades.data || [], planos: planos.data || [], vendedores: vendedores.data || [] };
    },
  });

  const query = useQuery({
    queryKey: ['pagamentos-comissoes', filters],
    queryFn: async () => {
      let base = (supabase as any)
        .from('comissoes')
        .select(`
          id, created_at, vendedor_id, contrato_id, cobranca_id, mes_referencia, ano_referencia,
          valor_base, percentual_aplicado, valor_comissao, valor_total, status, pago_em,
          parcela_numero, nivel_nome, role_destinatario, tipo_calculo, tipo_comissao,
          vendedor:profiles!comissoes_vendedor_id_fkey(nome, full_name, email),
          grade:grades_comissao(nome),
          plano:planos(nome),
          contrato:contratos(numero, vendedor:profiles!contratos_vendedor_id_fkey(nome, full_name, email)),
          pagamento_itens:comissoes_pagamento_itens(pagamento_id, created_at, pagamento:comissoes_pagamentos(data_pagamento))
        `)
        .gte('created_at', `${filters.dataInicio}T00:00:00`)
        .lte('created_at', `${filters.dataFim}T23:59:59`)
        .order('created_at', { ascending: false })
        .limit(5000);

      if (filters.status !== 'todos') base = base.eq('status', filters.status);
      if (filters.vendedorId !== 'todos') base = base.eq('vendedor_id', filters.vendedorId);
      if (filters.gradeId !== 'todos') base = base.eq('grade_id', filters.gradeId);
      if (filters.planoId !== 'todos') base = base.eq('plano_id', filters.planoId);
      if (filters.parcela !== 'todas') base = base.eq('parcela_numero', Number(filters.parcela));
      if (filters.search.trim()) base = base.or(`nivel_nome.ilike.%${filters.search.trim()}%,role_destinatario.ilike.%${filters.search.trim()}%`);

      const { data, error } = await base;
      if (error) throw error;

      const allItems: PagamentoComissaoItem[] = (data || []).filter((row: any) => matchesTipoLancamentoComissao(row, filters.tipoLancamento)).map((row: any) => {
        const pagamentoItem = row.pagamento_itens?.[0];
        return {
          id: row.id,
          created_at: row.created_at,
          status: row.status,
          pagamento_id: pagamentoItem?.pagamento_id || null,
          pagamento_created_at: pagamentoItem?.created_at || null,
          data_pagamento: row.pago_em || pagamentoItem?.pagamento?.data_pagamento || null,
          destinatario_nome: nameOf(row.vendedor),
          destinatario_email: row.vendedor?.email || null,
          vendedor_origem_nome: nameOf(row.contrato?.vendedor),
          mes_referencia: row.mes_referencia,
          ano_referencia: row.ano_referencia,
          contrato: row.contrato?.numero || row.contrato_id,
          cobranca: row.cobranca_id,
          plano: row.plano?.nome || null,
          grade: row.grade?.nome || null,
          parcela: row.parcela_numero,
          perfil: row.nivel_nome || row.role_destinatario,
          role_destinatario: row.role_destinatario,
          nivel_nome: row.nivel_nome,
          valor_base: Number(row.valor_base || 0),
          tipo_calculo: row.tipo_calculo,
          percentual_aplicado: Number(row.percentual_aplicado || 0),
          regra_valor: Number(row.percentual_aplicado || 0),
          valor_pago: Number(row.valor_total ?? row.valor_comissao ?? 0),
          valor_total: Number(row.valor_total || 0),
          valor_comissao: Number(row.valor_comissao || 0),
        };
      });
      const from = (filters.page - 1) * filters.pageSize;
      const items = allItems.slice(from, from + filters.pageSize);

      return { items, total: allItems.length };
    },
  });

  const kpis = useMemo(() => {
    const items = query.data?.items || [];
    const destinatarios = new Set(items.map((item) => item.destinatario_email || item.destinatario_nome).filter(Boolean));
    return items.reduce((acc, item) => {
      const valor = Number(item.valor_pago || 0);
      acc.quantidade += 1;
      if (item.status === 'paga') acc.totalPago += valor;
      if (item.status === 'pendente' || item.status === 'aprovada') acc.totalAPagar += valor;
      acc.destinatarios = destinatarios.size;
      return acc;
    }, { totalAPagar: 0, totalPago: 0, quantidade: 0, destinatarios: 0 });
  }, [query.data?.items]);

  const marcarComoPaga = useMutation({
    mutationFn: async (comissaoId: string) => {
      const { data, error } = await (supabase as any).rpc('fn_marcar_comissao_paga', { p_comissao_id: comissaoId });
      if (error) throw error;
      return data?.[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pagamentos-comissoes'] });
      queryClient.invalidateQueries({ queryKey: ['relatorio-comissoes'] });
      queryClient.invalidateQueries({ queryKey: ['comissoes-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['comissao-detalhes-pagamento'] });
      toast.success('Pagamento registrado e comissão marcada como paga');
    },
    onError: (error: any) => toast.error(error?.message || 'Não foi possível registrar o pagamento'),
  });

  return {
    filters,
    setFilters,
    items: query.data?.items || [],
    total: query.data?.total || 0,
    totalPages: Math.max(1, Math.ceil((query.data?.total || 0) / filters.pageSize)),
    kpis,
    isLoading: query.isLoading,
    grades: listasQuery.data?.grades || [],
    planos: listasQuery.data?.planos || [],
    vendedores: listasQuery.data?.vendedores || [],
    marcarComoPaga,
    gerarRecibo: baixarReciboComissao,
  };
}