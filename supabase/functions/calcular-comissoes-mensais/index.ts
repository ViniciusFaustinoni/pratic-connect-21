import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const agora = new Date();
    const mesAnterior = agora.getMonth() === 0 ? 12 : agora.getMonth();
    const anoAnterior = agora.getMonth() === 0 ? agora.getFullYear() - 1 : agora.getFullYear();
    const mesAtual = agora.getMonth() + 1;
    const anoAtual = agora.getFullYear();

    console.log(`[calcular-comissoes] Iniciando processamento - Mês anterior: ${mesAnterior}/${anoAnterior}, Mês atual: ${mesAtual}/${anoAtual}`);

    const resultados: Record<string, unknown> = { mesAnterior: null, mesAtual: null, inadimplencia: null };

    // 1. Processar mês anterior se campanha aberta
    const { data: campanhaAnterior, error: erroCampAnterior } = await supabase
      .from('comissoes_campanhas')
      .select('*')
      .eq('mes', mesAnterior)
      .eq('ano', anoAnterior)
      .maybeSingle();

    if (erroCampAnterior) {
      console.error('[calcular-comissoes] Erro ao buscar campanha anterior:', erroCampAnterior);
    }

    if (campanhaAnterior && campanhaAnterior.status === 'aberta') {
      console.log(`[calcular-comissoes] Executando fechamento para ${mesAnterior}/${anoAnterior}...`);
      
      const { data: fechamentoData, error: fechamentoError } = await supabase.rpc('fn_fechamento_mensal_comissoes', {
        p_mes: mesAnterior,
        p_ano: anoAnterior,
        p_usuario_id: null,
      });

      resultados.mesAnterior = {
        acao: 'fechamento_executado',
        resultado: fechamentoData,
        erro: fechamentoError?.message || null,
      };

      if (fechamentoError) {
        console.error('[calcular-comissoes] Erro no fechamento:', fechamentoError);
      } else {
        console.log('[calcular-comissoes] Fechamento concluído com sucesso');
      }
    } else {
      resultados.mesAnterior = { acao: 'nenhum_fechamento', status: campanhaAnterior?.status || 'sem_campanha' };
    }

    // 2. Criar campanha do mês atual se não existir
    const { data: campanhaAtual, error: erroCampAtual } = await supabase
      .from('comissoes_campanhas')
      .select('id')
      .eq('mes', mesAtual)
      .eq('ano', anoAtual)
      .maybeSingle();

    if (erroCampAtual) {
      console.error('[calcular-comissoes] Erro ao buscar campanha atual:', erroCampAtual);
    }

    if (!campanhaAtual) {
      const primeiroDia = new Date(anoAtual, mesAtual - 1, 1);
      const ultimoDia = new Date(anoAtual, mesAtual, 0);
      
      const { data: novaCampanha, error: erroNovaCamp } = await supabase
        .from('comissoes_campanhas')
        .insert({
          nome: `Campanha ${String(mesAtual).padStart(2, '0')}/${anoAtual}`,
          mes: mesAtual,
          ano: anoAtual,
          data_inicio: primeiroDia.toISOString().split('T')[0],
          data_fim: ultimoDia.toISOString().split('T')[0],
          status: 'aberta',
        })
        .select()
        .single();

      resultados.mesAtual = {
        acao: 'campanha_criada',
        resultado: novaCampanha,
        erro: erroNovaCamp?.message || null,
      };

      console.log('[calcular-comissoes] Nova campanha criada:', novaCampanha?.id);
    } else {
      resultados.mesAtual = { acao: 'campanha_existente', id: campanhaAtual.id };
    }

    // 3. Verificar inadimplência dos 2 primeiros boletos (60 dias)
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - 60);

    const { data: inadimplentes, error: erroInadimplentes } = await supabase
      .from('asaas_cobrancas')
      .select(`
        id, associado_id, contrato_id, valor, mes_referencia,
        contrato:contratos!asaas_cobrancas_contrato_id_fkey(vendedor_id)
      `)
      .eq('tipo', 'mensalidade')
      .in('status', ['PENDING', 'OVERDUE'])
      .lte('data_vencimento', dataLimite.toISOString().split('T')[0])
      .lte('mes_referencia', 2);

    if (erroInadimplentes) {
      console.error('[calcular-comissoes] Erro ao buscar inadimplentes:', erroInadimplentes);
    }

    let deducoesCriadas = 0;
    if (inadimplentes && inadimplentes.length > 0) {
      for (const cobranca of inadimplentes) {
        const vendedorId = (cobranca.contrato as any)?.vendedor_id;
        if (!vendedorId) continue;

        // Verificar se já existe dedução
        const { data: deducaoExistente } = await supabase
          .from('comissoes_deducoes')
          .select('id')
          .eq('cobranca_id', cobranca.id)
          .eq('tipo', 'inadimplencia_2_boletos')
          .maybeSingle();

        if (!deducaoExistente) {
          const { error: erroDeducao } = await supabase.from('comissoes_deducoes').insert({
            vendedor_id: vendedorId,
            tipo: 'inadimplencia_2_boletos',
            valor: cobranca.valor,
            contrato_id: cobranca.contrato_id,
            associado_id: cobranca.associado_id,
            cobranca_id: cobranca.id,
            descricao: `Inadimplência do ${cobranca.mes_referencia}º boleto - apuração 60 dias`,
            aplicada_em: new Date().toISOString(),
          });

          if (!erroDeducao) deducoesCriadas++;
        }
      }
    }

    resultados.inadimplencia = {
      boletos_verificados: inadimplentes?.length || 0,
      deducoes_criadas: deducoesCriadas,
    };

    console.log(`[calcular-comissoes] Processamento concluído. Deduções criadas: ${deducoesCriadas}`);

    return new Response(JSON.stringify({
      sucesso: true,
      timestamp: agora.toISOString(),
      resultados,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[calcular-comissoes] Erro geral:', error);
    return new Response(JSON.stringify({
      sucesso: false,
      erro: error.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
