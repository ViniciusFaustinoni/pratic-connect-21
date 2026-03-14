import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useComissaoExternaConfig } from './useComissaoExternaConfig';

// ==========================================
// TYPES
// ==========================================
export interface CCLancamento {
  id: string;
  vendedor_id: string;
  associado_id: string | null;
  contrato_id: string | null;
  tipo: 'credito' | 'debito';
  categoria: string;
  descricao: string;
  valor_bruto: number;
  valor_abatimento: number;
  valor_liquido: number;
  saldo_apos: number | null;
  parcela_numero: number | null;
  parcela_total: number | null;
  debito_volante_ref_id: string | null;
  status: string;
  data_lancamento: string;
  data_pagamento: string | null;
  observacao_pagamento: string | null;
  pago_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface CCSaldo {
  saldo_atual: number;
  a_receber_mes: number;
  antecipacoes_abertas: number;
}

export interface CCFiltros {
  vendedorId: string;
  dataInicio?: string;
  dataFim?: string;
  tipo?: 'credito' | 'debito' | '';
  status?: string;
  page?: number;
  pageSize?: number;
}

interface DadosAtivacao {
  vendedor_id: string;
  associado_id: string;
  contrato_id: string;
  valor_adesao: number;
  tipo_instalacao: 'base' | 'volante';
  nome_associado: string;
}

// ==========================================
// HOOK
// ==========================================
export function useContaCorrenteVendedor(filtros: CCFiltros) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { getValue } = useComissaoExternaConfig();
  const { vendedorId, dataInicio, dataFim, tipo, status, page = 1, pageSize = 20 } = filtros;

