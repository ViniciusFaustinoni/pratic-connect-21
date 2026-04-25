// Drenagem do backfill financeiro SGA — agora 100% assíncrona.
//
// Comportamento:
// 1) Retorna 202 Accepted IMEDIATAMENTE com {success:true, started:true|false, reason}.
// 2) Se já houver execução ativa (sga_runtime_state.backfill_financeiro_ativo=true
//    com heartbeat fresco, < 2 min), responde started=false (idempotente).
// 3) Caso contrário, dispara o loop em background com EdgeRuntime.waitUntil().
// 4) O loop processa até esgotar a fila, com cap defensivo de tempo e ciclos,
//    atualizando heartbeat/contadores em sga_runtime_state a cada lote.
// 5) Lê backfill_cancelar_solicitado a cada lote para parada graciosa.
//
// IMPORTANTE: a sincronização financeira atua apenas sobre a BASE ANTIGA
// (associados.origem_cadastro = 'api_externa'). Veículos do sistema novo
// (origem_cadastro = 'interno') são enviados ao SGA via sga-hinova-sync.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Caps defensivos por execução em background
const MAX_CICLOS = 500;          // 500 × 20 = 10.000 jobs por execução
const BATCH = 20;                // batch menor → invoke responde mais rápido (evita timeout interno)
const DELAY_LOTE = 300;          // pausa entre lotes (sga-backfill-financeiro já tem delay interno)
const MAX_WALL_CLOCK_MS = 50 * 60 * 1000; // 50 min — segurança vs runtime ~60 min
const HEARTBEAT_TTL_MS = 2 * 60 * 1000;   // 2 min sem heartbeat → execução considerada morta
const MAX_ERROS_CONSEC = 5;      // tolera erros transitórios antes de abortar

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

