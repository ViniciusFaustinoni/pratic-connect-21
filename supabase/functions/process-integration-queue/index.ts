// Worker que processa a fila integration_retry_queue
// - Pega lote de até 50 itens prontos (status pending/failed e next_attempt_at <= now)
// - Roteia para a edge function correspondente por (integration, operation)
// - Marca processing -> success | failed (com backoff) | dead_letter
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

// (integration, operation) -> nome da edge function
const ROUTES: Record<string, string> = {
  "sga:hinova_sync": "sga-hinova-sync",
  "softruck:ativar_dispositivo": "softruck-ativar-dispositivo",
  "softruck:desativar_dispositivo": "softruck-buscar-dispositivo", // placeholder; usado se existir
  "rede:vincular_cliente": "rede-veiculos-vincular-cliente",
  "rede:desvincular_cliente": "rede-veiculos-desvincular-cliente",
  "rede:informar_inadimplente": "rede-veiculos-informar-inadimplente",
  "rede:informar_adimplente": "rede-veiculos-informar-adimplente",
  "rede:inativar_cliente_completo": "rede-veiculos-inativar-cliente-completo",
};

// Backoff exponencial em segundos: 1m, 5m, 30m, 2h, 6h
const BACKOFF_SECS = [60, 300, 1800, 7200, 21600];

async function processItem(item: any): Promise<{ ok: boolean; error?: string }> {
  const key = `${item.integration}:${item.operation}`;
  const fn = ROUTES[key];
  if (!fn) {
    return { ok: false, error: `Rota não mapeada para ${key}` };
  }

  const url = `${SUPABASE_URL}/functions/v1/${fn}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE}`,
      },
      body: JSON.stringify(item.payload || {}),
      signal: ctrl.signal,
    });
    const text = await resp.text();
    if (!resp.ok) {
      return { ok: false, error: `HTTP ${resp.status}: ${text.slice(0, 400)}` };
    }
    // Considera success também 2xx com {success:false} explícito
    try {
      const j = JSON.parse(text);
      if (j && j.success === false) return { ok: false, error: j.error || "success=false" };
    } catch (_) { /* ignore non-json */ }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.name === "AbortError" ? "timeout 15s" : (e?.message || String(e)) };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { data: lote, error: selErr } = await supabase
      .from("integration_retry_queue")
      .select("*")
      .in("status", ["pending", "failed"])
      .lte("next_attempt_at", new Date().toISOString())
      .order("next_attempt_at", { ascending: true })
      .limit(50);

    if (selErr) throw selErr;
    if (!lote || lote.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let ok = 0, fail = 0, dead = 0;

    for (const item of lote) {
      // Reivindica (CAS): só processa se ainda está pending/failed
      const { data: claimed } = await supabase
        .from("integration_retry_queue")
        .update({ status: "processing", last_attempt_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", item.id)
        .in("status", ["pending", "failed"])
        .select("id")
        .maybeSingle();
      if (!claimed) continue;

      const res = await processItem(item);
      const attempts = (item.attempts || 0) + 1;

      if (res.ok) {
        ok++;
        await supabase.from("integration_retry_queue").update({
          status: "success",
          attempts,
          succeeded_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        }).eq("id", item.id);
      } else {
        const max = item.max_attempts || 5;
        if (attempts >= max) {
          dead++;
          await supabase.from("integration_retry_queue").update({
            status: "dead_letter",
            attempts,
            last_error: res.error,
            dead_letter_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("id", item.id);

          // Alerta em relatos_erros (best-effort)
          await supabase.from("relatos_erros").insert({
            tipo: "integracao_dead_letter",
            descricao: `Integração ${item.integration}:${item.operation} falhou após ${attempts} tentativas: ${res.error}`,
            severidade: "alta",
            metadata: { queue_id: item.id, payload: item.payload, correlation_id: item.correlation_id },
          }).then(() => {}, () => {});
        } else {
          fail++;
          const delay = BACKOFF_SECS[Math.min(attempts - 1, BACKOFF_SECS.length - 1)];
          await supabase.from("integration_retry_queue").update({
            status: "failed",
            attempts,
            last_error: res.error,
            next_attempt_at: new Date(Date.now() + delay * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("id", item.id);
        }
      }
    }

    return new Response(JSON.stringify({ processed: lote.length, ok, fail, dead }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[process-integration-queue] erro:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
