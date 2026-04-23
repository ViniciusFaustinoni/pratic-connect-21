// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import {
  getHinovaCreds,
  autenticarHinova,
  buscarAssociadoComVeiculosPorCpf,
  HinovaTransientError,
  HinovaNotFoundError,
  calcularProximoRetry,
} from '../_shared/hinova-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface ReqBody {
  acao: 'enfileirar' | 'processar';
  batch_size?: number;
  delay_ms?: number;
  limit?: number;
  trigger_backfill?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    body = { acao: 'processar' };
  }

  try {
    if (body.acao === 'enfileirar') {
      return await enfileirar(supabase);
    }
    return await processar(supabase, body);
  } catch (err: any) {
    console.error('[sga-reconciliar-codigo-veiculo] erro fatal:', err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err?.message || err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

/* ----------------- ENFILEIRAR ----------------- */
async function enfileirar(supabase: any): Promise<Response> {
  // Busca DISTINCT associado_id para veículos sem codigo_hinova
  // Estratégia: paginar veículos elegíveis, montar Map por associado, depois inserir.
  console.log('[enfileirar] iniciando…');

  const candidatos = new Map<string, { cpf: string; codigo_hinova_associado: number }>();

  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('veiculos')
      .select('associado_id, associados!inner(cpf, codigo_hinova, origem_cadastro)')
      .is('codigo_hinova', null)
      .not('placa', 'is', null)
      .eq('associados.origem_cadastro', 'api_externa')
      .not('associados.cpf', 'is', null)
      .not('associados.codigo_hinova', 'is', null)
      .range(from, from + PAGE - 1);

    if (error) throw new Error(`Erro paginando veículos: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      const aid = row.associado_id as string;
      const a = (row as any).associados;
      if (!aid || candidatos.has(aid)) continue;
      const cpf = String(a?.cpf || '').replace(/\D/g, '');
      const codigo = Number(a?.codigo_hinova || 0);
      if (cpf.length !== 11 || !codigo) continue;
      candidatos.set(aid, { cpf, codigo_hinova_associado: codigo });
    }

    if (data.length < PAGE) break;
    from += PAGE;
  }

  console.log(`[enfileirar] ${candidatos.size} associados candidatos`);

  // Insere em batches com onConflict (associado_id) DO NOTHING
  let inseridos = 0;
  const entries = Array.from(candidatos.entries());
  const CHUNK = 500;
  for (let i = 0; i < entries.length; i += CHUNK) {
    const slice = entries.slice(i, i + CHUNK).map(([associado_id, v]) => ({
      associado_id,
      cpf: v.cpf,
      codigo_hinova_associado: v.codigo_hinova_associado,
      status: 'pendente',
    }));
    const { error, count } = await supabase
      .from('sga_reconciliacao_veiculo_jobs')
      .upsert(slice, { onConflict: 'associado_id', ignoreDuplicates: true, count: 'exact' });
    if (error) {
      console.error('[enfileirar] erro upsert batch:', error.message);
    } else {
      inseridos += count ?? slice.length;
    }
  }

  return new Response(
    JSON.stringify({ ok: true, candidatos: candidatos.size, inseridos }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}

/* ----------------- PROCESSAR ----------------- */
async function processar(supabase: any, body: ReqBody): Promise<Response> {
  const batchSize = Math.min(Math.max(body.batch_size ?? 50, 1), 200);
  const delayMs = Math.max(body.delay_ms ?? 100, 0);
  const triggerBackfill = body.trigger_backfill !== false; // default true

  // 1) Pega jobs pendentes + retries vencidos
  const nowIso = new Date().toISOString();
  const { data: jobs, error: errJobs } = await supabase
    .from('sga_reconciliacao_veiculo_jobs')
    .select('id, associado_id, cpf, codigo_hinova_associado, status, tentativas')
    .or(`status.eq.pendente,and(status.eq.pendente_retry,proximo_retry_em.lte.${nowIso})`)
    .order('created_at', { ascending: true })
    .limit(batchSize);

  if (errJobs) throw new Error(`Erro buscando jobs: ${errJobs.message}`);
  if (!jobs || jobs.length === 0) {
    console.log('[processar] fila vazia');
    if (triggerBackfill) await dispararBackfillFinanceiro(supabase);
    return new Response(
      JSON.stringify({ ok: true, processados: 0, mensagem: 'fila vazia' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // 2) Auth Hinova (compartilhada)
  const creds = await getHinovaCreds(supabase);
  if (!creds) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Credenciais Hinova não configuradas' }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  let session: any;
  try {
    session = await autenticarHinova(creds);
  } catch (e: any) {
    if (e instanceof HinovaTransientError) {
      // Auth falhou (provavelmente janela horária) → reagenda TODOS os jobs deste batch
      const proximo = calcularProximoRetry(e.reason).toISOString();
      const ids = jobs.map((j: any) => j.id);
      await supabase
        .from('sga_reconciliacao_veiculo_jobs')
        .update({ status: 'pendente_retry', proximo_retry_em: proximo, ultimo_erro: `auth: ${e.message}` })
        .in('id', ids);
      return new Response(
        JSON.stringify({ ok: false, reagendados: ids.length, motivo: e.reason, proximo_retry_em: proximo }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    throw e;
  }

  // 3) Processa job a job
  let concluidos = 0;
  let veiculosResolvidosTotal = 0;
  let naoEncontrados = 0;
  let reagendados = 0;
  let erros = 0;

  for (const job of jobs) {
    try {
      const { codigo_associado, veiculos } = await buscarAssociadoComVeiculosPorCpf(session, job.cpf);

      let resolvidos = 0;
      for (const v of veiculos) {
        const { data: upd, error: errUpd } = await supabase
          .from('veiculos')
          .update({
            codigo_hinova: v.codigo_veiculo,
            sincronizado_hinova: true,
            sincronizado_hinova_em: new Date().toISOString(),
          })
          .eq('associado_id', job.associado_id)
          .eq('placa', v.placa)
          .is('codigo_hinova', null)
          .select('id');
        if (errUpd) {
          console.warn(`[job ${job.id}] update veículo placa=${v.placa} falhou:`, errUpd.message);
        } else if (upd && upd.length > 0) {
          resolvidos += upd.length;
        }
      }

      // Se Hinova trouxe um codigo_associado diferente, atualiza
      if (codigo_associado && Number(codigo_associado) !== Number(job.codigo_hinova_associado)) {
        await supabase
          .from('associados')
          .update({ codigo_hinova: codigo_associado })
          .eq('id', job.associado_id);
      }

      await supabase
        .from('sga_reconciliacao_veiculo_jobs')
        .update({
          status: 'concluido',
          veiculos_resolvidos: resolvidos,
          ultimo_erro: null,
          tentativas: (job.tentativas ?? 0) + 1,
        })
        .eq('id', job.id);

      concluidos += 1;
      veiculosResolvidosTotal += resolvidos;
    } catch (e: any) {
      if (e instanceof HinovaNotFoundError) {
        await supabase
          .from('sga_reconciliacao_veiculo_jobs')
          .update({
            status: 'nao_encontrado_hinova',
            ultimo_erro: e.message,
            tentativas: (job.tentativas ?? 0) + 1,
          })
          .eq('id', job.id);
        naoEncontrados += 1;
      } else if (e instanceof HinovaTransientError) {
        const proximo = calcularProximoRetry(e.reason).toISOString();
        await supabase
          .from('sga_reconciliacao_veiculo_jobs')
          .update({
            status: 'pendente_retry',
            proximo_retry_em: proximo,
            ultimo_erro: `${e.reason}: ${e.message}`,
          })
          .eq('id', job.id);
        reagendados += 1;
        // Se for janela_horaria, não adianta continuar o batch — toda chamada vai falhar
        if (e.reason === 'janela_horaria') {
          console.warn('[processar] janela horária — abortando batch e reagendando restantes');
          const restantesIds = jobs.slice(jobs.indexOf(job) + 1).map((j: any) => j.id);
          if (restantesIds.length > 0) {
            await supabase
              .from('sga_reconciliacao_veiculo_jobs')
              .update({
                status: 'pendente_retry',
                proximo_retry_em: proximo,
                ultimo_erro: 'janela_horaria (batch abortado)',
              })
              .in('id', restantesIds);
            reagendados += restantesIds.length;
          }
          break;
        }
      } else {
        console.error(`[job ${job.id}] erro inesperado:`, e);
        await supabase
          .from('sga_reconciliacao_veiculo_jobs')
          .update({
            status: 'erro',
            ultimo_erro: String(e?.message || e).slice(0, 500),
            tentativas: (job.tentativas ?? 0) + 1,
          })
          .eq('id', job.id);
        erros += 1;
      }
    }
    if (delayMs > 0) await sleep(delayMs);
  }

  // 4) Bonus: dispara backfill financeiro se ao menos 1 veículo foi resolvido
  let backfillEnfileiramento: any = null;
  if (triggerBackfill && veiculosResolvidosTotal > 0) {
    backfillEnfileiramento = await dispararBackfillFinanceiro(supabase);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      processados: jobs.length,
      concluidos,
      veiculos_resolvidos: veiculosResolvidosTotal,
      nao_encontrados: naoEncontrados,
      reagendados,
      erros,
      backfill_enfileiramento: backfillEnfileiramento,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}

/** Após reconciliar, dispara enfileiramento do backfill financeiro */
async function dispararBackfillFinanceiro(supabase: any): Promise<any> {
  try {
    const { data, error } = await supabase.functions.invoke('sga-backfill-financeiro', {
      body: { acao: 'enfileirar' },
    });
    if (error) {
      console.warn('[backfill enfileirar] erro:', error.message);
      return { ok: false, error: error.message };
    }
    return data;
  } catch (e: any) {
    console.warn('[backfill enfileirar] exceção:', e?.message);
    return { ok: false, error: String(e?.message || e) };
  }
}
