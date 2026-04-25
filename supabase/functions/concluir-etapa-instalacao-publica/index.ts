// Conclui a etapa de INSTALAÇÃO DO RASTREADOR da vistoria pública unificada.
// Exige nome do técnico (server-side trava o nome quando há atribuição interna).
// Se a outra etapa já estiver concluída, dispara aplicar-conclusao-vistoria.

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
      executor_nome: executorNomeInput = null,
      checklist_data = null,
      fotos = null, // Record<string, string>
    } = body as Record<string, any>

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'token obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 1) Buscar link
    const { data: link, error: linkErr } = await supabase
      .from('vistoria_links')
      .select('*')
      .eq('token', token)
      .maybeSingle()

    if (linkErr || !link) {
      return new Response(
        JSON.stringify({ success: false, error: 'Link inválido' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (link.instalacao_etapa_status === 'concluida') {
      return new Response(
        JSON.stringify({ success: true, message: 'Etapa já concluída', already: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 2) Resolver nome do técnico (server-side)
    let executorTipo: 'interno' | 'prestador' | 'publico' = 'publico'
    let executorNome: string | null = null

    if (link.tecnico_atribuido_id) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', link.tecnico_atribuido_id)
        .maybeSingle()
      if (prof?.nome) {
        executorTipo = 'interno'
        executorNome = prof.nome
      }
    } else if (link.prestador_atribuido_id) {
      const { data: prest } = await supabase
        .from('vistoriadores_prestadores')
        .select('nome')
        .eq('id', link.prestador_atribuido_id)
        .maybeSingle()
      if (prest?.nome) {
        executorTipo = 'prestador'
        executorNome = prest.nome
      }
    }

    // Se não há atribuição interna/prestador, o nome vem do input (obrigatório)
    if (!executorNome) {
      const nomeLivre = String(executorNomeInput || '').trim()
      if (nomeLivre.length < 2) {
        return new Response(
          JSON.stringify({ success: false, error: 'Informe o nome de quem realizou a instalação' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      executorNome = nomeLivre
      executorTipo = 'publico'
    }

    const agora = new Date().toISOString()

    // ── 3) Persistir fotos da instalação na vistoria (mesma tabela vistoria_fotos)
    if (link.vistoria_id && fotos && typeof fotos === 'object') {
      const rows = Object.entries(fotos).map(([tipo, arquivo_url]) => ({
        vistoria_id: link.vistoria_id,
        tipo,
        arquivo_url,
      }))
      if (rows.length > 0) {
        await supabase
          .from('vistoria_fotos')
          .upsert(rows as any, { onConflict: 'vistoria_id,tipo' })
      }
    }

    // Persistir checklist de instalação (se a vistoria tiver coluna checklist_instalacao,
    // tentamos atualizar; ignoramos erro caso não exista para preservar compat).
    if (link.vistoria_id && checklist_data) {
      try {
        await supabase
          .from('vistorias')
          .update({ checklist_instalacao: checklist_data, updated_at: agora })
          .eq('id', link.vistoria_id)
      } catch (_) {
        // coluna opcional — silencioso
      }
    }

    // ── 4) Marcar etapa concluída no link
    const { error: linkUpd } = await supabase
      .from('vistoria_links')
      .update({
        instalacao_etapa_status: 'concluida',
        instalacao_concluida_em: agora,
        instalacao_executor_nome: executorNome,
        instalacao_executor_tipo: executorTipo,
      })
      .eq('id', link.id)

    if (linkUpd) {
      return new Response(
        JSON.stringify({ success: false, error: linkUpd.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 5) Se a outra etapa já foi concluída, aplicar conclusão final
    if (link.fotos_etapa_status === 'concluida') {
      try {
        await supabase.functions.invoke('aplicar-conclusao-vistoria', {
          body: { vistoria_link_id: link.id },
        })
      } catch (err) {
        console.warn('[concluir-etapa-instalacao-publica] aplicar-conclusao falhou:', err)
      }
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
