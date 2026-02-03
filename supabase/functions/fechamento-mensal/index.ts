import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Tipos de benefícios para rateio
const TIPOS_BENEFICIO = [
  'colisao',
  'roubo_furto', 
  'incendio',
  'vidros',
  'terceiros',
  'assistencia'
] as const;

// Mapeamento de tipos de sinistro para benefício
// Todos os tipos conhecidos devem estar mapeados para garantir cálculo correto
const SINISTRO_PARA_BENEFICIO: Record<string, string> = {
  // Colisão
  'colisao_parcial': 'colisao',
  'colisao_total': 'colisao',
  'colisao': 'colisao',
  'fenomeno_natural': 'colisao', // Granizo, alagamento, queda de árvore
  'vandalismo': 'colisao',       // Vandalismo entra como colisão
  'outro': 'colisao',            // Outros tipos não especificados
  
  // Roubo/Furto
  'roubo': 'roubo_furto',
  'furto': 'roubo_furto',
  'roubo_furto': 'roubo_furto',
  
  // Outros benefícios específicos
  'incendio': 'incendio',
  'vidros': 'vidros',
  'terceiros': 'terceiros',
  'assistencia': 'assistencia',
};

interface FechamentoRequest {
  mes?: number;
  ano?: number;
  forcar?: boolean;
  auto?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body: FechamentoRequest = await req.json().catch(() => ({}));
    
    // Determinar mês/ano de referência (mês ANTERIOR ao atual)
    const dataReferencia = new Date();
    dataReferencia.setMonth(dataReferencia.getMonth() - 1);
    
    const mes = body.mes || dataReferencia.getMonth() + 1;
    const ano = body.ano || dataReferencia.getFullYear();
    
    console.log(`[fechamento-mensal] Iniciando fechamento para ${mes}/${ano}`);

    // Verificar se já existe fechamento para este período
    const { data: fechamentoExistente, error: checkError } = await supabase
      .from('fechamentos_mensais')
      .select('*')
      .eq('mes', mes)
      .eq('ano', ano)
      .maybeSingle();

    if (checkError) {
      throw new Error(`Erro ao verificar fechamento: ${checkError.message}`);
    }

