// ============================================================================
// Régua de Cobrança — motor Hinova-first
// ----------------------------------------------------------------------------
// 1. Busca boletos via /listar/boleto-associado/periodo.
//    Janela = união de [hoje-dMax .. hoje-dMin] com [1º dia (mês-2) .. último
//    dia mês atual] — garante 2 meses retroativos + mês corrente para
//    espelhar TODOS os boletos relevantes em `cobrancas`.
// 2. Espelha boletos na tabela `cobrancas` (insert/update/baixa pagas).
// 3. Classifica status (PAGO/CANCELADO/VENCIDO/A VENCER).
// 4. Casa cada boleto não-pago com a etapa correspondente.
// 5. Ordena: inadimplentes mais antigos primeiro, depois por valor, depois lembretes.
// 6. Dedupe por (nosso_numero + dia_regua + dia_civil_SP).
// 7. Dispara WhatsApp em BACKGROUND com delay configurável (default 10s).
// 8. Devolve { run_id, total_planejado } imediatamente; UI faz polling em cobranca_runs.
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  listarBoletosPorPeriodo,
  parseDataHinova,
  toNumber,
  HinovaTransientError,
  calcularProximoRetry,
} from '../_shared/hinova-client.ts'
import { mirrorBoletosEmCobrancas } from '../_shared/cobrancas-sga-upsert.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Permite EdgeRuntime.waitUntil em background
declare const EdgeRuntime: { waitUntil(p: Promise<any>): void } | undefined

interface Etapa {
  id?: string
  dias: number
  acao: string
  template?: string
  ativa?: boolean
}

type CobrancaVar =
  | 'nome' | 'valor' | 'vencimento' | 'mes_ano' | 'placa' | 'modelo' | 'linha_digitavel'

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

const SITUACAO_PAGA = /\b(PAGO|BAIXA|LIQUIDA|QUITADO)\b/i
const SITUACAO_CANCELADA = /\b(CANCEL|ESTORN)\b/i

