// Aprova as fotos enviadas via link público de vistoria.
// Liberação: somente após aprovação, o botão "Realizar Instalação" fica disponível.
// Permitido a perfis de monitoramento, coordenador de monitoramento e analista de cadastro.

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

    // Autenticação obrigatória
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

    // Validar perfil via user_roles
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)

    const userRoles = (roles || []).map((r: any) => String(r.role))
    const podeAprovar = userRoles.some((r) => ROLES_PERMITIDAS.includes(r))

    if (!podeAprovar) {
      return new Response(JSON.stringify({ success: false, error: 'Sem permissão para aprovar fotos' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => ({}))
    const { vistoria_link_id } = body as { vistoria_link_id?: string }

    if (!vistoria_link_id) {
      return new Response(JSON.stringify({ success: false, error: 'vistoria_link_id é obrigatório' }), {
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
      return new Response(JSON.stringify({ success: true, alreadyApproved: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: updErr } = await supabase
      .from('vistoria_links')
      .update({
        fotos_aprovadas_em: new Date().toISOString(),
        fotos_aprovadas_por: userId,
        fotos_reprovadas_em: null,
        fotos_reprovadas_por: null,
        fotos_reprovacao_motivo: null,
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
