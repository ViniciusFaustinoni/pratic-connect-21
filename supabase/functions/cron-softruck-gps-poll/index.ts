// cron-softruck-gps-poll
// Consome softruck_gps_poll_queue. Para cada item pending, chama softruck-api 'tracking'.
// Se vier posição -> grava em rastreadores e marca queue=success.
// Se não vier após max_attempts -> success_no_gps (não é falha).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function callSoftruckApi(supabaseUrl: string, anonKey: string, operation: string, data: Record<string, unknown>) {
  const r = await fetch(`${supabaseUrl}/functions/v1/softruck-api`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
    body: JSON.stringify({ operation, data }),
  });
  return await r.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const BATCH = 25;
  const nowIso = new Date().toISOString();

  const { data: jobs, error } = await supabase
    .from("softruck_gps_poll_queue")
    .select("id, rastreador_id, softruck_device_id, softruck_vehicle_id, attempts, max_attempts")
    .eq("status", "pending")
    .lte("next_run_at", nowIso)
    .order("next_run_at", { ascending: true })
    .limit(BATCH);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let success = 0, retry = 0, terminal = 0;

  for (const job of jobs || []) {
    try {
      const tracking = await callSoftruckApi(supabaseUrl, anonKey, "tracking", {
        veiculoId: job.softruck_vehicle_id,
        deviceId: job.softruck_device_id,
      });

      const t = tracking?.data as { latitude?: number; longitude?: number; speed?: number; ignition?: boolean; last_gps_time?: string } | undefined;
      const hasPos = !!(t?.latitude && t?.longitude);

      if (hasPos) {
        await supabase.from("rastreadores").update({
          ultima_comunicacao: t!.last_gps_time || new Date().toISOString(),
          ultima_posicao_lat: t!.latitude,
          ultima_posicao_lng: t!.longitude,
          ultima_velocidade: t!.speed || 0,
          ultima_ignicao: t!.ignition || false,
          updated_at: new Date().toISOString(),
        }).eq("id", job.rastreador_id);

        await supabase.from("softruck_gps_poll_queue").update({
          status: "success",
          attempts: job.attempts + 1,
          last_response: t,
          finished_at: new Date().toISOString(),
        }).eq("id", job.id);
        success++;
        continue;
      }

      const nextAttempts = job.attempts + 1;
      if (nextAttempts >= job.max_attempts) {
        await supabase.from("softruck_gps_poll_queue").update({
          status: "success_no_gps",
          attempts: nextAttempts,
          last_response: tracking,
          finished_at: new Date().toISOString(),
        }).eq("id", job.id);
        terminal++;
      } else {
        // backoff exponencial: 1, 2, 4, 8, 16, 32 min
        const delayMin = Math.pow(2, nextAttempts);
        await supabase.from("softruck_gps_poll_queue").update({
          attempts: nextAttempts,
          last_response: tracking,
          next_run_at: new Date(Date.now() + delayMin * 60 * 1000).toISOString(),
        }).eq("id", job.id);
        retry++;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const nextAttempts = job.attempts + 1;
      if (nextAttempts >= job.max_attempts) {
        await supabase.from("softruck_gps_poll_queue").update({
          status: "error", attempts: nextAttempts, last_error: msg, finished_at: new Date().toISOString(),
        }).eq("id", job.id);
        terminal++;
      } else {
        await supabase.from("softruck_gps_poll_queue").update({
          attempts: nextAttempts, last_error: msg,
          next_run_at: new Date(Date.now() + Math.pow(2, nextAttempts) * 60 * 1000).toISOString(),
        }).eq("id", job.id);
        retry++;
      }
    }
  }

  return new Response(JSON.stringify({ processed: jobs?.length || 0, success, retry, terminal }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
