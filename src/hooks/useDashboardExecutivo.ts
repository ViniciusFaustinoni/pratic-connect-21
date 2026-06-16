import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const sb = supabase as any;

export interface Fornecedor { nome: string; valor: number; }
export interface GrupoPct { codigo: string; nome: string; valor: number; pct: number; }

export interface DashboardExecutivo {
  receita: number;
  despesa: number;
  lucro: number;
  margem: number;
  custoTecnicoRisco: number;
  custoTecnicoPct: number;
  saldoBancos: number;
  aPagarAberto: number;
  vencidasQtd: number;
  prazoMedioPagamento: number; // dias
  topFornecedores: Fornecedor[];
  topGrupos: GrupoPct[];
}

function ultimoDia(ano: number, mes: number): string {
  const d = new Date(ano, mes, 0).getDate();
  return `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
const grupoDe = (c: string | null): string | null => (c ? c.split('.').slice(0, 2).join('.') : null);
const RISCO = ['2.01', '2.08', '2.09']; // Assistência + Eventos + Monitoramento

export function useDashboardExecutivo(ano: number, mes: number) {
  return useQuery({
    queryKey: ['dashboard-executivo', ano, mes],
    queryFn: async (): Promise<DashboardExecutivo> => {
      const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
      const fim = ultimoDia(ano, mes);
      const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

      const [catRes, payMesRes, abertoRes, recRes, asaasRes, sgaRes, bancosRes] = await Promise.all([
        sb.from('categorias_financeiras').select('codigo, nome, fora_do_custo'),
        sb.from('contas_pagar')
          .select('valor, valor_pago, status, conta_codigo, fornecedor_nome, data_emissao, data_pagamento, data_vencimento')
          .gte('data_vencimento', inicio).lte('data_vencimento', fim).limit(20000),
        sb.from('contas_pagar').select('valor, data_vencimento, status').not('status', 'in', '(pago,cancelado)').limit(20000),
        sb.from('receitas').select('valor, data').gte('data', inicio).lte('data', fim).limit(20000),
        sb.from('asaas_cobrancas').select('pagamento_valor, data_vencimento').gte('data_vencimento', inicio).lte('data_vencimento', fim).limit(20000),
        sb.from('cobrancas').select('valor_pago, data_vencimento').gte('data_vencimento', inicio).lte('data_vencimento', fim).limit(20000),
        sb.from('contas_bancarias').select('saldo_atual, ativo').eq('ativo', true),
      ]);

      const cats = (catRes.data ?? []) as any[];
      const info = new Map<string, { nome: string; fora: boolean }>();
      for (const c of cats) info.set(c.codigo, { nome: c.nome, fora: !!c.fora_do_custo });

      const receita =
        (recRes.data ?? []).reduce((a: number, c: any) => a + Number(c.valor || 0), 0) +
        (asaasRes.data ?? []).reduce((a: number, c: any) => a + Number(c.pagamento_valor || 0), 0) +
        (sgaRes.data ?? []).reduce((a: number, c: any) => a + Number(c.valor_pago || 0), 0);

      const pagas = (payMesRes.data ?? []).filter((p: any) => p.status === 'pago');

      // Despesa (sem sócios) + grupos + risco
      const porGrupo = new Map<string, number>();
      const forn = new Map<string, number>();
      let despesaSemSocios = 0;
      let custoRisco = 0;
      let somaDias = 0, countDias = 0;
      for (const p of pagas) {
        const valor = Number(p.valor_pago || p.valor || 0);
        const g = grupoDe(p.conta_codigo);
        const fora = g && info.get(g)?.fora;
        if (!fora) {
          despesaSemSocios += valor;
          if (g) porGrupo.set(g, (porGrupo.get(g) || 0) + valor);
          if (g && RISCO.includes(g)) custoRisco += valor;
        }
        const nome = (p.fornecedor_nome || 'Sem nome').trim();
        forn.set(nome, (forn.get(nome) || 0) + valor);
        if (p.data_emissao && p.data_pagamento) {
          const d = (new Date(p.data_pagamento).getTime() - new Date(p.data_emissao).getTime()) / 86400000;
          if (d >= 0 && d < 365) { somaDias += d; countDias++; }
        }
      }

      const topGrupos: GrupoPct[] = Array.from(porGrupo.entries())
        .map(([codigo, valor]) => ({ codigo, nome: info.get(codigo)?.nome ?? codigo, valor, pct: despesaSemSocios > 0 ? (valor / despesaSemSocios) * 100 : 0 }))
        .sort((a, b) => b.valor - a.valor).slice(0, 8);

      const topFornecedores: Fornecedor[] = Array.from(forn.entries())
        .map(([nome, valor]) => ({ nome, valor }))
        .sort((a, b) => b.valor - a.valor).slice(0, 10);

      const aberto = abertoRes.data ?? [];
      const aPagarAberto = aberto.reduce((a: number, c: any) => a + Number(c.valor || 0), 0);
      const vencidasQtd = aberto.filter((c: any) => c.data_vencimento < hoje).length;
      const saldoBancos = (bancosRes.data ?? []).reduce((a: number, c: any) => a + Number(c.saldo_atual || 0), 0);

      return {
        receita,
        despesa: despesaSemSocios,
        lucro: receita - despesaSemSocios,
        margem: receita > 0 ? ((receita - despesaSemSocios) / receita) * 100 : 0,
        custoTecnicoRisco: custoRisco,
        custoTecnicoPct: receita > 0 ? (custoRisco / receita) * 100 : 0,
        saldoBancos,
        aPagarAberto,
        vencidasQtd,
        prazoMedioPagamento: countDias > 0 ? somaDias / countDias : 0,
        topFornecedores,
        topGrupos,
      };
    },
  });
}
