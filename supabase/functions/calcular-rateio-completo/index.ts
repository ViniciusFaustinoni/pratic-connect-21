import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Mapeamento de benefício para campo de cobertura no veículo
const BENEFICIO_PARA_CAMPO: Record<string, { campo: string; condicao: string }> = {
  'colisao': { campo: 'cobertura_total', condicao: 'eq' },
  'roubo_furto': { campo: 'cobertura_roubo_furto', condicao: 'or_cobertura_total' },
  'incendio': { campo: 'cobertura_total', condicao: 'eq' },
  'vidros': { campo: 'cobertura_total', condicao: 'eq' },
  'terceiros': { campo: 'cobertura_total', condicao: 'eq' },
  'assistencia': { campo: 'cobertura_total', condicao: 'eq' },
};

interface RateioRequest {
  fechamento_id?: string;
  mes?: number;
  ano?: number;
  aprovar?: boolean;
  profile_id?: string;
}

interface DespesaRateio {
  id: string;
  tipo_beneficio: string;
  valor_total: number;
  total_cotas_elegivel: number;
  valor_por_cota: number;
  quantidade_eventos: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body: RateioRequest = await req.json().catch(() => ({}));
    
    let fechamentoId = body.fechamento_id;
    
    // Se não passou ID, buscar pelo mês/ano
    if (!fechamentoId && body.mes && body.ano) {
      const { data: fechamento, error } = await supabase
        .from('fechamentos_mensais')
        .select('id')
        .eq('mes', body.mes)
        .eq('ano', body.ano)
        .single();
      
      if (error || !fechamento) {
        throw new Error(`Fechamento não encontrado para ${body.mes}/${body.ano}`);
      }
      fechamentoId = fechamento.id;
    }

    if (!fechamentoId) {
      throw new Error('Informe fechamento_id ou mes/ano');
    }

    console.log(`[calcular-rateio] Calculando rateio para fechamento ${fechamentoId}`);

    // 1. Buscar fechamento e despesas
    const { data: fechamento, error: fechamentoError } = await supabase
      .from('fechamentos_mensais')
      .select('*')
      .eq('id', fechamentoId)
      .single();

    if (fechamentoError || !fechamento) {
      throw new Error(`Fechamento não encontrado: ${fechamentoError?.message}`);
    }

    if (fechamento.status === 'processado' && !body.aprovar) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Fechamento já foi processado. Não é possível recalcular.',
        fechamento
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: despesas, error: despesasError } = await supabase
      .from('despesas_rateio')
      .select('*')
      .eq('fechamento_id', fechamentoId);

    if (despesasError) {
      throw new Error(`Erro ao buscar despesas: ${despesasError.message}`);
    }

    console.log(`[calcular-rateio] ${despesas?.length || 0} tipos de despesa encontrados`);

    // 2. Para cada tipo de benefício, calcular cotas elegíveis e valor por cota
    const resultadosRateio: DespesaRateio[] = [];

    for (const despesa of (despesas || [])) {
      const tipoBeneficio = despesa.tipo_beneficio;
      
      // Buscar veículos/associados que têm este benefício ativo
      let query = supabase
        .from('veiculos')
        .select(`
          id,
          associado_id,
          quantidade_cotas,
          faixa_cota_id,
          cobertura_total,
          cobertura_roubo_furto,
          cobertura_vidros,
          cobertura_terceiros,
          cobertura_assistencia,
          faixas_cotas:faixa_cota_id (quantidade_cotas)
        `)
        .eq('status', 'ativo');

      // Aplicar filtro de cobertura específico por tipo de benefício
      if (tipoBeneficio === 'colisao' || tipoBeneficio === 'incendio') {
        query = query.eq('cobertura_total', true);
      } else if (tipoBeneficio === 'roubo_furto') {
        query = query.or('cobertura_roubo_furto.eq.true,cobertura_total.eq.true');
      } else if (tipoBeneficio === 'vidros') {
        query = query.eq('cobertura_vidros', true);
      } else if (tipoBeneficio === 'terceiros') {
        query = query.eq('cobertura_terceiros', true);
      } else if (tipoBeneficio === 'assistencia') {
        query = query.eq('cobertura_assistencia', true);
      } else if (tipoBeneficio === 'outros') {
        // "Outros" é rateado entre TODAS as cotas ativas (sem filtro de cobertura)
        // Não aplica nenhum filtro adicional
      }

      const { data: veiculosElegiveis, error: veiculosError } = await query;

      if (veiculosError) {
        console.error(`[calcular-rateio] Erro ao buscar veículos para ${tipoBeneficio}:`, veiculosError);
        continue;
      }

      // Somar cotas dos veículos elegíveis
      let totalCotasElegivel = 0;
      for (const veiculo of (veiculosElegiveis || [])) {
        const cotas = veiculo.quantidade_cotas || 
                      (veiculo.faixas_cotas as any)?.quantidade_cotas || 
                      1;
        totalCotasElegivel += cotas;
      }

      // Calcular valor por cota
      const valorPorCota = totalCotasElegivel > 0 
        ? despesa.valor_total / totalCotasElegivel 
        : 0;

      console.log(`[calcular-rateio] ${tipoBeneficio}: ${veiculosElegiveis?.length} veículos, ${totalCotasElegivel} cotas, R$ ${valorPorCota.toFixed(4)}/cota`);

      // Atualizar despesa com valores calculados
      const { error: updateError } = await supabase
        .from('despesas_rateio')
        .update({
          total_cotas_elegivel: totalCotasElegivel,
          valor_por_cota: valorPorCota,
        })
        .eq('id', despesa.id);

      if (updateError) {
        console.error(`[calcular-rateio] Erro ao atualizar despesa ${despesa.id}:`, updateError);
      }

      resultadosRateio.push({
        id: despesa.id,
        tipo_beneficio: tipoBeneficio,
        valor_total: despesa.valor_total,
        total_cotas_elegivel: totalCotasElegivel,
        valor_por_cota: valorPorCota,
        quantidade_eventos: despesa.quantidade_eventos,
      });
    }

    // 3. Se solicitado aprovar, atualizar status do fechamento
    if (body.aprovar) {
      const { error: aprovarError } = await supabase
        .from('fechamentos_mensais')
        .update({
          status: 'aprovado',
          aprovado_por: body.profile_id || null,
          aprovado_em: new Date().toISOString(),
        })
        .eq('id', fechamentoId);

      if (aprovarError) {
        throw new Error(`Erro ao aprovar fechamento: ${aprovarError.message}`);
      }
      console.log(`[calcular-rateio] Fechamento aprovado`);
    }

    // 4. Calcular totais para resposta
    const totalDespesas = resultadosRateio.reduce((acc, r) => acc + r.valor_total, 0);
    const valorMedioPorCota = fechamento.total_cotas_ativas > 0 
      ? totalDespesas / fechamento.total_cotas_ativas 
      : 0;

    return new Response(JSON.stringify({
      success: true,
      message: body.aprovar ? 'Rateio calculado e aprovado!' : 'Rateio calculado com sucesso',
      fechamento: {
        id: fechamentoId,
        mes: fechamento.mes,
        ano: fechamento.ano,
        status: body.aprovar ? 'aprovado' : fechamento.status,
        total_associados: fechamento.total_associados_ativos,
        total_cotas: fechamento.total_cotas_ativas,
      },
      rateio: {
        total_despesas: totalDespesas,
        valor_medio_por_cota: valorMedioPorCota,
        por_beneficio: resultadosRateio,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[calcular-rateio] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
