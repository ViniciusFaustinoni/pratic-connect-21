import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const sb = supabase as any;

export interface DistribuicaoParametros {
  id?: string;
  percentual_caixa: number;
  dl_minimo: number;
  pro_labore: number;
  aliquota_ir: number;
  num_socios: number;
}

export interface DistribuicaoSocio {
  id?: string;
  socio_id: string | null;
  socio_nome: string;
  cota_lucro: number;
  pro_labore: number;
  dl_minimo: number;
  ir_valor: number;
  valor_liquido: number;
}

export interface Distribuicao {
  id: string;
  ano: number;
  mes: number;
  receita_total: number;
  despesa_total: number;
  lucro: number;
  percentual_caixa: number;
  valor_caixa: number;
  valor_distribuivel: number;
  num_socios: number;
  valor_por_socio: number;
  pro_labore: number;
  dl_minimo: number;
  aliquota_ir: number;
  status: 'rascunho' | 'fechado';
  observacao: string | null;
  fechado_em: string | null;
}

function ultimoDia(ano: number, mes: number): string {
  const d = new Date(ano, mes, 0).getDate();
  return `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

async function calcularReceitaDespesa(ano: number, mes: number) {
  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const fim = ultimoDia(ano, mes);

  const [asaasRes, sgaRes, payRes] = await Promise.all([
    sb.from('asaas_cobrancas').select('pagamento_valor, data_vencimento')
      .gte('data_vencimento', inicio).lte('data_vencimento', fim).limit(10000),
    sb.from('cobrancas').select('valor_pago, data_vencimento')
      .gte('data_vencimento', inicio).lte('data_vencimento', fim).limit(10000),
    sb.from('contas_pagar').select('valor, valor_pago, status, data_vencimento')
      .gte('data_vencimento', inicio).lte('data_vencimento', fim).limit(10000),
  ]);

  const receita =
    (asaasRes.data ?? []).reduce((a: number, c: any) => a + Number(c.pagamento_valor || 0), 0) +
    (sgaRes.data ?? []).reduce((a: number, c: any) => a + Number(c.valor_pago || 0), 0);
  const despesa = (payRes.data ?? [])
    .filter((p: any) => p.status === 'pago')
    .reduce((a: number, p: any) => a + Number(p.valor_pago || p.valor || 0), 0);

  return { receita, despesa };
}

export function useDistribuicaoParametros() {
  return useQuery({
    queryKey: ['distribuicao-parametros'],
    queryFn: async (): Promise<DistribuicaoParametros> => {
      const { data } = await sb.from('distribuicao_parametros').select('*').limit(1).maybeSingle();
      return (data ?? {
        percentual_caixa: 20, dl_minimo: 45000, pro_labore: 6070.73, aliquota_ir: 0, num_socios: 3,
      }) as DistribuicaoParametros;
    },
  });
}

export function useSalvarParametros() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: DistribuicaoParametros) => {
      const payload = { ...p, updated_at: new Date().toISOString() };
      if (p.id) {
        const { error } = await sb.from('distribuicao_parametros').update(payload).eq('id', p.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from('distribuicao_parametros').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Parâmetros salvos!');
      qc.invalidateQueries({ queryKey: ['distribuicao-parametros'] });
    },
    onError: () => toast.error('Erro ao salvar parâmetros'),
  });
}

export function useDistribuicaoMes(ano: number, mes: number) {
  return useQuery({
    queryKey: ['distribuicao', ano, mes],
    queryFn: async (): Promise<{ dist: Distribuicao | null; socios: DistribuicaoSocio[] }> => {
      const { data: dist } = await sb.from('distribuicoes_lucro')
        .select('*').eq('ano', ano).eq('mes', mes).maybeSingle();
      if (!dist) return { dist: null, socios: [] };
      const { data: socios } = await sb.from('distribuicao_lucro_socios')
        .select('*').eq('distribuicao_id', dist.id).order('socio_nome');
      return { dist: dist as Distribuicao, socios: (socios ?? []) as DistribuicaoSocio[] };
    },
  });
}

export function useGerarDistribuicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      ano: number; mes: number; parametros: DistribuicaoParametros; percentualCaixaOverride?: number;
    }) => {
      const { ano, mes, parametros } = params;
      const { receita, despesa } = await calcularReceitaDespesa(ano, mes);
      const lucro = receita - despesa;

      const percentualCaixa = params.percentualCaixaOverride ?? parametros.percentual_caixa;
      const valorCaixa = Math.max(lucro, 0) * (percentualCaixa / 100);
      const distribuivel = lucro - valorCaixa;

      // Sócios reais
      const { data: sociosData } = await sb.rpc('listar_socios');
      const socios: { id: string; nome: string }[] = sociosData ?? [];
      const n = socios.length > 0 ? socios.length : parametros.num_socios;
      const porSocio = n > 0 ? distribuivel / n : 0;
      const ir = porSocio > 0 ? porSocio * (parametros.aliquota_ir / 100) : 0;
      const liquido = porSocio - ir;

      // upsert do fechamento
      const { data: dist, error: e1 } = await sb.from('distribuicoes_lucro')
        .upsert({
          ano, mes,
          receita_total: receita, despesa_total: despesa, lucro,
          percentual_caixa: percentualCaixa, valor_caixa: valorCaixa, valor_distribuivel: distribuivel,
          num_socios: n, valor_por_socio: porSocio,
          pro_labore: parametros.pro_labore, dl_minimo: parametros.dl_minimo, aliquota_ir: parametros.aliquota_ir,
          status: 'rascunho', updated_at: new Date().toISOString(),
        }, { onConflict: 'ano,mes' })
        .select().single();
      if (e1) throw e1;

      // recria as cotas por sócio
      await sb.from('distribuicao_lucro_socios').delete().eq('distribuicao_id', dist.id);
      const linhas = (socios.length > 0 ? socios : Array.from({ length: n }, (_, i) => ({ id: null, nome: `Sócio ${i + 1}` })))
        .map((s: any) => ({
          distribuicao_id: dist.id,
          socio_id: s.id,
          socio_nome: s.nome,
          cota_lucro: porSocio,
          pro_labore: parametros.pro_labore,
          dl_minimo: parametros.dl_minimo,
          ir_valor: ir,
          valor_liquido: liquido,
        }));
      const { error: e2 } = await sb.from('distribuicao_lucro_socios').insert(linhas);
      if (e2) throw e2;

      return dist;
    },
    onSuccess: (_d, vars) => {
      toast.success('Distribuição calculada!');
      qc.invalidateQueries({ queryKey: ['distribuicao', vars.ano, vars.mes] });
      qc.invalidateQueries({ queryKey: ['distribuicoes'] });
    },
    onError: () => toast.error('Erro ao calcular distribuição'),
  });
}

export function useFecharDistribuicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; ano: number; mes: number }) => {
      const { error } = await sb.from('distribuicoes_lucro')
        .update({ status: 'fechado', fechado_em: new Date().toISOString() })
        .eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success('Mês fechado!');
      qc.invalidateQueries({ queryKey: ['distribuicao', vars.ano, vars.mes] });
    },
    onError: () => toast.error('Erro ao fechar mês'),
  });
}

// Dispara o resumo no WhatsApp dos sócios (fire-and-forget)
export function enviarResumoDistribuicao(distribuicaoId: string) {
  return supabase.functions
    .invoke('notificar-distribuicao-lucro', { body: { distribuicao_id: distribuicaoId } })
    .catch((e) => console.warn('[distribuicao] falha ao enviar resumo:', e));
}
