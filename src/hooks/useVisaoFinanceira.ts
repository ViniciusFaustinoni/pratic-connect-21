import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const sb = supabase as any;

export interface LinhaCategoria {
  categoria: string;
  total: number;
}

export interface LinhaEmpresa {
  id: string;
  nome: string;
  tipo: 'associacao' | 'ltda';
  papel: string;
  receita: number;        // receita direta (Pratic) ou repasse sugerido (LTDA)
  despesas: number;       // despesas pagas pela empresa no período
  repassesSaida: number;  // repasses sugeridos da Pratic para as LTDAs
  resultado: number;
  ehSugestao: boolean;    // true quando a receita é repasse sugerido (sem repasse real)
}

export interface VisaoFinanceira {
  receita: number;
  despesaTotal: number;
  resultado: number;
  porCategoria: LinhaCategoria[];
  porEmpresa: LinhaEmpresa[];
}

function ultimoDia(ano: number, mes: number): string {
  const d = new Date(ano, mes, 0).getDate();
  return `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function useVisaoFinanceira(ano: number, mes: number) {
  return useQuery({
    queryKey: ['visao-financeira', ano, mes],
    queryFn: async (): Promise<VisaoFinanceira> => {
      const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
      const fim = ultimoDia(ano, mes);

      const [empresasRes, asaasRes, sgaRes, payRes] = await Promise.all([
        sb.from('empresas').select('id, nome, tipo, papel, percentual_rateio, ativo'),
        sb.from('asaas_cobrancas')
          .select('pagamento_valor, status, data_vencimento')
          .gte('data_vencimento', inicio).lte('data_vencimento', fim).limit(10000),
        sb.from('cobrancas')
          .select('valor_pago, status, data_vencimento')
          .gte('data_vencimento', inicio).lte('data_vencimento', fim).limit(10000),
        sb.from('contas_pagar')
          .select('valor, valor_pago, status, categoria, empresa_id, data_vencimento')
          .gte('data_vencimento', inicio).lte('data_vencimento', fim).limit(10000),
      ]);

      const empresas = (empresasRes.data ?? []).filter((e: any) => e.ativo);

      // Receita recebida no período (ASAAS + SGA)
      const receita =
        (asaasRes.data ?? []).reduce((a: number, c: any) => a + Number(c.pagamento_valor || 0), 0) +
        (sgaRes.data ?? []).reduce((a: number, c: any) => a + Number(c.valor_pago || 0), 0);

      // Despesas pagas no período
      const pagas = (payRes.data ?? []).filter((p: any) => p.status === 'pago');
      const despesaTotal = pagas.reduce((a: number, p: any) => a + Number(p.valor_pago || p.valor || 0), 0);

      // Por categoria (visão consolidada)
      const catMap = new Map<string, number>();
      for (const p of pagas) {
        const k = p.categoria || 'outros';
        catMap.set(k, (catMap.get(k) || 0) + Number(p.valor_pago || p.valor || 0));
      }
      const porCategoria = Array.from(catMap.entries())
        .map(([categoria, total]) => ({ categoria, total }))
        .sort((a, b) => b.total - a.total);

      // Despesas por empresa
      const despPorEmpresa = new Map<string, number>();
      for (const p of pagas) {
        if (!p.empresa_id) continue;
        despPorEmpresa.set(p.empresa_id, (despPorEmpresa.get(p.empresa_id) || 0) + Number(p.valor_pago || p.valor || 0));
      }

      const associacao = empresas.find((e: any) => e.papel === 'associacao' || e.tipo === 'associacao');
      const despesaAssoc = associacao ? (despPorEmpresa.get(associacao.id) || 0) : 0;
      const disponivelRateio = Math.max(receita - despesaAssoc, 0);

      const ltdas = empresas.filter((e: any) => e.tipo === 'ltda');

      const porEmpresa: LinhaEmpresa[] = [];

      // Repasses sugeridos (% do disponível)
      let totalRepasses = 0;
      const repasseDe = new Map<string, number>();
      for (const e of ltdas) {
        const r = (Number(e.percentual_rateio || 0) / 100) * disponivelRateio;
        repasseDe.set(e.id, r);
        totalRepasses += r;
      }

      // Linha da associação (Pratic)
      if (associacao) {
        porEmpresa.push({
          id: associacao.id, nome: associacao.nome, tipo: 'associacao', papel: associacao.papel,
          receita,
          despesas: despesaAssoc,
          repassesSaida: totalRepasses,
          resultado: receita - despesaAssoc - totalRepasses,
          ehSugestao: true,
        });
      }

      // Linhas das LTDAs
      for (const e of ltdas) {
        const repasse = repasseDe.get(e.id) || 0;
        const desp = despPorEmpresa.get(e.id) || 0;
        porEmpresa.push({
          id: e.id, nome: e.nome, tipo: 'ltda', papel: e.papel,
          receita: repasse,
          despesas: desp,
          repassesSaida: 0,
          resultado: repasse - desp,
          ehSugestao: true,
        });
      }

      return {
        receita,
        despesaTotal,
        resultado: receita - despesaTotal,
        porCategoria,
        porEmpresa,
      };
    },
  });
}
