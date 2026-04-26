// Salva rascunho da etapa pública de fotos da vistoria.
// Permite que a pessoa que está enviando feche a página e volte depois
// sem perder nome do executor, conferência, hodômetro e observações.
//
// Acesso: público (token do link valida a permissão).

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

    const body = await req.json().catch(() => ({}))
    const {
      token,
      executor_nome = null,
      conferencia = null,
      hodometro = null,
      observacoes = null,
    } = body as Record<string, any>

    if (!token || typeof token !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'token obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Validar limites de tamanho (defesa em profundidade)
    const truncStr = (v: unknown, max: number): string | null => {
      if (typeof v !== 'string') return null
      const t = v.trim()
      return t.length === 0 ? null : t.slice(0, max)
    }

    // Buscar link
    const { data: link, error: linkErr } = await supabase
      .from('vistoria_links')
      .select('id, status, fotos_etapa_status')
      .eq('token', token)
      .maybeSingle()

    if (linkErr || !link) {
      return new Response(
        JSON.stringify({ success: false, error: 'Link inválido' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (link.status === 'cancelado') {
      return new Response(
        JSON.stringify({ success: false, error: 'Link cancelado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Não salvar rascunho se a etapa de fotos já foi concluída
    if (link.fotos_etapa_status === 'concluida') {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'etapa já concluída' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Validar conferência (objeto plano com booleans)
    let conferenciaSafe: Record<string, boolean> | null = null
    if (conferencia && typeof conferencia === 'object' && !Array.isArray(conferencia)) {
      conferenciaSafe = {}
      for (const k of ['placa', 'chassi', 'modelo', 'cor']) {
        if (typeof conferencia[k] === 'boolean') {
          conferenciaSafe[k] = conferencia[k]
        }
      }
    }

    const { error: updErr } = await supabase
      .from('vistoria_links')
      .update({
        fotos_rascunho_executor_nome: truncStr(executor_nome, 120),
        fotos_rascunho_conferencia: conferenciaSafe,
        fotos_rascunho_hodometro: truncStr(hodometro, 12),
        fotos_rascunho_observacoes: truncStr(observacoes, 2000),
        fotos_rascunho_atualizado_em: new Date().toISOString(),
      })
      .eq('id', link.id)

    if (updErr) {
      return new Response(
        JSON.stringify({ success: false, error: updErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
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
