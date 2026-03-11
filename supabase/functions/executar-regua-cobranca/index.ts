import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function calcularPrioridade(diasAtraso: number, valor: number): number {
  let prioridade = 3
  if (diasAtraso > 30) prioridade = 9
  else if (diasAtraso > 15) prioridade = 7
  else if (diasAtraso > 5) prioridade = 5
  if (valor > 2000) prioridade = Math.min(prioridade + 1, 10)
  return prioridade
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const hoje = new Date().toISOString().split('T')[0]
    const seteDiasAtras = new Date(Date.now() - 7 * 86400000).toISOString()

    // 1. Buscar régua ativa
    const { data: regua } = await supabase
      .from('reguas_cobranca')
      .select('*, etapas:regua_etapas(*)')
      .eq('ativa', true)
      .limit(1)
      .single()

    if (!regua || !regua.etapas?.length) {
      console.log('Nenhuma régua ativa encontrada')
      return new Response(JSON.stringify({ message: 'Nenhuma régua ativa', processados: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const etapas = (regua.etapas as any[]).sort((a: any, b: any) => a.dia - b.dia)
    console.log(`Régua "${regua.nome}" com ${etapas.length} etapas`)

    // 2. Buscar cobranças vencidas não pagas (lotes de 100)
    let offset = 0
    const batchSize = 100
    let totalProcessados = 0
    let totalEventos = 0
    let totalTarefas = 0

    while (true) {
      const { data: cobrancasVencidas, error: errCobrancas } = await supabase
        .from('asaas_cobrancas')
        .select('id, associado_id, valor, data_vencimento')
        .in('status', ['PENDING', 'OVERDUE'])
        .not('asaas_id', 'like', 'LOCAL-%')
        .lt('data_vencimento', hoje)
        .order('data_vencimento')
        .range(offset, offset + batchSize - 1)

      if (errCobrancas) {
        console.error('Erro ao buscar cobranças:', errCobrancas)
        break
      }

      if (!cobrancasVencidas || cobrancasVencidas.length === 0) break

      // 3. Agrupar por associado
      const porAssociado = new Map<string, { diasAtraso: number; valorTotal: number; cobrancaIds: string[] }>()

      for (const cob of cobrancasVencidas) {
        const dias = Math.floor((Date.now() - new Date(cob.data_vencimento).getTime()) / 86400000)
        const existing = porAssociado.get(cob.associado_id)
        if (!existing || dias > existing.diasAtraso) {
          porAssociado.set(cob.associado_id, {
            diasAtraso: dias,
            valorTotal: (existing?.valorTotal || 0) + Number(cob.valor || 0),
            cobrancaIds: [...(existing?.cobrancaIds || []), cob.id]
          })
        } else {
          existing.valorTotal += Number(cob.valor || 0)
          existing.cobrancaIds.push(cob.id)
        }
      }

      // 4. Processar cada associado
      for (const [associadoId, info] of porAssociado) {
        const { diasAtraso, valorTotal } = info

        // Para cada etapa da régua que corresponde ao dia de atraso
        for (const etapa of etapas) {
          if (diasAtraso < etapa.dia) continue

          // Verificar duplicidade — já executou essa etapa nos últimos 7 dias?
          const { data: eventoExistente } = await supabase
            .from('cobranca_eventos')
            .select('id')
            .eq('associado_id', associadoId)
            .eq('tipo', etapa.tipo)
            .eq('subtipo', `regua_d${etapa.dia}`)
            .gte('created_at', seteDiasAtras)
            .limit(1)

          if (eventoExistente && eventoExistente.length > 0) continue

          const prioridade = calcularPrioridade(diasAtraso, valorTotal)

          // Executar conforme tipo da etapa
          if (['whatsapp', 'sms', 'email'].includes(etapa.tipo)) {
            // Ações automáticas — registrar evento
            await supabase.from('cobranca_eventos').insert({
              associado_id: associadoId,
              tipo: etapa.tipo,
              subtipo: `regua_d${etapa.dia}`,
              descricao: `${etapa.tipo.toUpperCase()} automático - D+${etapa.dia}: ${etapa.descricao || etapa.mensagem || 'Lembrete de cobrança'}`,
              dados: { dia_regua: etapa.dia, valor_total: valorTotal, dias_atraso: diasAtraso, status: 'agendado' },
              automatico: true
            })
            totalEventos++
            console.log(`[EVENTO] ${etapa.tipo} D+${etapa.dia} para associado ${associadoId}`)

          } else if (etapa.tipo === 'ligacao') {
            // Verificar se já existe tarefa pendente
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
                observacao: `Régua D+${etapa.dia}: ${etapa.descricao || 'Ligar para cobrar'}`,
                data_agendamento: new Date().toISOString()
              })
              totalTarefas++
              console.log(`[TAREFA] ligacao D+${etapa.dia} para associado ${associadoId} (prior: ${prioridade})`)
            }

            // Registrar evento
            await supabase.from('cobranca_eventos').insert({
              associado_id: associadoId,
              tipo: 'ligacao',
              subtipo: `regua_d${etapa.dia}`,
              descricao: `Tarefa de ligação criada - D+${etapa.dia}`,
              dados: { dia_regua: etapa.dia, prioridade },
              automatico: true
            })
            totalEventos++

          } else if (etapa.tipo === 'suspensao') {
            await supabase.from('cobranca_eventos').insert({
              associado_id: associadoId,
              tipo: 'status',
              subtipo: 'suspensao',
              descricao: `Suspensão automática - D+${etapa.dia} (${diasAtraso} dias de atraso, R$ ${valorTotal.toFixed(2)})`,
              dados: { dia_regua: etapa.dia, valor_total: valorTotal, dias_atraso: diasAtraso },
              automatico: true
            })
            totalEventos++
            console.log(`[EVENTO] suspensão D+${etapa.dia} para associado ${associadoId}`)

          } else if (etapa.tipo === 'negativacao') {
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
                observacao: `D+${etapa.dia}: Decisão de negativação (R$ ${valorTotal.toFixed(2)})`,
                data_agendamento: new Date().toISOString()
              })
              totalTarefas++
            }

            await supabase.from('cobranca_eventos').insert({
              associado_id: associadoId,
              tipo: 'negativacao',
              subtipo: `regua_d${etapa.dia}`,
              descricao: `Candidato a negativação - D+${etapa.dia}`,
              dados: { dia_regua: etapa.dia, valor_total: valorTotal },
              automatico: true
            })
            totalEventos++

          } else if (etapa.tipo === 'cancelamento' || etapa.tipo === 'exclusao') {
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
                observacao: `D+${etapa.dia}: Decisão de exclusão/cancelamento (R$ ${valorTotal.toFixed(2)})`,
                data_agendamento: new Date().toISOString()
              })
              totalTarefas++
            }

            await supabase.from('cobranca_eventos').insert({
              associado_id: associadoId,
              tipo: 'status',
              subtipo: `regua_d${etapa.dia}`,
              descricao: `Candidato a exclusão - D+${etapa.dia}`,
              dados: { dia_regua: etapa.dia, valor_total: valorTotal },
              automatico: true
            })
            totalEventos++
          }
        }
        totalProcessados++
      }

      if (cobrancasVencidas.length < batchSize) break
      offset += batchSize
    }

    const resultado = {
      message: 'Régua executada com sucesso',
      processados: totalProcessados,
      eventos_criados: totalEventos,
      tarefas_criadas: totalTarefas
    }
    console.log('Resultado:', JSON.stringify(resultado))

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Erro na execução da régua:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
