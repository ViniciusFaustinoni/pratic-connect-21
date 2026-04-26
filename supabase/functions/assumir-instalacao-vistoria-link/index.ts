// O técnico logado assume a instalação vinculada a um link público de vistoria.
// - Exige autenticação.
// - Exige que as fotos já tenham sido aprovadas pelo monitoramento.
// - Atribuição atômica: só atribui se ainda não houver técnico atribuído.
// - Em caso de já estar atribuído a outro técnico, retorna erro com nome.
// - Atribui a instalação ao técnico (instalacoes.tecnico_id).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const ROLES_TECNICAS = new Set([
  'tecnico',
  'instalador',
  'tecnico_externo',
  'prestador',
])

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

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, nome, role, tipo')
      .eq('id', userId)
      .maybeSingle()

    if (!profile) {
      return new Response(JSON.stringify({ success: false, error: 'Perfil não encontrado' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!ROLES_TECNICAS.has(String(profile.role || ''))) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Apenas técnicos/instaladores podem assumir esta instalação',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const body = await req.json().catch(() => ({}))
    const { token } = body as { token?: string }

    if (!token) {
      return new Response(JSON.stringify({ success: false, error: 'token é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: link, error: linkErr } = await supabase
      .from('vistoria_links')
      .select('id, instalacao_id, status, fotos_etapa_status, fotos_aprovadas_em, instalacao_etapa_status, tecnico_atribuido_id')
      .eq('token', token)
      .maybeSingle()

    if (linkErr || !link) {
      return new Response(JSON.stringify({ success: false, error: 'Link inválido' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (link.status === 'cancelado' || link.status === 'concluido') {
      return new Response(JSON.stringify({ success: false, error: 'Link não está mais ativo' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!link.fotos_aprovadas_em) {
      return new Response(JSON.stringify({ success: false, error: 'Fotos ainda não foram aprovadas pelo monitoramento' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (link.instalacao_etapa_status === 'concluida') {
      return new Response(JSON.stringify({ success: false, error: 'Instalação já foi concluída' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Caso B: já atribuído
    if (link.tecnico_atribuido_id && link.tecnico_atribuido_id !== userId) {
      const { data: outroTecnico } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', link.tecnico_atribuido_id)
        .maybeSingle()
      return new Response(
        JSON.stringify({
          success: false,
          alreadyAssigned: true,
          tecnico_nome: outroTecnico?.nome || 'outro técnico',
          error: `Esta instalação já foi atribuída a ${outroTecnico?.nome || 'outro técnico'}.`,
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Caso A: atribuição atômica (apenas se ainda for null)
    if (!link.tecnico_atribuido_id) {
      const { data: updated, error: updErr } = await supabase
        .from('vistoria_links')
        .update({ tecnico_atribuido_id: userId })
        .eq('id', link.id)
        .is('tecnico_atribuido_id', null)
        .select('id')
        .maybeSingle()

      if (updErr) {
        return new Response(JSON.stringify({ success: false, error: updErr.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (!updated) {
        // Outra requisição venceu a corrida — refazer leitura para informar
        const { data: novoLink } = await supabase
          .from('vistoria_links')
          .select('tecnico_atribuido_id')
          .eq('id', link.id)
          .maybeSingle()
        if (novoLink?.tecnico_atribuido_id && novoLink.tecnico_atribuido_id !== userId) {
          const { data: outroTecnico } = await supabase
            .from('profiles')
            .select('nome')
            .eq('id', novoLink.tecnico_atribuido_id)
            .maybeSingle()
          return new Response(
            JSON.stringify({
              success: false,
              alreadyAssigned: true,
              tecnico_nome: outroTecnico?.nome || 'outro técnico',
              error: `Esta instalação acabou de ser atribuída a ${outroTecnico?.nome || 'outro técnico'}.`,
            }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }
      }
    }

    // Vincular a instalação ao técnico (mesmo efeito do AtribuirInstaladorDialog)
    if (link.instalacao_id) {
      await supabase
        .from('instalacoes')
        .update({ tecnico_id: userId })
        .eq('id', link.instalacao_id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        instalacao_id: link.instalacao_id,
        redirect_to: link.instalacao_id ? `/instalador/vistoria/${link.instalacao_id}` : null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err?.message || 'Erro inesperado' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
