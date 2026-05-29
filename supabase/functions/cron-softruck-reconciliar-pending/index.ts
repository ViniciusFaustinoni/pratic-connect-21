// cron-softruck-reconciliar-pending
// Roda a cada 10 min via pg_cron e fecha rastreadores Softruck presos em PENDING.
//
// Estratégia:
// 1) Selecionar lote (max 20) de rastreadores plataforma='softruck', status='instalado',
//    softruck_integration_status='PENDING', softruck_last_attempt_at < now()-5min,
//    softruck_tentativas < 5, com veiculo_id e associado_id.
// 2) Para cada um:
//    - Se plataforma_device_id parece o próprio IMEI (placeholder): chama softruck-ativar-dispositivo
//      (que agora reseta e refaz tudo — ver guard atualizado).
//    - Caso contrário: tenta softruck-reconciliar-pending (caminho canônico já existente
//      para fechar UPDATE final sem refazer chamadas).
// 3) Registra resultado por rastreador.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const startedAt = new Date().toISOString();
  const resumo: Array<Record<string, unknown>> = [];

  try {
    const corteAtt = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: pendentes, error: selErr } = await supabase
      .from("rastreadores")
      .select("id, imei, plataforma, plataforma_device_id, plataforma_veiculo_id, softruck_integration_status, softruck_tentativas, softruck_last_attempt_at, veiculo_id, associado_id, associado_email")
      .eq("plataforma", "softruck")
      .eq("status", "instalado")
      // Aceita ambos os cases — há ~1.911 registros legados com 'pending' (minúsculo)
      // que ficavam invisíveis com .eq('PENDING'). Read-back novo grava sempre maiúsculo.
      .in("softruck_integration_status", ["PENDING", "pending"])
      .lt("softruck_tentativas", 5)
      .or(`softruck_last_attempt_at.is.null,softruck_last_attempt_at.lt.${corteAtt}`)
      .not("veiculo_id", "is", null)
      .not("associado_id", "is", null)
      .order("softruck_last_attempt_at", { ascending: true, nullsFirst: true })
      .limit(20);

    if (selErr) throw new Error(`select pendentes: ${selErr.message}`);

    console.log(`[cron-softruck-reconciliar-pending] lote=${pendentes?.length || 0}`);

    for (const r of pendentes || []) {
      const imei = r.imei || "";
      const isPlaceholder = !!r.plataforma_device_id && /^\d{14,17}$/.test(r.plataforma_device_id) && r.plataforma_device_id === imei;

      try {
        if (isPlaceholder || !r.plataforma_device_id) {
          // Re-ativar pelo caminho canônico (já reseta placeholder internamente)
          const res = await fetch(`${supabaseUrl}/functions/v1/softruck-ativar-dispositivo`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              imei,
              veiculoId: r.veiculo_id,
              associadoId: r.associado_id,
              associadoEmail: r.associado_email || undefined,
            }),
          });
          const body = await res.json().catch(() => ({}));
          resumo.push({ rastreador_id: r.id, imei, via: "ativar-dispositivo", ok: res.ok, status: res.status, body });
        } else {
          // Tem device_id real Softruck e veiculo_id real — fechar UPDATE final
          const res = await fetch(`${supabaseUrl}/functions/v1/softruck-reconciliar-pending`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({ rastreador_id: r.id }),
          });
          const body = await res.json().catch(() => ({}));
          resumo.push({ rastreador_id: r.id, imei, via: "reconciliar-pending", ok: res.ok, status: res.status, body });
        }

        // Após o ciclo: se ainda PENDING e já bateu o limite de tentativas, promover
        // a FAILED_VINCULO pra sair da fila e aparecer no Monitoramento como caso
        // que exige intervenção manual (botão Reprocessar no drawer).
        try {
          const { data: pos } = await supabase
            .from("rastreadores")
            .select("softruck_integration_status, softruck_tentativas")
            .eq("id", r.id).maybeSingle();
          const tent = pos?.softruck_tentativas ?? 0;
          const st = String(pos?.softruck_integration_status || "").toUpperCase();
          if ((st === "PENDING") && tent >= 5) {
            await supabase.from("rastreadores").update({
              softruck_integration_status: "FAILED_VINCULO",
              updated_at: new Date().toISOString(),
            }).eq("id", r.id);
            console.warn(`[cron-softruck-reconciliar-pending] rastreador ${r.id} promovido a FAILED_VINCULO (tentativas=${tent})`);
            resumo.push({ rastreador_id: r.id, imei, promovido_a: "FAILED_VINCULO", tentativas: tent });
          }
        } catch (escErr) {
          console.warn(`[cron-softruck-reconciliar-pending] erro check FAILED_VINCULO ${r.id}:`, escErr);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[cron-softruck-reconciliar-pending] erro rastreador ${r.id}:`, msg);
        resumo.push({ rastreador_id: r.id, imei, error: msg });
      }
    }

    // Log canônico
    await supabase.from("rastreadores_api_logs").insert({
      plataforma: "softruck",
      operacao: "CRON_RECONCILIAR_PENDING",
      request: { startedAt, lote: pendentes?.length || 0 },
      response: { resumo },
      status: "sucesso",
    });

    return new Response(
      JSON.stringify({ success: true, processados: pendentes?.length || 0, resumo }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cron-softruck-reconciliar-pending] fatal:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