  // Query lancamentos
  const lancamentosQuery = useQuery({
    queryKey: ['cc-lancamentos', vendedorId, dataInicio, dataFim, tipo, status, page],
    queryFn: async () => {
      let query = supabase
        .from('cc_vendedor_lancamentos')
        .select('*', { count: 'exact' })
        .eq('vendedor_id', vendedorId)
        .order('data_lancamento', { ascending: false })
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (dataInicio) query = query.gte('data_lancamento', dataInicio);
      if (dataFim) query = query.lte('data_lancamento', dataFim);
      if (tipo) query = query.eq('tipo', tipo);
      if (status) query = query.eq('status', status);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: (data || []) as unknown as CCLancamento[], total: count || 0 };
    },
    enabled: !!vendedorId,
  });

  // Query saldo
  const saldoQuery = useQuery({
    queryKey: ['cc-saldo', vendedorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_cc_vendedor_saldo')
        .select('*')
        .eq('vendedor_id', vendedorId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as CCSaldo) || { saldo_atual: 0, a_receber_mes: 0, antecipacoes_abertas: 0 };
    },
    enabled: !!vendedorId,
  });

  // Helper: recalculate saldo_apos for all entries of a vendor
  const recalcularSaldos = async (vid: string) => {
    const { data: all, error } = await supabase
      .from('cc_vendedor_lancamentos')
      .select('id, tipo, valor_liquido, status')
      .eq('vendedor_id', vid)
      .neq('status', 'cancelado')
      .order('data_lancamento', { ascending: true })
      .order('created_at', { ascending: true });
    if (error || !all) return;

    let saldo = 0;
    for (const row of all as unknown as CCLancamento[]) {
      if (row.tipo === 'credito') saldo += Number(row.valor_liquido);
      else saldo -= Number(row.valor_liquido);
      await supabase
        .from('cc_vendedor_lancamentos')
        .update({ saldo_apos: saldo } as any)
        .eq('id', row.id);
    }
  };

  // Mutation: gerar lançamentos na ativação
  const gerarLancamentosAtivacao = useMutation({
    mutationFn: async (dados: DadosAtivacao) => {
      const { vendedor_id, associado_id, contrato_id, valor_adesao, tipo_instalacao, nome_associado } = dados;
      const pctAdesao = Number(getValue('comissao_ext_pct_adesao')) / 100;
      const valorVolante = Number(getValue('comissao_ext_valor_volante'));
      const tipoRecorrente = getValue('comissao_ext_tipo_recorrente');
      const valorRecorrente = Number(getValue('comissao_ext_valor_recorrente'));
      const parcelasRecorrente = Number(getValue('comissao_ext_parcelas_recorrente'));

      const inserts: any[] = [];
      const cobrou = valor_adesao > 0;
      const volante = tipo_instalacao === 'volante';

      // Cenário 3: nenhum lançamento
      if (!cobrou && !volante) return;

      // Crédito adesão (cenários 1 e 4)
      if (cobrou) {
        const comissaoAdesao = valor_adesao * pctAdesao;
        inserts.push({
          vendedor_id, associado_id, contrato_id,
          tipo: 'credito', categoria: 'adesao',
          descricao: `Comissão de adesão — ${nome_associado} — R$ ${comissaoAdesao.toFixed(2)}`,
          valor_bruto: comissaoAdesao, valor_abatimento: 0, valor_liquido: comissaoAdesao,
          status: 'a_pagar', data_lancamento: new Date().toISOString().slice(0, 10),
        });
      }

      // Débito volante (cenários 1 e 2)
      if (volante) {
        inserts.push({
          vendedor_id, associado_id, contrato_id,
          tipo: 'debito', categoria: 'volante',
          descricao: `Débito instalação volante — ${nome_associado} — R$ ${valorVolante.toFixed(2)}`,
          valor_bruto: valorVolante, valor_abatimento: 0, valor_liquido: valorVolante,
          status: cobrou ? 'a_pagar' : 'pendente',
          data_lancamento: new Date().toISOString().slice(0, 10),
        });
      }

      // Parcelas recorrentes (cenários 1, 2, 4)
      for (let i = 1; i <= parcelasRecorrente; i++) {
        const valorBruto = tipoRecorrente === 'fixo' ? valorRecorrente : 0; // percentual resolved later
        inserts.push({
          vendedor_id, associado_id, contrato_id,
          tipo: 'credito', categoria: 'recorrente',
          descricao: `Comissão recorrente parcela ${i}/${parcelasRecorrente} — ${nome_associado}`,
          valor_bruto: valorBruto, valor_abatimento: 0, valor_liquido: valorBruto,
          parcela_numero: i, parcela_total: parcelasRecorrente,
          status: 'pendente',
          data_lancamento: new Date().toISOString().slice(0, 10),
        });
      }

      const { error } = await supabase.from('cc_vendedor_lancamentos').insert(inserts as any);
      if (error) throw error;

      await recalcularSaldos(vendedor_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cc-lancamentos'] });
      queryClient.invalidateQueries({ queryKey: ['cc-saldo'] });
      toast.success('Lançamentos gerados com sucesso!');
    },
    onError: (e) => toast.error('Erro ao gerar lançamentos: ' + (e as Error).message),
  });

  // Mutation: confirmar parcela recorrente (quando associado paga fatura mensal)
  const confirmarParcelaRecorrente = useMutation({
    mutationFn: async ({ parcelaId, valorMensalidade }: { parcelaId: string; valorMensalidade?: number }) => {
      // Get the parcela
      const { data: parcela, error: pErr } = await supabase
        .from('cc_vendedor_lancamentos')
        .select('*')
        .eq('id', parcelaId)
        .single();
      if (pErr || !parcela) throw pErr || new Error('Parcela não encontrada');
      const p = parcela as unknown as CCLancamento;

      // If percentual, calculate valor_bruto from mensalidade
      const tipoRecorrente = getValue('comissao_ext_tipo_recorrente');
      const valorRecorrente = Number(getValue('comissao_ext_valor_recorrente'));
      let valorBruto = p.valor_bruto;
      if (tipoRecorrente === 'percentual' && valorMensalidade) {
        valorBruto = (valorRecorrente / 100) * valorMensalidade;
      }

      // Check for pending volante debits
      const { data: debitos } = await supabase
        .from('cc_vendedor_lancamentos')
        .select('id, valor_bruto, valor_liquido')
        .eq('vendedor_id', p.vendedor_id)
        .eq('categoria', 'volante')
        .eq('status', 'pendente');

      // Sum already-applied abatimentos for this vendor's volante debits
      const { data: abatimentos } = await supabase
        .from('cc_vendedor_lancamentos')
        .select('valor_abatimento')
        .eq('vendedor_id', p.vendedor_id)
        .eq('categoria', 'recorrente')
        .gt('valor_abatimento', 0);

      const totalDebito = (debitos || []).reduce((s: number, d: any) => s + Number(d.valor_bruto), 0);
      const totalAbatido = (abatimentos || []).reduce((s: number, a: any) => s + Number(a.valor_abatimento), 0);
      const saldoDevedor = Math.max(0, totalDebito - totalAbatido);

      let valorAbatimento = 0;
      let valorLiquido = valorBruto;
      let descricaoExtra = '';

      if (saldoDevedor > 0) {
        valorAbatimento = Math.min(valorBruto, saldoDevedor);
        valorLiquido = valorBruto - valorAbatimento;
        if (valorAbatimento >= valorBruto) {
          descricaoExtra = ` → Abatido integralmente do débito volante. A receber: R$ 0,00`;
        } else {
          descricaoExtra = ` → Abatimento parcial R$ ${valorAbatimento.toFixed(2)}. A receber: R$ ${valorLiquido.toFixed(2)}`;
        }
      } else {
        descricaoExtra = ` → A receber: R$ ${valorLiquido.toFixed(2)}`;
      }

      const novaDescricao = p.descricao.split(' →')[0] + descricaoExtra;

      const { error } = await supabase
        .from('cc_vendedor_lancamentos')
        .update({
          valor_bruto: valorBruto,
          valor_abatimento: valorAbatimento,
          valor_liquido: valorLiquido,
          descricao: novaDescricao,
          status: 'a_pagar',
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', parcelaId);
      if (error) throw error;

      await recalcularSaldos(p.vendedor_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cc-lancamentos'] });
      queryClient.invalidateQueries({ queryKey: ['cc-saldo'] });
    },
    onError: (e) => toast.error('Erro: ' + (e as Error).message),
  });

  // Mutation: registrar pagamento manual
  const registrarPagamento = useMutation({
    mutationFn: async ({ parcelaId, dataPagamento, observacao }: { parcelaId: string; dataPagamento: string; observacao?: string }) => {
      const { error } = await supabase
        .from('cc_vendedor_lancamentos')
        .update({
          status: 'pago',
          data_pagamento: dataPagamento,
          observacao_pagamento: observacao || null,
          pago_por: profile?.id || null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', parcelaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cc-lancamentos'] });
      queryClient.invalidateQueries({ queryKey: ['cc-saldo'] });
      toast.success('Pagamento registrado com sucesso!');
    },
    onError: (e) => toast.error('Erro: ' + (e as Error).message),
  });

  // Mutation: cancelar venda pré-boleto
  const cancelarVendaPreBoleto = useMutation({
    mutationFn: async ({ vendedor_id, associado_id, nome_associado }: { vendedor_id: string; associado_id: string; nome_associado: string }) => {
      // 1. Cancel pending recurrent installments
      await supabase
        .from('cc_vendedor_lancamentos')
        .update({ status: 'cancelado', updated_at: new Date().toISOString() } as any)
        .eq('vendedor_id', vendedor_id)
        .eq('associado_id', associado_id)
        .eq('categoria', 'recorrente')
        .eq('status', 'pendente');

      // 2. Check if adesão was credited — if so, estorno
      const { data: adesao } = await supabase
        .from('cc_vendedor_lancamentos')
        .select('*')
        .eq('vendedor_id', vendedor_id)
        .eq('associado_id', associado_id)
        .eq('categoria', 'adesao')
        .eq('tipo', 'credito')
        .neq('status', 'cancelado');

      if (adesao && adesao.length > 0) {
        const a = adesao[0] as any;
        await supabase.from('cc_vendedor_lancamentos').insert({
          vendedor_id, associado_id,
          tipo: 'debito', categoria: 'estorno',
          descricao: `Estorno comissão de adesão — Cancelamento — ${nome_associado}`,
          valor_bruto: a.valor_liquido, valor_abatimento: 0, valor_liquido: a.valor_liquido,
          status: 'a_pagar',
          data_lancamento: new Date().toISOString().slice(0, 10),
        } as any);
      }

      // 3. Check anticipated — debit back
      const { data: antecipados } = await supabase
        .from('cc_vendedor_lancamentos')
        .select('*')
        .eq('vendedor_id', vendedor_id)
        .eq('associado_id', associado_id)
        .eq('status', 'antecipado')
        .eq('tipo', 'credito');

      if (antecipados && antecipados.length > 0) {
        const totalAntecipado = antecipados.reduce((s: number, a: any) => s + Number(a.valor_liquido), 0);
        await supabase.from('cc_vendedor_lancamentos').insert({
          vendedor_id, associado_id,
          tipo: 'debito', categoria: 'cancelamento',
          descricao: `Débito cancelamento com antecipação — ${nome_associado}`,
          valor_bruto: totalAntecipado, valor_abatimento: 0, valor_liquido: totalAntecipado,
          status: 'a_pagar',
          data_lancamento: new Date().toISOString().slice(0, 10),
        } as any);
      }

      // 4. Volante debit remains (no action needed)

      await recalcularSaldos(vendedor_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cc-lancamentos'] });
      queryClient.invalidateQueries({ queryKey: ['cc-saldo'] });
      toast.success('Venda cancelada e lançamentos ajustados.');
    },
    onError: (e) => toast.error('Erro: ' + (e as Error).message),
  });

  return {
    lancamentos: lancamentosQuery.data?.data || [],
    totalLancamentos: lancamentosQuery.data?.total || 0,
    isLoadingLancamentos: lancamentosQuery.isLoading,
    saldo: saldoQuery.data || { saldo_atual: 0, a_receber_mes: 0, antecipacoes_abertas: 0 },
    isLoadingSaldo: saldoQuery.isLoading,
    registrarPagamento,
    gerarLancamentosAtivacao,
    confirmarParcelaRecorrente,
    cancelarVendaPreBoleto,
  };
}