async function executarDrenagemEmBackground(
  supabase: ReturnType<typeof createClient>,
  opts: { enfileirar: boolean }
) {
  const inicio = Date.now();
  let totalOk = 0;
  let totalFail = 0;
  let totalRetry = 0;
  let totalProcessados = 0;
  let lotes = 0;

  // Marca execução ativa e zera contadores desta sessão
  await supabase
    .from('sga_runtime_state')
    .update({
      backfill_financeiro_ativo: true,
      backfill_iniciado_em: new Date().toISOString(),
      backfill_expira_em: new Date(Date.now() + HEARTBEAT_TTL_MS).toISOString(),
      backfill_ultimo_heartbeat: new Date().toISOString(),
      backfill_processados_total: 0,
      backfill_ok_total: 0,
      backfill_fail_total: 0,
      backfill_retry_total: 0,
      backfill_lote_atual: 0,
      backfill_cancelar_solicitado: false,
    })
    .gte('id', '00000000-0000-0000-0000-000000000000');

  try {
    if (opts.enfileirar) {
      // Limpeza + enfileiramento + reagendamento (3 chamadas leves)
      try {
        const limpeza = await supabase.functions.invoke('sga-backfill-financeiro', {
          body: { acao: 'cancelar_internos' },
        });
        console.log('[Cron SGA Drenagem] limpeza internos:', limpeza.data);
      } catch (e) {
        console.warn('[Cron SGA Drenagem] limpeza falhou (segue):', e);
      }
      try {
        const enq = await supabase.functions.invoke('sga-backfill-financeiro', {
          body: { acao: 'enfileirar', tipo: 'resync' },
        });
        console.log('[Cron SGA Drenagem] enfileirar:', enq.data);
      } catch (e) {
        console.warn('[Cron SGA Drenagem] enfileirar falhou (segue):', e);
      }
      try {
        const reag = await supabase.functions.invoke('sga-backfill-financeiro', {
          body: { acao: 'reagendar_erros_horario' },
        });
        console.log('[Cron SGA Drenagem] reagendar:', reag.data);
      } catch (e) {
        console.warn('[Cron SGA Drenagem] reagendar falhou (segue):', e);
      }
    }

    let errosConsec = 0;
    for (let i = 0; i < MAX_CICLOS; i++) {
      // Cap por wall-clock
      if (Date.now() - inicio > MAX_WALL_CLOCK_MS) {
        console.log('[Cron SGA Drenagem] wall-clock cap atingido, encerrando ciclo');
        break;
      }

      // Cancelamento pelo usuário?
      const { data: stateRow } = await supabase
        .from('sga_runtime_state')
        .select('backfill_cancelar_solicitado')
        .gte('id', '00000000-0000-0000-0000-000000000000')
        .limit(1)
        .maybeSingle();
      if (stateRow?.backfill_cancelar_solicitado) {
        console.log('[Cron SGA Drenagem] cancelamento solicitado pelo usuário');
        break;
      }

      // Pré-checagem: existe algum job pendente/retry vencido?
      const nowIsoCheck = new Date().toISOString();
      const { count: pendCount } = await supabase
        .from('sga_sync_financeiro_jobs')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pendente', 'pendente_retry'])
        .in('tipo', ['backfill_inicial', 'resync'])
        .or(`status.eq.pendente,proximo_retry_em.lte.${nowIsoCheck}`);
      if ((pendCount ?? 0) === 0) {
        console.log('[Cron SGA Drenagem] fila realmente vazia (count=0), encerrando');
        break;
      }

      let data: any = null;
      let invokeError: any = null;
      try {
        const r = await supabase.functions.invoke('sga-backfill-financeiro', {
          body: { acao: 'processar', batch_size: BATCH, delay_ms: 150 },
        });
        data = r.data;
        invokeError = r.error;
      } catch (e) {
        invokeError = e;
      }

      if (invokeError) {
        errosConsec++;
        console.warn(`[Cron SGA Drenagem] invoke erro (${errosConsec}/${MAX_ERROS_CONSEC}):`, invokeError);
        if (errosConsec >= MAX_ERROS_CONSEC) {
          console.error('[Cron SGA Drenagem] erros consecutivos demais, abortando');
          break;
        }
        await sleep(2000);
        continue;
      }
      errosConsec = 0;

      const processados = data?.processados ?? 0;
      if (processados === 0) {
        // fila estava vazia neste momento — sai do loop, próximo cron retoma
        console.log('[Cron SGA Drenagem] processados=0 (sem jobs vencidos no momento), encerrando');
        break;
      }
      totalOk += data.ok ?? 0;
      totalFail += data.fail ?? 0;
      totalRetry += data.retry ?? 0;
      totalProcessados += processados;
      lotes++;

      // Heartbeat + contadores acumulados
      await supabase
        .from('sga_runtime_state')
        .update({
          backfill_ultimo_heartbeat: new Date().toISOString(),
          backfill_expira_em: new Date(Date.now() + HEARTBEAT_TTL_MS).toISOString(),
          backfill_lote_atual: lotes,
          backfill_processados_total: totalProcessados,
          backfill_ok_total: totalOk,
          backfill_fail_total: totalFail,
          backfill_retry_total: totalRetry,
        })
        .gte('id', '00000000-0000-0000-0000-000000000000');

      await sleep(DELAY_LOTE);
    }
  } catch (err) {
    console.error('[Cron SGA Drenagem] erro no loop:', err);
  } finally {
    // Libera o flag para a próxima execução do cron retomar
    await supabase
      .from('sga_runtime_state')
      .update({
        backfill_financeiro_ativo: false,
        backfill_expira_em: null,
        backfill_ultimo_heartbeat: new Date().toISOString(),
        backfill_cancelar_solicitado: false,
      })
      .gte('id', '00000000-0000-0000-0000-000000000000');
    console.log(
      `[Cron SGA Drenagem] FIM — lotes=${lotes} processados=${totalProcessados} ok=${totalOk} retry=${totalRetry} fail=${totalFail} duracao=${Math.round((Date.now() - inicio) / 1000)}s`
    );
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const body = await req.json().catch(() => ({}));
    const apenasProcessar: boolean = body?.apenas_processar === true;

    // Idempotência: se já há execução ativa com heartbeat recente, não dispara outra.
    const { data: state } = await supabase
      .from('sga_runtime_state')
      .select('backfill_financeiro_ativo, backfill_ultimo_heartbeat')
      .gte('id', '00000000-0000-0000-0000-000000000000')
      .limit(1)
      .maybeSingle();

    const heartbeatTs = state?.backfill_ultimo_heartbeat
      ? new Date(state.backfill_ultimo_heartbeat).getTime()
      : 0;
    const heartbeatVivo = Date.now() - heartbeatTs < HEARTBEAT_TTL_MS;
    const jaAtivo = state?.backfill_financeiro_ativo === true && heartbeatVivo;

    if (jaAtivo) {
      return new Response(
        JSON.stringify({
          success: true,
          started: false,
          reason: 'already_running',
          message: 'Drenagem já em execução em background.',
        }),
        { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Dispara em background
    EdgeRuntime.waitUntil(executarDrenagemEmBackground(supabase, { enfileirar: !apenasProcessar }));

    return new Response(
      JSON.stringify({
        success: true,
        started: true,
        message: 'Drenagem iniciada em background. Acompanhe o progresso pelo painel.',
      }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[Cron SGA Drenagem] erro:', err);
    return new Response(JSON.stringify({ success: false, error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
