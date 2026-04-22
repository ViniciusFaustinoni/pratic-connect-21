// Orquestrador do backfill financeiro:
// - Modo "enfileirar": cria jobs pendentes (backfill_inicial) para todos os veículos elegíveis
// - Modo "processar": pega N jobs pendentes e dispara sga-sync-financeiro-veiculo com throttling
// Body: { acao: 'enfileirar' | 'processar' | 'status', batch_size?: number, delay_ms?: number, tipo?: 'backfill_inicial'|'resync' }
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const body = await req.json().catch(() => ({}));
    const acao = body.acao || 'processar';
    const tipo = body.tipo || 'backfill_inicial';

    // -------- STATUS --------
    if (acao === 'status') {
      const counts: Record<string, number> = {};
      for (const st of ['pendente', 'executando', 'concluido', 'erro', 'sem_historico_hinova', 'cancelado']) {
        const { count } = await supabase
          .from('sga_sync_financeiro_jobs')
          .select('id', { count: 'exact', head: true })
          .eq('status', st);
        counts[st] = count ?? 0;
      }
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
      // Veículos do sistema novo (não sincronizam — vão ao SGA via sga-hinova-sync)
      const { count: sistemaNovo } = await supabase
        .from('veiculos')
        .select('id, associados:associados!inner(origem_cadastro)', { count: 'exact', head: true })
        .eq('associados.origem_cadastro', 'interno');
      return json(200, {
        success: true,
        jobs: counts,
        veiculos_sem_codigo: elegiveisSemCodigo ?? 0,
        veiculos_com_codigo: elegiveisComCodigo ?? 0,
        veiculos_sistema_novo: sistemaNovo ?? 0,
      });
    }

    // -------- ENFILEIRAR --------
    if (acao === 'enfileirar') {
      // Apenas veículos da BASE ANTIGA (origem_cadastro='api_externa').
      // Veículos do sistema novo nasceram no Praticcar e suas cobranças vivem
      // aqui (Asaas/Cobrancas locais), não no SGA Hinova.
      const pageSize = 1000;
      let from = 0;
      let inseridos = 0;
      while (true) {
        const { data: vs, error } = await supabase
          .from('veiculos')
          .select('id, associado_id, associados:associados!inner(codigo_hinova, origem_cadastro)')
          .not('codigo_hinova', 'is', null)
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
          .in('status', ['pendente', 'executando']);
        const blocked = new Set((jobsExistentes ?? []).map(j => j.veiculo_id));

        const novos = vs
          .filter(v => {
            const a: any = Array.isArray((v as any).associados) ? (v as any).associados[0] : (v as any).associados;
            return a?.codigo_hinova && !blocked.has(v.id);
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
    const batchSize = Math.min(Math.max(parseInt(body.batch_size ?? '20'), 1), 100);
    const delayMs = Math.max(parseInt(body.delay_ms ?? '200'), 50);

    const { data: jobs, error: jErr } = await supabase
      .from('sga_sync_financeiro_jobs')
      .select('id, veiculo_id')
      .eq('status', 'pendente')
      .in('tipo', ['backfill_inicial', 'resync'])
      .order('agendado_em', { ascending: true })
      .limit(batchSize);
    if (jErr) throw jErr;
    if (!jobs?.length) return json(200, { success: true, processados: 0 });

    let ok = 0;
    let fail = 0;

    for (const job of jobs) {
      try {
        const { data, error } = await supabase.functions.invoke('sga-sync-financeiro-veiculo', {
          body: { veiculo_id: job.veiculo_id, job_id: job.id },
        });
        if (error) throw error;
        if (data?.success) ok++; else fail++;
      } catch (e: any) {
        fail++;
        await supabase
          .from('sga_sync_financeiro_jobs')
          .update({ status: 'erro', concluido_em: new Date().toISOString(), ultimo_erro: String(e?.message || e) })
          .eq('id', job.id);
      }
      await sleep(delayMs);
    }

    return json(200, { success: true, processados: jobs.length, ok, fail });
  } catch (err: any) {
    console.error('[SGA Backfill] erro:', err);
    return json(500, { success: false, error: String(err?.message || err) });
  }
});
