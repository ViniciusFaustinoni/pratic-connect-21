// Reprova as fotos enviadas via link público de vistoria.
// Reabre a etapa de fotos para reenvio (não apaga as fotos antigas — mantém histórico).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const ROLES_PERMITIDAS = [
  'diretor',
  'analista_monitoramento',
  'coordenador_monitoramento',
  'analista_cadastro',
  'gerente_comercial',
  'supervisor_vendas',
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const authHeader = req.headers.get('Authorization') || ''
    const jwt = authHeader.replace('Bearer ', '').trim()
    if (!jwt) {
      return new Response(JSON.stringify({ success: false, error: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: userRes, error: userErr } = await supabase.auth.getUser(jwt)
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ success: false, error: 'Sessão inválida' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const userId = userRes.user.id

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)

    const userRoles = (roles || []).map((r: any) => String(r.role))
    const podeReprovar = userRoles.some((r) => ROLES_PERMITIDAS.includes(r))

    if (!podeReprovar) {
      return new Response(JSON.stringify({ success: false, error: 'Sem permissão para reprovar fotos' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => ({}))
    const { vistoria_link_id, motivo } = body as { vistoria_link_id?: string; motivo?: string }

    if (!vistoria_link_id) {
      return new Response(JSON.stringify({ success: false, error: 'vistoria_link_id é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!motivo || motivo.trim().length < 5) {
      return new Response(JSON.stringify({ success: false, error: 'Motivo da reprovação é obrigatório (mín. 5 caracteres)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: link, error: linkErr } = await supabase
      .from('vistoria_links')
      .select('id, fotos_etapa_status, fotos_aprovadas_em')
      .eq('id', vistoria_link_id)
      .maybeSingle()

    if (linkErr || !link) {
      return new Response(JSON.stringify({ success: false, error: 'Link não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (link.fotos_etapa_status !== 'concluida') {
      return new Response(JSON.stringify({ success: false, error: 'Etapa de fotos ainda não foi concluída' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (link.fotos_aprovadas_em) {
      return new Response(JSON.stringify({ success: false, error: 'Fotos já aprovadas — não é possível reprovar' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Marca como reprovada e reabre a etapa de fotos para novo envio
    const { error: updErr } = await supabase
      .from('vistoria_links')
      .update({
        fotos_etapa_status: 'pendente',
        fotos_concluida_em: null,
        fotos_reprovadas_em: new Date().toISOString(),
        fotos_reprovadas_por: userId,
        fotos_reprovacao_motivo: motivo.trim(),
      })
      .eq('id', vistoria_link_id)

    if (updErr) {
      return new Response(JSON.stringify({ success: false, error: updErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err?.message || 'Erro inesperado' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
