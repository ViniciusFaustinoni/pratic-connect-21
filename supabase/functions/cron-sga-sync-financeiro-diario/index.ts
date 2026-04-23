// Cron diário: enfileira jobs de resync e processa a fila em batches.
//
// IMPORTANTE: a sincronização financeira atua apenas sobre a BASE ANTIGA
// (associados.origem_cadastro = 'api_externa'). Veículos do sistema novo
// (origem_cadastro = 'interno') são enviados ao SGA via sga-hinova-sync e
// suas cobranças vivem localmente — não devem ser sincronizados a partir do Hinova.
//
// Schedule: o cron pg_cron deve ser configurado para 12:00 UTC (09:00 BRT) — dentro
// da janela horária comercial liberada para o usuário SGA. Crons fora da janela
// caem em pendente_retry automaticamente.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    // Suporta modo "drenar apenas" (cron de 2h em 2h) — pula enfileiramento.
    const body = await req.json().catch(() => ({}));
    const apenasProcessar: boolean = body?.apenas_processar === true;

    if (!apenasProcessar) {
      // 0) Limpeza recorrente: cancela jobs órfãos de veículos 'interno'
      const limpeza = await supabase.functions.invoke('sga-backfill-financeiro', {
        body: { acao: 'cancelar_internos' },
      });
      console.log('[Cron SGA Diario] limpeza internos:', limpeza.data);

      // 1) Enfileira resync (inclui veículos sem codigo_hinova)
      const enq = await supabase.functions.invoke('sga-backfill-financeiro', {
        body: { acao: 'enfileirar', tipo: 'resync' },
      });
      console.log('[Cron SGA Diario] enfileirar:', enq.data);

      // 1.1) Reagenda erros de janela horária
      const reag = await supabase.functions.invoke('sga-backfill-financeiro', {
        body: { acao: 'reagendar_erros_horario' },
      });
      console.log('[Cron SGA Diario] reagendar erros horário:', reag.data);
    }

    // 2) Processa em loop até esgotar (com limite de segurança)
    // 80 ciclos x 50 jobs = 4.000 veículos por execução (com delay 150ms ≈ 13 min)
    const MAX_CICLOS = 80;
    const BATCH = 50;
    const DELAY = 150;
    let totalOk = 0;
    let totalFail = 0;
    let totalRetry = 0;
    for (let i = 0; i < MAX_CICLOS; i++) {
      const r = await supabase.functions.invoke('sga-backfill-financeiro', {
        body: { acao: 'processar', batch_size: BATCH, delay_ms: DELAY },
      });
      const data: any = r.data;
      if (!data?.processados) break;
      totalOk += data.ok ?? 0;
      totalFail += data.fail ?? 0;
      totalRetry += data.retry ?? 0;
      await sleep(500);
    }

    return new Response(JSON.stringify({ success: true, ok: totalOk, fail: totalFail, retry: totalRetry }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[Cron SGA Diario] erro:', err);
    return new Response(JSON.stringify({ success: false, error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
