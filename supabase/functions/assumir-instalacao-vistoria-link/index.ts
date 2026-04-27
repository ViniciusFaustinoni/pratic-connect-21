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

const ROLES_TECNICAS = [
  'instalador_vistoriador',
  'vistoriador_base',
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, nome')
      .eq('id', userId)
      .maybeSingle()

    if (!profile) {
      return new Response(JSON.stringify({ success: false, error: 'Perfil não encontrado' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)

    const userRoles = (roles || []).map((r: any) => String(r.role))
    const ehTecnico = userRoles.some((r) => ROLES_TECNICAS.includes(r))

    if (!ehTecnico) {
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

    // Vincular a instalação ao técnico — atualiza AMBAS as colunas que o restante
    // do sistema (mapa de monitoramento, atribuição manual, kanban) consulta:
    //   - instalador_id            → usado por filtros de listagem do app do técnico
    //   - instalador_responsavel_id → usado pela view view_vistorias_mapa para popular
    //                                 o vistoriador_id (e refletir no Mapa > Atribuições)
    //   - status='agendada'         → consistente com AtribuirInstaladorDialog
    if (link.instalacao_id) {
      const { error: updInstErr } = await supabase
        .from('instalacoes')
        .update({
          instalador_id: userId,
          instalador_responsavel_id: userId,
          status: 'agendada',
        })
        .eq('id', link.instalacao_id)
      if (updInstErr) {
        console.error('[assumir-instalacao-vistoria-link] erro atualizando instalacoes:', updInstErr)
      }

      // Materializa a atribuição no(s) serviço(s) ativos derivados desta instalação.
      // A view do mapa prioriza COALESCE(servicos.profissional_id, ...), então sem
      // este update o pin não muda de "sem atribuição" no monitoramento.
      const { data: servicosAtivos, error: servSelErr } = await supabase
        .from('servicos')
        .select('id')
        .eq('instalacao_origem_id', link.instalacao_id)
        .not('status', 'in', '(concluida,cancelada,nao_compareceu,imprevisto_pendente)')

      if (servSelErr) {
        console.error('[assumir-instalacao-vistoria-link] erro lendo servicos:', servSelErr)
      } else if (servicosAtivos && servicosAtivos.length > 0) {
        const ids = servicosAtivos.map((s: any) => s.id)
        const { error: updServErr } = await supabase
          .from('servicos')
          .update({ profissional_id: userId, status: 'agendada' })
          .in('id', ids)
        if (updServErr) {
          console.error('[assumir-instalacao-vistoria-link] erro atualizando servicos:', updServErr)
        }

        // Log de atribuição (mesmo padrão do useAtribuicaoManual.ts)
        const logRows = ids.map((sid: string) => ({
          servico_id: sid,
          profissional_id: userId,
          tipo_atribuicao: 'manual',
          atribuido_por: userId,
          observacoes: 'Auto-atribuição via link público de vistoria',
        }))
        const { error: logErr } = await supabase
          .from('servicos_atribuicoes_log')
          .insert(logRows as any)
        if (logErr) {
          console.error('[assumir-instalacao-vistoria-link] erro log atribuicao:', logErr)
        }
      }
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
