// Cron: reconciliar-ativacao-parcial
// ----------------------------------
// Roda a cada 15 min via pg_cron. Varre associados cujo registro mais recente
// em `ativacao_status_log` ficou em `to_status='ativo_parcial'` (algum UPDATE
// de contrato/veiculo/cotacao falhou em `ativar-associado`). Reaplica o passo
// que faltou chamando `ativar-associado` de novo com o payload original — a
// edge é idempotente (CAS + lock), então re-execução é segura.
//
// Quando o novo run sai sem `parciais`, o log mais recente passa a ter
// `to_status='ativo'` e o associado some da varredura. Estado deixa de
// depender de operador clicar em "Retentar".

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface ParcialItem { alvo: string; id: string | null; erro: string }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const inicio = Date.now()
  const resultados: Array<{ associado_id: string; outcome: string; detalhe?: any }> = []

  try {
    // 1) Buscar candidatos: logs ativo_parcial nas últimas 24h
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: logsParciais, error: logErr } = await admin
      .from('ativacao_status_log')
      .select('associado_id, contrato_id, source, payload, created_at')
      .eq('to_status', 'ativo_parcial')
      .gte('created_at', desde)
      .order('created_at', { ascending: false })
      .limit(200)

    if (logErr) throw new Error(`Falha lendo ativacao_status_log: ${logErr.message}`)

    // Dedup: pegar apenas o registro mais recente por associado_id
    const maisRecentePorAssoc = new Map<string, typeof logsParciais[number]>()
    for (const l of logsParciais ?? []) {
      if (!maisRecentePorAssoc.has(l.associado_id)) maisRecentePorAssoc.set(l.associado_id, l)
    }

    // 2) Para cada candidato, confirmar que o log mais recente AINDA é parcial
    //    (não foi sobreposto por uma reconciliação bem-sucedida posterior)
    for (const [associadoId, log] of maisRecentePorAssoc) {
      const { data: ultimoLog } = await admin
        .from('ativacao_status_log')
        .select('to_status, source, created_at')
        .eq('associado_id', associadoId)
        .in('to_status', ['ativo', 'ativo_parcial'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!ultimoLog || ultimoLog.to_status !== 'ativo_parcial') {
        resultados.push({ associado_id: associadoId, outcome: 'ja_reconciliado' })
        continue
      }

      // 3) Reconstituir payload original do log
      const payload = (log.payload as any) || {}
      const parciaisOriginais: ParcialItem[] = Array.isArray(payload.parciais) ? payload.parciais : []
      if (parciaisOriginais.length === 0) {
        resultados.push({ associado_id: associadoId, outcome: 'sem_parciais_para_reaplicar' })
        continue
      }

      // 4) Re-invocar ativar-associado com mesmo payload (idempotente)
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/ativar-associado`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            associado_id: associadoId,
            contrato_id: log.contrato_id ?? payload.contrato_id ?? null,
            veiculo_id: payload.veiculo_id ?? null,
            cotacao_id: payload.cotacao_id ?? null,
            servico_id: payload.servico_id ?? null,
            instalacao_id: payload.instalacao_id ?? null,
            ativar_cobertura_total: payload.ativar_cobertura_total ?? false,
            ativar_cobertura_roubo_furto: payload.ativar_cobertura_roubo_furto ?? false,
            aguardar_instalacao: payload.aguardar_instalacao ?? false,
            sga_enqueue: payload.sga_enqueue ?? undefined,
            source: 'cron-reconciliar-ativacao-parcial',
            actor_id: null,
            metadata: {
              reconciliando_log_em: log.created_at,
              parciais_originais: parciaisOriginais.map((p) => p.alvo),
            },
          }),
        })

        const body = await resp.json().catch(() => ({}))
        if (resp.ok && body?.success === true) {
          resultados.push({ associado_id: associadoId, outcome: 'reconciliado_ok' })
        } else if (resp.status === 207 && Array.isArray(body?.parciais)) {
          resultados.push({
            associado_id: associadoId,
            outcome: 'ainda_parcial',
            detalhe: { alvos: body.parciais.map((p: ParcialItem) => p.alvo) },
          })
        } else {
          resultados.push({
            associado_id: associadoId,
            outcome: 'falha_reinvocacao',
            detalhe: { status: resp.status, body },
          })
        }
      } catch (e: any) {
        resultados.push({ associado_id: associadoId, outcome: 'erro_rede', detalhe: e?.message })
      }
    }

    const resumo = {
      duracao_ms: Date.now() - inicio,
      candidatos: maisRecentePorAssoc.size,
      reconciliados_ok: resultados.filter((r) => r.outcome === 'reconciliado_ok').length,
      ainda_parcial: resultados.filter((r) => r.outcome === 'ainda_parcial').length,
      ja_reconciliado: resultados.filter((r) => r.outcome === 'ja_reconciliado').length,
      falhas: resultados.filter((r) => r.outcome === 'falha_reinvocacao' || r.outcome === 'erro_rede').length,
    }

    console.log('[reconciliar-ativacao-parcial]', resumo)

    return new Response(JSON.stringify({ success: true, resumo, resultados }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    console.error('[reconciliar-ativacao-parcial] erro fatal:', e)
    return new Response(JSON.stringify({ success: false, error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
