import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { token, checklist_data, fotos_vistoria, assinatura_url } = await req.json()

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Buscar link pelo token ──
    const { data: link, error: linkErr } = await supabase
      .from('vistoria_prestador_links')
      .select('id, instalacao_id, vistoriador_prestador_id, valor, atribuido_por, status')
      .eq('token', token)
      .in('status', ['aguardando', 'em_execucao'])
      .maybeSingle()

    if (linkErr || !link) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido ou já utilizado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const agora = new Date().toISOString()

    // ── AÇÃO 1: Atualizar status da instalação para concluida ──
    const { error: instErr } = await supabase
      .from('instalacoes')
      .update({ status: 'concluida', updated_at: agora })
      .eq('id', link.instalacao_id)

    if (instErr) {
      console.error('Erro ao atualizar instalação:', instErr)
    }

    // ── AÇÃO 2: Invalidar o token + salvar evidências ──
    const { error: linkUpdateErr } = await supabase
      .from('vistoria_prestador_links')
      .update({
        status: 'concluida',
        concluida_em: agora,
        checklist_data,
        fotos_vistoria,
        assinatura_url,
        updated_at: agora,
      })
      .eq('id', link.id)

    if (linkUpdateErr) {
      console.error('Erro ao invalidar token:', linkUpdateErr)
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao concluir vistoria' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Buscar dados completos para ações seguintes ──
    const { data: instalacao } = await supabase
      .from('instalacoes')
      .select(`
        id, data_agendada, cidade, uf,
        veiculos:veiculo_id(marca, modelo, ano, placa),
        associados:associado_id(nome)
      `)
      .eq('id', link.instalacao_id)
      .single()

    const { data: prestador } = await supabase
      .from('vistoriadores_prestadores')
      .select('id, nome, cidade')
      .eq('id', link.vistoriador_prestador_id)
      .single()

    const veiculo = instalacao?.veiculos as any
    const associado = instalacao?.associados as any
    const veiculoDesc = veiculo ? `${veiculo.marca || ''} ${veiculo.modelo || ''}`.trim() : 'Veículo'
    const placa = veiculo?.placa || '---'
    const cidadeInst = instalacao?.cidade || prestador?.cidade || '---'

    // ── AÇÃO 4: Atualizar lançamento financeiro ──
    try {
      const { data: lancamento } = await supabase
        .from('lancamentos_contabeis')
        .select('id, complemento')
        .eq('origem', 'vistoria_prestador')
        .eq('origem_id', link.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (lancamento) {
        const complementoAtual = lancamento.complemento || ''
        const novoComplemento = `${complementoAtual}\nConcluída em: ${agora}. Link: ${link.id}`.trim()

        await supabase
          .from('lancamentos_contabeis')
          .update({ complemento: novoComplemento, updated_at: agora })
          .eq('id', lancamento.id)
      }
    } catch (finErr) {
      console.error('Erro financeiro (não bloqueante):', finErr)
    }

    // ── AÇÃO 5: Notificar coordenador via WhatsApp ──
    let whatsappEnviado = false
    try {
      if (link.atribuido_por) {
        const { data: coordenador } = await supabase
          .from('profiles')
          .select('nome, telefone')
          .eq('id', link.atribuido_por)
          .maybeSingle()

        if (coordenador?.telefone) {
          const telFmt = coordenador.telefone.replace(/\D/g, '')
          const telefoneCompleto = telFmt.startsWith('55') ? telFmt : `55${telFmt}`

          const mensagem = `✅ *Vistoria concluída — PraticCar*\n\nPrestador: ${prestador?.nome || '---'}\nInstalação: #${instalacao?.id?.substring(0, 8) || '---'}\nVeículo: ${veiculoDesc} — ${placa}\nCidade: ${cidadeInst}\nConcluída em: ${new Date(agora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n\nAcesse o sistema para revisar as evidências.`

          const { data: whatsResp } = await supabase.functions.invoke('whatsapp-send-text', {
            body: {
              telefone: telefoneCompleto,
              mensagem,
              template_name: 'notificacao_geral_v1',
              template_params: [
                coordenador.nome?.split(' ')[0] || 'Coordenador',
                'Vistoria Prestador concluída',
                `${prestador?.nome || ''} finalizou a vistoria do veículo ${placa} em ${cidadeInst}`,
              ],
            },
          })

          whatsappEnviado = whatsResp?.success === true
        }
      }
    } catch (whatsErr) {
      console.error('Erro WhatsApp (não bloqueante):', whatsErr)
    }

    // ── AÇÃO 6: Notificação interna no painel ──
    try {
      await supabase.from('notificacoes_sistema').insert({
        titulo: '✅ Vistoria Prestador Concluída',
        mensagem: `${prestador?.nome || 'Prestador'} concluiu a vistoria do veículo ${veiculoDesc} (${placa}) em ${cidadeInst}.`,
        tipo: 'vistoria_prestador_concluida',
        destino: 'role',
        destino_role: 'coordenador_monitoramento',
        link: `/monitoramento/instalacoes/${link.instalacao_id}`,
      })
    } catch (notifErr) {
      console.error('Erro notificação (não bloqueante):', notifErr)
    }

    // ── Auditoria ──
    try {
      await supabase.from('logs_auditoria').insert({
        usuario_id: link.atribuido_por,
        usuario_nome: prestador?.nome || 'Prestador externo',
        acao: 'aprovar',
        modulo: 'instalacoes',
        descricao: `Vistoria prestador concluída: ${prestador?.nome || '---'} — ${veiculoDesc} (${placa}) — ${cidadeInst}`,
        registro_id: link.instalacao_id,
        dados_novos: {
          link_id: link.id,
          prestador_nome: prestador?.nome,
          valor: link.valor,
          whatsapp_coordenador: whatsappEnviado,
          concluida_em: agora,
        },
      })
    } catch (auditErr) {
      console.error('Erro auditoria (não bloqueante):', auditErr)
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Erro geral concluir-vistoria-prestador:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
