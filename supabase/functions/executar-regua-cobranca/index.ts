import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Etapa {
  id?: string
  dias: number
  acao: string
  template?: string
  ativa?: boolean
}

// ============================================================
// MAPA DE TEMPLATES → VARIÁVEIS (sincronizado com
// src/lib/cobranca/templateParams.ts — duplicado inline porque
// edge functions não importam de src/).
// ============================================================
type CobrancaVar =
  | 'nome'
  | 'valor'
  | 'vencimento'
  | 'mes_ano'
  | 'placa'
  | 'modelo'
  | 'linha_digitavel'

const TEMPLATE_PARAMS_MAP: Record<string, CobrancaVar[]> = {
  cobranca_mensalidade: ['nome', 'mes_ano', 'vencimento'],
  d_6_lembrete_desconto_v1: ['nome', 'vencimento', 'linha_digitavel'],
  d0_boleto_vence_hoje_v1: ['nome', 'valor', 'vencimento', 'modelo', 'placa', 'linha_digitavel'],
  d1_a_d4_boleto_vencido_v1: ['nome'],
  d5_ultimo_dia_sem_revistoria_v1: ['vencimento'],
  d6_impedimento_pagamento_v1: ['nome', 'vencimento', 'valor', 'placa'],
  d7_reforco_contato_v1: ['nome', 'vencimento'],
  d8_urgencia_revistoria_v1: ['nome'],
  d9_alerta_retirada_v1: ['nome', 'vencimento'],
  d10_ultima_tentativa_v1: ['nome'],
  d11_aviso_negativacao_v1: ['nome', 'vencimento', 'valor', 'placa'],
  d12_debito_com_multa_v1: ['nome', 'vencimento', 'valor', 'placa'],
  d13_regularize_cadastro_v1: ['nome', 'vencimento'],
  d14_d61_reativacao_protecao_v1: ['nome'],
}

function calcularPrioridade(diasAtraso: number, valor: number): number {
  let prioridade = 3
  if (diasAtraso > 30) prioridade = 9
  else if (diasAtraso > 15) prioridade = 7
  else if (diasAtraso > 5) prioridade = 5
  if (valor > 2000) prioridade = Math.min(prioridade + 1, 10)
  return prioridade
}

