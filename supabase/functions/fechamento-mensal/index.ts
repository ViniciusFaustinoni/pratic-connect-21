import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const TIPOS_BENEFICIO = ['colisao', 'roubo_furto', 'incendio', 'vidros', 'terceiros', 'assistencia'] as const;

const SINISTRO_PARA_BENEFICIO: Record<string, string> = {
  'colisao_parcial': 'colisao', 'colisao_total': 'colisao', 'colisao': 'colisao',
  'fenomeno_natural': 'colisao', 'vandalismo': 'colisao', 'outro': 'colisao',
  'roubo': 'roubo_furto', 'furto': 'roubo_furto', 'roubo_furto': 'roubo_furto',
  'incendio': 'incendio', 'vidros': 'vidros', 'terceiros': 'terceiros', 'assistencia': 'assistencia',
};

interface DespesasManuais {
  colisao?: number;
  roubo_furto?: number;
  assistencia?: number;
  terceiros?: number;
  vidros?: number;
  outros?: number;
}

interface FechamentoRequest {
  mes?: number;
  ano?: number;
  forcar?: boolean;
  auto?: boolean;
  despesas_manuais?: DespesasManuais;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body: FechamentoRequest = await req.json().catch(() => ({}));
    
    const dataReferencia = new Date();
    dataReferencia.setMonth(dataReferencia.getMonth() - 1);
    
    const mes = body.mes || dataReferencia.getMonth() + 1;
    const ano = body.ano || dataReferencia.getFullYear();
    
    console.log(`[fechamento-mensal] Iniciando fechamento para ${mes}/${ano}`);

    // Verificar fechamento existente
    const { data: fechamentoExistente, error: checkError } = await supabase
      .from('fechamentos_mensais')
      .select('*')
      .eq('mes', mes)
      .eq('ano', ano)
      .maybeSingle();

    if (checkError) throw new Error(`Erro ao verificar fechamento: ${checkError.message}`);

