// Marca a tarefa de vistoria como em andamento assim que alguém toca em
// uma das etapas no link público (fotos ou instalação). Idempotente: só
// avança status se ainda estiver em estados pré-execução. Reflete o
// "em andamento" no monitoramento sem precisar mudar o painel.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Status considerados "anteriores à execução" — só esses podem ser
// promovidos para em_andamento. Status terminais ou já em andamento são
// preservados.
const PRE_EXEC_INSTALACAO = ['agendada', 'pendente', 'pendente_agendamento', 'aguardando_atribuicao']
const PRE_EXEC_VISTORIA = ['agendada', 'pendente', 'em_analise']
const PRE_EXEC_SERVICO = ['agendada', 'pendente', 'em_rota', 'em_analise']

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
      etapa, // 'fotos' | 'instalacao'
      executor_nome = null,
      executor_telefone = null,
      executor_user_id = null,
    } = body as Record<string, any>

    if (!token || !etapa || !['fotos', 'instalacao'].includes(etapa)) {
      return new Response(
        JSON.stringify({ success: false, error: 'token e etapa (fotos|instalacao) são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 1) Buscar link
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

    if (link.status === 'cancelado' || link.status === 'concluido') {
      return new Response(
        JSON.stringify({ success: true, message: 'Link já finalizado/cancelado', skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const agora = new Date().toISOString()

    // 2) Atualizar etapa do link (idempotente: só pendente -> em_andamento)
    const etapaCol = etapa === 'fotos' ? 'fotos_etapa_status' : 'instalacao_etapa_status'
    const linkPatch: Record<string, any> = {}
    if (link[etapaCol] === 'pendente') {
      linkPatch[etapaCol] = 'em_andamento'
    }
    if (!link.iniciada_em) {
      linkPatch.iniciada_em = agora
    }

    // Auditoria de quem iniciou (não sobrescreve)
    if (!link.iniciada_por_user_id && executor_user_id) {
      linkPatch.iniciada_por_user_id = executor_user_id
    }
    if (!link.iniciada_por_nome && executor_nome) {
      linkPatch.iniciada_por_nome = String(executor_nome).trim()
    }
    if (etapa === 'fotos') {
      if (!link.fotos_executor_nome && executor_nome) {
        // Pré-registra nome de quem está realizando para auditoria, ainda
        // que a etapa só conclua depois.
        linkPatch.fotos_executor_nome = String(executor_nome).trim()
      }
      if (executor_telefone && !link.fotos_executor_telefone) {
        linkPatch.fotos_executor_telefone = String(executor_telefone).trim()
      }
    }

    if (Object.keys(linkPatch).length > 0) {
      await supabase.from('vistoria_links').update(linkPatch).eq('id', link.id)
    }

    // 3) Promover instalação -> em_andamento (se em estado pré-execução)
    if (link.instalacao_id) {
      const { data: inst } = await supabase
        .from('instalacoes')
        .select('status, iniciada_em')
        .eq('id', link.instalacao_id)
        .maybeSingle()

      if (inst && PRE_EXEC_INSTALACAO.includes(String(inst.status))) {
        const patch: Record<string, any> = {
          status: 'em_andamento',
          updated_at: agora,
        }
        if (!inst.iniciada_em) patch.iniciada_em = agora
        await supabase.from('instalacoes').update(patch).eq('id', link.instalacao_id)
      } else if (inst && !inst.iniciada_em) {
        // Mesmo sem trocar status, garante iniciada_em preenchida
        await supabase
          .from('instalacoes')
          .update({ iniciada_em: agora, updated_at: agora })
          .eq('id', link.instalacao_id)
      }
    }

    // 4) Promover vistoria -> em_andamento (se aplicável)
    if (link.vistoria_id) {
      const { data: vist } = await supabase
        .from('vistorias')
        .select('status, iniciada_em')
        .eq('id', link.vistoria_id)
        .maybeSingle()

      if (vist && PRE_EXEC_VISTORIA.includes(String(vist.status))) {
        const patch: Record<string, any> = {
          status: 'em_andamento',
          updated_at: agora,
        }
        if (!vist.iniciada_em) patch.iniciada_em = agora
        await supabase.from('vistorias').update(patch).eq('id', link.vistoria_id)
      } else if (vist && !vist.iniciada_em) {
        await supabase
          .from('vistorias')
          .update({ iniciada_em: agora, updated_at: agora })
          .eq('id', link.vistoria_id)
      }

      // 5) Propagar para serviço materializado (mesma chave usada na conclusão)
      const { data: servs } = await supabase
        .from('servicos')
        .select('id, status, iniciada_em')
        .eq('vistoria_origem_id', link.vistoria_id)

      if (servs && servs.length > 0) {
        for (const s of servs) {
          if (PRE_EXEC_SERVICO.includes(String(s.status))) {
            const patch: Record<string, any> = {
              status: 'em_andamento',
              updated_at: agora,
            }
            if (!s.iniciada_em) patch.iniciada_em = agora
            await supabase.from('servicos').update(patch).eq('id', s.id)
          }
        }
      }
    }

    // 6) Histórico do associado (não bloqueante)
    try {
      const { data: inst } = await supabase
        .from('instalacoes')
        .select('associado_id')
        .eq('id', link.instalacao_id)
        .maybeSingle()

      if (inst?.associado_id) {
        await supabase.from('associados_historico').insert({
          associado_id: inst.associado_id,
          tipo: 'vistoria_iniciada',
          descricao: `Etapa "${etapa === 'fotos' ? 'Fotos & Vídeo' : 'Instalação do Rastreador'}" iniciada via link público`,
          dados_novos: {
            vistoria_link_id: link.id,
            etapa,
            executor_nome: executor_nome || null,
            executor_user_id: executor_user_id || null,
          },
        })
      }
    } catch (_) {
      /* silencioso */
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: any) {
    console.error('[iniciar-etapa-vistoria-publica] erro:', err)
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Erro inesperado' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
