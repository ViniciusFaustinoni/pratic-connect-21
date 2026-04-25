// Gera (ou retorna) o link público unificado de vistoria para uma instalação.
// Idempotente: se já existir um link ativo, devolve o mesmo token/url.
// Disparado automaticamente após a aprovação documental no Cadastro.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const BASE_URL = 'https://app.praticcar.org'

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
      instalacao_id,
      cotacao_id,
      vistoria_id,
      tecnico_atribuido_id = null,
      prestador_atribuido_id = null,
      criado_por = null,
    } = body as Record<string, any>

    // ── 1) Resolver instalacao_id (aceita também cotacao_id por conveniência)
    let instalacaoId: string | null = instalacao_id ?? null
    let vistoriaId: string | null = vistoria_id ?? null

    if (!instalacaoId && cotacao_id) {
      const { data: inst } = await supabase
        .from('instalacoes')
        .select('id, vistoria_id')
        .eq('cotacao_id', cotacao_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (inst) {
        instalacaoId = inst.id
        vistoriaId = vistoriaId || (inst as any).vistoria_id || null
      }
    }

    if (!instalacaoId) {
      return new Response(
        JSON.stringify({ success: false, error: 'instalacao_id (ou cotacao_id válido) é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Se não veio vistoria_id, tentar resolver pela vistoria vinculada à instalação
    if (!vistoriaId) {
      const { data: vist } = await supabase
        .from('vistorias')
        .select('id')
        .eq('instalacao_id', instalacaoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (vist) vistoriaId = vist.id
    }

    // ── 2) Já existe link? (idempotente)
    const { data: existing } = await supabase
      .from('vistoria_links')
      .select('id, token, status')
      .eq('instalacao_id', instalacaoId)
      .maybeSingle()

    if (existing && existing.status !== 'cancelado') {
      // Atualiza atribuições se vieram novas
      const patch: Record<string, any> = {}
      if (tecnico_atribuido_id) patch.tecnico_atribuido_id = tecnico_atribuido_id
      if (prestador_atribuido_id) patch.prestador_atribuido_id = prestador_atribuido_id
      if (vistoriaId) patch.vistoria_id = vistoriaId
      if (Object.keys(patch).length > 0) {
        await supabase.from('vistoria_links').update(patch).eq('id', existing.id)
      }
      return new Response(
        JSON.stringify({
          success: true,
          token: existing.token,
          url: `${BASE_URL}/vistoria/${existing.token}`,
          reused: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 3) Criar novo
    const { data: created, error: insErr } = await supabase
      .from('vistoria_links')
      .insert({
        instalacao_id: instalacaoId,
        vistoria_id: vistoriaId,
        tecnico_atribuido_id,
        prestador_atribuido_id,
        criado_por,
      })
      .select('id, token')
      .single()

    if (insErr || !created) {
      return new Response(
        JSON.stringify({ success: false, error: insErr?.message || 'Erro ao criar link' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        token: created.token,
        url: `${BASE_URL}/vistoria/${created.token}`,
        reused: false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Erro inesperado' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