    if (fechamentoExistente && fechamentoExistente.status !== 'aberto' && !body.forcar) {
      return new Response(JSON.stringify({
        success: false,
        message: `Fechamento ${mes}/${ano} já existe com status "${fechamentoExistente.status}". Use forcar=true para recalcular.`,
        fechamento: fechamentoExistente
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Determinar despesas: manual ou automático
    const usarDespesasManuais = body.despesas_manuais && Object.values(body.despesas_manuais).some(v => (v ?? 0) > 0);
    
    let despesasPorBeneficio: Record<string, { valor: number; quantidade: number; sinistros_ids: string[]; ordens_servico_ids: string[] }> = {};
    let totalIndenizacoes = 0;
    let totalReparosOficina = 0;
    let sinistrosApurados = 0;

    if (usarDespesasManuais) {
      // ===== MODO MANUAL =====
      console.log('[fechamento-mensal] Usando despesas manuais');
      const dm = body.despesas_manuais!;
      
      // Mapear categorias manuais para tipos de benefício
      const mapeamento: Record<string, string> = {
        colisao: 'colisao',
        roubo_furto: 'roubo_furto',
        assistencia: 'assistencia',
        terceiros: 'terceiros',
        vidros: 'vidros',
        outros: 'outros',
      };

      for (const [chave, tipo] of Object.entries(mapeamento)) {
        const valor = (dm as any)[chave] ?? 0;
        if (valor > 0) {
          despesasPorBeneficio[tipo] = { valor, quantidade: 0, sinistros_ids: [], ordens_servico_ids: [] };
        }
      }
    } else {
      // ===== MODO AUTOMÁTICO (comportamento original) =====
      console.log('[fechamento-mensal] Usando apuração automática de sinistros');
      
      const inicioMes = `${ano}-${String(mes).padStart(2, '0')}-01`;
      const fimMes = new Date(ano, mes, 0).toISOString().split('T')[0];

      const { data: sinistros, error: sinistrosError } = await supabase
        .from('sinistros')
        .select('id, tipo, tipo_dano, valor_indenizacao, data_ocorrencia, associado_id, veiculo_id')
        .in('status', ['aprovado', 'indenizado', 'pago'])
        .gte('data_ocorrencia', inicioMes)
        .lte('data_ocorrencia', fimMes);

      if (sinistrosError) throw new Error(`Erro ao buscar sinistros: ${sinistrosError.message}`);
      sinistrosApurados = sinistros?.length || 0;

      // Buscar OS pagas
      const sinistrosIds = (sinistros || []).map(s => s.id);
      let valorPagoPorSinistro: Record<string, number> = {};
      let ordensServicoIds: Record<string, string[]> = {};
      
      if (sinistrosIds.length > 0) {
        const { data: ordensServico } = await supabase
          .from('ordens_servico')
          .select('id, sinistro_id, valor_pago, status')
          .in('sinistro_id', sinistrosIds)
          .in('status', ['concluido', 'pago', 'aprovado']);

        for (const os of (ordensServico || [])) {
          if (os.sinistro_id && os.valor_pago) {
            valorPagoPorSinistro[os.sinistro_id] = (valorPagoPorSinistro[os.sinistro_id] || 0) + os.valor_pago;
            if (!ordensServicoIds[os.sinistro_id]) ordensServicoIds[os.sinistro_id] = [];
            ordensServicoIds[os.sinistro_id].push(os.id);
          }
        }
      }

      for (const tipo of TIPOS_BENEFICIO) {
        despesasPorBeneficio[tipo] = { valor: 0, quantidade: 0, sinistros_ids: [], ordens_servico_ids: [] };
      }

      for (const sinistro of (sinistros || [])) {
        const beneficio = SINISTRO_PARA_BENEFICIO[sinistro.tipo];
        if (!beneficio || !despesasPorBeneficio[beneficio]) continue;

        let valorCusto = 0;
        const valorOS = valorPagoPorSinistro[sinistro.id] || 0;
        const valorIndenizacao = sinistro.valor_indenizacao || 0;

        if (sinistro.tipo_dano === 'perda_total') {
          valorCusto = valorIndenizacao;
          totalIndenizacoes += valorCusto;
        } else if (valorOS > 0) {
          valorCusto = valorOS;
          totalReparosOficina += valorCusto;
        } else {
          valorCusto = valorIndenizacao;
          totalIndenizacoes += valorCusto;
        }

        despesasPorBeneficio[beneficio].valor += valorCusto;
        despesasPorBeneficio[beneficio].quantidade += 1;
        despesasPorBeneficio[beneficio].sinistros_ids.push(sinistro.id);
        if (ordensServicoIds[sinistro.id]) {
          despesasPorBeneficio[beneficio].ordens_servico_ids.push(...ordensServicoIds[sinistro.id]);
        }
      }
    }

    // Contar associados ativos e cotas
    const { data: associadosAtivos, error: associadosError } = await supabase
      .from('associados')
      .select('id')
      .eq('status', 'ativo');

    if (associadosError) throw new Error(`Erro ao contar associados: ${associadosError.message}`);

    const { data: totalCotasData } = await supabase.rpc('fn_calcular_total_cotas_ativos');
    const totalCotas = totalCotasData || 0;
    const totalAssociados = associadosAtivos?.length || 0;

    const totalDespesasRateio = Object.values(despesasPorBeneficio).reduce((acc, d) => acc + d.valor, 0);

    // Criar ou atualizar fechamento
    const fechamentoData = {
      mes, ano,
      status: 'fechado',
      total_associados_ativos: totalAssociados,
      total_cotas_ativas: totalCotas,
      total_despesas_rateio: totalDespesasRateio,
      fechado_em: new Date().toISOString(),
    };

    let fechamentoId: string;

    if (fechamentoExistente) {
      const { error: updateError } = await supabase
        .from('fechamentos_mensais')
        .update(fechamentoData)
        .eq('id', fechamentoExistente.id);
      if (updateError) throw new Error(`Erro ao atualizar fechamento: ${updateError.message}`);
      fechamentoId = fechamentoExistente.id;
      await supabase.from('despesas_rateio').delete().eq('fechamento_id', fechamentoId);
    } else {
      const { data: novoFechamento, error: insertError } = await supabase
        .from('fechamentos_mensais')
        .insert(fechamentoData)
        .select()
        .single();
      if (insertError) throw new Error(`Erro ao criar fechamento: ${insertError.message}`);
      fechamentoId = novoFechamento.id;
    }

    // Inserir despesas por benefício
    const despesasParaInserir = Object.entries(despesasPorBeneficio)
      .filter(([_, d]) => d.valor > 0)
      .map(([tipo, d]) => ({
        fechamento_id: fechamentoId,
        tipo_beneficio: tipo,
        valor_total: d.valor,
        quantidade_eventos: d.quantidade,
        sinistros_ids: d.sinistros_ids,
      }));

    if (despesasParaInserir.length > 0) {
      const { error: despError } = await supabase.from('despesas_rateio').insert(despesasParaInserir);
      if (despError) throw new Error(`Erro ao inserir despesas: ${despError.message}`);
    }

    console.log(`[fechamento-mensal] Fechamento ${mes}/${ano} concluído`);

    const { data: fechamentoFinal } = await supabase
      .from('fechamentos_mensais')
      .select('*, despesas_rateio(*)')
      .eq('id', fechamentoId)
      .single();

    return new Response(JSON.stringify({
      success: true,
      message: `Fechamento ${mes}/${ano} realizado com sucesso`,
      fechamento: fechamentoFinal,
      resumo: {
        associados_ativos: totalAssociados,
        total_cotas: totalCotas,
        total_despesas: totalDespesasRateio,
        modo: usarDespesasManuais ? 'manual' : 'automatico',
        sinistros_apurados: sinistrosApurados,
        despesas_por_beneficio: despesasPorBeneficio,
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    console.error('[fechamento-mensal] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
