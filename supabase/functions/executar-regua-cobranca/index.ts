import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Etapa {
  id?: string
  dias: number
  acao: string
  template?: string
  ativa?: boolean
}

function calcularPrioridade(diasAtraso: number, valor: number): number {
  let prioridade = 3
  if (diasAtraso > 30) prioridade = 9
  else if (diasAtraso > 15) prioridade = 7
  else if (diasAtraso > 5) prioridade = 5
  if (valor > 2000) prioridade = Math.min(prioridade + 1, 10)
  return prioridade
}

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startedAt = new Date().toISOString()

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const MAX_DISPAROS = parseInt(Deno.env.get('REGUA_MAX_DISPAROS_POR_RUN') || '500', 10)
    let disparosWhatsapp = 0

    const hoje = new Date()
    const hojeISO = hoje.toISOString().split('T')[0]
    const seteDiasAtras = new Date(Date.now() - 7 * 86400000).toISOString()

    // 1. Buscar régua ativa (etapas é coluna JSONB em reguas_cobranca)
    const { data: regua, error: errRegua } = await supabase
      .from('reguas_cobranca')
      .select('*')
      .eq('ativa', true)
      .limit(1)
      .maybeSingle()

    if (errRegua) {
      console.error('Erro ao buscar régua:', errRegua)
      throw errRegua
    }

    const etapasRaw = (regua?.etapas as Etapa[] | null) || []
    const etapasAtivas = etapasRaw.filter((e) => e.ativa !== false)

    if (!regua || etapasAtivas.length === 0) {
      console.log('Nenhuma régua ativa encontrada ou sem etapas')
      return new Response(JSON.stringify({ message: 'Nenhuma régua ativa', processados: 0, eventos_criados: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const etapas = [...etapasAtivas].sort((a, b) => a.dias - b.dias)
    console.log(`Régua "${regua.nome}" com ${etapas.length} etapas ativas (${etapasRaw.length} total)`)

    // Calcular janela de pré-vencimento (etapas com dias < 0)
    const etapasPre = etapas.filter((e) => e.dias < 0)
    const maxDiasAntes = etapasPre.length > 0 ? Math.abs(Math.min(...etapasPre.map((e) => e.dias))) : 0

    let totalProcessados = 0
    let totalEventos = 0
    let totalTarefas = 0
    let totalEnviadosWA = 0
    let totalFalhasWA = 0
    let limitAtingido = false

    // ============================================================
    // HELPER: enviar WhatsApp via whatsapp-send-text (Meta template)
    // ============================================================
    async function enviarTemplateWhatsapp(opts: {
      telefone: string
      templateName: string
      params: string[]
    }): Promise<{ ok: boolean; erro?: string; message_id?: string }> {
      try {
        const resp = await supabase.functions.invoke('whatsapp-send-text', {
          body: {
            telefone: opts.telefone,
            mensagem: '', // ignorado quando há template
            template_name: opts.templateName,
            template_params: opts.params,
          },
        })
        if (resp.error) {
          return { ok: false, erro: resp.error.message || String(resp.error) }
        }
        const data: any = resp.data || {}
        if (data.success === false) {
          return { ok: false, erro: data.error || 'Falha desconhecida' }
        }
        return { ok: true, message_id: data.message_id }
      } catch (err: any) {
        return { ok: false, erro: err?.message || String(err) }
      }
    }

    // ============================================================
    // PASS 1 — Cobranças VENCIDAS (dias positivos / D+0)
    // ============================================================
    let offset = 0
    const batchSize = 100

    while (true) {
      const { data: cobrancasVencidas, error: errCobrancas } = await supabase
        .from('asaas_cobrancas')
        .select('id, associado_id, valor, data_vencimento')
        .in('status', ['PENDING', 'OVERDUE'])
        .not('asaas_id', 'like', 'LOCAL-%')
        .lte('data_vencimento', hojeISO)
        .order('data_vencimento')
        .range(offset, offset + batchSize - 1)

      if (errCobrancas) {
        console.error('Erro ao buscar cobranças vencidas:', errCobrancas)
        break
      }

      if (!cobrancasVencidas || cobrancasVencidas.length === 0) break

      // Agrupar por associado (manter o maior atraso e somar valores)
      const porAssociado = new Map<string, { diasAtraso: number; valorTotal: number; vencimento: string; cobrancaIds: string[] }>()

      for (const cob of cobrancasVencidas) {
        const dias = Math.floor((Date.now() - new Date(cob.data_vencimento).getTime()) / 86400000)
        const existing = porAssociado.get(cob.associado_id)
        if (!existing) {
          porAssociado.set(cob.associado_id, {
            diasAtraso: dias,
            valorTotal: Number(cob.valor || 0),
            vencimento: cob.data_vencimento,
            cobrancaIds: [cob.id],
          })
        } else {
          existing.valorTotal += Number(cob.valor || 0)
          existing.cobrancaIds.push(cob.id)
          if (dias > existing.diasAtraso) {
            existing.diasAtraso = dias
            existing.vencimento = cob.data_vencimento
          }
        }
      }

      for (const [associadoId, info] of porAssociado) {
        const { diasAtraso, valorTotal } = info

        for (const etapa of etapas) {
          // Apenas etapas pós-vencimento neste pass (dias >= 0) e que já "venceram"
          if (etapa.dias < 0) continue
          if (diasAtraso < etapa.dias) continue

          // Anti-duplicidade — já executou nos últimos 7 dias?
          const { data: eventoExistente } = await supabase
            .from('cobranca_eventos')
            .select('id')
            .eq('associado_id', associadoId)
            .eq('subtipo', `regua_d${etapa.dias}`)
            .gte('created_at', seteDiasAtras)
            .limit(1)

          if (eventoExistente && eventoExistente.length > 0) continue

          const prioridade = calcularPrioridade(diasAtraso, valorTotal)
          await processarEtapa({
            associadoId,
            etapa,
            diasAtraso,
            valorTotal,
            vencimento: info.vencimento,
            prioridade,
          })
        }
        totalProcessados++
      }

      if (cobrancasVencidas.length < batchSize) break
      offset += batchSize
    }

    // ============================================================
    // PASS 2 — Cobranças A VENCER (lembretes pré-vencimento, dias < 0)
    // ============================================================
    if (maxDiasAntes > 0) {
      const limiteFuturo = new Date(hoje.getTime() + maxDiasAntes * 86400000).toISOString().split('T')[0]
      const amanhaISO = new Date(hoje.getTime() + 86400000).toISOString().split('T')[0]

      let offsetPre = 0
      while (true) {
        const { data: cobrancasFuturas, error: errPre } = await supabase
          .from('asaas_cobrancas')
          .select('id, associado_id, valor, data_vencimento')
          .in('status', ['PENDING'])
          .not('asaas_id', 'like', 'LOCAL-%')
          .gte('data_vencimento', amanhaISO)
          .lte('data_vencimento', limiteFuturo)
          .order('data_vencimento')
          .range(offsetPre, offsetPre + batchSize - 1)

        if (errPre) {
          console.error('Erro ao buscar cobranças a vencer:', errPre)
          break
        }
        if (!cobrancasFuturas || cobrancasFuturas.length === 0) break

        for (const cob of cobrancasFuturas) {
          const diasAteVencer = Math.ceil(
            (new Date(cob.data_vencimento).getTime() - hoje.getTime()) / 86400000
          )
          const diasRelativos = -diasAteVencer // ex.: vence em 5 dias => etapa.dias === -5

          // Procurar etapa exata para esse dia
          const etapaMatch = etapas.find((e) => e.dias === diasRelativos)
          if (!etapaMatch) continue

          // Anti-duplicidade por cobrança
          const { data: eventoExistente } = await supabase
            .from('cobranca_eventos')
            .select('id')
            .eq('associado_id', cob.associado_id)
            .eq('subtipo', `regua_d${etapaMatch.dias}`)
            .gte('created_at', seteDiasAtras)
            .limit(1)

          if (eventoExistente && eventoExistente.length > 0) continue

          await processarEtapa({
            associadoId: cob.associado_id,
            etapa: etapaMatch,
            diasAtraso: diasRelativos, // negativo: lembrete
            valorTotal: Number(cob.valor || 0),
            vencimento: cob.data_vencimento,
            prioridade: 3,
          })
          totalProcessados++
        }

        if (cobrancasFuturas.length < batchSize) break
        offsetPre += batchSize
      }
    }

    // ============================================================
    // PROCESSADOR DE ETAPA (compartilhado entre os dois passes)
    // ============================================================
    async function processarEtapa(params: {
      associadoId: string
      etapa: Etapa
      diasAtraso: number
      valorTotal: number
      vencimento: string
      prioridade: number
    }) {
      const { associadoId, etapa, diasAtraso, valorTotal, vencimento, prioridade } = params
      const subtipo = `regua_d${etapa.dias}`

      // ---- AÇÕES DE MENSAGEM ----
      if (etapa.acao === 'whatsapp') {
        // Buscar telefone + nome do associado
        const { data: assoc } = await supabase
          .from('associados')
          .select('nome, whatsapp, telefone')
          .eq('id', associadoId)
          .maybeSingle()

        const telefone = assoc?.whatsapp || assoc?.telefone
        let envioStatus: 'enviado' | 'falhou' | 'agendado' = 'agendado'
        let envioErro: string | null = null
        let messageId: string | null = null

        if (etapa.template && telefone && disparosWhatsapp < MAX_DISPAROS) {
          const params = [
            assoc?.nome || 'Associado',
            formatBRL(valorTotal),
            formatDate(vencimento),
          ]
          const result = await enviarTemplateWhatsapp({
            telefone,
            templateName: etapa.template,
            params,
          })
          disparosWhatsapp++
          if (result.ok) {
            envioStatus = 'enviado'
            messageId = result.message_id || null
            totalEnviadosWA++
          } else {
            envioStatus = 'falhou'
            envioErro = result.erro || 'Erro desconhecido'
            totalFalhasWA++
          }
        } else if (disparosWhatsapp >= MAX_DISPAROS) {
          limitAtingido = true
          envioErro = `Limite de disparos por execução atingido (${MAX_DISPAROS})`
        } else if (!etapa.template) {
          envioErro = 'Etapa sem template definido'
        } else if (!telefone) {
          envioErro = 'Associado sem telefone/whatsapp'
        }

        await supabase.from('cobranca_eventos').insert({
          associado_id: associadoId,
          tipo: 'whatsapp',
          subtipo,
          descricao: `WhatsApp ${etapa.dias < 0 ? `D${etapa.dias} (lembrete)` : `D+${etapa.dias}`} — template ${etapa.template || '(nenhum)'}`,
          dados: {
            dia_regua: etapa.dias,
            valor_total: valorTotal,
            dias_atraso: diasAtraso,
            template: etapa.template,
            status: envioStatus,
            message_id: messageId,
            erro: envioErro,
          },
          automatico: true,
        })
        totalEventos++
      } else if (etapa.acao === 'sms' || etapa.acao === 'email') {
        // SMS/Email: ainda sem provedor — apenas registra
        await supabase.from('cobranca_eventos').insert({
          associado_id: associadoId,
          tipo: etapa.acao,
          subtipo,
          descricao: `${etapa.acao.toUpperCase()} ${etapa.dias < 0 ? `D${etapa.dias}` : `D+${etapa.dias}`} agendado (provedor não configurado)`,
          dados: { dia_regua: etapa.dias, valor_total: valorTotal, dias_atraso: diasAtraso, status: 'agendado' },
          automatico: true,
        })
        totalEventos++
      } else if (etapa.acao === 'ligacao') {
        const { data: tarefaExiste } = await supabase
          .from('cobranca_fila')
          .select('id')
          .eq('associado_id', associadoId)
          .eq('motivo', 'regua_ligacao')
          .in('status', ['pendente', 'em_atendimento'])
          .limit(1)

        if (!tarefaExiste || tarefaExiste.length === 0) {
          await supabase.from('cobranca_fila').insert({
            associado_id: associadoId,
            motivo: 'regua_ligacao',
            prioridade,
            status: 'pendente',
            observacao: `Régua D${etapa.dias >= 0 ? '+' : ''}${etapa.dias}: ligar para cobrar`,
            data_agendamento: new Date().toISOString(),
          })
          totalTarefas++
        }
        await supabase.from('cobranca_eventos').insert({
          associado_id: associadoId,
          tipo: 'ligacao',
          subtipo,
          descricao: `Tarefa de ligação D+${etapa.dias}`,
          dados: { dia_regua: etapa.dias, prioridade },
          automatico: true,
        })
        totalEventos++
      } else if (etapa.acao === 'suspensao') {
        await supabase.from('cobranca_eventos').insert({
          associado_id: associadoId,
          tipo: 'status',
          subtipo: 'suspensao',
          descricao: `Suspensão automática D+${etapa.dias} (${diasAtraso} dias / R$ ${formatBRL(valorTotal)})`,
          dados: { dia_regua: etapa.dias, valor_total: valorTotal, dias_atraso: diasAtraso },
          automatico: true,
        })
        totalEventos++
      } else if (etapa.acao === 'negativacao') {
        const { data: tarefaExiste } = await supabase
          .from('cobranca_fila')
          .select('id')
          .eq('associado_id', associadoId)
          .eq('motivo', 'decisao_negativacao')
          .in('status', ['pendente', 'em_atendimento'])
          .limit(1)
        if (!tarefaExiste || tarefaExiste.length === 0) {
          await supabase.from('cobranca_fila').insert({
            associado_id: associadoId,
            motivo: 'decisao_negativacao',
            prioridade: 9,
            status: 'pendente',
            observacao: `D+${etapa.dias}: decisão de negativação (R$ ${formatBRL(valorTotal)})`,
            data_agendamento: new Date().toISOString(),
          })
          totalTarefas++
        }
        await supabase.from('cobranca_eventos').insert({
          associado_id: associadoId,
          tipo: 'negativacao',
          subtipo,
          descricao: `Candidato a negativação D+${etapa.dias}`,
          dados: { dia_regua: etapa.dias, valor_total: valorTotal },
          automatico: true,
        })
        totalEventos++
      } else if (etapa.acao === 'cancelamento' || etapa.acao === 'exclusao') {
        const { data: tarefaExiste } = await supabase
          .from('cobranca_fila')
          .select('id')
          .eq('associado_id', associadoId)
          .eq('motivo', 'decisao_exclusao')
          .in('status', ['pendente', 'em_atendimento'])
          .limit(1)
        if (!tarefaExiste || tarefaExiste.length === 0) {
          await supabase.from('cobranca_fila').insert({
            associado_id: associadoId,
            motivo: 'decisao_exclusao',
            prioridade: 9,
            status: 'pendente',
            observacao: `D+${etapa.dias}: decisão de exclusão (R$ ${formatBRL(valorTotal)})`,
            data_agendamento: new Date().toISOString(),
          })
          totalTarefas++
        }
        await supabase.from('cobranca_eventos').insert({
          associado_id: associadoId,
          tipo: 'status',
          subtipo,
          descricao: `Candidato a exclusão D+${etapa.dias}`,
          dados: { dia_regua: etapa.dias, valor_total: valorTotal },
          automatico: true,
        })
        totalEventos++
      }
    }

    const resultado = {
      message: 'Régua executada com sucesso',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      processados: totalProcessados,
      eventos_criados: totalEventos,
      tarefas_criadas: totalTarefas,
      whatsapp_enviados: totalEnviadosWA,
      whatsapp_falhas: totalFalhasWA,
      limite_atingido: limitAtingido,
      max_disparos: MAX_DISPAROS,
    }
    console.log('Resultado:', JSON.stringify(resultado))

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Erro na execução da régua:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
