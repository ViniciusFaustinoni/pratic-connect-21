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

    const body = await req.json()
    // Aceita tanto 'vistoriador_prestador_id' (novo padrão, paridade com vistoria)
    // quanto 'prestador_id' (legado, prestadores_assistencia) para retrocompatibilidade
    const {
      instalacao_id,
      vistoriador_prestador_id,
      prestador_id, // legado
      valor,
      atribuido_por,
      reenviar,
      skip_whatsapp,
    } = body

    const prestadorIdFinal = vistoriador_prestador_id || prestador_id

    if (!instalacao_id || !prestadorIdFinal) {
      return new Response(
        JSON.stringify({ success: false, error: 'instalacao_id e vistoriador_prestador_id são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Determina qual coluna usar (prefere vistoriador_prestador_id quando aplicável)
    // Verifica se o prestador existe em vistoriadores_prestadores; se não, usa prestadores_assistencia
    let usaVistoriadorPrestador = false
    let prestadorData: any = null

    const { data: vp } = await supabase
      .from('vistoriadores_prestadores')
      .select('id, nome, telefone, cidade')
      .eq('id', prestadorIdFinal)
      .maybeSingle()

    if (vp) {
      usaVistoriadorPrestador = true
      prestadorData = { nome: vp.nome, whatsapp: vp.telefone, cidade: vp.cidade }
    } else {
      const { data: pa, error: paErr } = await supabase
        .from('prestadores_assistencia')
        .select('id, razao_social, nome_fantasia, whatsapp, telefone, cidade')
        .eq('id', prestadorIdFinal)
        .single()
      if (paErr || !pa) {
        return new Response(
          JSON.stringify({ success: false, error: 'Prestador não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      prestadorData = {
        nome: pa.nome_fantasia || pa.razao_social,
        whatsapp: pa.whatsapp || pa.telefone,
        cidade: pa.cidade,
      }
    }

    // ── AÇÃO 1: Reusar link ativo ou criar novo ──
    const colunaPrestador = usaVistoriadorPrestador ? 'vistoriador_prestador_id' : 'prestador_id'
    let linkToken: string
    let linkId: string

    const { data: existingLink } = await supabase
      .from('instalacao_prestador_links')
      .select('id, token')
      .eq('instalacao_id', instalacao_id)
      .eq(colunaPrestador, prestadorIdFinal)
      .in('status', ['aguardando', 'aceito', 'em_rota', 'em_execucao'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingLink) {
      linkToken = existingLink.token
      linkId = existingLink.id
    } else {
      const insertPayload: any = {
        instalacao_id,
        valor,
        atribuido_por,
      }
      insertPayload[colunaPrestador] = prestadorIdFinal

      const { data: newLink, error: linkErr } = await supabase
        .from('instalacao_prestador_links')
        .insert(insertPayload)
        .select('id, token')
        .single()

      if (linkErr) {
        console.error('Erro ao criar link:', linkErr)
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao gerar link' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      linkToken = newLink.token
      linkId = newLink.id
    }

    // ── AÇÃO 2: Buscar dados da instalação ──
    const { data: instalacao } = await supabase
      .from('instalacoes')
      .select(`
        id, data_agendada, periodo, logradouro, numero, complemento, bairro, cidade, uf, cep,
        associados:associado_id(id, nome, telefone),
        veiculos:veiculo_id(marca, modelo, placa)
      `)
      .eq('id', instalacao_id)
      .single()

    if (!instalacao) {
      return new Response(
        JSON.stringify({ success: false, error: 'Instalação não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const baseUrl = 'https://app.praticcar.org'
    const url = `${baseUrl}/prestador/instalacao/${linkToken}`

    const endereco = [
      instalacao.logradouro,
      instalacao.numero ? `nº ${instalacao.numero}` : null,
      instalacao.bairro,
      instalacao.cidade,
      instalacao.uf,
    ].filter(Boolean).join(', ')

    const associado = (instalacao.associados as any)
    const nomeAssociado = associado?.nome || 'Associado'
    const dataAgendada = instalacao.data_agendada
      ? new Date(instalacao.data_agendada + 'T12:00:00').toLocaleDateString('pt-BR')
      : 'A definir'

    // ── AÇÃO 3: Enviar WhatsApp ──
    let whatsappEnviado = false
    let whatsappErro: string | null = null

    if (prestadorData.whatsapp) {
      const telefoneLimpo = String(prestadorData.whatsapp).replace(/\D/g, '')
      const telefoneFormatado = telefoneLimpo.startsWith('55') ? telefoneLimpo : `55${telefoneLimpo}`

      try {
        const { data: whatsResp } = await supabase.functions.invoke('whatsapp-send-text', {
          body: {
            telefone: telefoneFormatado,
            template_nome: 'prestador_nova_tarefa_v1',
            variaveis: {
              '1': prestadorData.nome,
              '2': `Instalação — ${nomeAssociado}`,
              '3': instalacao.cidade || 'município',
              '4': url,
            },
            mensagem_fallback: `Olá ${prestadorData.nome}! ${reenviar ? '(Reenvio) ' : ''}Nova instalação em ${instalacao.cidade || 'município'}.\n\nAssociado: ${nomeAssociado}\nEndereço: ${endereco}\nData: ${dataAgendada}\n\nAcesse os detalhes e confirme pelo link:\n${url}`,
            allow_text: true,
          },
        })
        whatsappEnviado = whatsResp?.success === true
      } catch (whatsErr: any) {
        whatsappErro = whatsErr?.message || 'Falha ao enviar WhatsApp'
        console.error('Erro ao enviar WhatsApp (não bloqueante):', whatsErr)
      }
    }

    // ── AÇÃO 4: Persistir status do envio no link ──
    await supabase
      .from('instalacao_prestador_links')
      .update({ whatsapp_enviado: whatsappEnviado, whatsapp_erro: whatsappErro })
      .eq('id', linkId)

    // ── AÇÃO 5: Auditoria ──
    if (!reenviar) {
      try {
        await supabase.from('logs_auditoria').insert({
          usuario_id: atribuido_por,
          acao: 'criar',
          modulo: 'instalacoes',
          descricao: `Instalação atribuída ao prestador externo ${prestadorData.nome} — ${instalacao.cidade || ''}`,
          registro_id: instalacao_id,
          dados_novos: {
            link_id: linkId,
            prestador_id: prestadorIdFinal,
            prestador_nome: prestadorData.nome,
            valor,
            whatsapp_enviado: whatsappEnviado,
          },
        })
      } catch (auditErr) {
        console.error('Erro auditoria (não bloqueante):', auditErr)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        token: linkToken,
        url,
        prestador_nome: prestadorData.nome,
        whatsapp_enviado: whatsappEnviado,
        whatsapp_erro: whatsappErro,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Erro geral gerar-link-prestador:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