function fmtBRL(v: number): string {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtData(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function fmtMesAno(iso: string): string {
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  const [y, m] = iso.split('-')
  return `${meses[parseInt(m, 10) - 1]}/${y}`
}

function diaCivilSP(): string {
  // YYYY-MM-DD em America/Sao_Paulo
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

function sanitizeFone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const d = String(raw).replace(/\D/g, '')
  if (d.length < 10) return null
  if (d.length === 10 || d.length === 11) return '55' + d
  if (d.length === 12 || d.length === 13) return d
  return null
}

interface Ctx {
  nome: string
  valor: number
  vencimento: string
  placa: string | null
  modelo: string | null
  linha_digitavel: string | null
}

function buildParams(template: string, ctx: Ctx, slots: number): { params: string[]; faltaSGA: boolean } {
  const mapping = TEMPLATE_PARAMS_MAP[template]
  let faltaSGA = false
  const valueOf = (v: CobrancaVar): string => {
    switch (v) {
      case 'nome': return ctx.nome || 'Associado'
      case 'valor': return fmtBRL(ctx.valor)
      case 'vencimento': return fmtData(ctx.vencimento)
      case 'mes_ano': return fmtMesAno(ctx.vencimento)
      case 'placa': return ctx.placa || '—'
      case 'modelo': return ctx.modelo || '—'
      case 'linha_digitavel':
        if (!ctx.linha_digitavel) faltaSGA = true
        return ctx.linha_digitavel || '—'
    }
  }
  let params: string[] = mapping
    ? mapping.map(valueOf)
    : (['nome','valor','vencimento','linha_digitavel','placa'] as CobrancaVar[]).map(valueOf)
  if (slots > 0) {
    if (params.length > slots) params = params.slice(0, slots)
    while (params.length < slots) params.push('—')
  }
  return { params, faltaSGA }
}

interface ItemFila {
  nosso_numero: string
  associado_id: string | null         // local mirror se existir
  codigo_associado: number
  nome: string
  telefone: string | null
  email: string | null
  valor: number
  vencimento: string                  // ISO yyyy-mm-dd
  diasAtraso: number                  // >0 = atrasado, <=0 = a vencer
  linha_digitavel: string | null
  boleto_url: string | null
  placa: string | null
  modelo: string | null
  veiculo_id: string | null
  codigo_veiculo: number | null
  etapa: Etapa
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startedAt = new Date().toISOString()

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    let body: any = {}
    try { body = await req.json() } catch { /* sem body ok */ }
    const delayMs = Math.max(0, Math.min(60_000, Number(body?.delayMs ?? 10_000)))
    const MAX = parseInt(Deno.env.get('REGUA_MAX_DISPAROS_POR_RUN') || '1000', 10)

    // Identidade do solicitante (auditoria)
    let criadoPor: string | null = null
    try {
      const auth = req.headers.get('Authorization')?.replace('Bearer ', '')
      if (auth) {
        const { data } = await supabase.auth.getUser(auth)
        criadoPor = data?.user?.id ?? null
      }
    } catch { /* opcional */ }

    // 1. Régua ativa
    const { data: regua } = await supabase
      .from('reguas_cobranca').select('*').eq('ativa', true).limit(1).maybeSingle()

    if (!regua) {
      return jsonResp({ ativa: false, message: 'Régua desativada — nenhuma ação executada', total_planejado: 0 })
    }
    const etapasRaw = (regua.etapas as Etapa[] | null) || []
    const etapas = etapasRaw.filter((e) => e.ativa !== false).sort((a, b) => a.dias - b.dias)
    if (etapas.length === 0) {
      return jsonResp({ ativa: true, message: 'Régua sem etapas habilitadas', total_planejado: 0 })
    }

    // 2. Pré-carrega slots dos templates (defesa Meta 132000)
    const slotsPorTemplate = new Map<string, number>()
    const tmplNomes = Array.from(new Set(etapas.map((e) => e.template).filter((t): t is string => !!t)))
    if (tmplNomes.length) {
      const { data: tmpls } = await supabase
        .from('whatsapp_meta_templates').select('nome, corpo').in('nome', tmplNomes)
      for (const t of tmpls || []) {
        const matches = String(t.corpo || '').match(/\{\{\d+\}\}/g) || []
        slotsPorTemplate.set(String(t.nome), new Set(matches).size)
      }
    }

    // 3. Janela de varredura
    //    Etapas: dias > 0 = vencido há X (venc = hoje-X); dias < 0 = vence em |X| (venc = hoje+|X|)
    //    + Garantia mínima: 1º dia do (mês atual - 2) até último dia do mês atual
    //    (espelhar 2 meses retroativos + mês corrente em `cobrancas`).
    const dMin = Math.min(...etapas.map((e) => e.dias))   // ex.: -15
    const dMax = Math.max(...etapas.map((e) => e.dias))   // ex.: +61
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    const etapaInicio = new Date(hoje); etapaInicio.setDate(etapaInicio.getDate() - dMax)
    const etapaFim = new Date(hoje); etapaFim.setDate(etapaFim.getDate() - dMin)
    const mesAtualPrimeiro = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1)
    const mesAtualUltimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
    const inicioVenc = etapaInicio < mesAtualPrimeiro ? etapaInicio : mesAtualPrimeiro
    const fimVenc = etapaFim > mesAtualUltimo ? etapaFim : mesAtualUltimo

    // 4. Busca Hinova
    let boletos: any[]
    try {
      boletos = await listarBoletosPorPeriodo(supabase, {
        dataInicial: inicioVenc,
        dataFinal: fimVenc,
        quantidadePorPagina: 200,
      })
    } catch (e: any) {
      if (e instanceof HinovaTransientError) {
        const retry = calcularProximoRetry(e.reason)
        return jsonResp({
          erro: 'hinova_transitorio',
          motivo: e.reason,
          retry_em: retry.toISOString(),
          message: 'Hinova indisponível — tente novamente em instantes',
        }, 503)
      }
      throw e
    }

    console.log(`[regua] ${boletos.length} boletos retornados (janela ${inicioVenc.toISOString().slice(0,10)} → ${fimVenc.toISOString().slice(0,10)})`)

    // 5. Filtra/normaliza e casa com etapas
    const hojeMs = hoje.getTime()
    const fila: ItemFila[] = []
    const dia = diaCivilSP()

    // Pré-carrega mirror local de associados (codigo_hinova → id, telefone alt) e veículos (placa → id)
    const codigosAssoc = Array.from(new Set(
      boletos.map((b) => Number(b?.codigo_associado || 0)).filter((n) => n > 0),
    ))
    const placasSet = new Set<string>()
    for (const b of boletos) {
      const ps = (b?.veiculos || []) as any[]
      for (const v of ps) {
        const p = String(v?.placa || '').toUpperCase().trim()
        if (p) placasSet.add(p)
      }
    }

    const assocByCodigo = new Map<number, { id: string; whatsapp: string | null; telefone: string | null }>()
    if (codigosAssoc.length) {
      const { data } = await supabase
        .from('associados').select('id, codigo_hinova, whatsapp, telefone')
        .in('codigo_hinova', codigosAssoc)
      for (const a of data || []) {
        assocByCodigo.set(Number((a as any).codigo_hinova), {
          id: (a as any).id, whatsapp: (a as any).whatsapp || null, telefone: (a as any).telefone || null,
        })
      }
    }
    const veicByPlaca = new Map<string, { id: string; modelo: string | null; marca: string | null }>()
    if (placasSet.size) {
      const { data } = await supabase
        .from('veiculos').select('id, placa, modelo, marca')
        .in('placa', Array.from(placasSet))
      for (const v of data || []) {
        veicByPlaca.set(String((v as any).placa).toUpperCase(), {
          id: (v as any).id, modelo: (v as any).modelo || null, marca: (v as any).marca || null,
        })
      }
    }

    // 5.1 Espelha boletos no mirror local `cobrancas` (insere/atualiza/baixa pagas).
    //     Usa os mapas já carregados; boletos sem associado/veículo local são pulados.
    let mirrorRes = { inseridas: 0, atualizadas: 0, baixadas: 0, ignoradas: 0, erros: 0 }
    try {
      mirrorRes = await mirrorBoletosEmCobrancas(supabase, boletos, {
        associadosPorCodigoHinova: new Map(
          Array.from(assocByCodigo.entries()).map(([k, v]) => [k, { id: v.id }]),
        ),
        veiculosPorPlaca: new Map(
          Array.from(veicByPlaca.entries()).map(([k, v]) => [k, { id: v.id }]),
        ),
      })
      console.log(`[regua] mirror cobrancas:`, mirrorRes)
    } catch (e: any) {
      console.error('[regua] mirror cobrancas falhou (não-bloqueante):', e?.message || e)
    }

      const situacao = String(b?.situacao_boleto || '')
      const dataPag = parseDataHinova(b?.data_pagamento)
      if (dataPag) continue
      if (SITUACAO_PAGA.test(situacao)) continue
      if (SITUACAO_CANCELADA.test(situacao)) continue

      const venc = parseDataHinova(b?.data_vencimento)
      if (!venc) continue
      const vencMs = new Date(venc + 'T00:00:00').getTime()
      const diffDias = Math.floor((hojeMs - vencMs) / 86_400_000)
      // diffDias > 0 → atrasado; diffDias < 0 → a vencer; ==0 vence hoje

      // Acha etapa: dias > 0 (atrasado) ou dias <= 0 (lembrete)
      let etapaMatch: Etapa | undefined
      if (diffDias >= 0) {
        // atrasado/vence hoje: usa etapa exata, ou a maior <=
        etapaMatch = etapas.filter((e) => e.dias >= 0 && e.dias <= diffDias).pop()
      } else {
        // a vencer: precisa etapa exata (D-N)
        etapaMatch = etapas.find((e) => e.dias === diffDias)
      }
      if (!etapaMatch) continue

      const codAssoc = Number(b?.codigo_associado || 0)
      const local = codAssoc ? assocByCodigo.get(codAssoc) : undefined
      const fone = sanitizeFone(b?.celular)
        || sanitizeFone(local?.whatsapp)
        || sanitizeFone(b?.telefone_fixo)
        || sanitizeFone(b?.telefone_comercial)
        || sanitizeFone(local?.telefone)

      const v0 = (b?.veiculos || [])[0] || {}
      const placaUp = String(v0?.placa || '').toUpperCase().trim() || null
      const veicLocal = placaUp ? veicByPlaca.get(placaUp) : undefined
      const modeloMontado = veicLocal
        ? [veicLocal.marca, veicLocal.modelo].filter(Boolean).join(' ') || null
        : (v0?.modelo || null)

      fila.push({
        nosso_numero: String(b?.nosso_numero || ''),
        associado_id: local?.id || null,
        codigo_associado: codAssoc,
        nome: String(b?.nome_associado || '').trim() || 'Associado',
        telefone: fone,
        email: b?.email || null,
        valor: toNumber(b?.valor_boleto),
        vencimento: venc,
        diasAtraso: diffDias,
        linha_digitavel: b?.linha_digitavel || null,
        boleto_url: b?.link_boleto || b?.url_boleto || null,
        placa: placaUp,
        modelo: modeloMontado,
        veiculo_id: veicLocal?.id || null,
        codigo_veiculo: Number(v0?.codigo_veiculo || 0) || null,
        etapa: etapaMatch,
      })
    }

    // 6. Ordena: inadimplentes (diasAtraso DESC) → valor DESC; depois "a vencer" do mais próximo ao mais distante
    fila.sort((a, b) => {
      const aAtras = a.diasAtraso >= 0
      const bAtras = b.diasAtraso >= 0
      if (aAtras !== bAtras) return aAtras ? -1 : 1
      if (aAtras) {
        if (b.diasAtraso !== a.diasAtraso) return b.diasAtraso - a.diasAtraso
        return b.valor - a.valor
      }
      // ambos a vencer: menor |dias| primeiro (mais próximo de vencer)
      return a.diasAtraso - b.diasAtraso // a.diasAtraso é negativo; -1 antes de -10
    })

    // 7. Dedupe diário consultando cobranca_eventos por (nosso_numero, dia_regua) no dia
    const inicioDia = `${dia}T00:00:00-03:00`
    const numeros = Array.from(new Set(fila.map((f) => f.nosso_numero).filter(Boolean)))
    const jaDisparados = new Set<string>() // chave: nosso_numero|dias
    if (numeros.length) {
      const CHUNK = 200
      for (let i = 0; i < numeros.length; i += CHUNK) {
        const slice = numeros.slice(i, i + CHUNK)
        const { data } = await supabase
          .from('cobranca_eventos')
          .select('dados')
          .gte('created_at', inicioDia)
          .in('dados->>nosso_numero', slice)
        for (const ev of data || []) {
          const nn = (ev as any).dados?.nosso_numero
          const dr = (ev as any).dados?.dia_regua
          if (nn != null && dr != null) jaDisparados.add(`${nn}|${dr}`)
        }
      }
    }

    const filaFinal = fila.filter((f) => f.nosso_numero && !jaDisparados.has(`${f.nosso_numero}|${f.etapa.dias}`))
    const totalPlanejado = Math.min(filaFinal.length, MAX)

    // 8. Cria cobranca_runs e dispara em background
    const { data: runRow, error: errRun } = await supabase
      .from('cobranca_runs').insert({
        status: 'executando',
        total_planejado: totalPlanejado,
        delay_ms: delayMs,
        criado_por: criadoPor,
        payload: {
          janela_inicio: inicioVenc.toISOString().slice(0, 10),
          janela_fim: fimVenc.toISOString().slice(0, 10),
          boletos_retornados: boletos.length,
          fila_bruta: fila.length,
          duplicados_pulados: fila.length - filaFinal.length,
          regua_id: regua.id,
        },
      }).select('id').single()
    if (errRun) throw errRun
    const runId = (runRow as any).id as string

    // Worker em background
    const worker = (async () => {
      let enviados = 0, falhas = 0, pulados = 0
      const itens = filaFinal.slice(0, totalPlanejado)

      for (let i = 0; i < itens.length; i++) {
        // Verifica cancelamento
        const { data: rState } = await supabase
          .from('cobranca_runs').select('status').eq('id', runId).maybeSingle()
        if ((rState as any)?.status === 'cancelado') {
          console.log(`[regua run ${runId}] cancelado em ${i}/${itens.length}`)
          break
        }

        const it = itens[i]
        const subtipo = `regua_d${it.etapa.dias}`
        let envioStatus: 'enviado' | 'falhou' | 'agendado' = 'agendado'
        let envioErro: string | null = null
        let messageId: string | null = null
        let templateParams: string[] = []
        let faltaSGA = false

        if (it.etapa.acao !== 'whatsapp') {
          // ações não-whatsapp só registram evento (comportamento legado)
          await supabase.from('cobranca_eventos').insert({
            associado_id: it.associado_id, tipo: it.etapa.acao, subtipo,
            descricao: `${it.etapa.acao.toUpperCase()} D${it.etapa.dias >= 0 ? '+' : ''}${it.etapa.dias} agendado`,
            dados: {
              dia_regua: it.etapa.dias, dias_atraso: it.diasAtraso, valor: it.valor,
              nosso_numero: it.nosso_numero, codigo_associado: it.codigo_associado,
              codigo_veiculo: it.codigo_veiculo, fonte: 'hinova_periodo', status: 'agendado',
            }, automatico: true,
          })
          pulados++
          await supabase.from('cobranca_runs').update({ pulados }).eq('id', runId)
          continue
        }

        if (!it.telefone) {
          envioStatus = 'falhou'; envioErro = 'Sem telefone/celular'
          falhas++
        } else if (!it.etapa.template) {
          envioStatus = 'falhou'; envioErro = 'Etapa sem template'
          falhas++
        } else {
          const slots = slotsPorTemplate.get(it.etapa.template) ?? 0
          const built = buildParams(it.etapa.template, {
            nome: it.nome, valor: it.valor, vencimento: it.vencimento,
            placa: it.placa, modelo: it.modelo, linha_digitavel: it.linha_digitavel,
          }, slots)
          templateParams = built.params
          faltaSGA = built.faltaSGA

          const exigeLD = TEMPLATE_PARAMS_MAP[it.etapa.template]?.includes('linha_digitavel') ?? false
          if (exigeLD && !it.linha_digitavel) {
            envioStatus = 'falhou'; envioErro = 'Sem linha digitável (Hinova)'
            falhas++
          } else {
            try {
              const resp = await supabase.functions.invoke('whatsapp-send-text', {
                body: {
                  telefone: it.telefone, mensagem: '',
                  template_name: it.etapa.template, template_params: templateParams,
                },
              })
              const data: any = resp.data || {}
              if (resp.error || data?.success === false) {
                envioStatus = 'falhou'; envioErro = resp.error?.message || data?.error || 'Falha desconhecida'
                falhas++
              } else {
                envioStatus = 'enviado'
                messageId = data?.message_id || null
                enviados++
              }
            } catch (e: any) {
              envioStatus = 'falhou'; envioErro = e?.message || String(e)
              falhas++
            }
          }
        }

        await supabase.from('cobranca_eventos').insert({
          associado_id: it.associado_id, tipo: 'whatsapp', subtipo,
          descricao: `WhatsApp ${it.etapa.dias < 0 ? `D${it.etapa.dias} (lembrete)` : `D+${it.etapa.dias}`} — ${it.etapa.template || '(s/template)'}`,
          dados: {
            dia_regua: it.etapa.dias, dias_atraso: it.diasAtraso,
            valor: it.valor, vencimento: it.vencimento,
            nosso_numero: it.nosso_numero, codigo_associado: it.codigo_associado,
            codigo_veiculo: it.codigo_veiculo, placa: it.placa,
            template: it.etapa.template, template_params: templateParams,
            linha_digitavel: it.linha_digitavel || null, boleto_url: it.boleto_url || null,
            falta_sga: faltaSGA, status: envioStatus, message_id: messageId, erro: envioErro,
            fonte: 'hinova_periodo', run_id: runId,
          },
          automatico: true,
        })

        // Atualiza contadores a cada N envios (reduz writes)
        if ((i % 5) === 0 || i === itens.length - 1) {
          await supabase.from('cobranca_runs').update({ enviados, falhas, pulados }).eq('id', runId)
        }

        // Delay entre envios (não no último)
        if (i < itens.length - 1 && delayMs > 0) {
          await new Promise((r) => setTimeout(r, delayMs))
        }
      }

      const { data: finalState } = await supabase
        .from('cobranca_runs').select('status').eq('id', runId).maybeSingle()
      const wasCancelled = (finalState as any)?.status === 'cancelado'

      await supabase.from('cobranca_runs').update({
        status: wasCancelled ? 'cancelado' : 'concluido',
        finished_at: new Date().toISOString(),
        enviados, falhas, pulados,
      }).eq('id', runId)
      console.log(`[regua run ${runId}] finalizado — enviados=${enviados} falhas=${falhas} pulados=${pulados}`)
    })().catch(async (err) => {
      console.error(`[regua run ${runId}] erro fatal:`, err)
      await supabase.from('cobranca_runs').update({
        status: 'falhou', finished_at: new Date().toISOString(),
        payload: { erro: String(err?.message || err) },
      }).eq('id', runId)
    })

    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
      EdgeRuntime.waitUntil(worker)
    }

    return jsonResp({
      ativa: true,
      run_id: runId,
      total_planejado: totalPlanejado,
      delay_ms: delayMs,
      janela: { inicio: inicioVenc.toISOString().slice(0, 10), fim: fimVenc.toISOString().slice(0, 10) },
      boletos_retornados: boletos.length,
      duplicados_pulados: fila.length - filaFinal.length,
      started_at: startedAt,
      message: totalPlanejado > 0
        ? `Régua iniciada — ${totalPlanejado} envio(s) agendado(s) com ${delayMs}ms entre cada`
        : 'Nenhum envio pendente para hoje (tudo já disparado ou sem etapa correspondente)',
    })
  } catch (error: any) {
    console.error('Erro régua:', error)
    return jsonResp({ error: error?.message || String(error) }, 500)
  }
})

function jsonResp(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
