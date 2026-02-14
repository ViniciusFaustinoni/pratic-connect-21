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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    // Buscar sinistros em sindicância/perícia com prazo definido
    const { data: sinistros, error } = await supabase
      .from('sinistros')
      .select('id, protocolo, sindicante_id, analista_id, sindicancia_prazo_fim, status')
      .in('status', ['em_sindicancia', 'em_pericia'])
      .not('sindicancia_prazo_fim', 'is', null)

    if (error) throw error
    if (!sinistros || sinistros.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhuma sindicância ativa com prazo' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Buscar diretores
    const { data: diretores } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'diretor')
    const diretorIds = (diretores || []).map((d: any) => d.user_id)

    const hojeStr = hoje.toISOString().split('T')[0]
    let notificacoesEnviadas = 0

    for (const sin of sinistros) {
      const prazoFim = new Date(sin.sindicancia_prazo_fim)
      prazoFim.setHours(0, 0, 0, 0)
      const diffMs = prazoFim.getTime() - hoje.getTime()
      const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24))

      let subtipo = ''
      let titulo = ''
      let mensagem = ''
      let prioridade = 'alta'
      let destinatarios: string[] = []

      if (diffDias === 7) {
        subtipo = 'sindicancia_vencendo'
        titulo = 'Sindicância Vencendo'
        mensagem = `Sindicância do evento #${sin.protocolo} vence em 7 dias.`
        if (sin.sindicante_id) destinatarios = [sin.sindicante_id]
      } else if (diffDias <= 0) {
        subtipo = 'sindicancia_vencida'
        titulo = 'Sindicância VENCIDA'
        mensagem = `Sindicância do evento #${sin.protocolo} está VENCIDA.`
        prioridade = 'urgente'
        destinatarios = [
          ...(sin.sindicante_id ? [sin.sindicante_id] : []),
          ...(sin.analista_id ? [sin.analista_id] : []),
          ...diretorIds,
        ]
      }

      if (!subtipo || destinatarios.length === 0) continue

      // Deduplicar
      const uniqueDest = [...new Set(destinatarios)]

      for (const userId of uniqueDest) {
        // Verificar se já notificou hoje
        const { data: existente } = await supabase
          .from('notificacoes')
          .select('id')
          .eq('user_id', userId)
          .eq('subtipo', subtipo)
          .eq('referencia_id', sin.id)
          .gte('created_at', `${hojeStr}T00:00:00`)
          .limit(1)

        if (existente && existente.length > 0) continue

        await supabase.from('notificacoes').insert({
          user_id: userId,
          titulo,
          mensagem,
          tipo: 'sinistro',
          subtipo,
          link: `/eventos/sindicancias/${sin.id}`,
          prioridade,
          referencia_id: sin.id,
          referencia_tipo: 'sinistro',
          lida: false,
          canal_sistema: true,
        })
        notificacoesEnviadas++
      }
    }

    return new Response(
      JSON.stringify({ success: true, sinistros_verificados: sinistros.length, notificacoes_enviadas: notificacoesEnviadas }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Erro no cron-verificar-sindicancias:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})