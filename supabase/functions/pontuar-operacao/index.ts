import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getParametroPontuacao, registrarEventoPontuacao } from '../_shared/pontuacao-helper.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const {
      tipo_operacao,
      vendedor_id,
      contrato_id,
      referencia_tipo,
      referencia_id,
      pagamento_integral,
    } = await req.json()

    if (!tipo_operacao || !vendedor_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'tipo_operacao e vendedor_id são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    let chaveParametro: string
    let fallback: number

    switch (tipo_operacao) {
      case 'troca_titularidade':
        chaveParametro = pagamento_integral
          ? 'pontos_troca_titularidade'
          : 'pontos_troca_titularidade_parcial'
        fallback = pagamento_integral ? 0.5 : 0
        break
      case 'migracao_aprovada':
        chaveParametro = 'pontos_migracao_aprovada'
        fallback = 1.0
        break
      case 'indicacao_convertida':
        chaveParametro = 'pontos_indicacao_convertida'
        fallback = 1.0
        break
      default:
        return new Response(
          JSON.stringify({ success: false, error: `tipo_operacao desconhecido: ${tipo_operacao}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
    }

    const pontos = await getParametroPontuacao(supabase, chaveParametro, fallback)

    console.log(`[pontuar-operacao] ${tipo_operacao} → ${pontos} pontos (param: ${chaveParametro}) para vendedor ${vendedor_id}`)

    await registrarEventoPontuacao(supabase, {
      vendedor_id,
      tipo_operacao,
      pontos,
      contrato_id: contrato_id || null,
      referencia_tipo: referencia_tipo || tipo_operacao,
      referencia_id: referencia_id || null,
    })

    return new Response(
      JSON.stringify({ success: true, pontos, tipo_operacao }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    console.error('[pontuar-operacao] Erro:', e)
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
