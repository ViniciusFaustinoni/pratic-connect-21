import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cron wrapper: itera sobre associados com veículos vinculados à Rede Veículos
// e dispara a sincronização para cada um. Detecta desvínculos feitos no painel
// da Rede mesmo sem ninguém abrir o associado.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const startedAt = Date.now();
  console.log("[rede-veiculos-sync-cron] start");

  try {
    // Pega veículos vinculados à Rede, priorizando os mais antigos em updated_at.
    // Ordenação determinística garante que TODOS os associados vinculados sejam alcançados
    // ao longo dos ciclos (antes ficava preso nos primeiros 50 sem ordem).
    const { data: veiculos, error } = await supabase
      .from("veiculos")
      .select("associado_id, updated_at")
      .not("rede_veiculos_veiculo_id", "is", null)
      .not("associado_id", "is", null)
      .order("updated_at", { ascending: true, nullsFirst: true })
      .limit(2000);

    if (error) throw error;

    // Dedup mantendo o mais antigo de cada associado e processa até 200 por ciclo.
    const seen = new Set<string>();
    const uniqueAssociados: string[] = [];
    for (const v of (veiculos ?? []) as Array<{ associado_id: string }>) {
      if (!seen.has(v.associado_id)) {
        seen.add(v.associado_id);
        uniqueAssociados.push(v.associado_id);
        if (uniqueAssociados.length >= 200) break;
      }
    }

    console.log(`[rede-veiculos-sync-cron] processando ${uniqueAssociados.length} associados`);

    const results: Array<{ associadoId: string; ok: boolean; error?: string }> = [];

    for (const associadoId of uniqueAssociados) {
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/rede-veiculos-sincronizar-status`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ associadoId, forcarAtualizacao: false }),
        });
        results.push({ associadoId, ok: resp.ok });
      } catch (e) {
        results.push({ associadoId, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }

    const elapsed = Date.now() - startedAt;
    console.log(`[rede-veiculos-sync-cron] done in ${elapsed}ms`, JSON.stringify(results.slice(0, 5)));

    return new Response(
      JSON.stringify({ success: true, processed: results.length, elapsed_ms: elapsed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[rede-veiculos-sync-cron] error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
