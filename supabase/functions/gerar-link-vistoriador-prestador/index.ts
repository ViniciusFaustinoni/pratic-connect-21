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

    const { instalacao_id, vistoriador_prestador_id, valor, atribuido_por, reenviar } = await req.json()

    if (!instalacao_id || !vistoriador_prestador_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'instalacao_id e vistoriador_prestador_id são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── AÇÃO 1: Gerar ou reusar token ──
    let linkToken: string
    let linkId: string

    // Check for existing active link
    const { data: existingLink } = await supabase
      .from('vistoria_prestador_links')
      .select('id, token')
      .eq('instalacao_id', instalacao_id)
      .eq('vistoriador_prestador_id', vistoriador_prestador_id)
      .in('status', ['aguardando', 'em_execucao'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingLink) {
      linkToken = existingLink.token
      linkId = existingLink.id
    } else {
      if (!valor || valor <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Valor é obrigatório para nova atribuição' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: newLink, error: linkErr } = await supabase
        .from('vistoria_prestador_links')
        .insert({
          instalacao_id,
          vistoriador_prestador_id,
          valor,
          atribuido_por,
        })
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

    // Update instalacoes table if not reenviar
    if (!reenviar) {
      await supabase
        .from('instalacoes')
        .update({
          vistoriador_prestador_id,
          valor_prestador: valor,
          prestador_atribuido_em: new Date().toISOString(),
        })
        .eq('id', instalacao_id)
    }

    const baseUrl = 'https://pratic-connect-21.lovable.app'
    const url = `${baseUrl}/vistoria-prestador/${linkToken}`

    // ── AÇÃO 2: WhatsApp ──
    // Buscar dados completos
    const { data: instalacao, error: instErr } = await supabase
      .from('instalacoes')
      .select(`
        id, data_agendada, periodo, logradouro, numero, complemento, bairro, cidade, uf, cep,
        associados:associado_id(id, nome, telefone),
        veiculos:veiculo_id(id, marca, modelo, ano, placa)
      `)
      .eq('id', instalacao_id)
      .single()

    if (instErr || !instalacao) {
      console.error('Erro ao buscar instalação:', instErr)
      // Don't fail - link was created, just can't send WhatsApp
      return new Response(
        JSON.stringify({ success: true, token: linkToken, url, whatsapp_enviado: false, erro_whatsapp: 'Instalação não encontrada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: prestador } = await supabase
      .from('vistoriadores_prestadores')
      .select('id, nome, telefone, email')
      .eq('id', vistoriador_prestador_id)
      .single()

    if (!prestador) {
      return new Response(
        JSON.stringify({ success: true, token: linkToken, url, whatsapp_enviado: false, erro_whatsapp: 'Prestador não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build message fields
    const associado = (instalacao as any).associados
    const veiculo = (instalacao as any).veiculos
    const nomeAssociado = associado?.nome || 'Associado'
    const veiculoDesc = veiculo ? `${veiculo.marca || ''} ${veiculo.modelo || ''} ${veiculo.ano || ''}`.trim() : 'Não informado'
    const placaVeiculo = veiculo?.placa || 'Não informada'

    const endereco = [
      instalacao.logradouro,
      instalacao.numero ? `${instalacao.numero}` : null,
      instalacao.bairro ? `— ${instalacao.bairro}` : null,
      instalacao.cidade ? `— ${instalacao.cidade}/${instalacao.uf}` : null,
    ].filter(Boolean).join(' ')

    const dataAgendada = instalacao.data_agendada
      ? new Date(instalacao.data_agendada + 'T12:00:00').toLocaleDateString('pt-BR')
      : 'A definir'

    const periodoLabels: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', integral: 'Integral' }
    const periodoStr = instalacao.periodo ? periodoLabels[instalacao.periodo] || instalacao.periodo : ''
    const dataHora = periodoStr ? `${dataAgendada} — ${periodoStr}` : dataAgendada

    // Validate required fields
    const camposFaltantes: string[] = []
    if (!prestador.telefone) camposFaltantes.push('telefone do prestador')
    if (!instalacao.cidade) camposFaltantes.push('cidade da instalação')

    let whatsappEnviado = false
    let whatsappErro: string | null = null

    if (camposFaltantes.length > 0) {
      whatsappErro = `Campos obrigatórios ausentes: ${camposFaltantes.join(', ')}`
      console.error('Campos faltantes para WhatsApp:', whatsappErro)
    } else {
      // Build formatted message
      const mensagem = `📋 *Nova tarefa de vistoria — PraticCar*

Olá, ${prestador.nome}!

Você recebeu uma tarefa de vistoria. Seguem os dados:

🚗 *Veículo:* ${veiculoDesc}
🔢 *Placa:* ${placaVeiculo}
📍 *Endereço:* ${endereco}
📅 *Data/Hora:* ${dataHora}
👤 *Associado:* ${nomeAssociado}

Acesse o link abaixo para realizar a vistoria:
🔗 ${url}

_Dúvidas? Entre em contato com o coordenador._`

      const telefoneLimpo = prestador.telefone!.replace(/\D/g, '')
      const telefoneFormatado = telefoneLimpo.startsWith('55') ? telefoneLimpo : `55${telefoneLimpo}`

      try {
        const { error: wppErr } = await supabase.functions.invoke('whatsapp-send-text', {
          body: {
            telefone: telefoneFormatado,
            template_nome: 'notificacao_geral_v1',
            variaveis: {
              '1': prestador.nome,
              '2': `Vistoria em ${instalacao.cidade}: ${veiculoDesc} (${placaVeiculo})`,
            },
            mensagem_fallback: mensagem,
            allow_text: true,
          },
        })

        if (wppErr) {
          whatsappErro = wppErr.message || 'Erro ao enviar WhatsApp'
          console.error('Erro WhatsApp:', wppErr)
        } else {
          whatsappEnviado = true
        }
      } catch (e) {
        whatsappErro = e.message || 'Erro inesperado ao enviar WhatsApp'
        console.error('Erro WhatsApp (catch):', e)
      }
    }

    // Update link with WhatsApp status
    await supabase
      .from('vistoria_prestador_links')
      .update({
        whatsapp_enviado: whatsappEnviado,
        whatsapp_erro: whatsappErro,
        updated_at: new Date().toISOString(),
      })
      .eq('id', linkId)

    // ── AÇÃO 3: Lançamento financeiro (apenas se nova atribuição) ──
    if (!reenviar && valor > 0) {
      try {
        const historico = `Vistoria Prestador — ${prestador.nome} — ${instalacao.cidade || 'Cidade'} — ${dataAgendada}`
        
        const { data: lancamento, error: lancErr } = await supabase
          .from('lancamentos_contabeis')
          .insert({
            data_lancamento: new Date().toISOString().split('T')[0],
            data_competencia: instalacao.data_agendada || new Date().toISOString().split('T')[0],
            origem: 'vistoria_prestador',
            origem_id: linkId,
            historico,
            status: 'ativo',
            criado_por: atribuido_por,
          })
          .select('id')
          .single()

        if (lancErr) {
          console.error('Erro ao criar lançamento contábil:', lancErr)
        } else if (lancamento) {
          // Conta débito: Despesa de vistoria (usando TAXAS_VISTORIA como despesa)
          // Conta crédito: Provisão
          const CONTA_DESPESA = '3963d9f8-a8db-418b-98a3-95612d0eacbc' // 4.1.02.002 Taxas vistoria
          const CONTA_PROVISAO = '251f0eee-88ed-4ee6-b45b-411b42785263' // 2.1.04.001 Provisão sinistros

          await supabase.from('lancamentos_partidas').insert([
            { lancamento_id: lancamento.id, conta_id: CONTA_DESPESA, tipo: 'debito', valor, ordem: 1 },
            { lancamento_id: lancamento.id, conta_id: CONTA_PROVISAO, tipo: 'credito', valor, ordem: 2 },
          ])
        }
      } catch (finErr) {
        console.error('Erro financeiro (não bloqueante):', finErr)
      }
    }

    // ── AÇÃO 4: Auditoria ──
    if (!reenviar) {
      try {
        // Get profile name for atribuido_por
        let nomeAtribuidor = 'Sistema'
        if (atribuido_por) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('nome')
            .eq('id', atribuido_por)
            .maybeSingle()
          if (profile?.nome) nomeAtribuidor = profile.nome
        }

        await supabase.from('logs_auditoria').insert({
          usuario_id: atribuido_por,
          usuario_nome: nomeAtribuidor,
          acao: 'atribuir',
          modulo: 'instalacoes',
          descricao: `Atribuição de vistoriador prestador: ${prestador.nome} — Valor: R$ ${valor?.toFixed(2)} — WhatsApp: ${whatsappEnviado ? 'enviado' : 'falha'}`,
          registro_id: instalacao_id,
          dados_novos: {
            prestador_id: vistoriador_prestador_id,
            prestador_nome: prestador.nome,
            valor,
            token: linkToken,
            whatsapp_enviado: whatsappEnviado,
            whatsapp_erro: whatsappErro,
          },
        } as any)
      } catch (auditErr) {
        console.error('Erro auditoria (não bloqueante):', auditErr)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        token: linkToken,
        url,
        whatsapp_enviado: whatsappEnviado,
        whatsapp_erro: whatsappErro,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Erro geral:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
