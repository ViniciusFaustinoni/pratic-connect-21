// Orquestrador do backfill financeiro:
// - Modo "enfileirar": cria jobs pendentes (backfill_inicial) para veículos elegíveis
//   (com OU sem codigo_hinova — a função sync reconcilia via placa+CPF).
// - Modo "processar": pega N jobs pendentes/pendente_retry vencidos e dispara sga-sync-financeiro-veiculo
// - Modo "reagendar_erros_horario": converte status='erro' por janela horária em 'pendente_retry'.
// Body: { acao, batch_size?, delay_ms?, tipo? }
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Próxima janela 09:00 BRT (12:00 UTC) — se já passou, agenda amanhã */
function nextJanela(): Date {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(12, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const body = await req.json().catch(() => ({}));
    const acao = body.acao || 'processar';
    const tipo = body.tipo || 'backfill_inicial';

    // -------- STATUS DRENAGEM (telemetria do background) --------
    if (acao === 'status_drenagem') {
      const { data: state } = await supabase
        .from('sga_runtime_state')
        .select(
          'backfill_financeiro_ativo, backfill_iniciado_em, backfill_ultimo_heartbeat, backfill_lote_atual, backfill_processados_total, backfill_ok_total, backfill_fail_total, backfill_retry_total, backfill_cancelar_solicitado'
        )
        .gte('id', '00000000-0000-0000-0000-000000000000')
        .limit(1)
        .maybeSingle();
      const heartbeatTs = state?.backfill_ultimo_heartbeat
        ? new Date(state.backfill_ultimo_heartbeat).getTime()
        : 0;
      const heartbeatIdadeMs = heartbeatTs ? Date.now() - heartbeatTs : null;
      const vivo = state?.backfill_financeiro_ativo === true && heartbeatIdadeMs !== null && heartbeatIdadeMs < 2 * 60 * 1000;
      return json(200, {
        success: true,
        ativo: !!state?.backfill_financeiro_ativo,
        vivo,
        cancelamento_solicitado: !!state?.backfill_cancelar_solicitado,
        iniciado_em: state?.backfill_iniciado_em ?? null,
        ultimo_heartbeat: state?.backfill_ultimo_heartbeat ?? null,
        heartbeat_idade_ms: heartbeatIdadeMs,
        lote_atual: state?.backfill_lote_atual ?? 0,
        processados_total: state?.backfill_processados_total ?? 0,
        ok_total: state?.backfill_ok_total ?? 0,
        fail_total: state?.backfill_fail_total ?? 0,
        retry_total: state?.backfill_retry_total ?? 0,
      });
    }

    // -------- PARAR DRENAGEM (cancelamento gracioso) --------
    if (acao === 'parar_drenagem') {
      await supabase
        .from('sga_runtime_state')
        .update({ backfill_cancelar_solicitado: true })
        .gte('id', '00000000-0000-0000-0000-000000000000');
      return json(200, { success: true, cancelamento_solicitado: true });
    }

    // -------- STATUS --------
    if (acao === 'status') {
      const counts: Record<string, number> = {};
      for (const st of ['pendente', 'pendente_retry', 'executando', 'concluido', 'erro', 'sem_historico_hinova', 'cancelado']) {
        const { count } = await supabase
          .from('sga_sync_financeiro_jobs')
          .select('id', { count: 'exact', head: true })
          .eq('status', st);
        counts[st] = count ?? 0;
      }

      // Top 5 erros agrupados
      const { data: erros } = await supabase
        .from('sga_sync_financeiro_jobs')
        .select('ultimo_erro')
        .in('status', ['erro', 'pendente_retry'])
        .not('ultimo_erro', 'is', null)
        .limit(2000);
      const errosMap: Record<string, number> = {};
      for (const e of erros ?? []) {
        const raw = String(e.ultimo_erro || '').slice(0, 80);
        // normaliza por categoria
        let key = raw;
        if (/janela_horaria|horari/i.test(raw)) key = 'Janela horária restrita (Hinova)';
        else if (/auth|401|403/i.test(raw)) key = 'Autenticação recusada (401/403)';
        else if (/rate|429/i.test(raw)) key = 'Rate limit (429)';
        else if (/server|5\d\d/i.test(raw)) key = 'Servidor Hinova indisponível (5xx)';
        else if (/network|rede|fetch/i.test(raw)) key = 'Erro de rede';
        else if (/codigo_hinova|reconciliação|n[ãa]o encontrado/i.test(raw)) key = 'Veículo/associado não encontrado na Hinova';
        errosMap[key] = (errosMap[key] ?? 0) + 1;
      }
      const topErros = Object.entries(errosMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([motivo, qtd]) => ({ motivo, qtd }));

      // Apenas veículos da base antiga são elegíveis para sincronização financeira
      const { count: elegiveisSemCodigo } = await supabase
        .from('veiculos')
        .select('id, associados:associados!inner(origem_cadastro)', { count: 'exact', head: true })
        .is('codigo_hinova', null)
        .eq('associados.origem_cadastro', 'api_externa');
      const { count: elegiveisComCodigo } = await supabase
        .from('veiculos')
        .select('id, associados:associados!inner(origem_cadastro)', { count: 'exact', head: true })
        .not('codigo_hinova', 'is', null)
        .eq('associados.origem_cadastro', 'api_externa');
      const { count: sistemaNovo } = await supabase
        .from('veiculos')
        .select('id, associados:associados!inner(origem_cadastro)', { count: 'exact', head: true })
        .eq('associados.origem_cadastro', 'interno');

      // Cobranças SGA importadas
      const { count: cobrancasSga } = await supabase
        .from('cobrancas')
        .select('id', { count: 'exact', head: true })
        .eq('origem', 'sga_hinova');

      return json(200, {
        success: true,
        jobs: counts,
        veiculos_sem_codigo: elegiveisSemCodigo ?? 0,
        veiculos_com_codigo: elegiveisComCodigo ?? 0,
        veiculos_sistema_novo: sistemaNovo ?? 0,
        cobrancas_sga: cobrancasSga ?? 0,
        top_erros: topErros,
      });
    }

    // -------- CANCELAR JOBS DE VEÍCULOS INTERNOS --------
    if (acao === 'cancelar_internos') {
      const veiculosInternos: string[] = [];
      const pageSize = 1000;
      let fromIdx = 0;
      while (true) {
        const { data, error } = await supabase
          .from('veiculos')
          .select('id, associados:associados!inner(origem_cadastro)')
          .eq('associados.origem_cadastro', 'interno')
          .range(fromIdx, fromIdx + pageSize - 1);
        if (error) throw error;
        if (!data?.length) break;
        veiculosInternos.push(...data.map((v: any) => v.id));
        if (data.length < pageSize) break;
        fromIdx += pageSize;
      }

      if (!veiculosInternos.length) {
        return json(200, { success: true, cancelados: 0, veiculos_internos: 0 });
      }

      const CHUNK = 200;
      let cancelados = 0;
      for (let i = 0; i < veiculosInternos.length; i += CHUNK) {
        const slice = veiculosInternos.slice(i, i + CHUNK);
        const { data, error } = await supabase
          .from('sga_sync_financeiro_jobs')
          .update({
            status: 'cancelado',
            ultimo_erro: 'Veículo da base nova (origem_cadastro=interno) — não elegível para sincronização financeira do SGA',
            concluido_em: new Date().toISOString(),
          })
          .in('veiculo_id', slice)
          .in('status', ['pendente', 'pendente_retry', 'executando', 'erro', 'sem_historico_hinova'])
          .select('id');
        if (error) {
          console.error('[SGA Backfill] cancelar_internos erro:', error.message);
          continue;
        }
        cancelados += data?.length ?? 0;
      }

      return json(200, { success: true, cancelados, veiculos_internos: veiculosInternos.length });
    }

    // -------- REAGENDAR ERROS DE JANELA HORÁRIA --------
    if (acao === 'reagendar_erros_horario') {
      const proximo = nextJanela().toISOString();
      // Move erros conhecidamente transitórios → pendente_retry
      const { data, error } = await supabase
        .from('sga_sync_financeiro_jobs')
        .update({ status: 'pendente_retry', proximo_retry_em: proximo })
        .eq('status', 'erro')
        .or('ultimo_erro.ilike.%horario%,ultimo_erro.ilike.%horário%,ultimo_erro.ilike.%janela_horaria%,ultimo_erro.ilike.%401%,ultimo_erro.ilike.%restri%')
        .select('id');
      if (error) throw error;
      return json(200, { success: true, reagendados: data?.length ?? 0, proximo_retry_em: proximo });
    }

    // -------- GUARDA GLOBAL: backfill_financeiro_ativo --------
    // Bloqueia ações que disparam workers se a flag de runtime estiver desativada.
    // Isso impede que o cron `sga-sync-financeiro-drenagem-5min` reinicie a drenagem
    // quando o usuário clicou em "Parar Drenagem".
    if (acao === 'enfileirar' || acao === 'processar' || !acao) {
      const { data: rt } = await supabase
        .from('sga_runtime_state')
        .select('backfill_financeiro_ativo, backfill_cancelar_solicitado')
        .gte('id', '00000000-0000-0000-0000-000000000000')
        .limit(1)
        .maybeSingle();
      if (rt && (rt.backfill_financeiro_ativo === false || rt.backfill_cancelar_solicitado === true)) {
        return json(200, {
          success: true,
          skipped: true,
          motivo: 'backfill_pausado',
          ativo: !!rt.backfill_financeiro_ativo,
          cancelamento_solicitado: !!rt.backfill_cancelar_solicitado,
        });
      }
    }

    // -------- ENFILEIRAR --------
    if (acao === 'enfileirar') {

      // Apenas veículos da BASE ANTIGA (origem_cadastro='api_externa').
      // INCLUI veículos SEM codigo_hinova — a sync reconcilia via placa+CPF.
      const pageSize = 1000;
      let from = 0;
      let inseridos = 0;
      while (true) {
        const { data: vs, error } = await supabase
          .from('veiculos')
          .select('id, associado_id, placa, codigo_hinova, associados:associados!inner(cpf, codigo_hinova, origem_cadastro)')
          .not('associado_id', 'is', null)
          .eq('associados.origem_cadastro', 'api_externa')
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!vs?.length) break;

        const vIds = vs.map(v => v.id);
        const { data: jobsExistentes } = await supabase
          .from('sga_sync_financeiro_jobs')
          .select('veiculo_id')
          .in('veiculo_id', vIds)
          .in('status', ['pendente', 'pendente_retry', 'executando']);
        const blocked = new Set((jobsExistentes ?? []).map(j => j.veiculo_id));

        const novos = vs
          .filter(v => {
            const a: any = Array.isArray((v as any).associados) ? (v as any).associados[0] : (v as any).associados;
            // Precisa ter ALGUMA forma de reconciliar: codigo_hinova OU (placa + cpf do associado)
            const podeSync = v.codigo_hinova || a?.codigo_hinova || (v.placa && a?.cpf);
            return podeSync && !blocked.has(v.id);
          })
          .map(v => ({
            veiculo_id: v.id,
            associado_id: v.associado_id,
            tipo,
            status: 'pendente',
          }));

        if (novos.length) {
          const { error: insErr } = await supabase.from('sga_sync_financeiro_jobs').insert(novos);
          if (insErr) console.error('[SGA Backfill] insert err', insErr.message);
          else inseridos += novos.length;
        }

        if (vs.length < pageSize) break;
        from += pageSize;
      }
      return json(200, { success: true, enfileirados: inseridos });
    }

    // -------- PROCESSAR --------
    const batchSize = Math.min(Math.max(parseInt(body.batch_size ?? '50'), 1), 100);
    const delayMs = Math.max(parseInt(body.delay_ms ?? '150'), 50);

    // Marca backfill ativo (TTL 30min) para pausar crons concorrentes
    const ttlExpira = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await supabase
      .from('sga_runtime_state')
      .update({
        backfill_financeiro_ativo: true,
        backfill_iniciado_em: new Date().toISOString(),
        backfill_expira_em: ttlExpira,
      })
      .gte('id', '00000000-0000-0000-0000-000000000000');

    try {
      // Pega pendentes + pendente_retry vencidos
      const nowIso = new Date().toISOString();
      const { data: pendentes, error: jErr } = await supabase
        .from('sga_sync_financeiro_jobs')
        .select('id, veiculo_id')
        .eq('status', 'pendente')
        .in('tipo', ['backfill_inicial', 'resync'])
        .order('agendado_em', { ascending: true })
        .limit(batchSize);
      if (jErr) throw jErr;

      let jobs = pendentes ?? [];

      if (jobs.length < batchSize) {
        const restante = batchSize - jobs.length;
        const { data: retries } = await supabase
          .from('sga_sync_financeiro_jobs')
          .select('id, veiculo_id')
          .eq('status', 'pendente_retry')
          .lte('proximo_retry_em', nowIso)
          .in('tipo', ['backfill_inicial', 'resync'])
          .order('proximo_retry_em', { ascending: true })
          .limit(restante);
        jobs = jobs.concat(retries ?? []);
      }

      if (!jobs.length) {
        // Fila vazia → desmarca flag para liberar crons
        await supabase
          .from('sga_runtime_state')
          .update({ backfill_financeiro_ativo: false, backfill_expira_em: null })
          .gte('id', '00000000-0000-0000-0000-000000000000');
        return json(200, { success: true, processados: 0, ok: 0, fail: 0 });
      }

      let ok = 0;
      let fail = 0;
      let retry = 0;
      let authFailStreak = 0;
      let aborted = false;
      const proximaJanela = nextJanela().toISOString();

      // Detecta erro de janela horária / auth da Hinova (mesmo quando vem mascarado como "Login ou senha inválido")
      const isAuthOrHorarioError = (msg: string) =>
        /horari|janela_horaria|restri[çc][ãa]o|usu[áa]rio com restri|login ou senha inv[áa]lid|401|403|n[ãa]o autorizad/i.test(msg);

      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        try {
          const { data, error } = await supabase.functions.invoke('sga-sync-financeiro-veiculo', {
            body: { veiculo_id: job.veiculo_id, job_id: job.id },
          });
          if (error) throw error;
          if (data?.success) {
            ok++;
            authFailStreak = 0;
          } else if (data?.retry) {
            retry++;
          } else {
            fail++;
            if (isAuthOrHorarioError(String(data?.error || ''))) authFailStreak++;
            else authFailStreak = 0;
          }
        } catch (e: any) {
          fail++;
          const msg = String(e?.message || e);
          if (isAuthOrHorarioError(msg)) {
            authFailStreak++;
            // Reagenda o job para a próxima janela em vez de marcar como erro definitivo
            await supabase
              .from('sga_sync_financeiro_jobs')
              .update({ status: 'pendente_retry', proximo_retry_em: proximaJanela, ultimo_erro: msg })
              .eq('id', job.id);
          } else {
            authFailStreak = 0;
            await supabase
              .from('sga_sync_financeiro_jobs')
              .update({ status: 'erro', concluido_em: new Date().toISOString(), ultimo_erro: msg })
              .eq('id', job.id);
          }
        }

        // Heartbeat a cada 5 jobs para manter o "vivo" no status_drenagem
        if (i % 5 === 0) {
          await supabase
            .from('sga_runtime_state')
            .update({
              backfill_ultimo_heartbeat: new Date().toISOString(),
              backfill_processados_total: (i + 1),
              backfill_ok_total: ok,
              backfill_fail_total: fail,
              backfill_retry_total: retry,
            })
            .gte('id', '00000000-0000-0000-0000-000000000000');
        }

        // CIRCUIT BREAKER: 5 falhas de auth/horário seguidas → aborta o batch
        // (evita queimar CPU/memória em jobs que TODOS vão falhar pelo mesmo motivo,
        //  prevenindo o RUNTIME_ERROR 503 por exceder limites do edge runtime)
        if (authFailStreak >= 5) {
          aborted = true;
          // Reagenda o restante dos jobs para a próxima janela
          const restantes = jobs.slice(i + 1).map(j => j.id);
          if (restantes.length) {
            await supabase
              .from('sga_sync_financeiro_jobs')
              .update({ status: 'pendente_retry', proximo_retry_em: proximaJanela, ultimo_erro: 'Circuit breaker: janela horária Hinova fechada' })
              .in('id', restantes);
          }
          console.warn(`[SGA Backfill] Circuit breaker disparado após ${authFailStreak} falhas de auth — ${restantes.length} jobs reagendados para ${proximaJanela}`);
          break;
        }

        await sleep(delayMs);
      }

      return json(200, { success: true, processados: jobs.length, ok, fail, retry, aborted, motivo_abort: aborted ? 'janela_horaria_hinova_fechada' : null });
    } finally {
      // Renova TTL para o próximo batch (não desmarca — o TTL de 30min cuida disso se o cron parar)
      await supabase
        .from('sga_runtime_state')
        .update({ backfill_expira_em: new Date(Date.now() + 10 * 60 * 1000).toISOString() })
        .gte('id', '00000000-0000-0000-0000-000000000000');
    }
  } catch (err: any) {
    console.error('[SGA Backfill] erro:', err);
    return json(500, { success: false, error: String(err?.message || err) });
  }
});
