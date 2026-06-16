import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const sb = supabase as any;

export interface LinhaGrupoDRE {
  codigo: string;
  nome: string;
  valores: number[]; // por mês
}

export interface DREGerencial {
  meses: { key: string; label: string }[];
  receita: number[];
  grupos: LinhaGrupoDRE[];
  despesaSemSocios: number[];
  socios: number[];
  lucro: number[];
  caixaReal: number[];
  margem: number[]; // % do lucro sobre receita
}

function listaMeses(num: number): { key: string; label: string; inicio: string; fim: string }[] {
  const base = new Date();
  base.setDate(1);
  const arr = [];
  for (let i = num - 1; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    const ano = d.getFullYear();
    const mes = d.getMonth() + 1;
    const ud = new Date(ano, mes, 0).getDate();
    arr.push({
      key: `${ano}-${String(mes).padStart(2, '0')}`,
      label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      inicio: `${ano}-${String(mes).padStart(2, '0')}-01`,
      fim: `${ano}-${String(mes).padStart(2, '0')}-${String(ud).padStart(2, '0')}`,
    });
  }
  return arr;
}

const grupoDe = (codigo: string | null): string | null =>
  codigo ? codigo.split('.').slice(0, 2).join('.') : null;
const ym = (d: string | null): string | null => (d ? d.slice(0, 7) : null);

export function useDREGerencial(numMeses = 6) {
  return useQuery({
    queryKey: ['dre-gerencial', numMeses],
    queryFn: async (): Promise<DREGerencial> => {
      const meses = listaMeses(numMeses);
      const inicio = meses[0].inicio;
      const fim = meses[meses.length - 1].fim;
      const idx = new Map(meses.map((m, i) => [m.key, i]));
      const zeros = () => new Array(meses.length).fill(0);

      const [catRes, payRes, recRes, asaasRes, sgaRes] = await Promise.all([
        sb.from('categorias_financeiras').select('codigo, nome, fora_do_custo, ordem'),
        sb.from('contas_pagar').select('valor, valor_pago, status, conta_codigo, data_vencimento')
          .gte('data_vencimento', inicio).lte('data_vencimento', fim).limit(20000),
        sb.from('receitas').select('valor, data').gte('data', inicio).lte('data', fim).limit(20000),
        sb.from('asaas_cobrancas').select('pagamento_valor, data_vencimento')
          .gte('data_vencimento', inicio).lte('data_vencimento', fim).limit(20000),
        sb.from('cobrancas').select('valor_pago, data_vencimento')
          .gte('data_vencimento', inicio).lte('data_vencimento', fim).limit(20000),
      ]);

      const cats = (catRes.data ?? []) as any[];
      const info = new Map<string, { nome: string; fora: boolean; ordem: number }>();
      for (const c of cats) info.set(c.codigo, { nome: c.nome, fora: !!c.fora_do_custo, ordem: c.ordem });

      // Receita por mês
      const receita = zeros();
      for (const r of recRes.data ?? []) {
        const i = idx.get(ym(r.data) ?? '');
        if (i != null) receita[i] += Number(r.valor || 0);
      }
      for (const c of asaasRes.data ?? []) {
        const i = idx.get(ym(c.data_vencimento) ?? '');
        if (i != null) receita[i] += Number(c.pagamento_valor || 0);
      }
      for (const c of sgaRes.data ?? []) {
        const i = idx.get(ym(c.data_vencimento) ?? '');
        if (i != null) receita[i] += Number(c.valor_pago || 0);
      }

      // Despesas pagas por grupo e mês
      const pagas = (payRes.data ?? []).filter((p: any) => p.status === 'pago');
      const porGrupo = new Map<string, number[]>();
      const socios = zeros();
      const naoClass = zeros();
      for (const p of pagas) {
        const i = idx.get(ym(p.data_vencimento) ?? '');
        if (i == null) continue;
        const valor = Number(p.valor_pago || p.valor || 0);
        const g = grupoDe(p.conta_codigo);
        if (g && info.has(g)) {
          if (info.get(g)!.fora) { socios[i] += valor; continue; }
          if (!porGrupo.has(g)) porGrupo.set(g, zeros());
          porGrupo.get(g)![i] += valor;
        } else {
          naoClass[i] += valor;
        }
      }

      const grupos: LinhaGrupoDRE[] = Array.from(porGrupo.entries())
        .map(([codigo, valores]) => ({ codigo, nome: info.get(codigo)?.nome ?? codigo, valores }))
        .sort((a, b) => (info.get(a.codigo)?.ordem ?? 999) - (info.get(b.codigo)?.ordem ?? 999));
      if (naoClass.some((v) => v > 0)) grupos.push({ codigo: '—', nome: 'Não classificado', valores: naoClass });

      const despesaSemSocios = zeros();
      for (const g of grupos) g.valores.forEach((v, i) => { despesaSemSocios[i] += v; });

      const lucro = receita.map((r, i) => r - despesaSemSocios[i]);
      const caixaReal = receita.map((r, i) => r - despesaSemSocios[i] - socios[i]);
      const margem = receita.map((r, i) => (r > 0 ? (lucro[i] / r) * 100 : 0));

      return {
        meses: meses.map((m) => ({ key: m.key, label: m.label })),
        receita, grupos, despesaSemSocios, socios, lucro, caixaReal, margem,
      };
    },
  });
}
