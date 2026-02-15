import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const quinzeDiasAtras = new Date(Date.now() - 15 * 86400000).toISOString()
    let totalTarefas = 0

    // Helper: verificar se já existe tarefa pendente
    async function existeTarefaPendente(associadoId: string, motivo: string): Promise<boolean> {
      const { data } = await supabase
        .from('cobranca_fila')
        .select('id')
        .eq('associado_id', associadoId)
        .eq('motivo', motivo)
        .in('status', ['pendente', 'em_atendimento'])
        .limit(1)
      return (data && data.length > 0) || false
    }

    // 1. Promessas quebradas
    console.log('Verificando promessas quebradas...')
    const { data: promessas } = await supabase
      .from('cobranca_contatos')
      .select('associado_id, data_promessa')
      .eq('resultado', 'promessa_pagamento')
      .not('data_promessa', 'is', null)
      .lt('data_promessa', hoje)

    if (promessas) {
      for (const p of promessas) {
        // Verificar se ainda tem cobrança vencida
        const { data: cobVencida } = await supabase
          .from('cobrancas')
          .select('id')
          .eq('associado_id', p.associado_id)
          .in('status', ['aguardando_pagamento', 'vencido'])
          .lt('data_vencimento', hoje)
          .limit(1)

        if (cobVencida && cobVencida.length > 0) {
          if (!(await existeTarefaPendente(p.associado_id, 'promessa_quebrada'))) {
            await supabase.from('cobranca_fila').insert({
              associado_id: p.associado_id,
              motivo: 'promessa_quebrada',
              prioridade: 8,
              status: 'pendente',
              observacao: `Promessa de pagamento para ${p.data_promessa} não cumprida`,
              data_agendamento: new Date().toISOString()
            })
            totalTarefas++
            console.log(`[TAREFA] promessa_quebrada para ${p.associado_id}`)
          }
        }
      }
    }

    // 2. Parcelas de acordo vencendo hoje
    console.log('Verificando parcelas vencendo hoje...')
    const { data: parcelas } = await supabase
      .from('acordo_parcelas')
      .select('acordo_id, numero_parcela, valor, acordo:acordos(associado_id)')
      .eq('data_vencimento', hoje)
      .eq('status', 'pendente')

    if (parcelas) {
      for (const parcela of parcelas) {
        const associadoId = (parcela.acordo as any)?.associado_id
        if (!associadoId) continue

        if (!(await existeTarefaPendente(associadoId, 'parcela_vencendo'))) {
          await supabase.from('cobranca_fila').insert({
            associado_id: associadoId,
            motivo: 'parcela_vencendo',
            prioridade: 5,
            status: 'pendente',
            observacao: `Parcela ${parcela.numero_parcela} de R$ ${parcela.valor} vence hoje`,
            data_agendamento: new Date().toISOString()
          })
          totalTarefas++
          console.log(`[TAREFA] parcela_vencendo para ${associadoId}`)
        }
      }
    }

    // 3. Retornos agendados para hoje
    console.log('Verificando retornos agendados...')
    const { data: retornos } = await supabase
      .from('cobranca_contatos')
      .select('associado_id, observacao')
      .eq('data_retorno', hoje)

    if (retornos) {
      for (const r of retornos) {
        if (!(await existeTarefaPendente(r.associado_id, 'retorno_agendado'))) {
          await supabase.from('cobranca_fila').insert({
            associado_id: r.associado_id,
            motivo: 'retorno_agendado',
            prioridade: 7,
            status: 'pendente',
            observacao: `Retorno agendado: ${r.observacao || 'Retornar contato'}`,
            data_agendamento: new Date().toISOString()
          })
          totalTarefas++
          console.log(`[TAREFA] retorno_agendado para ${r.associado_id}`)
        }
      }
    }

    // 4. Sem contato há mais de 15 dias
    console.log('Verificando inadimplentes sem contato recente...')
    const { data: inadimplentes } = await supabase
      .from('cobrancas')
      .select('associado_id')
      .in('status', ['aguardando_pagamento', 'vencido'])
      .lt('data_vencimento', hoje)

    if (inadimplentes) {
      const associadosUnicos = [...new Set(inadimplentes.map(i => i.associado_id))]

      for (const associadoId of associadosUnicos) {
        // Verificar se tem acordo ativo
        const { data: acordoAtivo } = await supabase
          .from('acordos')
          .select('id')
          .eq('associado_id', associadoId)
          .eq('status', 'ativo')
          .limit(1)

        if (acordoAtivo && acordoAtivo.length > 0) continue

        // Verificar último contato
        const { data: ultimoContato } = await supabase
          .from('cobranca_contatos')
          .select('created_at')
          .eq('associado_id', associadoId)
          .order('created_at', { ascending: false })
          .limit(1)

        const semContatoRecente = !ultimoContato || ultimoContato.length === 0 ||
          new Date(ultimoContato[0].created_at).getTime() < new Date(quinzeDiasAtras).getTime()

        if (semContatoRecente) {
          if (!(await existeTarefaPendente(associadoId, 'sem_contato'))) {
            await supabase.from('cobranca_fila').insert({
              associado_id: associadoId,
              motivo: 'sem_contato',
              prioridade: 6,
              status: 'pendente',
              observacao: 'Sem contato há mais de 15 dias',
              data_agendamento: new Date().toISOString()
            })
            totalTarefas++
            console.log(`[TAREFA] sem_contato para ${associadoId}`)
          }
        }
      }
    }

    const resultado = {
      message: 'Fila gerada com sucesso',
      tarefas_criadas: totalTarefas
    }
    console.log('Resultado:', JSON.stringify(resultado))

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Erro ao gerar fila:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
