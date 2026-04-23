// Orquestrador em massa do backfill SGA.
// Coordena duas fases sob um único timeout grande (até max_segundos):
//   1) Reconciliação em lote (sga-reconciliar-codigo-veiculo acao=processar)
//   2) Backfill financeiro em lote (sga-backfill-financeiro acao=processar)
// Idempotente. Auto-respeita janela horária via HinovaTransientError → pendente_retry.
// Body: { acao?: 'executar_tudo'|'so_reconciliar'|'so_financeiro', max_segundos?: number,
//         batch_reconciliacao?: number, batch_financeiro?: number }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface ReqBody {
  acao?: 'executar_tudo' | 'so_reconciliar' | 'so_financeiro';
  max_segundos?: number;
  batch_reconciliacao?: number;
  batch_financeiro?: number;
}

async function invokeFn(name: string, payload: any): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}: ${text.slice(0, 200)}`, data };
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let body: ReqBody = {};
  try { body = await req.json(); } catch { /* default */ }

  const acao = body.acao || 'executar_tudo';
  const maxSeg = Math.min(Math.max(body.max_segundos ?? 540, 30), 590);
  const batchRec = Math.min(Math.max(body.batch_reconciliacao ?? 80, 10), 200);
  const batchFin = Math.min(Math.max(body.batch_financeiro ?? 50, 10), 100);
  const inicio = Date.now();
  const limite = inicio + maxSeg * 1000;

  const tempoRestante = () => limite - Date.now();
  const log = (...args: any[]) => console.log('[orquestrador]', ...args);

  let totalReconciliados = 0;
  let totalReconRodadas = 0;
  let totalFinJobsProcessados = 0;
  let totalBoletosImportados = 0;
  let totalFinRodadas = 0;
  let novosJobsEnfileirados = 0;
  let errosTransitorios = 0;
  let parouPor = 'fim_natural';

  // ---------- Fase 1: Reconciliação ----------
  if (acao === 'executar_tudo' || acao === 'so_reconciliar') {
    const limiteFase1 = acao === 'so_reconciliar' ? limite : inicio + Math.floor(maxSeg * 0.45) * 1000;
    log('Fase 1: reconciliação iniciada', { limite_fase1_seg: Math.round((limiteFase1 - inicio) / 1000), batchRec });

    while (Date.now() < limiteFase1) {
      const { count: pendentes } = await supabase
        .from('sga_reconciliacao_veiculo_jobs')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pendente', 'pendente_retry']);

      if (!pendentes || pendentes === 0) {
        log('Fase 1: fila reconciliação vazia');
        break;
      }

      const r = await invokeFn('sga-reconciliar-codigo-veiculo', {
        acao: 'processar',
        batch_size: batchRec,
        delay_ms: 100,
      });
      totalReconRodadas++;
      if (!r.ok) {
        log('Fase 1: erro chamada', r.error);
        errosTransitorios++;
        await sleep(1500);
        if (errosTransitorios >= 5) { parouPor = 'erros_consecutivos_fase1'; break; }
        continue;
      }
      const d = r.data || {};
      const proc = Number(d.processados ?? d.processed ?? d.total ?? 0);
      totalReconciliados += proc;
      log('Fase 1 batch concluído', { proc, restante_pendente: pendentes - proc, tempo_restante_seg: Math.round(tempoRestante() / 1000) });

      if (proc === 0) { log('Fase 1: nada processado neste batch, encerrando fase'); break; }
      await sleep(500);
    }
  }

  // ---------- Enfileirar novos jobs financeiros (idempotente) ----------
  if (acao === 'executar_tudo' || acao === 'so_financeiro') {
    if (tempoRestante() > 30000) {
      log('Fase 2a: enfileirando novos jobs financeiros');
      const enf = await invokeFn('sga-backfill-financeiro', { acao: 'enfileirar' });
      if (enf.ok) {
        novosJobsEnfileirados = Number(enf.data?.enfileirados ?? enf.data?.criados ?? 0);
        log('Fase 2a: enfileirados', novosJobsEnfileirados);
      } else {
        log('Fase 2a: falha enfileirar', enf.error);
      }
    }
  }

  // ---------- Fase 2: Backfill financeiro ----------
  if (acao === 'executar_tudo' || acao === 'so_financeiro') {
    log('Fase 2: backfill financeiro iniciado', { tempo_restante_seg: Math.round(tempoRestante() / 1000), batchFin });
    let errosConsec = 0;
    while (tempoRestante() > 15000) {
      const { count: pendentes } = await supabase
        .from('sga_sync_financeiro_jobs')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pendente', 'pendente_retry']);

      if (!pendentes || pendentes === 0) {
        log('Fase 2: fila financeira vazia');
        break;
      }

      const r = await invokeFn('sga-backfill-financeiro', {
        acao: 'processar',
        batch_size: batchFin,
        delay_ms: 100,
      });
      totalFinRodadas++;
      if (!r.ok) {
        log('Fase 2: erro chamada', r.error);
        errosTransitorios++;
        errosConsec++;
        await sleep(2000);
        if (errosConsec >= 3) { parouPor = 'erros_consecutivos_fase2'; break; }
        continue;
      }
      errosConsec = 0;
      const d = r.data || {};
      const proc = Number(d.processados ?? d.processed ?? d.total ?? 0);
      const importados = Number(d.boletos_importados ?? d.imported ?? 0);
      totalFinJobsProcessados += proc;
      totalBoletosImportados += importados;
      log('Fase 2 batch', { proc, importados, restante: pendentes - proc, tempo_restante_seg: Math.round(tempoRestante() / 1000) });

      if (proc === 0) { log('Fase 2: nada processado, encerrando'); break; }
      await sleep(500);
    }
    if (tempoRestante() <= 15000 && parouPor === 'fim_natural') parouPor = 'timeout_proximidade';
  }

  // ---------- Telemetria final ----------
  const [{ count: finPend }, { count: finErr }, { count: finOk }, { count: recPend }, { count: cobSga }] = await Promise.all([
    supabase.from('sga_sync_financeiro_jobs').select('id', { count: 'exact', head: true }).in('status', ['pendente', 'pendente_retry']),
    supabase.from('sga_sync_financeiro_jobs').select('id', { count: 'exact', head: true }).eq('status', 'erro'),
    supabase.from('sga_sync_financeiro_jobs').select('id', { count: 'exact', head: true }).eq('status', 'concluido'),
    supabase.from('sga_reconciliacao_veiculo_jobs').select('id', { count: 'exact', head: true }).in('status', ['pendente', 'pendente_retry']),
    supabase.from('cobrancas').select('id', { count: 'exact', head: true }).eq('origem', 'sga_hinova'),
  ]);

  const resp = {
    ok: true,
    duracao_segundos: Math.round((Date.now() - inicio) / 1000),
    parou_por: parouPor,
    fase1_reconciliacao: {
      rodadas: totalReconRodadas,
      reconciliados: totalReconciliados,
    },
    fase2_financeiro: {
      rodadas: totalFinRodadas,
      jobs_processados: totalFinJobsProcessados,
      boletos_importados: totalBoletosImportados,
      novos_jobs_enfileirados: novosJobsEnfileirados,
    },
    erros_transitorios: errosTransitorios,
    estado_atual: {
      reconciliacao_pendente: recPend ?? 0,
      financeiro_pendente: finPend ?? 0,
      financeiro_erro: finErr ?? 0,
      financeiro_concluido: finOk ?? 0,
      cobrancas_sga_total: cobSga ?? 0,
    },
  };

  return new Response(JSON.stringify(resp, null, 2), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
