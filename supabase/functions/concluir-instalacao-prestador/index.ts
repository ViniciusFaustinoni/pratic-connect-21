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

    const { data: link, error: linkErr } = await supabase
      .from('instalacao_prestador_links')
      .select('id, instalacao_id, vistoriador_prestador_id, prestador_id, valor, atribuido_por, status')
      .eq('token', token)
      .in('status', ['aguardando', 'aceito', 'em_rota', 'em_execucao'])
      .maybeSingle()

    if (linkErr || !link) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido ou já utilizado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const agora = new Date().toISOString()
    const fotoComprovante = fotos_vistoria
      ? Object.values(fotos_vistoria as Record<string, string>)[0]
      : null

    // ── AÇÃO 1: Atualizar instalação ──
    await supabase
      .from('instalacoes')
      .update({ status: 'concluida', concluida_em: agora, updated_at: agora })
      .eq('id', link.instalacao_id)

    // ── AÇÃO 2: Atualizar link ──
    const { error: linkUpdateErr } = await supabase
      .from('instalacao_prestador_links')
      .update({
        status: 'concluida',
        concluida_em: agora,
        checklist_data,
        fotos_vistoria,
        assinatura_url,
        foto_comprovante_url: fotoComprovante,
        updated_at: agora,
      })
      .eq('id', link.id)

    if (linkUpdateErr) {
      console.error('Erro ao concluir link:', linkUpdateErr)
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao concluir instalação' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── DISPARO AUTOMÁTICO: enviar veículo para a plataforma de rastreamento ──
    let plataformaSyncResult: { plataforma?: string; ok: boolean; error?: string } = { ok: false }
    try {
      const { data: instal } = await supabase
        .from('instalacoes')
        .select('veiculo_id, associado_id')
        .eq('id', link.instalacao_id)
        .maybeSingle()

      if (instal?.veiculo_id) {
        const { data: rastreador } = await supabase
          .from('rastreadores')
          .select('id, imei, plataforma, plataforma_device_id, status')
          .eq('veiculo_id', instal.veiculo_id)
          .in('status', ['instalado', 'estoque'])
          .maybeSingle()

        if (rastreador?.imei && !rastreador.plataforma_device_id) {
          const { data: assoc } = await supabase
            .from('associados')
            .select('email')
            .eq('id', instal.associado_id)
            .maybeSingle()

          const fnName = rastreador.plataforma === 'softruck'
            ? 'softruck-ativar-dispositivo'
            : rastreador.plataforma === 'rede_veiculos'
              ? 'rede-veiculos-vincular-cliente'
              : null

          if (fnName) {
            console.log(`[concluir-instalacao] Disparando ${fnName} para ${rastreador.imei}`)
            try {
              const r = await supabase.functions.invoke(fnName, {
                body: {
                  imei: rastreador.imei,
                  veiculoId: instal.veiculo_id,
                  associadoId: instal.associado_id,
                  associadoEmail: assoc?.email,
                },
              })
              plataformaSyncResult = { plataforma: rastreador.plataforma, ok: r.error == null, error: r.error?.message }
            } catch (err: any) {
              console.warn('[concluir-instalacao] Falha ao sincronizar plataforma (não bloqueante):', err)
              plataformaSyncResult = { plataforma: rastreador.plataforma, ok: false, error: err?.message }
            }
          }
        } else {
          plataformaSyncResult = { ok: true, plataforma: rastreador?.plataforma }
        }
      }
    } catch (syncErr) {
      console.warn('[concluir-instalacao] Erro no disparo de sync (não bloqueante):', syncErr)
    }

    // ── Buscar dados completos ──
    const { data: instalacao } = await supabase
      .from('instalacoes')
      .select(`
        id, data_agendada, cidade, uf,
        veiculos:veiculo_id(marca, modelo, ano, placa),
        associados:associado_id(nome, email)
      `)
      .eq('id', link.instalacao_id)
      .single()

    let prestadorNome = 'Prestador externo'
    if (link.vistoriador_prestador_id) {
      const { data: vp } = await supabase
        .from('vistoriadores_prestadores')
        .select('nome')
        .eq('id', link.vistoriador_prestador_id)
        .maybeSingle()
      prestadorNome = vp?.nome || prestadorNome
    } else if (link.prestador_id) {
      const { data: pa } = await supabase
        .from('prestadores_assistencia')
        .select('razao_social, nome_fantasia')
        .eq('id', link.prestador_id)
        .maybeSingle()
      prestadorNome = pa?.nome_fantasia || pa?.razao_social || prestadorNome
    }

    const veiculo = instalacao?.veiculos as any
    const associado = instalacao?.associados as any
    const veiculoDesc = veiculo ? `${veiculo.marca || ''} ${veiculo.modelo || ''}`.trim() : 'Veículo'
    const placa = veiculo?.placa || '---'
    const cidadeInst = instalacao?.cidade || '---'

    // ── Notificar coordenador ──
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

          const { data: whatsResp } = await supabase.functions.invoke('whatsapp-send-text', {
            body: {
              telefone: telefoneCompleto,
              template_name: 'notificacao_geral_v1',
              template_params: [
                coordenador.nome?.split(' ')[0] || 'Coordenador',
                'Instalação Prestador concluída',
                `${prestadorNome} finalizou a instalação do veículo ${placa} em ${cidadeInst}`,
              ],
            },
          })
          whatsappEnviado = whatsResp?.success === true
        }
      }
    } catch (whatsErr) {
      console.error('Erro WhatsApp (não bloqueante):', whatsErr)
    }

    // ── Notificação interna ──
    try {
      await supabase.from('notificacoes_sistema').insert({
        titulo: '✅ Instalação Prestador Concluída',
        mensagem: `${prestadorNome} concluiu a instalação do veículo ${veiculoDesc} (${placa}) em ${cidadeInst}.`,
        tipo: 'instalacao_prestador_concluida',
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
        usuario_nome: prestadorNome,
        acao: 'aprovar',
        modulo: 'instalacoes',
        descricao: `Instalação prestador concluída: ${prestadorNome} — ${veiculoDesc} (${placa}) — ${cidadeInst}`,
        registro_id: link.instalacao_id,
        dados_novos: {
          link_id: link.id,
          prestador_nome: prestadorNome,
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
    console.error('Erro geral concluir-instalacao-prestador:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
