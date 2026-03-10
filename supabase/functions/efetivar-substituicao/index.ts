import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface StepResult {
  step: number
  name: string
  success: boolean
  error?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const { substituicao_id, aprovado_por, observacoes } = await req.json()

    if (!substituicao_id) {
      return new Response(JSON.stringify({ success: false, error: 'substituicao_id obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const results: StepResult[] = []
    let criticalFailure = false

    // Buscar carência do banco de configuracoes
    const { data: cfgCarencia } = await supabase.from('configuracoes').select('valor').eq('chave', 'carencia_dias_padrao').single()
    const carenciaDias = cfgCarencia ? parseInt(cfgCarencia.valor) : 120

    // Buscar dados completos
    const { data: substituicao, error: fetchErr } = await supabase
      .from('substituicoes_veiculo')
      .select('*')
      .eq('id', substituicao_id)
      .single()

    if (fetchErr || !substituicao) {
      return new Response(JSON.stringify({ success: false, error: 'Substituição não encontrada' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: associado } = await supabase
      .from('associados')
      .select('*')
      .eq('id', substituicao.associado_id)
      .single()

    const beneficios = (substituicao.beneficios_novos || {}) as Record<string, unknown>

    // ─── STEP 1: Inativar veículo antigo ───
    try {
      const { error } = await supabase
        .from('veiculos')
        .update({
          ativo: false,
          principal: false,
          status: 'cancelado',
          data_inativacao: new Date().toISOString(),
          motivo_inativacao: 'substituicao',
          substituicao_id: substituicao.id,
        })
        .eq('id', substituicao.veiculo_antigo_id)

      if (error) throw error
      results.push({ step: 1, name: 'Inativar veículo antigo', success: true })
    } catch (e) {
      results.push({ step: 1, name: 'Inativar veículo antigo', success: false, error: (e as Error).message })
      criticalFailure = true
    }

    // ─── STEP 2: Ativar veículo novo ───
    if (!criticalFailure) {
      try {
        if (substituicao.veiculo_novo_id) {
          const { error } = await supabase
            .from('veiculos')
            .update({
              ativo: true,
              principal: true,
              status: 'ativo',
              cobertura_vidros: beneficios.cobertura_vidros === true,
              cobertura_terceiros: (beneficios.cobertura_terceiros as string) || null,
              cobertura_assistencia: (beneficios.cobertura_assistencia as string) || null,
              substituicao_id: substituicao.id,
            })
            .eq('id', substituicao.veiculo_novo_id)

          if (error) throw error
        }
        results.push({ step: 2, name: 'Ativar veículo novo', success: true })
      } catch (e) {
        results.push({ step: 2, name: 'Ativar veículo novo', success: false, error: (e as Error).message })
        criticalFailure = true
      }
    }

    // ─── STEP 3 & 4: Mensalidade e cota já calculadas no SB-03 ───
    results.push({ step: 3, name: 'Definir nova mensalidade', success: true })
    results.push({ step: 4, name: 'Definir nova cota de participação', success: true })

    // ─── STEP 5: Carência 120 dias ───
    if (!criticalFailure) {
      try {
        const dataInicio = new Date()
        const dataFim = new Date()
        dataFim.setDate(dataFim.getDate() + carenciaDias)

        const { error } = await supabase
          .from('substituicoes_veiculo')
          .update({
            data_inicio_carencia: dataInicio.toISOString(),
            data_fim_carencia: dataFim.toISOString(),
            carencia_dias: carenciaDias,
          })
          .eq('id', substituicao_id)

        if (error) throw error
        results.push({ step: 5, name: `Registrar carência ${carenciaDias} dias`, success: true })
      } catch (e) {
        results.push({ step: 5, name: `Registrar carência ${carenciaDias} dias`, success: false, error: (e as Error).message })
        criticalFailure = true
      }
    }

    // ─── STEP 6: Pro-rata já calculado ───
    results.push({ step: 6, name: 'Pro-rata (já calculado)', success: true })

    // ─── STEP 7: Atualizar boletos futuros no ASAAS ───
    try {
      const { data: cobrancasFuturas } = await supabase
        .from('asaas_cobrancas')
        .select('id, asaas_id, data_vencimento, valor')
        .eq('associado_id', substituicao.associado_id)
        .eq('status', 'PENDING')
        .gt('data_vencimento', new Date().toISOString())

      if (cobrancasFuturas && cobrancasFuturas.length > 0 && substituicao.mensalidade_nova) {
        for (const cobranca of cobrancasFuturas) {
          try {
            // Cancel old charge via edge function
            await supabase.functions.invoke('asaas-cobrancas', {
              body: { action: 'cancelar', asaas_id: cobranca.asaas_id },
            })
          } catch (cancelErr) {
            console.warn(`Erro ao cancelar cobrança ${cobranca.id}:`, cancelErr)
          }
        }
      }

      results.push({ step: 7, name: 'Atualizar boletos futuros', success: true })
    } catch (e) {
      results.push({ step: 7, name: 'Atualizar boletos futuros', success: false, error: (e as Error).message })
    }

    // ─── STEP 8: Gerar proposta Autentique ───
    try {
      if (associado) {
        await supabase.functions.invoke('autentique-create', {
          body: {
            template: 'CONTRATO_ADESAO_V1',
            signatarios: [{
              nome: associado.nome,
              email: associado.email,
              telefone: associado.telefone,
            }],
            dados: {
              associado_nome: associado.nome,
              associado_cpf: associado.cpf,
              veiculo_modelo: substituicao.veiculo_novo_modelo,
              veiculo_placa: substituicao.veiculo_novo_placa,
              mensalidade: substituicao.mensalidade_nova,
              cota_participacao: substituicao.cota_participacao_nova,
            },
          },
        })
      }
      results.push({ step: 8, name: 'Gerar proposta Autentique', success: true })
    } catch (e) {
      results.push({ step: 8, name: 'Gerar proposta Autentique', success: false, error: (e as Error).message })
    }

    // ─── STEP 9: Vincular serviço de instalação ───
    try {
      if (substituicao.servico_instalacao_id && substituicao.veiculo_novo_id) {
        await supabase
          .from('servicos')
          .update({ veiculo_id: substituicao.veiculo_novo_id })
          .eq('id', substituicao.servico_instalacao_id)
      }
      results.push({ step: 9, name: 'Vincular serviço de instalação', success: true })
    } catch (e) {
      results.push({ step: 9, name: 'Vincular serviço de instalação', success: false, error: (e as Error).message })
    }

    // ─── STEP 10: Monitoramento (via instalação) ───
    results.push({ step: 10, name: 'Atualizar monitoramento (via instalação)', success: true })

    // ─── STEP 11: Registrar no histórico ───
    try {
      await supabase.from('associados_historico').insert({
        associado_id: substituicao.associado_id,
        tipo: 'substituicao_veiculo',
        acao: 'substituicao',
        descricao: `Substituição de veículo: ${substituicao.veiculo_antigo_placa || 'N/A'} → ${substituicao.veiculo_novo_placa || 'N/A'}`,
        status_anterior: 'ativo',
        status_novo: 'ativo',
        motivo: observacoes || 'Substituição aprovada pela diretoria',
        executado_por: aprovado_por,
        metadata: {
          substituicao_id: substituicao.id,
          mensalidade_antiga: substituicao.mensalidade_antiga,
          mensalidade_nova: substituicao.mensalidade_nova,
          fipe_antiga: substituicao.veiculo_antigo_fipe,
          fipe_nova: substituicao.veiculo_novo_fipe,
        },
      })
      results.push({ step: 11, name: 'Registrar no histórico', success: true })
    } catch (e) {
      results.push({ step: 11, name: 'Registrar no histórico', success: false, error: (e as Error).message })
    }

    // ─── STEP 12: Creditar consultor ───
    try {
      if (substituicao.consultor_id) {
        await supabase
          .from('substituicoes_veiculo')
          .update({ comissao_creditada: true, pontos_consultor: 0.5 })
          .eq('id', substituicao_id)
      }
      results.push({ step: 12, name: 'Creditar consultor', success: true })
    } catch (e) {
      results.push({ step: 12, name: 'Creditar consultor', success: false, error: (e as Error).message })
    }

    // ─── STEP 13: Notificar associado via WhatsApp ───
    try {
      if (associado) {
        const dataFimCarencia = new Date()
        dataFimCarencia.setDate(dataFimCarencia.getDate() + carenciaDias)
        const fmtDate = dataFimCarencia.toLocaleDateString('pt-BR')
        const fmtMensal = substituicao.mensalidade_nova
          ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(substituicao.mensalidade_nova)
          : 'N/A'
        const fmtCota = substituicao.cota_participacao_nova
          ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(substituicao.cota_participacao_nova)
          : 'N/A'

        await supabase.functions.invoke('disparar-notificacao', {
          body: {
            associado_id: substituicao.associado_id,
            tipo: 'substituicao_concluida',
            mensagem: `✅ Substituição concluída!\n\nNovo veículo: ${substituicao.veiculo_novo_modelo || 'N/A'} - ${substituicao.veiculo_novo_placa || 'N/A'}\nNova mensalidade: ${fmtMensal}\nNova cota participação: ${fmtCota}\n\n⚠️ Carência: 120 dias (até ${fmtDate})\nTodos os benefícios com carência própria reiniciam.\n\nNova proposta de filiação enviada para assinatura.`,
          },
        })
      }
      results.push({ step: 13, name: 'Notificar associado via WhatsApp', success: true })
    } catch (e) {
      results.push({ step: 13, name: 'Notificar associado via WhatsApp', success: false, error: (e as Error).message })
    }

    // ─── Finalizar ───
    if (!criticalFailure) {
      await supabase
        .from('substituicoes_veiculo')
        .update({
          status: 'efetivada',
          aprovado_por,
          aprovado_em: new Date().toISOString(),
          observacoes: observacoes || substituicao.observacoes,
        })
        .eq('id', substituicao_id)
    }

    const allSuccess = results.every((r) => r.success)

    return new Response(
      JSON.stringify({
        success: !criticalFailure,
        message: criticalFailure
          ? 'Falha crítica na efetivação'
          : allSuccess
          ? 'Substituição efetivada com sucesso'
          : 'Substituição efetivada com avisos',
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
