import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
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

    const { instalacao_id, vistoria_id, vistoriador_prestador_id, valor: valorRaw, atribuido_por, reenviar, skip_whatsapp } = await req.json()

    // Valor é OPCIONAL: vazio/0/null gera o link normalmente; pode ser ajustado depois pela operação.
    const valorNum = (valorRaw === null || valorRaw === undefined || valorRaw === '' || isNaN(Number(valorRaw)))
      ? 0
      : Number(valorRaw)
    const valor = valorNum > 0 ? valorNum : null

    if ((!instalacao_id && !vistoria_id) || !vistoriador_prestador_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'instalacao_id ou vistoria_id, e vistoriador_prestador_id, são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Garantir que existe registro em vistoriadores_prestadores (espelha de prestadores_instalacao se necessário)
    const { data: vpExist } = await supabase
      .from('vistoriadores_prestadores')
      .select('id')
      .eq('id', vistoriador_prestador_id)
      .maybeSingle()

    if (!vpExist) {
      const { data: pi } = await supabase
        .from('prestadores_instalacao')
        .select('id, nome, whatsapp')
        .eq('id', vistoriador_prestador_id)
        .maybeSingle()

      if (pi) {
        const { error: upErr } = await supabase
          .from('vistoriadores_prestadores')
          .upsert({ id: pi.id, nome: pi.nome, telefone: pi.whatsapp, ativo: true }, { onConflict: 'id' })
        if (upErr) console.error('Erro ao espelhar prestador_instalacao:', upErr)
      } else {
        return new Response(
          JSON.stringify({ success: false, error: 'Prestador não encontrado em vistoriadores_prestadores nem prestadores_instalacao' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // ── AÇÃO 1: Gerar ou reusar token ──
    let linkToken: string
    let linkId: string

    // Check for existing active link (by instalacao_id OR vistoria_id)
    const baseQuery = supabase
      .from('vistoria_prestador_links')
      .select('id, token')
      .eq('vistoriador_prestador_id', vistoriador_prestador_id)
      .in('status', ['aguardando', 'em_execucao'])
      .order('created_at', { ascending: false })
      .limit(1)

    const { data: existingLink } = instalacao_id
      ? await baseQuery.eq('instalacao_id', instalacao_id).maybeSingle()
      : await baseQuery.eq('vistoria_id', vistoria_id).maybeSingle()

    if (existingLink) {
      linkToken = existingLink.token
      linkId = existingLink.id
    } else {
      const { data: newLink, error: linkErr } = await supabase
        .from('vistoria_prestador_links')
        .insert({
          instalacao_id: instalacao_id || null,
          vistoria_id: vistoria_id || null,
          vistoriador_prestador_id,
          valor, // pode ser null — será definido pela operação posteriormente
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

    // Update instalacoes table if not reenviar (apenas quando há instalacao)
    if (!reenviar && instalacao_id) {
      await supabase
        .from('instalacoes')
        .update({
          vistoriador_prestador_id,
          valor_prestador: valor,
          prestador_atribuido_em: new Date().toISOString(),
        })
        .eq('id', instalacao_id)
    }

    const baseUrl = 'https://app.praticcar.org'
    const url = `${baseUrl}/vistoria-prestador/${linkToken}`

    // ── AÇÃO 2: WhatsApp ──
    // Buscar dados completos — pode vir de instalacoes (pós-instalação) ou vistorias+agendamento_base+oficina (vistoria base)
    let dadosCtx: {
      data_agendada: string | null
      periodo: string | null
      logradouro: string | null
      numero: string | null
      bairro: string | null
      cidade: string | null
      uf: string | null
      associado: { nome?: string | null; telefone?: string | null } | null
      veiculo: { marca?: string | null; modelo?: string | null; ano?: number | null; placa?: string | null } | null
    } | null = null

    if (instalacao_id) {
      const { data: instalacao } = await supabase
        .from('instalacoes')
        .select(`
          data_agendada, periodo, logradouro, numero, complemento, bairro, cidade, uf, cep,
          associados:associado_id(id, nome, telefone),
          veiculos:veiculo_id(id, marca, modelo, ano, placa)
        `)
        .eq('id', instalacao_id)
        .single()

      if (instalacao) {
        dadosCtx = {
          data_agendada: instalacao.data_agendada as any,
          periodo: instalacao.periodo as any,
          logradouro: instalacao.logradouro as any,
          numero: instalacao.numero as any,
          bairro: instalacao.bairro as any,
          cidade: instalacao.cidade as any,
          uf: instalacao.uf as any,
          associado: (instalacao as any).associados,
          veiculo: (instalacao as any).veiculos,
        }
      }
    } else if (vistoria_id) {
      const { data: vist } = await supabase
        .from('vistorias')
        .select(`
          id, data_agendada, local_vistoria, endereco_logradouro, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado,
          associados:associado_id(id, nome, telefone),
          veiculos:veiculo_id(id, marca, modelo, ano, placa)
        `)
        .eq('id', vistoria_id)
        .single()

      // Se vistoria base, pega endereço da oficina via agendamento_base
      let oficinaEnd: any = null
      let periodoFromAg: string | null = null
      if (vist) {
        const { data: ag } = await supabase
          .from('agendamentos_base')
          .select('horario, oficina_id')
          .eq('vistoria_id', vistoria_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (ag?.oficina_id) {
          const { data: of } = await supabase
            .from('oficinas')
            .select('logradouro, numero, bairro, cidade, estado')
            .eq('id', ag.oficina_id)
            .maybeSingle()
          oficinaEnd = of
        }
        if (ag?.horario) {
          const h = String(ag.horario).slice(0, 5)
          periodoFromAg = h < '12:00' ? 'manha' : 'tarde'
        }
      }

      if (vist) {
        dadosCtx = {
          data_agendada: vist.data_agendada ? String(vist.data_agendada).slice(0, 10) : null,
          periodo: periodoFromAg,
          logradouro: oficinaEnd?.logradouro || vist.endereco_logradouro || null,
          numero: oficinaEnd?.numero || vist.endereco_numero || null,
          bairro: oficinaEnd?.bairro || vist.endereco_bairro || null,
          cidade: oficinaEnd?.cidade || vist.endereco_cidade || null,
          uf: oficinaEnd?.estado || vist.endereco_estado || null,
          associado: (vist as any).associados,
          veiculo: (vist as any).veiculos,
        }
      }
    }

    if (!dadosCtx) {
      return new Response(
        JSON.stringify({ success: true, token: linkToken, url, whatsapp_enviado: false, erro_whatsapp: 'Dados de origem não encontrados' }),
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
    const associado = dadosCtx.associado
    const veiculo = dadosCtx.veiculo
    const nomeAssociado = associado?.nome || 'Associado'
    const veiculoDesc = veiculo ? `${veiculo.marca || ''} ${veiculo.modelo || ''} ${veiculo.ano || ''}`.trim() : 'Não informado'
    const placaVeiculo = veiculo?.placa || 'Não informada'

    const endereco = [
      dadosCtx.logradouro,
      dadosCtx.numero ? `${dadosCtx.numero}` : null,
      dadosCtx.bairro ? `— ${dadosCtx.bairro}` : null,
      dadosCtx.cidade ? `— ${dadosCtx.cidade}/${dadosCtx.uf}` : null,
    ].filter(Boolean).join(' ')

    const dataAgendada = dadosCtx.data_agendada
      ? new Date(dadosCtx.data_agendada + 'T12:00:00').toLocaleDateString('pt-BR')
      : 'A definir'

    const periodoLabels: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', integral: 'Integral' }
    const periodoStr = dadosCtx.periodo ? periodoLabels[dadosCtx.periodo] || dadosCtx.periodo : ''
    const dataHora = periodoStr ? `${dataAgendada} — ${periodoStr}` : dataAgendada

    // Validate required fields
    const camposFaltantes: string[] = []
    if (!prestador.telefone) camposFaltantes.push('telefone do prestador')
    if (!dadosCtx.cidade) camposFaltantes.push('cidade da vistoria/instalação')

    let whatsappEnviado = false
    let whatsappErro: string | null = null

    if (skip_whatsapp) {
      whatsappErro = 'skip_whatsapp=true'
    } else if (camposFaltantes.length > 0) {
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
            mensagem,
            template_name: 'tarefa_vistoriador_v2',
            template_params: [
              prestador.nome,
              `${nomeAssociado} - ${veiculoDesc} (${placaVeiculo})`.substring(0, 280),
              (instalacao.cidade || endereco || 'município').substring(0, 200),
              dataHora,
            ],
          },
        })

        if (wppErr) {
          whatsappErro = wppErr.message || 'Erro ao enviar WhatsApp'
          console.error('Erro WhatsApp:', wppErr)
        } else {
          whatsappEnviado = true
        }
      } catch (e) {
        whatsappErro = getErrorMessage(e) || 'Erro inesperado ao enviar WhatsApp'
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
    if (!reenviar && (valor ?? 0) > 0) {
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
          descricao: `Atribuição de vistoriador prestador: ${prestador.nome} — Valor: ${valor != null ? `R$ ${valor.toFixed(2)}` : 'a definir'} — WhatsApp: ${whatsappEnviado ? 'enviado' : 'falha'}`,
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
      JSON.stringify({ success: false, error: getErrorMessage(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
