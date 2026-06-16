import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const sb = supabase as any;

export interface LinhaReceita { nome: string; valor: number; }
export interface LinhaGrupo { codigo: string; nome: string; valor: number; pct: number; }

export interface RelatorioCustosReceitas {
  receita: number;
  receitaPorCategoria: LinhaReceita[];
  despesaSemSocios: number;
  despesaComSocios: number;
  despesaSocios: number;
  lucro: number;
  caixaReal: number;
  gruposDespesa: LinhaGrupo[];
  sociosItens: LinhaGrupo[];
  naoClassificado: number;
}

function ultimoDia(ano: number, mes: number): string {
  const d = new Date(ano, mes, 0).getDate();
  return `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const grupoDe = (codigo: string | null): string | null => {
  if (!codigo) return null;
  return codigo.split('.').slice(0, 2).join('.'); // "2.08.16" -> "2.08"
};

export function useRelatorioCustosReceitas(ano: number, mes: number) {
  return useQuery({
    queryKey: ['relatorio-custos-receitas', ano, mes],
    queryFn: async (): Promise<RelatorioCustosReceitas> => {
      const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
      const fim = ultimoDia(ano, mes);

      const [catRes, payRes, recRes, asaasRes, sgaRes] = await Promise.all([
        sb.from('categorias_financeiras').select('codigo, nome, tipo, fora_do_custo, ordem'),
        sb.from('contas_pagar')
          .select('valor, valor_pago, status, categoria, conta_codigo, data_vencimento')
          .gte('data_vencimento', inicio).lte('data_vencimento', fim).limit(10000),
        sb.from('receitas').select('valor, categoria_nome, categoria_codigo, data')
          .gte('data', inicio).lte('data', fim).limit(10000),
        sb.from('asaas_cobrancas').select('pagamento_valor, data_vencimento')
          .gte('data_vencimento', inicio).lte('data_vencimento', fim).limit(10000),
        sb.from('cobrancas').select('valor_pago, data_vencimento')
          .gte('data_vencimento', inicio).lte('data_vencimento', fim).limit(10000),
      ]);

      const cats = (catRes.data ?? []) as any[];
      const grupoInfo = new Map<string, { nome: string; fora: boolean; ordem: number }>();
      for (const c of cats) {
        grupoInfo.set(c.codigo, { nome: c.nome, fora: !!c.fora_do_custo, ordem: c.ordem });
      }

      // ----- RECEITA -----
      const recPorCat = new Map<string, number>();
      for (const r of recRes.data ?? []) {
        const k = r.categoria_nome || r.categoria_codigo || 'Outros';
        recPorCat.set(k, (recPorCat.get(k) || 0) + Number(r.valor || 0));
      }
      const recAsaas = (asaasRes.data ?? []).reduce((a: number, c: any) => a + Number(c.pagamento_valor || 0), 0);
      const recSga = (sgaRes.data ?? []).reduce((a: number, c: any) => a + Number(c.valor_pago || 0), 0);
      if (recAsaas + recSga > 0) recPorCat.set('Cobranças ASAAS/SGA', recAsaas + recSga);

      const receitaPorCategoria = Array.from(recPorCat.entries())
        .map(([nome, valor]) => ({ nome, valor }))
        .sort((a, b) => b.valor - a.valor);
      const receita = receitaPorCategoria.reduce((a, l) => a + l.valor, 0);

      // ----- DESPESAS (pagas) agrupadas por grupo do plano de contas -----
      const pagas = (payRes.data ?? []).filter((p: any) => p.status === 'pago');
      const porGrupo = new Map<string, number>();
      let naoClassificado = 0;
      for (const p of pagas) {
        const valor = Number(p.valor_pago || p.valor || 0);
        const g = grupoDe(p.conta_codigo);
        if (g && grupoInfo.has(g)) porGrupo.set(g, (porGrupo.get(g) || 0) + valor);
        else naoClassificado += valor;
      }

      const todasLinhas: LinhaGrupo[] = Array.from(porGrupo.entries()).map(([codigo, valor]) => ({
        codigo, nome: grupoInfo.get(codigo)?.nome ?? codigo, valor, pct: 0,
      }));

      const sociosItens = todasLinhas.filter((l) => grupoInfo.get(l.codigo)?.fora);
      const gruposDespesa = todasLinhas
        .filter((l) => !grupoInfo.get(l.codigo)?.fora)
        .sort((a, b) => b.valor - a.valor);

      if (naoClassificado > 0) {
        gruposDespesa.push({ codigo: '—', nome: 'Não classificado', valor: naoClassificado, pct: 0 });
      }

      const despesaSocios = sociosItens.reduce((a, l) => a + l.valor, 0);
      const despesaSemSocios = gruposDespesa.reduce((a, l) => a + l.valor, 0);
      const despesaComSocios = despesaSemSocios + despesaSocios;

      // % sobre despesas (sem sócios)
      for (const l of gruposDespesa) l.pct = despesaSemSocios > 0 ? (l.valor / despesaSemSocios) * 100 : 0;

      return {
        receita,
        receitaPorCategoria,
        despesaSemSocios,
        despesaComSocios,
        despesaSocios,
        lucro: receita - despesaSemSocios,
        caixaReal: receita - despesaComSocios,
        gruposDespesa,
        sociosItens,
        naoClassificado,
      };
    },
  });
}