function formatBRL(v: number): string {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function formatMesAno(vencimento: string): string {
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  const [y, m] = vencimento.split('T')[0].split('-')
  return `${meses[parseInt(m, 10) - 1]}/${y}`
}

interface ContextoEnvio {
  nome: string
  valor: number
  vencimento: string
  placa?: string | null
  modelo?: string | null
  linha_digitavel?: string | null
  boleto_url?: string | null
}

/**
 * Monta o array de parâmetros conforme o template configurado.
 * Para templates não mapeados explicitamente, devolve um fallback
 * genérico [nome, valor, vencimento, linha_digitavel?, placa?] que
 * será truncado conforme a contagem de slots detectados.
 */
function buildTemplateParams(
  templateName: string,
  ctx: ContextoEnvio,
  slotsDetectados: number
): { params: string[]; faltaSGA: boolean } {
  const mapping = TEMPLATE_PARAMS_MAP[templateName]
  let faltaSGA = false

  const valorOf = (v: CobrancaVar): string => {
    switch (v) {
      case 'nome': return ctx.nome || 'Associado'
      case 'valor': return formatBRL(Number(ctx.valor || 0))
      case 'vencimento': return formatDate(ctx.vencimento)
      case 'mes_ano': return formatMesAno(ctx.vencimento)
      case 'placa': return ctx.placa || '—'
      case 'modelo': return ctx.modelo || '—'
      case 'linha_digitavel':
        if (!ctx.linha_digitavel) faltaSGA = true
        return ctx.linha_digitavel || '—'
    }
  }

  let params: string[]
  if (mapping) {
    params = mapping.map(valorOf)
  } else {
    // Fallback genérico
    const fallbackOrder: CobrancaVar[] = ['nome', 'valor', 'vencimento', 'linha_digitavel', 'placa']
    params = fallbackOrder.map(valorOf)
  }

  // Ajustar pelo número real de slots detectados no corpo (defesa contra erro 132000)
  if (slotsDetectados > 0) {
    if (params.length > slotsDetectados) params = params.slice(0, slotsDetectados)
    while (params.length < slotsDetectados) params.push('—')
  }

  return { params, faltaSGA }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startedAt = new Date().toISOString()

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const MAX_DISPAROS = parseInt(Deno.env.get('REGUA_MAX_DISPAROS_POR_RUN') || '500', 10)
    let disparosWhatsapp = 0

    const hoje = new Date()
    const hojeISO = hoje.toISOString().split('T')[0]
    const seteDiasAtras = new Date(Date.now() - 7 * 86400000).toISOString()

    // 1. Buscar régua ativa
    const { data: regua, error: errRegua } = await supabase
      .from('reguas_cobranca')
      .select('*')
      .eq('ativa', true)
      .limit(1)
      .maybeSingle()

    if (errRegua) {
      console.error('Erro ao buscar régua:', errRegua)
      throw errRegua
    }

    if (!regua) {
      console.log('⛔ Régua DESATIVADA — execução abortada (nenhuma régua com ativa=true)')
      return new Response(JSON.stringify({
        ativa: false,
        message: 'Régua desativada — nenhuma ação executada',
        processados: 0,
        eventos_criados: 0,
        whatsapp_enviados: 0,
        whatsapp_falhas: 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const etapasRaw = (regua.etapas as Etapa[] | null) || []
    const etapasAtivas = etapasRaw.filter((e) => e.ativa !== false)

    if (etapasAtivas.length === 0) {
      console.log('Régua ativa, mas sem etapas habilitadas')
      return new Response(JSON.stringify({
        ativa: true,
        message: 'Régua ativa, porém sem etapas habilitadas',
        processados: 0,
        eventos_criados: 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const etapas = [...etapasAtivas].sort((a, b) => a.dias - b.dias)
    console.log(`Régua "${regua.nome}" com ${etapas.length} etapas ativas (${etapasRaw.length} total)`)

    // 2. Pré-carregar contagem de variáveis dos templates Meta usados
    const templatesUsados = Array.from(new Set(
      etapas.map((e) => e.template).filter((t): t is string => !!t)
    ))
    const slotsPorTemplate = new Map<string, number>()
    if (templatesUsados.length > 0) {
      const { data: tmpls } = await supabase
        .from('whatsapp_meta_templates')
        .select('nome, corpo')
        .in('nome', templatesUsados)
      for (const t of tmpls || []) {
        const matches = (t.corpo as string || '').match(/\{\{\d+\}\}/g) || []
        // Quantos slots únicos?
        const unique = new Set(matches.map((m) => m))
        slotsPorTemplate.set(t.nome as string, unique.size)
      }
    }

    // Janela de pré-vencimento
    const etapasPre = etapas.filter((e) => e.dias < 0)
    const maxDiasAntes = etapasPre.length > 0 ? Math.abs(Math.min(...etapasPre.map((e) => e.dias))) : 0

    let totalProcessados = 0
    let totalEventos = 0
    let totalTarefas = 0
    let totalEnviadosWA = 0
    let totalFalhasWA = 0
    let limitAtingido = false

    // ============================================================
    // HELPER: enviar WhatsApp via whatsapp-send-text
    // ============================================================
    async function enviarTemplateWhatsapp(opts: {
      telefone: string
      templateName: string
      params: string[]
    }): Promise<{ ok: boolean; erro?: string; message_id?: string }> {
      try {
        const resp = await supabase.functions.invoke('whatsapp-send-text', {
          body: {
            telefone: opts.telefone,
            mensagem: '',
            template_name: opts.templateName,
            template_params: opts.params,
          },
        })
        if (resp.error) return { ok: false, erro: resp.error.message || String(resp.error) }
        const data: any = resp.data || {}
        if (data.success === false) return { ok: false, erro: data.error || 'Falha desconhecida' }
        return { ok: true, message_id: data.message_id }
      } catch (err: any) {
        return { ok: false, erro: err?.message || String(err) }
      }
    }

    // ============================================================
    // BUSCA UNIFICADA — Asaas + SGA Hinova
    // ============================================================
    type CobrancaUnif = {
      id: string
      associado_id: string
      veiculo_id: string | null
      valor: number
      data_vencimento: string
      linha_digitavel: string | null
      boleto_url: string | null
      fonte: 'asaas' | 'sga'
    }

    /**
     * Busca cobranças (asaas + sga) num intervalo de vencimento.
     * `start`/`end` são datas ISO (YYYY-MM-DD), inclusivas.
     */
    async function buscarCobrancas(start: string, end: string): Promise<CobrancaUnif[]> {
      const [asaas, sga] = await Promise.all([
        supabase
          .from('asaas_cobrancas')
          .select('id, associado_id, veiculo_id, valor, data_vencimento, linha_digitavel, boleto_url')
          .in('status', ['PENDING', 'OVERDUE'])
          .not('asaas_id', 'like', 'LOCAL-%')
          .gte('data_vencimento', start)
          .lte('data_vencimento', end)
          .order('data_vencimento')
          .limit(1000),
        supabase
          .from('cobrancas')
          .select('id, associado_id, veiculo_id, valor_final, valor, data_vencimento, linha_digitavel, boleto_url')
          .eq('origem', 'sga_hinova')
          .in('status', ['aguardando_pagamento', 'vencido'])
          .gte('data_vencimento', start)
          .lte('data_vencimento', end)
          .order('data_vencimento')
          .limit(1000),
      ])

      const out: CobrancaUnif[] = []
      for (const r of asaas.data || []) {
        out.push({
          id: r.id as string,
          associado_id: r.associado_id as string,
          veiculo_id: (r.veiculo_id as string | null) ?? null,
          valor: Number(r.valor || 0),
          data_vencimento: r.data_vencimento as string,
          linha_digitavel: (r.linha_digitavel as string | null) ?? null,
          boleto_url: (r.boleto_url as string | null) ?? null,
          fonte: 'asaas',
        })
      }
      for (const r of sga.data || []) {
        out.push({
          id: r.id as string,
          associado_id: r.associado_id as string,
          veiculo_id: (r.veiculo_id as string | null) ?? null,
          valor: Number((r as any).valor_final || (r as any).valor || 0),
          data_vencimento: r.data_vencimento as string,
          linha_digitavel: (r.linha_digitavel as string | null) ?? null,
          boleto_url: (r.boleto_url as string | null) ?? null,
          fonte: 'sga',
        })
      }
      return out
    }

    // Cache de associado e veículo
    const associadoCache = new Map<string, { nome: string; telefone: string | null }>()
    const veiculoCache = new Map<string, { placa: string | null; modelo: string | null }>()

    async function getAssociado(id: string) {
      if (associadoCache.has(id)) return associadoCache.get(id)!
      const { data } = await supabase
        .from('associados')
        .select('nome, whatsapp, telefone')
        .eq('id', id)
        .maybeSingle()
      const info = {
        nome: (data?.nome as string) || 'Associado',
        telefone: (data?.whatsapp as string) || (data?.telefone as string) || null,
      }
      associadoCache.set(id, info)
      return info
    }

    async function getVeiculo(id: string | null) {
      if (!id) return { placa: null, modelo: null }
      if (veiculoCache.has(id)) return veiculoCache.get(id)!
      const { data } = await supabase
        .from('veiculos')
        .select('placa, modelo')
        .eq('id', id)
        .maybeSingle()
      const info = {
        placa: (data?.placa as string | null) ?? null,
        modelo: (data?.modelo as string | null) ?? null,
      }
      veiculoCache.set(id, info)
      return info
    }

    // ============================================================
    // PASS 1 — Cobranças VENCIDAS (dias >= 0)
    // ============================================================
    {
      // Janela: de 60 dias atrás até hoje
      const inicio = new Date(hoje.getTime() - 90 * 86400000).toISOString().split('T')[0]
      const cobrs = await buscarCobrancas(inicio, hojeISO)

      // Agrupar por associado: maior atraso, somando valores; preserva veiculo_id/linha_digitavel da MAIS antiga (= maior atraso)
      const porAssociado = new Map<string, {
        diasAtraso: number
        valorTotal: number
        vencimento: string
        veiculo_id: string | null
        linha_digitavel: string | null
        boleto_url: string | null
        fonte: 'asaas' | 'sga'
      }>()

      for (const c of cobrs) {
        const dias = Math.floor((Date.now() - new Date(c.data_vencimento).getTime()) / 86400000)
        const cur = porAssociado.get(c.associado_id)
        if (!cur) {
          porAssociado.set(c.associado_id, {
            diasAtraso: dias,
            valorTotal: c.valor,
            vencimento: c.data_vencimento,
            veiculo_id: c.veiculo_id,
            linha_digitavel: c.linha_digitavel,
            boleto_url: c.boleto_url,
            fonte: c.fonte,
          })
        } else {
          cur.valorTotal += c.valor
          if (dias > cur.diasAtraso) {
            cur.diasAtraso = dias
            cur.vencimento = c.data_vencimento
            cur.veiculo_id = c.veiculo_id
            cur.linha_digitavel = c.linha_digitavel
            cur.boleto_url = c.boleto_url
            cur.fonte = c.fonte
          }
        }
      }

      for (const [associadoId, info] of porAssociado) {
        for (const etapa of etapas) {
          if (etapa.dias < 0) continue
          if (info.diasAtraso < etapa.dias) continue

          const { data: existe } = await supabase
            .from('cobranca_eventos')
            .select('id')
            .eq('associado_id', associadoId)
            .eq('subtipo', `regua_d${etapa.dias}`)
            .gte('created_at', seteDiasAtras)
            .limit(1)
          if (existe && existe.length > 0) continue

          const prioridade = calcularPrioridade(info.diasAtraso, info.valorTotal)
          await processarEtapa({
            associadoId,
            etapa,
            diasAtraso: info.diasAtraso,
            valorTotal: info.valorTotal,
            vencimento: info.vencimento,
            veiculo_id: info.veiculo_id,
            linha_digitavel: info.linha_digitavel,
            boleto_url: info.boleto_url,
            fonte: info.fonte,
            prioridade,
          })
        }
        totalProcessados++
      }
    }

    // ============================================================
    // PASS 2 — Cobranças A VENCER (dias < 0)
    // ============================================================
    if (maxDiasAntes > 0) {
      const limiteFuturo = new Date(hoje.getTime() + maxDiasAntes * 86400000).toISOString().split('T')[0]
      const amanhaISO = new Date(hoje.getTime() + 86400000).toISOString().split('T')[0]
      const cobrs = await buscarCobrancas(amanhaISO, limiteFuturo)

      for (const c of cobrs) {
        const diasAteVencer = Math.ceil((new Date(c.data_vencimento).getTime() - hoje.getTime()) / 86400000)
        const diasRelativos = -diasAteVencer
        const etapaMatch = etapas.find((e) => e.dias === diasRelativos)
        if (!etapaMatch) continue

        const { data: existe } = await supabase
          .from('cobranca_eventos')
          .select('id')
          .eq('associado_id', c.associado_id)
          .eq('subtipo', `regua_d${etapaMatch.dias}`)
          .gte('created_at', seteDiasAtras)
          .limit(1)
        if (existe && existe.length > 0) continue

        await processarEtapa({
          associadoId: c.associado_id,
          etapa: etapaMatch,
          diasAtraso: diasRelativos,
          valorTotal: c.valor,
          vencimento: c.data_vencimento,
          veiculo_id: c.veiculo_id,
          linha_digitavel: c.linha_digitavel,
          boleto_url: c.boleto_url,
          fonte: c.fonte,
          prioridade: 3,
        })
        totalProcessados++
      }
    }

    // ============================================================
    // PROCESSADOR DE ETAPA
    // ============================================================
    async function processarEtapa(p: {
      associadoId: string
      etapa: Etapa
      diasAtraso: number
      valorTotal: number
      vencimento: string
      veiculo_id: string | null
      linha_digitavel: string | null
      boleto_url: string | null
      fonte: 'asaas' | 'sga'
      prioridade: number
    }) {
      const { associadoId, etapa, diasAtraso, valorTotal, vencimento, veiculo_id, linha_digitavel, boleto_url, fonte, prioridade } = p
      const subtipo = `regua_d${etapa.dias}`

      if (etapa.acao === 'whatsapp') {
        const assoc = await getAssociado(associadoId)
        const veic = await getVeiculo(veiculo_id)
        const telefone = assoc.telefone

        let envioStatus: 'enviado' | 'falhou' | 'agendado' = 'agendado'
        let envioErro: string | null = null
        let messageId: string | null = null
        let templateParams: string[] = []
        let faltaSGA = false

        if (etapa.template && telefone && disparosWhatsapp < MAX_DISPAROS) {
          const slots = slotsPorTemplate.get(etapa.template) ?? 0
          const built = buildTemplateParams(etapa.template, {
            nome: assoc.nome,
            valor: valorTotal,
            vencimento,
            placa: veic.placa,
            modelo: veic.modelo,
            linha_digitavel,
            boleto_url,
          }, slots)
          templateParams = built.params
          faltaSGA = built.faltaSGA

          // Bloquear envio se template exige linha_digitavel e não temos
          const mapping = TEMPLATE_PARAMS_MAP[etapa.template]
          const exigeSGA = mapping?.includes('linha_digitavel') ?? false
          if (exigeSGA && !linha_digitavel) {
            envioStatus = 'falhou'
            envioErro = 'Sem linha digitável SGA disponível — sincronize o financeiro do veículo'
            totalFalhasWA++
          } else {
            const result = await enviarTemplateWhatsapp({
              telefone,
              templateName: etapa.template,
              params: templateParams,
            })
            disparosWhatsapp++
            if (result.ok) {
              envioStatus = 'enviado'
              messageId = result.message_id || null
              totalEnviadosWA++
            } else {
              envioStatus = 'falhou'
              envioErro = result.erro || 'Erro desconhecido'
              totalFalhasWA++
            }
          }
        } else if (disparosWhatsapp >= MAX_DISPAROS) {
          limitAtingido = true
          envioErro = `Limite de disparos por execução atingido (${MAX_DISPAROS})`
        } else if (!etapa.template) {
          envioErro = 'Etapa sem template definido'
        } else if (!telefone) {
          envioErro = 'Associado sem telefone/whatsapp'
        }

        await supabase.from('cobranca_eventos').insert({
          associado_id: associadoId,
          tipo: 'whatsapp',
          subtipo,
          descricao: `WhatsApp ${etapa.dias < 0 ? `D${etapa.dias} (lembrete)` : `D+${etapa.dias}`} — template ${etapa.template || '(nenhum)'}`,
          dados: {
            dia_regua: etapa.dias,
            valor_total: valorTotal,
            dias_atraso: diasAtraso,
            template: etapa.template,
            template_params: templateParams,
            fonte,
            veiculo_id: veiculo_id ?? null,
            linha_digitavel: linha_digitavel || null,
            boleto_url: boleto_url || null,
            falta_sga: faltaSGA,
            status: envioStatus,
            message_id: messageId,
            erro: envioErro,
          },
          automatico: true,
        })
        totalEventos++
      } else if (etapa.acao === 'sms' || etapa.acao === 'email') {
        await supabase.from('cobranca_eventos').insert({
          associado_id: associadoId,
          tipo: etapa.acao,
          subtipo,
          descricao: `${etapa.acao.toUpperCase()} ${etapa.dias < 0 ? `D${etapa.dias}` : `D+${etapa.dias}`} agendado (provedor não configurado)`,
          dados: { dia_regua: etapa.dias, valor_total: valorTotal, dias_atraso: diasAtraso, fonte, status: 'agendado' },
          automatico: true,
        })
        totalEventos++
      } else if (etapa.acao === 'ligacao') {
        const { data: tarefaExiste } = await supabase
          .from('cobranca_fila')
          .select('id')
          .eq('associado_id', associadoId)
          .eq('motivo', 'regua_ligacao')
          .in('status', ['pendente', 'em_atendimento'])
          .limit(1)

        if (!tarefaExiste || tarefaExiste.length === 0) {
          await supabase.from('cobranca_fila').insert({
            associado_id: associadoId,
            motivo: 'regua_ligacao',
            prioridade,
            status: 'pendente',
            observacao: `Régua D${etapa.dias >= 0 ? '+' : ''}${etapa.dias}: ligar para cobrar`,
            data_agendamento: new Date().toISOString(),
          })
          totalTarefas++
        }
        await supabase.from('cobranca_eventos').insert({
          associado_id: associadoId,
          tipo: 'ligacao',
          subtipo,
          descricao: `Tarefa de ligação D+${etapa.dias}`,
          dados: { dia_regua: etapa.dias, prioridade, fonte },
          automatico: true,
        })
        totalEventos++
      } else if (etapa.acao === 'suspensao') {
        await supabase.from('cobranca_eventos').insert({
          associado_id: associadoId,
          tipo: 'status',
          subtipo: 'suspensao',
          descricao: `Suspensão automática D+${etapa.dias} (${diasAtraso} dias / ${formatBRL(valorTotal)})`,
          dados: { dia_regua: etapa.dias, valor_total: valorTotal, dias_atraso: diasAtraso, fonte },
          automatico: true,
        })
        totalEventos++
      } else if (etapa.acao === 'negativacao') {
        const { data: tarefaExiste } = await supabase
          .from('cobranca_fila')
          .select('id')
          .eq('associado_id', associadoId)
          .eq('motivo', 'decisao_negativacao')
          .in('status', ['pendente', 'em_atendimento'])
          .limit(1)
        if (!tarefaExiste || tarefaExiste.length === 0) {
          await supabase.from('cobranca_fila').insert({
            associado_id: associadoId,
            motivo: 'decisao_negativacao',
            prioridade: 9,
            status: 'pendente',
            observacao: `D+${etapa.dias}: decisão de negativação (${formatBRL(valorTotal)})`,
            data_agendamento: new Date().toISOString(),
          })
          totalTarefas++
        }
        await supabase.from('cobranca_eventos').insert({
          associado_id: associadoId,
          tipo: 'negativacao',
          subtipo,
          descricao: `Candidato a negativação D+${etapa.dias}`,
          dados: { dia_regua: etapa.dias, valor_total: valorTotal, fonte },
          automatico: true,
        })
        totalEventos++
      } else if (etapa.acao === 'cancelamento' || etapa.acao === 'exclusao') {
        const { data: tarefaExiste } = await supabase
          .from('cobranca_fila')
          .select('id')
          .eq('associado_id', associadoId)
          .eq('motivo', 'decisao_exclusao')
          .in('status', ['pendente', 'em_atendimento'])
          .limit(1)
        if (!tarefaExiste || tarefaExiste.length === 0) {
          await supabase.from('cobranca_fila').insert({
            associado_id: associadoId,
            motivo: 'decisao_exclusao',
            prioridade: 9,
            status: 'pendente',
            observacao: `D+${etapa.dias}: decisão de exclusão (${formatBRL(valorTotal)})`,
            data_agendamento: new Date().toISOString(),
          })
          totalTarefas++
        }
        await supabase.from('cobranca_eventos').insert({
          associado_id: associadoId,
          tipo: 'status',
          subtipo,
          descricao: `Candidato a exclusão D+${etapa.dias}`,
          dados: { dia_regua: etapa.dias, valor_total: valorTotal, fonte },
          automatico: true,
        })
        totalEventos++
      }
    }

    const resultado = {
      message: 'Régua executada com sucesso',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      processados: totalProcessados,
      eventos_criados: totalEventos,
      tarefas_criadas: totalTarefas,
      whatsapp_enviados: totalEnviadosWA,
      whatsapp_falhas: totalFalhasWA,
      limite_atingido: limitAtingido,
      max_disparos: MAX_DISPAROS,
    }
    console.log('Resultado:', JSON.stringify(resultado))

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Erro na execução da régua:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
