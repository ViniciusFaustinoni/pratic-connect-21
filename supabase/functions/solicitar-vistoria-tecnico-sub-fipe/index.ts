// Sub-FIPE: Monitoramento solicita nova vistoria presencial (sem instalação) ao técnico.
// Encerra o serviço atual da fila do monitoramento, cria nova `instalacoes`
// (dispensa_rastreador=true) + `vistoria_links` para que o técnico execute apenas
// as 31/15 fotos via /vistoria/:token. Quando concluída, aplicar-conclusao-vistoria
// devolve o caso para a fila do Monitoramento.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface Body {
  servicoId: string
  veiculoId: string
  associadoId: string
  motivo: string
  cenario: 'rota' | 'base'
  dataAgendada?: string | null
  periodo?: 'manha' | 'tarde'
  fotosObrigatorias: number
  solicitadoPor?: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const body = (await req.json()) as Body
    if (!body?.servicoId || !body?.veiculoId || !body?.associadoId || !body?.motivo || !body?.cenario) {
      return json({ success: false, error: 'Parâmetros obrigatórios ausentes' }, 400)
    }

    const agora = new Date().toISOString()
    const ressalva = `Monitoramento solicitou nova vistoria presencial (sem instalação). Motivo: ${body.motivo}`

    // 1) Busca serviço de origem (contrato/cotação/endereço)
    const { data: srvAtual } = await supabase
      .from('servicos')
      .select('contrato_id, cotacao_id, cep, logradouro, numero, complemento, bairro, cidade, uf')
      .eq('id', body.servicoId)
      .maybeSingle()

    // 2) Encerra o serviço atual sem ativar Proteção 360
    await supabase
      .from('servicos')
      .update({
        status: 'aprovada',
        analisado_em: agora,
        analisado_por: body.solicitadoPor ?? null,
        observacoes_analise: ressalva,
        ressalvas: 'vistoria_sem_instalacao_solicitada',
        updated_at: agora,
      } as any)
      .eq('id', body.servicoId)

    // 3) Endereço (Rota usa o do serviço; Base usa configuração padrão)
    let endereco = {
      cep: srvAtual?.cep || '',
      logradouro: srvAtual?.logradouro || '',
      numero: srvAtual?.numero || '',
      complemento: srvAtual?.complemento || '',
      bairro: srvAtual?.bairro || '',
      cidade: srvAtual?.cidade || '',
      uf: srvAtual?.uf || '',
    }
    if (body.cenario === 'base') {
      const { data: cfgs } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', ['base_cep', 'base_logradouro', 'base_numero', 'base_bairro', 'base_cidade', 'base_uf'])
      const cfgMap: Record<string, string> = {}
      ;(cfgs || []).forEach((c: any) => { cfgMap[c.chave] = c.valor || '' })
      endereco = {
        cep: cfgMap.base_cep || '',
        logradouro: cfgMap.base_logradouro || '',
        numero: cfgMap.base_numero || '',
        complemento: '',
        bairro: cfgMap.base_bairro || '',
        cidade: cfgMap.base_cidade || '',
        uf: cfgMap.base_uf || '',
      }
    }

    // 4) Cria nova `instalacoes` marcada como dispensa_rastreador → link público pula a etapa de instalação
    const dataAg = body.dataAgendada || new Date(Date.now() + 86400000).toISOString().split('T')[0]
    const { data: novaInst, error: instErr } = await supabase
      .from('instalacoes')
      .insert({
        associado_id: body.associadoId,
        veiculo_id: body.veiculoId,
        contrato_id: srvAtual?.contrato_id ?? null,
        cotacao_id: srvAtual?.cotacao_id ?? null,
        data_agendada: dataAg,
        periodo: body.periodo ?? 'manha',
        cep: endereco.cep,
        logradouro: endereco.logradouro,
        numero: endereco.numero,
        complemento: endereco.complemento,
        bairro: endereco.bairro,
        cidade: endereco.cidade,
        uf: endereco.uf,
        status: 'agendada',
        local_vistoria: body.cenario === 'base' ? 'base' : 'cliente',
        dispensa_rastreador: true,
        observacoes: `[VISTORIA_SEM_INSTALACAO] ${ressalva}`,
      } as any)
      .select('id')
      .single()
    if (instErr || !novaInst) return json({ success: false, error: instErr?.message || 'Falha ao criar instalação' }, 500)

    // 5) Cria registro de vistoria
    const { data: novaVist } = await supabase
      .from('vistorias')
      .insert({
        instalacao_id: novaInst.id,
        veiculo_id: body.veiculoId,
        associado_id: body.associadoId,
        contrato_id: srvAtual?.contrato_id ?? null,
        cotacao_id: srvAtual?.cotacao_id ?? null,
        local_vistoria: body.cenario === 'base' ? 'base' : 'cliente',
        status: 'agendada',
        observacoes: `[VISTORIA_SEM_INSTALACAO] fotos=${body.fotosObrigatorias} | ${ressalva}`,
      } as any)
      .select('id')
      .single()

    // 6) Gera o link público (idempotente). exige_etapa_instalacao=false vem de dispensa_rastreador
    const { data: linkResp } = await supabase.functions.invoke('gerar-link-vistoria-publica', {
      body: {
        instalacao_id: novaInst.id,
        vistoria_id: novaVist?.id ?? null,
        criado_por: body.solicitadoPor ?? null,
      },
    })

    // 7) Cria novo `servicos.vistoria_entrada` (fila de Atribuição Manual)
    const tag = `[VISTORIA_SEM_INSTALACAO]${JSON.stringify({
      motivo: body.motivo,
      fotos_obrigatorias: body.fotosObrigatorias,
      cenario: body.cenario,
      origem_servico_id: body.servicoId,
      vistoria_link_url: (linkResp as any)?.url ?? null,
    })}`
    const { data: srvNovo } = await supabase
      .from('servicos')
      .insert({
        tipo: 'vistoria_entrada',
        status: 'agendada',
        veiculo_id: body.veiculoId,
        associado_id: body.associadoId,
        contrato_id: srvAtual?.contrato_id ?? null,
        cotacao_id: srvAtual?.cotacao_id ?? null,
        data_agendada: dataAg,
        periodo: body.periodo ?? 'manha',
        modalidade: body.cenario,
        cep: body.cenario === 'rota' ? endereco.cep : null,
        logradouro: body.cenario === 'rota' ? endereco.logradouro : null,
        numero: body.cenario === 'rota' ? endereco.numero : null,
        complemento: body.cenario === 'rota' ? endereco.complemento : null,
        bairro: body.cenario === 'rota' ? endereco.bairro : null,
        cidade: body.cenario === 'rota' ? endereco.cidade : null,
        uf: body.cenario === 'rota' ? endereco.uf : null,
        observacoes: `${tag}\n${ressalva}`,
        origem: 'monitoramento_sub_fipe',
        vistoria_origem_id: novaVist?.id ?? null,
      } as any)
      .select('id')
      .single()

    // 8) Histórico
    await supabase.from('associados_historico').insert({
      associado_id: body.associadoId,
      tipo: 'vistoria_tecnico_solicitada_monitoramento',
      descricao: ressalva,
      dados_novos: {
        servico_origem_id: body.servicoId,
        servico_novo_id: srvNovo?.id ?? null,
        instalacao_id: novaInst.id,
        vistoria_id: novaVist?.id ?? null,
        veiculo_id: body.veiculoId,
        cenario: body.cenario,
        fotos_obrigatorias: body.fotosObrigatorias,
        link: (linkResp as any)?.url ?? null,
      },
      usuario_id: body.solicitadoPor ?? null,
    } as any)

    return json({
      success: true,
      servicoId: srvNovo?.id ?? null,
      instalacaoId: novaInst.id,
      vistoriaId: novaVist?.id ?? null,
      linkUrl: (linkResp as any)?.url ?? null,
    })
  } catch (err: any) {
    return json({ success: false, error: err?.message || 'Erro inesperado' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
