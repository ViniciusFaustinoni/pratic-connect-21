// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Drena fila em ciclos até esvaziar ou estourar limite por execução.
  // batch_size grande + delay 100ms ⇒ ~80 chamadas Hinova por ciclo (~10s).
  const BATCH_SIZE = 80;
  const DELAY_MS = 100;
  const MAX_CICLOS = 30; // ~30 * 80 = 2400 jobs por execução de cron

  const inicio = Date.now();
  let totalProcessados = 0;
  let totalConcluidos = 0;
  let totalVeiculosResolvidos = 0;
  let ciclos = 0;

  for (let i = 0; i < MAX_CICLOS; i++) {
    const { data, error } = await supabase.functions.invoke('sga-reconciliar-codigo-veiculo', {
      body: { acao: 'processar', batch_size: BATCH_SIZE, delay_ms: DELAY_MS, trigger_backfill: false },
    });

    if (error) {
      console.error(`[cron-recon ciclo ${i}] erro invoke:`, error.message);
      break;
    }
    ciclos += 1;
    const r = (data as any) ?? {};
    totalProcessados += Number(r.processados ?? 0);
    totalConcluidos += Number(r.concluidos ?? 0);
    totalVeiculosResolvidos += Number(r.veiculos_resolvidos ?? 0);

    // Se fila vazia, ou janela horária reagendou tudo, ou nada foi processado → para
    if ((r.processados ?? 0) === 0) break;
    if ((r.reagendados ?? 0) > 0 && (r.concluidos ?? 0) === 0) break;

    // Stop se passou de 4 minutos para não estourar o timeout do edge runtime
    if (Date.now() - inicio > 4 * 60 * 1000) break;
  }

  // Ao final, dispara enfileiramento do backfill financeiro para os recém-resolvidos
  let backfill: any = null;
  if (totalVeiculosResolvidos > 0) {
    try {
      const { data, error } = await supabase.functions.invoke('sga-backfill-financeiro', {
        body: { acao: 'enfileirar' },
      });
      backfill = error ? { ok: false, error: error.message } : data;
    } catch (e: any) {
      backfill = { ok: false, error: String(e?.message || e) };
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      ciclos,
      total_processados: totalProcessados,
      total_concluidos: totalConcluidos,
      total_veiculos_resolvidos: totalVeiculosResolvidos,
      duracao_ms: Date.now() - inicio,
      backfill_enfileiramento: backfill,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
