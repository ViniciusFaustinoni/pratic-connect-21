import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { insertAuditLog } from '../_shared/auditLog.ts';

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

    const { token, checklist_data, fotos_vistoria } = await req.json()

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Buscar link pelo token ──
    const { data: link, error: linkErr } = await supabase
      .from('vistoria_prestador_links')
      .select('id, instalacao_id, vistoria_id, vistoriador_prestador_id, valor, atribuido_por, status')
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

    // ── AÇÃO 1: Atualizar status da origem (PROPAGA erro — não pode ser silencioso) ──
    // Antes, instErr era só console.error e seguia adiante; quando o guard
    // trg_guard_instalacao_concluida_exige_rastreador bloqueava (FIPE acima sem IMEI),
    // o link era marcado concluido mesmo com instalação travada em aguardando_prestador,
    // serviço travado em agendada, sem vistoria materializada (caso LUT8D25 — 01/06/26).
    if (link.instalacao_id) {
      const { error: instErr } = await supabase
        .from('instalacoes')
        .update({ status: 'concluida', concluida_em: agora, updated_at: agora })
        .eq('id', link.instalacao_id)
      if (instErr) {
        console.error('[concluir-vistoria-prestador] Falha ao concluir instalação:', instErr)
        return new Response(
          JSON.stringify({
            success: false,
            code: 'instalacao_nao_pode_ser_concluida',
            error: instErr.message,
            hint: 'Verifique se o veículo exige rastreador. Se exigir, o link precisa ser atribuído com escopo "Fotos + Instalação" para coletar o IMEI. O link NÃO foi consumido.',
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else if (link.vistoria_id) {
      const { error: vErr } = await supabase
        .from('vistorias')
        .update({ status: 'concluida', concluida_em: agora, updated_at: agora })
        .eq('id', link.vistoria_id)
      if (vErr) {
        console.error('[concluir-vistoria-prestador] Falha ao concluir vistoria:', vErr)
        return new Response(
          JSON.stringify({ success: false, code: 'vistoria_nao_pode_ser_concluida', error: vErr.message }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // ── AÇÃO 1b: Cascata para servicos (sem isto, some da fila Aprovação de Associados) ──
    if (link.instalacao_id) {
      const { error: servErr } = await supabase
        .from('servicos')
        .update({ status: 'concluida', concluida_em: agora, updated_at: agora })
        .eq('instalacao_origem_id', link.instalacao_id)
        .in('status', ['agendada', 'em_rota', 'em_andamento', 'em_execucao', 'aguardando_prestador'])
      if (servErr) console.error('[concluir-vistoria-prestador] Falha ao cascatear servicos (não bloqueante):', servErr)
    }

    // ── AÇÃO 2: Invalidar o token + salvar evidências ──
    const { error: linkUpdateErr } = await supabase
      .from('vistoria_prestador_links')
      .update({
        status: 'concluida',
        concluida_em: agora,
        checklist_data,
        fotos_vistoria,
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

    // ── AÇÃO 2b: Materializar vistoria + vistoria_fotos canônicas (idempotente) ──
    // Memória "Fotos prestador materializadas": tela de Aprovação lê de
    // contratos→vistorias→vistoria_fotos. Sem essa ponte as fotos ficam isoladas.
    if (link.instalacao_id && fotos_vistoria && typeof fotos_vistoria === 'object') {
      try {
        const { data: instMat } = await supabase
          .from('instalacoes')
          .select('id, contrato_id, associado_id, veiculo_id, cotacao_id, imei_rastreador, created_at')
          .eq('id', link.instalacao_id)
          .maybeSingle()

        if (instMat?.contrato_id) {
          const { data: existingVistoria } = await supabase
            .from('vistorias')
            .select('id')
            .eq('instalacao_id', link.instalacao_id)
            .maybeSingle()

          let vistoriaIdMat = existingVistoria?.id as string | undefined
          if (!vistoriaIdMat) {
            const { data: newVistoria, error: errVistoria } = await supabase
              .from('vistorias')
              .insert({
                instalacao_id: instMat.id,
                contrato_id: instMat.contrato_id,
                associado_id: instMat.associado_id,
                veiculo_id: instMat.veiculo_id,
                cotacao_id: instMat.cotacao_id,
                tipo: 'entrada',
                modalidade: 'presencial',
                origem: 'prestador',
                status: 'concluida',
                iniciada_em: instMat.created_at ?? agora,
                concluida_em: agora,
                imei_rastreador: instMat.imei_rastreador,
                dados_parciais: { checklist_data: checklist_data ?? null, origem_link: link.id },
              })
              .select('id')
              .single()
            if (errVistoria) throw errVistoria
            vistoriaIdMat = newVistoria.id
          }

          if (vistoriaIdMat) {
            const entries = Object.entries(fotos_vistoria as Record<string, unknown>)
              .filter(([t, u]) => typeof t === 'string' && typeof u === 'string' && (u as string).length > 0)
              .map(([t, u]) => ({ vistoria_id: vistoriaIdMat, tipo: t, arquivo_url: u as string, visivel_cliente: true }))
            if (entries.length > 0) {
              await supabase.from('vistoria_fotos').delete().eq('vistoria_id', vistoriaIdMat)
              const { error: errFotos } = await supabase.from('vistoria_fotos').insert(entries)
              if (errFotos) console.error('[concluir-vistoria-prestador] Falha ao materializar vistoria_fotos:', errFotos)
            }
          }
        }
      } catch (matErr) {
        console.error('[concluir-vistoria-prestador] Falha ao materializar vistoria (não bloqueante):', matErr)
      }
    }

    // ── Buscar dados completos para ações seguintes ──
    let instalacao: any = null
    if (link.instalacao_id) {
      const { data } = await supabase
        .from('instalacoes')
        .select(`
          id, data_agendada, cidade, uf,
          veiculos:veiculo_id(marca, modelo, ano, placa),
          associados:associado_id(nome, email)
        `)
        .eq('id', link.instalacao_id)
        .single()
      instalacao = data
    } else if (link.vistoria_id) {
      const { data } = await supabase
        .from('vistorias')
        .select(`
          id, data_agendada, endereco_cidade, endereco_estado,
          veiculos:veiculo_id(marca, modelo, ano, placa),
          associados:associado_id(nome, email)
        `)
        .eq('id', link.vistoria_id)
        .single()
      if (data) {
        instalacao = {
          id: (data as any).id,
          data_agendada: (data as any).data_agendada,
          cidade: (data as any).endereco_cidade,
          uf: (data as any).endereco_estado,
          veiculos: (data as any).veiculos,
          associados: (data as any).associados,
        }
      }
    }

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
              template_name: 'notificacao_atendimento_pratic',
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
        link: link.instalacao_id ? `/monitoramento/instalacoes/${link.instalacao_id}` : `/monitoramento/vistorias/${link.vistoria_id}`,
      })
    } catch (notifErr) {
      console.error('Erro notificação (não bloqueante):', notifErr)
    }

    // ── AÇÃO 7: Gerar Laudo PDF e enviar por email ao associado (apenas quando há instalação) ──
    if (link.instalacao_id) {
      try {
        console.log('[concluir-vistoria-prestador] Gerando laudo PDF...')
        const { data: laudoResp, error: laudoErr2 } = await supabase.functions.invoke('gerar-laudo-vistoria', {
          body: {
            instalacaoId: link.instalacao_id,
          },
        })
        if (laudoErr2) {
          console.error('Erro ao gerar laudo (não bloqueante):', laudoErr2)
        } else {
          console.log('[concluir-vistoria-prestador] ✓ Laudo gerado:', laudoResp?.url || 'sem url')

          // Enviar email ao associado com link do laudo
          if (associado?.email && laudoResp?.url) {
            try {
              await supabase.functions.invoke('send-email', {
                body: {
                  template: 'generico',
                  to: associado.email,
                  data: {
                    nome: associado.nome || 'Associado',
                    assunto: 'Laudo de Vistoria - PraticCar',
                    titulo: 'Seu laudo de vistoria está disponível',
                    mensagem: `Olá ${associado.nome || ''}!\n\nA vistoria do seu veículo ${veiculoDesc} (${placa}) foi concluída com sucesso.\n\nO laudo de vistoria foi gerado e está anexado aos seus documentos. Você pode acessá-lo pelo link abaixo:`,
                    link_url: laudoResp.url,
                    link_texto: 'Visualizar Laudo de Vistoria',
                  },
                },
              })
              console.log('[concluir-vistoria-prestador] ✓ Email do laudo enviado para:', associado.email)
            } catch (emailErr) {
              console.error('Erro ao enviar email do laudo (não bloqueante):', emailErr)
            }
          }
        }
      } catch (laudoGenErr) {
        console.error('Erro ao gerar laudo (não bloqueante):', laudoGenErr)
      }
    }

    // ── Auditoria ──
    try {
      await insertAuditLog(supabase as any, {
        usuario_id: link.atribuido_por,
        usuario_nome: prestador?.nome || 'Prestador externo',
        acao: 'aprovar',
        modulo: 'instalacoes',
        descricao: `Vistoria prestador concluída: ${prestador?.nome || '---'} — ${veiculoDesc} (${placa}) — ${cidadeInst}`,
        registro_id: link.instalacao_id || link.vistoria_id,
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
