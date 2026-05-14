// Aplica a conclusão final quando AMBAS as etapas do link de vistoria foram concluídas.
// Marca vistoria=aprovada, instalacao=concluida, encerra serviço/agendamento, propaga
// para cotação/contrato (sem ativar o associado e SEM disparar SGA — isso continua
// acontecendo apenas na aprovação manual do monitoramento).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { vistoria_link_id } = await req.json().catch(() => ({}))
    if (!vistoria_link_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'vistoria_link_id obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { data: link } = await supabase
      .from('vistoria_links')
      .select('*')
      .eq('id', vistoria_link_id)
      .maybeSingle()

    if (!link) {
      return new Response(
        JSON.stringify({ success: false, error: 'Link não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Salvaguarda: ambas etapas devem estar concluídas
    if (link.fotos_etapa_status !== 'concluida' || link.instalacao_etapa_status !== 'concluida') {
      return new Response(
        JSON.stringify({ success: false, error: 'Ambas etapas precisam estar concluídas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const agora = new Date().toISOString()

    // 1) Aprovar vistoria
    if (link.vistoria_id) {
      await supabase
        .from('vistorias')
        .update({ status: 'aprovada', updated_at: agora })
        .eq('id', link.vistoria_id)
    }

    // 2) Concluir instalação
    await supabase
      .from('instalacoes')
      .update({ status: 'concluida', concluida_em: agora, updated_at: agora })
      .eq('id', link.instalacao_id)

    // 3) Encerrar serviço materializado (mesma regra do useAprovarVeiculoVistoria)
    // status='concluida' é o que a fila do monitoramento (useAprovacaoMonitoramento) lê.
    if (link.vistoria_id) {
      await supabase
        .from('servicos')
        .update({ status: 'concluida', concluida_em: agora, updated_at: agora })
        .eq('vistoria_origem_id', link.vistoria_id)
        .in('status', ['em_andamento', 'em_analise', 'em_rota', 'agendada'])
    }

    // 4) Marcar agendamento_base como realizado
    if (link.vistoria_id) {
      await supabase
        .from('agendamentos_base')
        .update({ status: 'realizado', updated_at: agora })
        .eq('vistoria_id', link.vistoria_id)
    }

    // 5) Propagar para cotação/contrato — status 'aguardando_aprovacao_monitoramento'
    //    (mantém comportamento: o associado NÃO é ativado aqui, isso só acontece
    //    quando o monitoramento aprova manualmente. O SGA também só é chamado lá.)
    let cotacaoId: string | null = null
    let contratoId: string | null = null
    const { data: inst } = await supabase
      .from('instalacoes')
      .select('cotacao_id, contrato_id, associado_id, veiculo_id')
      .eq('id', link.instalacao_id)
      .maybeSingle()

    if (inst) {
      cotacaoId = (inst as any).cotacao_id || null
      contratoId = (inst as any).contrato_id || null
      if (cotacaoId) {
        await supabase
          .from('cotacoes')
          .update({ vistoria_concluida_em: agora })
          .eq('id', cotacaoId)
      }
      if (contratoId) {
        await supabase
          .from('contratos')
          .update({ vistoria_concluida_em: agora })
          .eq('id', contratoId)
      }

      // Histórico
      try {
        await supabase.from('associados_historico').insert({
          associado_id: (inst as any).associado_id,
          tipo: 'veiculo_aprovado',
          descricao: 'Vistoria pública concluída — aguardando aprovação do monitoramento',
          dados_novos: {
            vistoria_link_id: link.id,
            vistoria_id: link.vistoria_id,
            instalacao_id: link.instalacao_id,
            veiculo_id: (inst as any).veiculo_id,
            fotos_executor: link.fotos_executor_nome,
            instalacao_executor: link.instalacao_executor_nome,
          },
        })
      } catch (_) {}
    }

    // 6) Gerar laudo PDF (não bloqueante)
    try {
      await supabase.functions.invoke('gerar-laudo-vistoria', {
        body: { instalacaoId: link.instalacao_id },
      })
    } catch (err) {
      console.warn('[aplicar-conclusao-vistoria] gerar-laudo falhou:', err)
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Erro inesperado' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
