// softruck-corrigir-vinculo
// Edge one-off (Monitoramento) que conserta o vínculo device↔vehicle de UM
// rastreador específico na Softruck.
//
// Entrada: { rastreador_id: string, dry_run?: boolean }
// - dry_run=true → faz só o GET de confirmação e devolve sem alterar nada.
// - dry_run=false (default) → executa o ciclo completo: desvincular→vincular→ativar→readback.
//
// Resolve LTC8G02 e casos do mesmo padrão. Não roda em massa.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCallSoftruckApi, corrigirVinculoSoftruck } from "../_shared/softruck-corrigir.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReqBody {
  rastreador_id?: string;
  dry_run?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let body: ReqBody;
  try { body = await req.json(); } catch { body = {}; }

  const rastreadorId = body.rastreador_id;
  const dryRun = body.dry_run === true;

  if (!rastreadorId) {
    return new Response(JSON.stringify({ success: false, error: "rastreador_id é obrigatório" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // 1. Carregar rastreador + veículo
    const { data: r, error: rErr } = await supabase
      .from("rastreadores")
      .select("id, imei, plataforma, plataforma_device_id, plataforma_veiculo_id, softruck_integration_status, softruck_tentativas, veiculo_id, associado_id")
      .eq("id", rastreadorId).maybeSingle();
    if (rErr) throw new Error(`select rastreador: ${rErr.message}`);
    if (!r) {
      return new Response(JSON.stringify({ success: false, error: "rastreador não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (r.plataforma !== "softruck") {
      return new Response(JSON.stringify({ success: false, error: `rastreador não é Softruck (plataforma=${r.plataforma})` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!r.imei) throw new Error("rastreador sem IMEI");
    if (!r.plataforma_device_id) throw new Error("rastreador sem plataforma_device_id (Softruck deviceId)");

    let softruckVehicleIdAlvo = r.plataforma_veiculo_id as string | null;
    let placaAlvo: string | null = null;
    if (r.veiculo_id) {
      const { data: v } = await supabase
        .from("veiculos")
        .select("placa, softruck_vehicle_id")
        .eq("id", r.veiculo_id).maybeSingle();
      placaAlvo = v?.placa || null;
      softruckVehicleIdAlvo = v?.softruck_vehicle_id || softruckVehicleIdAlvo;
    }
    if (!softruckVehicleIdAlvo) throw new Error("veículo local sem softruck_vehicle_id — não dá pra determinar o alvo correto");

    const callSoftruck = buildCallSoftruckApi(supabaseUrl, serviceKey);

    // 2. Dry-run: só GET de confirmação
    if (dryRun) {
      const resp = await callSoftruck("buscar-device-imei", { imei: r.imei });
      const list = (resp.data as { data?: Array<Record<string, any>> })?.data || [];
      const remoteDevice = list[0] || null;
      const remoteVehicleId =
        remoteDevice?.relationships?.vehicle?.data?.id
        || remoteDevice?.relationships?.vehicle?.id
        || null;
      const remotePlate =
        remoteDevice?.relationships?.vehicle?.data?.attributes?.plate
        || remoteDevice?.relationships?.vehicle?.attributes?.plate
        || null;
      const divergente = !!remoteVehicleId && remoteVehicleId !== softruckVehicleIdAlvo;
      return new Response(JSON.stringify({
        success: true,
        dry_run: true,
        etapa: "confirmacao",
        rastreador_id: rastreadorId,
        imei: r.imei,
        softruck_device_id: r.plataforma_device_id,
        placa_local: placaAlvo,
        softruck_vehicle_id_local: softruckVehicleIdAlvo,
        remote_vehicle_id: remoteVehicleId,
        remote_plate: remotePlate,
        divergente,
        sem_vinculo: !remoteVehicleId,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Execução: zerar tentativas antes (operador iniciou ciclo novo)
    await supabase.from("rastreadores").update({
      softruck_tentativas: 0,
      softruck_last_attempt_at: new Date().toISOString(),
    }).eq("id", rastreadorId);

    const result = await corrigirVinculoSoftruck(callSoftruck, {
      imei: r.imei,
      remoteDeviceId: r.plataforma_device_id,
      softruckVehicleIdAlvo,
    });

    // 4. Persistir resultado
    const update: Record<string, unknown> = {
      softruck_last_attempt_at: new Date().toISOString(),
      softruck_response_raw: {
        correcao_vinculo: true,
        executado_em: new Date().toISOString(),
        antes: { vehicleId: result.remoteVehicleIdAntes, plate: result.remotePlateAntes },
        depois: { vehicleId: result.remoteVehicleIdDepois, plate: result.remotePlateDepois },
        steps: result.steps,
        motivo_falha: result.motivoFalha || null,
      },
      updated_at: new Date().toISOString(),
    };
    if (result.ok) {
      update.softruck_integration_status = "SUCCESS";
      update.softruck_tentativas = 1;
      update.ultima_comunicacao = new Date().toISOString(); // provisório até GPS poll real
    } else {
      update.softruck_integration_status = "PENDING";
      update.softruck_tentativas = 0; // deixa cron retentar logo
    }
    const { error: upErr } = await supabase.from("rastreadores").update(update).eq("id", rastreadorId);
    if (upErr) console.error("[softruck-corrigir-vinculo] erro update rastreador:", upErr.message);

    // 5. Log canônico
    await supabase.from("rastreadores_api_logs").insert({
      plataforma: "softruck",
      operacao: "CORRIGIR_VINCULO",
      request: { rastreador_id: rastreadorId, imei: r.imei, alvo: softruckVehicleIdAlvo },
      response: result as unknown as Record<string, unknown>,
      status: result.ok ? "sucesso" : "falha",
    });

    return new Response(JSON.stringify({
      success: result.ok,
      etapa: result.ok ? "concluida" : "falhou",
      rastreador_id: rastreadorId,
      antes: { vehicleId: result.remoteVehicleIdAntes, plate: result.remotePlateAntes },
      depois: { vehicleId: result.remoteVehicleIdDepois, plate: result.remotePlateDepois },
      steps: result.steps,
      motivo_falha: result.motivoFalha,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[softruck-corrigir-vinculo] fatal:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
