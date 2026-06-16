import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const sb = supabase as any;

export interface BucketFluxo {
  key: string;
  label: string;
  vencidas?: boolean;
  entradas: number;
  saidas: number;
  resultado: number;
  saldoAcumulado: number;
}

export interface FluxoCaixaResultado {
  saldoAtual: number;
  totalAReceber: number;
  totalAPagar: number;
  saldoProjetado: number;
  buckets: BucketFluxo[];
}

// Data local (BRT) no formato YYYY-MM-DD
function hojeBRT(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function gerarMeses(horizonte: number): { key: string; label: string }[] {
  const base = new Date();
  base.setDate(1);
  const meses: { key: string; label: string }[] = [];
  for (let i = 0; i < horizonte; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    meses.push({ key, label });
  }
  return meses;
}

/**
 * Fluxo de caixa projetado: une recebíveis (ASAAS + SGA) e contas a pagar
 * em aberto, por mês, partindo do saldo bancário atual.
 */
export function useFluxoCaixa(horizonte = 6) {
  return useQuery({
    queryKey: ['fluxo-caixa', horizonte],
    queryFn: async (): Promise<FluxoCaixaResultado> => {
      const hoje = hojeBRT();
      const meses = gerarMeses(horizonte);
      const ultimoMes = meses[meses.length - 1].key; // 'YYYY-MM'
      const horizonFim = `${ultimoMes}-31`;

      const [saldoRes, asaasRes, sgaRes, payRes] = await Promise.all([
        // Saldo atual dos bancos
        sb.from('contas_bancarias').select('saldo_atual, ativo').eq('ativo', true),
        // Recebíveis ASAAS em aberto
        sb.from('asaas_cobrancas')
          .select('valor, data_vencimento, status')
          .in('status', ['PENDING', 'pendente', 'OVERDUE', 'vencido'])
          .lte('data_vencimento', horizonFim)
          .limit(5000),
        // Recebíveis SGA em aberto
        sb.from('cobrancas')
          .select('valor, valor_final, data_vencimento, status')
          .in('status', ['aguardando_pagamento', 'vencido', 'pendente'])
          .lte('data_vencimento', horizonFim)
          .limit(5000),
        // Contas a pagar em aberto
        sb.from('contas_pagar')
          .select('valor, data_vencimento, status')
          .not('status', 'in', '(pago,cancelado)')
          .lte('data_vencimento', horizonFim)
          .limit(5000),
      ]);

      const saldoAtual = (saldoRes.data ?? []).reduce(
        (acc: number, c: any) => acc + Number(c.saldo_atual || 0), 0);

      // Inicializa buckets: "Vencidas" + meses do horizonte
      const buckets: BucketFluxo[] = [
        { key: 'vencidas', label: 'Vencidas', vencidas: true, entradas: 0, saidas: 0, resultado: 0, saldoAcumulado: 0 },
        ...meses.map((m) => ({
          key: m.key, label: m.label, entradas: 0, saidas: 0, resultado: 0, saldoAcumulado: 0,
        })),
      ];
      const idxPorKey = new Map(buckets.map((b, i) => [b.key, i]));

      const bucketDe = (dataVenc: string | null): number | null => {
        if (!dataVenc) return null;
        if (dataVenc < hoje) return 0; // vencidas
        const ym = dataVenc.slice(0, 7);
        const i = idxPorKey.get(ym);
        return i === undefined ? null : i;
      };

      // Entradas: ASAAS
      for (const c of asaasRes.data ?? []) {
        const i = bucketDe(c.data_vencimento);
        if (i !== null) buckets[i].entradas += Number(c.valor || 0);
      }
      // Entradas: SGA
      for (const c of sgaRes.data ?? []) {
        const i = bucketDe(c.data_vencimento);
        if (i !== null) buckets[i].entradas += Number(c.valor_final || c.valor || 0);
      }
      // Saídas: contas a pagar
      for (const p of payRes.data ?? []) {
        const i = bucketDe(p.data_vencimento);
        if (i !== null) buckets[i].saidas += Number(p.valor || 0);
      }

      // Resultado e saldo acumulado
      let acumulado = saldoAtual;
      for (const b of buckets) {
        b.resultado = b.entradas - b.saidas;
        acumulado += b.resultado;
        b.saldoAcumulado = acumulado;
      }

      const totalAReceber = buckets.reduce((a, b) => a + b.entradas, 0);
      const totalAPagar = buckets.reduce((a, b) => a + b.saidas, 0);

      return {
        saldoAtual,
        totalAReceber,
        totalAPagar,
        saldoProjetado: acumulado,
        buckets,
      };
    },
  });
}
