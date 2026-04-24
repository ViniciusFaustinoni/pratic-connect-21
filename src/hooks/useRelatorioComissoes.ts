import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { matchesTipoLancamentoComissao } from '@/lib/comissoes-filtros';

export interface RelatorioComissoesFilters {
  dataInicio: string;
  dataFim: string;
  gradeId: string;
  planoId: string;
  vendedorId: string;
  role: string;
  parcela: string;
  status: string;
  tipoLancamento: string;
}

export interface RelatorioComissaoLinha {
  id: string;
  created_at: string;
  vendedor_id: string;
  contrato_id: string;
  valor_base: number;
  percentual_aplicado: number;
  valor_comissao: number;
  valor_total: number;
  status: string;
  parcela_numero: number | null;
  nivel_nome: string | null;
  role_destinatario: string | null;
  tipo_calculo: string | null;
  tipo_comissao: string | null;
  vendedor?: { nome: string | null; full_name?: string | null; email?: string | null } | null;
  grade?: { nome: string | null } | null;
  plano?: { nome: string | null } | null;
  contrato?: { vendedor?: { nome: string | null; full_name?: string | null; email?: string | null } | null } | null;
}

const today = new Date();
const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

export function useRelatorioComissoes() {
  const [filters, setFilters] = useState<RelatorioComissoesFilters>({
    dataInicio: firstDay,
    dataFim: lastDay,
    gradeId: 'todos',
    planoId: 'todos',
    vendedorId: 'todos',
    role: 'todos',
    parcela: 'todas',
    status: 'todos',
    tipoLancamento: 'todos',
  });

  const { data: grades = [] } = useQuery({
    queryKey: ['relatorio-comissoes-grades'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('grades_comissao').select('id, nome').order('nome');
      if (error) throw error;
      return data as { id: string; nome: string }[];
    },
  });

  const { data: planos = [] } = useQuery({
    queryKey: ['relatorio-comissoes-planos'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('planos').select('id, nome').order('nome');
      if (error) throw error;
      return data as { id: string; nome: string }[];
    },
  });

  const { data: vendedores = [] } = useQuery({
    queryKey: ['relatorio-comissoes-vendedores'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('profiles').select('id, nome, full_name, email').order('nome');
      if (error) throw error;
      return data as { id: string; nome: string | null; full_name: string | null; email: string | null }[];
    },
  });

  const { data: linhas = [], isLoading } = useQuery({
    queryKey: ['relatorio-comissoes', filters],
    queryFn: async () => {
      let query = (supabase as any)
        .from('comissoes')
        .select(`
          id, created_at, vendedor_id, contrato_id, valor_base, percentual_aplicado, valor_comissao, valor_total,
          status, parcela_numero, nivel_nome, role_destinatario, tipo_calculo, tipo_comissao,
          vendedor:profiles!comissoes_vendedor_id_fkey(nome, full_name, email),
          grade:grades_comissao(nome),
          plano:planos(nome),
          contrato:contratos(vendedor:profiles!contratos_vendedor_id_fkey(nome, full_name, email))
        `)
        .gte('created_at', `${filters.dataInicio}T00:00:00`)
        .lte('created_at', `${filters.dataFim}T23:59:59`)
        .order('created_at', { ascending: false });

      if (filters.gradeId !== 'todos') query = query.eq('grade_id', filters.gradeId);
      if (filters.planoId !== 'todos') query = query.eq('plano_id', filters.planoId);
      if (filters.vendedorId !== 'todos') query = query.eq('vendedor_id', filters.vendedorId);
      if (filters.role !== 'todos') query = query.eq('role_destinatario', filters.role);
      if (filters.parcela !== 'todas') query = query.eq('parcela_numero', Number(filters.parcela));
      if (filters.status !== 'todos') query = query.eq('status', filters.status);

      const { data, error } = await query;
      if (error) throw error;
      return (data as RelatorioComissaoLinha[]).filter((linha) => matchesTipoLancamentoComissao(linha, filters.tipoLancamento));
    },
  });

  const resumo = useMemo(() => {
    return linhas.reduce((acc, linha) => {
      const valor = Number(linha.valor_total) || 0;
      acc.totalGerado += valor;
      acc.quantidade += 1;
      if (linha.status === 'paga') acc.totalPago += valor;
      if (linha.status === 'pendente' || linha.status === 'aprovada') acc.totalPendente += valor;
      return acc;
    }, { totalGerado: 0, totalPago: 0, totalPendente: 0, quantidade: 0 });
  }, [linhas]);

  return { filters, setFilters, grades, planos, vendedores, linhas, resumo, isLoading };
}
