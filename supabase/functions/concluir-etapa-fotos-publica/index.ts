// Conclui a etapa de FOTOS & VÍDEO da vistoria pública unificada.
// Salva fotos/checklist/vídeo na vistoria existente e marca a etapa como concluída.
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
      executor_nome = null,
      checklist_data = null,
      fotos = null, // Record<string, string> -> { tipo: arquivo_url }
      video_360_url = null,
      hodometro = null,
      observacoes = null,
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

    if (link.fotos_etapa_status === 'concluida') {
      return new Response(
        JSON.stringify({ success: true, message: 'Etapa já concluída', already: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const agora = new Date().toISOString()

    // ── 2) Garantir vistoria vinculada
    let vistoriaId: string | null = link.vistoria_id
    if (!vistoriaId) {
      const { data: vist } = await supabase
        .from('vistorias')
        .select('id')
        .eq('instalacao_id', link.instalacao_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      vistoriaId = vist?.id ?? null
    }

    // ── 3) Persistir fotos & vídeo na vistoria (quando existir)
    if (vistoriaId) {
      // Atualiza vídeo + km + observações
      const vistoriaPatch: Record<string, any> = { updated_at: agora }
      if (video_360_url) vistoriaPatch.video_360_url = video_360_url
      if (hodometro != null) vistoriaPatch.km_atual = Number(hodometro)
      if (observacoes) vistoriaPatch.observacoes = observacoes
      if (Object.keys(vistoriaPatch).length > 1) {
        await supabase.from('vistorias').update(vistoriaPatch).eq('id', vistoriaId)
      }

      // Insere fotos novas (upsert por tipo)
      if (fotos && typeof fotos === 'object') {
        const rows = Object.entries(fotos).map(([tipo, arquivo_url]) => ({
          vistoria_id: vistoriaId,
          tipo,
          arquivo_url,
        }))
        if (rows.length > 0) {
          await supabase
            .from('vistoria_fotos')
            .upsert(rows as any, { onConflict: 'vistoria_id,tipo' })
        }
      }
    }

    // ── 4) Marcar etapa concluída no link
    const { error: linkUpd } = await supabase
      .from('vistoria_links')
      .update({
        fotos_etapa_status: 'concluida',
        fotos_concluida_em: agora,
        fotos_executor_nome: executor_nome,
        vistoria_id: vistoriaId,
      })
      .eq('id', link.id)

    if (linkUpd) {
      return new Response(
        JSON.stringify({ success: false, error: linkUpd.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 5) Se a outra etapa já foi concluída, aplicar conclusão final
    if (link.instalacao_etapa_status === 'concluida') {
      try {
        await supabase.functions.invoke('aplicar-conclusao-vistoria', {
          body: { vistoria_link_id: link.id },
        })
      } catch (err) {
        console.warn('[concluir-etapa-fotos-publica] aplicar-conclusao falhou:', err)
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