    // Se já existe e não está aberto, verificar se pode sobrescrever
    if (fechamentoExistente) {
      if (fechamentoExistente.status !== 'aberto' && !body.forcar) {
        return new Response(JSON.stringify({
          success: false,
          message: `Fechamento ${mes}/${ano} já existe com status "${fechamentoExistente.status}". Use forcar=true para recalcular.`,
          fechamento: fechamentoExistente
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Definir período para apuração
    const inicioMes = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const fimMes = new Date(ano, mes, 0).toISOString().split('T')[0];
    
    console.log(`[fechamento-mensal] Período: ${inicioMes} a ${fimMes}`);

    // 1. Buscar sinistros aprovados/indenizados do período
    const { data: sinistros, error: sinistrosError } = await supabase
      .from('sinistros')
      .select(`
        id, 
        tipo, 
        tipo_dano,
        valor_indenizacao, 
        data_ocorrencia, 
        associado_id, 
        veiculo_id
      `)
      .in('status', ['aprovado', 'indenizado', 'pago'])
      .gte('data_ocorrencia', inicioMes)
      .lte('data_ocorrencia', fimMes);

    if (sinistrosError) {
      throw new Error(`Erro ao buscar sinistros: ${sinistrosError.message}`);
    }

    console.log(`[fechamento-mensal] ${sinistros?.length || 0} sinistros encontrados`);

    // 1.1 Buscar Ordens de Serviço pagas vinculadas aos sinistros do período
    const sinistrosIds = (sinistros || []).map(s => s.id);
    let valorPagoPorSinistro: Record<string, number> = {};
    let ordensServicoIds: Record<string, string[]> = {};
    
    if (sinistrosIds.length > 0) {
      const { data: ordensServico, error: osError } = await supabase
        .from('ordens_servico')
        .select('id, sinistro_id, valor_pago, status')
        .in('sinistro_id', sinistrosIds)
        .in('status', ['concluido', 'pago', 'aprovado']);

      if (osError) {
        console.error('[fechamento-mensal] Erro ao buscar OS:', osError);
      } else {
        // Criar mapa de valor pago por sinistro
        for (const os of (ordensServico || [])) {
          if (os.sinistro_id && os.valor_pago) {
            valorPagoPorSinistro[os.sinistro_id] = 
              (valorPagoPorSinistro[os.sinistro_id] || 0) + os.valor_pago;
            
            // Guardar IDs das OS para rastreabilidade
            if (!ordensServicoIds[os.sinistro_id]) {
              ordensServicoIds[os.sinistro_id] = [];
            }
            ordensServicoIds[os.sinistro_id].push(os.id);
          }
        }
        console.log(`[fechamento-mensal] ${ordensServico?.length || 0} ordens de serviço encontradas`);
      }
    }

    // 2. Agrupar despesas por tipo de benefício
    const despesasPorBeneficio: Record<string, { valor: number; quantidade: number; sinistros_ids: string[]; ordens_servico_ids: string[] }> = {};
    
    for (const tipo of TIPOS_BENEFICIO) {
      despesasPorBeneficio[tipo] = { valor: 0, quantidade: 0, sinistros_ids: [], ordens_servico_ids: [] };
    }

    // Contadores para detalhamento
    let totalIndenizacoes = 0;
    let totalReparosOficina = 0;

    for (const sinistro of (sinistros || [])) {
      const beneficio = SINISTRO_PARA_BENEFICIO[sinistro.tipo];
      if (beneficio && despesasPorBeneficio[beneficio]) {
        // Determinar valor do custo baseado no tipo de dano
        let valorCusto = 0;
        let fonteValor = 'indenizacao';
        
        const valorOS = valorPagoPorSinistro[sinistro.id] || 0;
        const valorIndenizacao = sinistro.valor_indenizacao || 0;
        
        if (sinistro.tipo_dano === 'perda_total') {
          // Perda total: usar valor de indenização
          valorCusto = valorIndenizacao;
          totalIndenizacoes += valorCusto;
          fonteValor = 'indenizacao';
        } else if (sinistro.tipo_dano === 'parcial') {
          // Dano parcial: priorizar valor pago das OS
          if (valorOS > 0) {
            valorCusto = valorOS;
            totalReparosOficina += valorCusto;
            fonteValor = 'ordem_servico';
          } else {
            valorCusto = valorIndenizacao;
            totalIndenizacoes += valorCusto;
            fonteValor = 'indenizacao_fallback';
          }
        } else {
          // Fallback (tipo_dano NULL): verificar se há OS paga, senão usar valor_indenizacao
          if (valorOS > 0) {
            valorCusto = valorOS;
            totalReparosOficina += valorCusto;
            fonteValor = 'ordem_servico';
          } else {
            valorCusto = valorIndenizacao;
            totalIndenizacoes += valorCusto;
            fonteValor = 'indenizacao';
          }
        }
        
        console.log(`[fechamento-mensal] Sinistro ${sinistro.id}: tipo=${sinistro.tipo}, tipo_dano=${sinistro.tipo_dano || 'null'}, valor_indenizacao=${valorIndenizacao}, valor_os=${valorOS}, valor_usado=${valorCusto}, fonte=${fonteValor}`);
        
        despesasPorBeneficio[beneficio].valor += valorCusto;
        despesasPorBeneficio[beneficio].quantidade += 1;
        despesasPorBeneficio[beneficio].sinistros_ids.push(sinistro.id);
        
        // Adicionar IDs das OS usadas
        if (ordensServicoIds[sinistro.id]) {
          despesasPorBeneficio[beneficio].ordens_servico_ids.push(...ordensServicoIds[sinistro.id]);
        }
      }
    }

    // 3. Contar associados ativos e total de cotas
    const { data: associadosAtivos, error: associadosError } = await supabase
      .from('associados')
      .select('id')
      .eq('status', 'ativo');

    if (associadosError) {
      throw new Error(`Erro ao contar associados: ${associadosError.message}`);
    }

    // Buscar total de cotas via RPC ou calculando
    const { data: totalCotasData, error: cotasError } = await supabase
      .rpc('fn_calcular_total_cotas_ativos');

    const totalCotas = totalCotasData || 0;
    const totalAssociados = associadosAtivos?.length || 0;

    console.log(`[fechamento-mensal] ${totalAssociados} associados ativos, ${totalCotas} cotas`);

    // 4. Calcular totais gerais
    const totalDespesasRateio = Object.values(despesasPorBeneficio)
      .reduce((acc, d) => acc + d.valor, 0);

    // 5. Criar ou atualizar fechamento
    const fechamentoData = {
      mes,
      ano,
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

      if (updateError) {
        throw new Error(`Erro ao atualizar fechamento: ${updateError.message}`);
      }
      fechamentoId = fechamentoExistente.id;

      // Limpar despesas antigas
      await supabase
        .from('despesas_rateio')
        .delete()
        .eq('fechamento_id', fechamentoId);
    } else {
      const { data: novoFechamento, error: insertError } = await supabase
        .from('fechamentos_mensais')
        .insert(fechamentoData)
        .select()
        .single();

      if (insertError) {
        throw new Error(`Erro ao criar fechamento: ${insertError.message}`);
      }
      fechamentoId = novoFechamento.id;
    }

    // 6. Inserir despesas por benefício
    const despesasParaInserir = Object.entries(despesasPorBeneficio)
      .filter(([_, d]) => d.valor > 0 || d.quantidade > 0)
      .map(([tipo, d]) => ({
        fechamento_id: fechamentoId,
        tipo_beneficio: tipo,
        valor_total: d.valor,
        quantidade_eventos: d.quantidade,
        sinistros_ids: d.sinistros_ids,
      }));

    if (despesasParaInserir.length > 0) {
      const { error: despesasError } = await supabase
        .from('despesas_rateio')
        .insert(despesasParaInserir);

      if (despesasError) {
        throw new Error(`Erro ao inserir despesas: ${despesasError.message}`);
      }
    }

    console.log(`[fechamento-mensal] Fechamento ${mes}/${ano} concluído com sucesso`);

    // Buscar fechamento atualizado
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
        periodo: `${inicioMes} a ${fimMes}`,
        associados_ativos: totalAssociados,
        total_cotas: totalCotas,
        total_despesas: totalDespesasRateio,
        sinistros_apurados: sinistros?.length || 0,
        despesas_por_beneficio: despesasPorBeneficio,
        custos_detalhados: {
          indenizacoes: totalIndenizacoes,
          reparos_oficina: totalReparosOficina,
          total: totalDespesasRateio,
        }
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[fechamento-mensal] Erro:', error);
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
