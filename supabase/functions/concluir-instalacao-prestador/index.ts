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

    const { token, checklist_data, fotos_vistoria, assinatura_url, rastreador_imei } = await req.json()

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: link, error: linkErr } = await supabase
      .from('instalacao_prestador_links')
      .select('id, instalacao_id, prestador_id, valor, atribuido_por, status, dispensa_rastreador')
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

    // ── PRÉ-AÇÃO: validar/vincular IMEI do rastreador físico ──
    // Por que: o link do prestador é o ÚNICO ponto onde o equipamento
    // físico realmente instalado é informado. Sem vincular aqui,
    // instalacoes.rastreador_id fica NULL e o veículo aparece como
    // "instalação fantasma" em saneamentos por FIPE (vide caso CASSIO / LMX5A90).
    let rastreadorVinculado: { id: string; imei: string; plataforma: string | null } | null = null
    const imeiLimpo = typeof rastreador_imei === 'string' ? rastreador_imei.replace(/\D/g, '') : ''

    // Buscar dados do veículo para decidir se exige rastreador
    const { data: instVeic } = await supabase
      .from('instalacoes')
      .select('veiculo_id, associado_id, contrato_id, veiculos:veiculo_id(valor_fipe, combustivel, marca, modelo)')
      .eq('id', link.instalacao_id)
      .maybeSingle()

    const veic = (instVeic?.veiculos as any) || {}
    const isDiesel = String(veic.combustivel || '').toLowerCase().includes('diesel')
    const isMoto = /(honda|yamaha|suzuki|kawasaki|harley|bmw motorrad|royal enfield|dafra|haojue|shineray|kasinski|triumph|husqvarna|ducati|mv agusta|cf moto|sym|piaggio|vespa|traxx|sundown|garinni|kymco)/i.test(String(veic.marca || ''))
      || /(cb |cg |titan|biz|nmax|xre|fazer|bros|pop |xtz|hornet|cbr|gixxer|burgman|ybr|fan |factor)/i.test(String(veic.modelo || ''))
    const fipe = Number(veic.valor_fipe || 0)
    const exigeRastreador = isDiesel || (isMoto ? fipe >= 9000 : fipe >= 30000)

    if (exigeRastreador && !link.dispensa_rastreador && !imeiLimpo) {
      return new Response(
        JSON.stringify({ success: false, error: 'IMEI do rastreador é obrigatório para concluir esta instalação.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (imeiLimpo) {
      const { data: rast } = await supabase
        .from('rastreadores')
        .select('id, imei, plataforma, status, veiculo_id')
        .eq('imei', imeiLimpo)
        .maybeSingle()
      if (!rast) {
        return new Response(
          JSON.stringify({ success: false, error: `Rastreador IMEI ${imeiLimpo} não encontrado no estoque.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      if (rast.veiculo_id && rast.veiculo_id !== instVeic?.veiculo_id) {
        return new Response(
          JSON.stringify({ success: false, error: `Rastreador IMEI ${imeiLimpo} já está vinculado a outro veículo.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      rastreadorVinculado = { id: rast.id, imei: rast.imei, plataforma: rast.plataforma }
    }

    // ── AÇÃO 1: Atualizar instalação (já com rastreador físico vinculado) ──
    await supabase
      .from('instalacoes')
      .update({
        status: 'concluida',
        concluida_em: agora,
        rastreador_id: rastreadorVinculado?.id ?? null,
        imei_rastreador: rastreadorVinculado?.imei ?? null,
        updated_at: agora,
      })
      .eq('id', link.instalacao_id)

    // Vincular rastreador → veículo/associado no DB (Softruck é chamado mais abaixo)
    if (rastreadorVinculado && instVeic?.veiculo_id) {
      await supabase
        .from('rastreadores')
        .update({
          veiculo_id: instVeic.veiculo_id,
          associado_id: instVeic.associado_id,
          status: 'instalado',
          updated_at: agora,
        })
        .eq('id', rastreadorVinculado.id)
    }

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
        rastreador_imei: rastreadorVinculado?.imei ?? null,
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

    // ── AÇÃO 3: Materializar fotos do prestador como vistoria + vistoria_fotos canônicas ──
    // Por que: o módulo "Veículos" e os detalhes do associado leem de
    // contratos→vistorias→vistoria_fotos. Sem essa ponte, as fotos do
    // prestador ficam isoladas no jsonb do link e parecem "perdidas".
    // Idempotente por instalacao_id: se a vistoria já existe (re-execução
    // ou backfill), reutiliza e faz upsert das fotos.
    try {
      const { data: instMat, error: instMatErr } = await supabase
        .from('instalacoes')
        .select('id, contrato_id, associado_id, veiculo_id, cotacao_id, cep, logradouro, numero, complemento, bairro, cidade, uf, endereco_latitude, endereco_longitude, imei_rastreador, quilometragem, created_at')
        .eq('id', link.instalacao_id)
        .maybeSingle()

      if (instMatErr) console.error('[concluir-instalacao] erro ao buscar instalacao p/ materializar:', instMatErr)

      if (instMat?.contrato_id) {
        // 3.1 — vistoria canônica (uma por instalação)
        const { data: existingVistoria } = await supabase
          .from('vistorias')
          .select('id')
          .eq('instalacao_id', link.instalacao_id)
          .maybeSingle()

        let vistoriaId = existingVistoria?.id as string | undefined

        if (!vistoriaId) {
          const vistoriaPayload: Record<string, any> = {
            instalacao_id: instMat.id,
            contrato_id: instMat.contrato_id,
            associado_id: instMat.associado_id,
            veiculo_id: instMat.veiculo_id,
            cotacao_id: instMat.cotacao_id,
            tipo: 'entrada', // OBRIGATÓRIO (enum tipo_vistoria): instalação = vistoria de entrada
            modalidade: 'presencial',
            origem: 'prestador',
            status: 'concluida',
            iniciada_em: instMat.created_at ?? agora,
            concluida_em: agora,
            endereco_cep: instMat.cep,
            endereco_logradouro: instMat.logradouro,
            endereco_numero: instMat.numero,
            endereco_bairro: instMat.bairro,
            endereco_cidade: instMat.cidade,
            endereco_estado: instMat.uf,
            endereco_latitude: instMat.endereco_latitude,
            endereco_longitude: instMat.endereco_longitude,
            imei_rastreador: instMat.imei_rastreador,
            km_atual: instMat.quilometragem,
            dados_parciais: { checklist_data: checklist_data ?? null, origem_link: link.id },
            assinatura_documento_url: assinatura_url ?? null,
          }
          const { data: newVistoria, error: errVistoria } = await supabase
            .from('vistorias')
            .insert(vistoriaPayload)
            .select('id')
            .single()
          if (errVistoria) throw errVistoria
          vistoriaId = newVistoria.id
          console.log(`[concluir-instalacao] vistoria canônica criada ${vistoriaId} para instalação ${link.instalacao_id}`)
        } else {
          // Atualiza dados (idempotente em retentativas)
          await supabase
            .from('vistorias')
            .update({
              status: 'concluida',
              concluida_em: agora,
              dados_parciais: { checklist_data: checklist_data ?? null, origem_link: link.id },
              assinatura_documento_url: assinatura_url ?? null,
            })
            .eq('id', vistoriaId)
        }

        // 3.2 — fotos: limpa as anteriores dessa vistoria e reinsere a partir do jsonb
        if (vistoriaId && fotos_vistoria && typeof fotos_vistoria === 'object') {
          const entries = Object.entries(fotos_vistoria as Record<string, unknown>)
            .filter(([tipo, url]) => typeof tipo === 'string' && typeof url === 'string' && (url as string).length > 0)
            .map(([tipo, url]) => ({ vistoria_id: vistoriaId, tipo, arquivo_url: url as string, visivel_cliente: true }))

          if (entries.length > 0) {
            await supabase.from('vistoria_fotos').delete().eq('vistoria_id', vistoriaId)
            const { error: errFotos } = await supabase.from('vistoria_fotos').insert(entries)
            if (errFotos) throw errFotos
            console.log(`[concluir-instalacao] ${entries.length} fotos materializadas em vistoria_fotos para vistoria ${vistoriaId}`)
          }
        }
      } else {
        console.warn(`[concluir-instalacao] Instalação ${link.instalacao_id} sem contrato_id — não é possível materializar vistoria`)
      }
    } catch (matErr) {
      // Não bloqueia a resposta de sucesso: as fotos seguem salvas no jsonb e o backfill recupera.
      console.error('[concluir-instalacao] Falha ao materializar vistoria/fotos (não bloqueante):', matErr)
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

    // ── DISPARO AUTOMÁTICO: garantir sincronização completa no SGA após instalação ──
    try {
      const { data: instalSga } = await supabase
        .from('instalacoes')
        .select('veiculo_id, associado_id, veiculos:veiculo_id(cobertura_total, cobertura_roubo_furto)')
        .eq('id', link.instalacao_id)
        .maybeSingle()

      const veiculoSga = instalSga?.veiculos as any
      if (instalSga?.veiculo_id && instalSga?.associado_id) {
        await supabase.functions.invoke('sga-hinova-sync', {
          body: {
            veiculo_id: instalSga.veiculo_id,
            associado_id: instalSga.associado_id,
            status_sga_destino: 'pendente',
            force_resync_media: true,
            etapa_origem: 'concluir-instalacao-prestador',
            motivo_decisao: 'Instalação concluída — garantir veículo, fotos e documentos vinculados no SGA (sempre pendente; promoção para ativo só na ativação completa).',
          },
        })
      }
    } catch (sgaErr) {
      console.warn('[concluir-instalacao] Falha ao sincronizar SGA pós-instalação (não bloqueante):', sgaErr)
    }

    // ── Buscar dados completos ──
    const { data: instalacao } = await supabase
      .from('instalacoes')
      .select(`
        id, data_agendada, cidade, uf, contrato_id,
        veiculos:veiculo_id(marca, modelo, ano, placa),
        associados:associado_id(nome, email, telefone, whatsapp)
      `)
      .eq('id', link.instalacao_id)
      .single()

    let prestadorNome = 'Prestador externo'
    if (link.prestador_id) {
      // Tenta primeiro vistoriadores_prestadores (pessoa física); depois prestadores_assistencia (PJ)
      const { data: vp } = await supabase
        .from('vistoriadores_prestadores')
        .select('nome')
        .eq('id', link.prestador_id)
        .maybeSingle()
      if (vp?.nome) {
        prestadorNome = vp.nome
      } else {
        const { data: pa } = await supabase
          .from('prestadores_assistencia')
          .select('razao_social, nome_fantasia')
          .eq('id', link.prestador_id)
          .maybeSingle()
        prestadorNome = pa?.nome_fantasia || pa?.razao_social || prestadorNome
      }
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
              template_name: 'sinistro_atualizado',
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

    // ── Notificar associado: assinatura_instalacao_v1 ──
    // Vars: [primeiroNome, "MODELO - PLACA"]; button URL param: token de acompanhamento (contrato_id como fallback)
    try {
      const telAssoc = (associado?.whatsapp || associado?.telefone || '').toString();
      if (telAssoc && instalacao?.contrato_id) {
        const { data: contratoTok } = await supabase
          .from('contratos')
          .select('token_acompanhamento, numero, id')
          .eq('id', instalacao.contrato_id)
          .maybeSingle();
        const buttonParam = (contratoTok?.token_acompanhamento as string | null) || (contratoTok?.numero as string | null) || instalacao.contrato_id;
        const primeiroNomeAssoc = (associado?.nome || 'Associado').split(' ')[0];
        const modeloPlaca = `${[veiculo?.marca, veiculo?.modelo].filter(Boolean).join(' ')} - ${placa}`.trim();
        await supabase.functions.invoke('whatsapp-send-text', {
          body: {
            telefone: telAssoc,
            mensagem: `Olá ${primeiroNomeAssoc}! A instalação do rastreador no seu veículo ${modeloPlaca} foi concluída. Por favor, assine digitalmente.`,
            template_name: 'assinatura_instalacao_v2',
            template_params: [primeiroNomeAssoc, modeloPlaca],
            template_button_params: [String(buttonParam)],
            referencia_tipo: 'contrato',
            referencia_id: instalacao.contrato_id,
          },
        });
      }
    } catch (assinErr) {
      console.error('[concluir-instalacao] Falha assinatura_instalacao_v1 (não bloqueante):', assinErr)
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
