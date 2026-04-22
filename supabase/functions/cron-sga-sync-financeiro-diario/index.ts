// Cron diário (02:00): enfileira jobs de resync para todos os veículos elegíveis
// e dispara o orquestrador para processar a fila em batches.
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
    // 1) Enfileira resync
    const enq = await supabase.functions.invoke('sga-backfill-financeiro', {
      body: { acao: 'enfileirar', tipo: 'resync' },
    });
    console.log('[Cron SGA Diario] enfileirar:', enq.data);

    // 2) Processa em loop até esgotar (com limite de segurança)
    const MAX_CICLOS = 60;        // ~60 ciclos x 20 jobs = 1200 veículos por execução
    const BATCH = 20;
    const DELAY = 200;
    let totalOk = 0;
    let totalFail = 0;
    for (let i = 0; i < MAX_CICLOS; i++) {
      const r = await supabase.functions.invoke('sga-backfill-financeiro', {
        body: { acao: 'processar', batch_size: BATCH, delay_ms: DELAY },
      });
      const data: any = r.data;
      if (!data?.processados) break;
      totalOk += data.ok ?? 0;
      totalFail += data.fail ?? 0;
      await sleep(500);
    }

    return new Response(JSON.stringify({ success: true, ok: totalOk, fail: totalFail }), {
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
