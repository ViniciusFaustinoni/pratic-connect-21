import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

interface WebhookPayload {
  event: string;
  timestamp?: string;
  data?: Record<string, unknown>;
  // Alternate payload formats
  type?: string;
  action?: string;
  device?: {
    id?: string;
    imei?: string;
    [key: string]: unknown;
  };
  vehicle?: {
    id?: string;
    plate?: string;
    [key: string]: unknown;
  };
}

// deno-lint-ignore no-explicit-any
type SupabaseClientAny = SupabaseClient<any, any, any>;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  // Get request info
  const ipOrigem = req.headers.get("x-forwarded-for") || 
                   req.headers.get("cf-connecting-ip") || 
                   "unknown";
  
  const headersObj: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    if (!key.toLowerCase().includes('authorization')) {
      headersObj[key] = value;
    }
  });

  console.log(`[softruck-webhook] Request received from IP: ${ipOrigem}`);
  console.log(`[softruck-webhook] Headers:`, JSON.stringify(headersObj));

  try {
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse payload
    let payload: WebhookPayload;
    try {
      payload = await req.json();
      console.log(`[softruck-webhook] Payload:`, JSON.stringify(payload));
    } catch (e) {
      console.error(`[softruck-webhook] Failed to parse JSON:`, e);
      return new Response(
        JSON.stringify({ error: "Invalid JSON payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract event info - handle different payload formats
    const eventoTipo = payload.event || payload.type || "unknown";
    const eventoAcao = payload.action || null;
    
    // Extract device/vehicle info from different payload structures
    const deviceData = payload.data?.device || payload.device || {};
    const vehicleData = payload.data?.vehicle || payload.vehicle || {};
    
    const deviceId = (deviceData as Record<string, unknown>).id as string || null;
    const imei = (deviceData as Record<string, unknown>).imei as string || null;
    const vehicleId = (vehicleData as Record<string, unknown>).id as string || null;
    const placa = (vehicleData as Record<string, unknown>).plate as string || null;

    console.log(`[softruck-webhook] Event: ${eventoTipo}, Action: ${eventoAcao}`);
    console.log(`[softruck-webhook] Device ID: ${deviceId}, IMEI: ${imei}`);
    console.log(`[softruck-webhook] Vehicle ID: ${vehicleId}, Plate: ${placa}`);

    // Find related rastreador if we have device info
    let rastreadorId: string | null = null;
    let veiculoId: string | null = null;

    if (imei) {
      const { data: rastreador } = await supabase
        .from("rastreadores")
        .select("id, veiculo_id")
        .eq("imei", imei)
        .maybeSingle();
      
      if (rastreador) {
        rastreadorId = rastreador.id;
        veiculoId = rastreador.veiculo_id;
        console.log(`[softruck-webhook] Found rastreador: ${rastreadorId}`);
      }
    }

    if (!rastreadorId && deviceId) {
      const { data: rastreador } = await supabase
        .from("rastreadores")
        .select("id, veiculo_id")
        .eq("plataforma_device_id", deviceId)
        .maybeSingle();
      
      if (rastreador) {
        rastreadorId = rastreador.id;
        veiculoId = rastreador.veiculo_id;
        console.log(`[softruck-webhook] Found rastreador by device_id: ${rastreadorId}`);
      }
    }

    // Find veiculo by plate if not found yet
    if (!veiculoId && placa) {
      const { data: veiculo } = await supabase
        .from("veiculos")
        .select("id")
        .eq("placa", placa.toUpperCase())
        .maybeSingle();
      
      if (veiculo) {
        veiculoId = veiculo.id;
        console.log(`[softruck-webhook] Found veiculo by plate: ${veiculoId}`);
      }
    }

    // Insert event record BEFORE processing
    const { data: eventoRecord, error: insertError } = await supabase
      .from("softruck_eventos")
      .insert({
        evento_tipo: eventoTipo,
        evento_acao: eventoAcao,
        payload: payload,
        device_id: deviceId,
        vehicle_id: vehicleId,
        imei: imei,
        placa: placa,
        rastreador_id: rastreadorId,
        veiculo_id: veiculoId,
        ip_origem: ipOrigem,
        headers_recebidos: headersObj,
        processado: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error(`[softruck-webhook] Failed to insert event:`, insertError);
      return new Response(
        JSON.stringify({ error: "Failed to record event", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[softruck-webhook] Event recorded with ID: ${eventoRecord.id}`);

    // Process the event based on type
    let processResult: { success: boolean; alertaGerado: boolean; erro?: string } = {
      success: true,
      alertaGerado: false,
    };

    try {
      switch (eventoTipo.toUpperCase()) {
        case "DEVICES.ASSOCIATED":
          processResult = await handleDeviceAssociated(supabase, payload, rastreadorId, veiculoId);
          break;

        case "DEVICES.DISASSOCIATED":
          processResult = await handleDeviceDisassociated(supabase, payload, rastreadorId, veiculoId);
          break;

        case "VEHICLES.CREATED":
          processResult = await handleVehicleCreated(supabase, payload);
          break;

        case "VEHICLES.DELETED":
          processResult = await handleVehicleDeleted(supabase, payload, veiculoId);
          break;

        case "DEVICE-EVENTS":
        case "DEVICE_EVENTS":
          processResult = await handleDeviceEvents(supabase, payload, rastreadorId);
          break;

        default:
          console.log(`[softruck-webhook] Unknown event type: ${eventoTipo}`);
          processResult = { success: true, alertaGerado: false };
      }
    } catch (processError) {
      console.error(`[softruck-webhook] Error processing event:`, processError);
      processResult = {
        success: false,
        alertaGerado: false,
        erro: processError instanceof Error ? processError.message : String(processError),
      };
    }

    // Update event record with processing result
    await supabase
      .from("softruck_eventos")
      .update({
        processado: processResult.success,
        processado_em: new Date().toISOString(),
        erro_processamento: processResult.erro || null,
        alerta_gerado: processResult.alertaGerado,
      })
      .eq("id", eventoRecord.id);

    const elapsed = Date.now() - startTime;
    console.log(`[softruck-webhook] Completed in ${elapsed}ms. Success: ${processResult.success}`);

    return new Response(
      JSON.stringify({
        success: true,
        event_id: eventoRecord.id,
        processed: processResult.success,
        alert_generated: processResult.alertaGerado,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`[softruck-webhook] Unexpected error:`, error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============ EVENT HANDLERS ============

async function handleDeviceAssociated(
  supabase: SupabaseClientAny,
  payload: WebhookPayload,
  rastreadorId: string | null,
  _veiculoId: string | null
): Promise<{ success: boolean; alertaGerado: boolean; erro?: string }> {
  console.log(`[handleDeviceAssociated] Processing...`);

  if (!rastreadorId) {
    console.log(`[handleDeviceAssociated] No rastreador found, skipping update`);
    return { success: true, alertaGerado: false };
  }

  const vehicleData = payload.data?.vehicle || payload.vehicle || {};
  const newVehicleId = (vehicleData as Record<string, unknown>).id as string;

  if (newVehicleId) {
    // Update rastreador with platform vehicle ID
    const { error } = await supabase
      .from("rastreadores")
      .update({
        plataforma_veiculo_id: newVehicleId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", rastreadorId);

    if (error) {
      console.error(`[handleDeviceAssociated] Update failed:`, error);
      return { success: false, alertaGerado: false, erro: error.message };
    }

    console.log(`[handleDeviceAssociated] Updated rastreador ${rastreadorId} with vehicle ${newVehicleId}`);
  }

  return { success: true, alertaGerado: false };
}

async function handleDeviceDisassociated(
  supabase: SupabaseClientAny,
  payload: WebhookPayload,
  rastreadorId: string | null,
  veiculoId: string | null
): Promise<{ success: boolean; alertaGerado: boolean; erro?: string }> {
  console.log(`[handleDeviceDisassociated] Processing... CRITICAL EVENT`);

  let alertaGerado = false;

  // Create critical alert
  if (rastreadorId || veiculoId) {
    const { error: alertError } = await supabase.from("rastreador_alertas").insert({
      rastreador_id: rastreadorId,
      veiculo_id: veiculoId,
      tipo: "desinstalacao",
      severidade: "critica",
      titulo: "Dispositivo desassociado na plataforma",
      mensagem: `Um dispositivo foi removido do veículo na plataforma Softruck. Verificar se foi uma ação autorizada.`,
      status: "aberto",
      dados_extras: {
        payload: payload,
        origem: "webhook_softruck",
      },
    });

    if (alertError) {
      console.error(`[handleDeviceDisassociated] Failed to create alert:`, alertError);
    } else {
      alertaGerado = true;
      console.log(`[handleDeviceDisassociated] Critical alert created`);
    }

    // Also try to notify via disparar-notificacao
    try {
      await supabase.functions.invoke("disparar-notificacao", {
        body: {
          tipo: "rastreador_desassociado",
          titulo: "⚠️ ALERTA CRÍTICO: Dispositivo Desassociado",
          mensagem: `Um dispositivo Softruck foi desassociado. Verifique imediatamente se foi uma ação autorizada.`,
          dados: {
            rastreador_id: rastreadorId,
            veiculo_id: veiculoId,
            payload: payload,
          },
          canais: ["sistema", "email"],
        },
      });
    } catch (notifError) {
      console.error(`[handleDeviceDisassociated] Failed to send notification:`, notifError);
    }
  }

  // Clear platform vehicle ID from rastreador
  if (rastreadorId) {
    await supabase
      .from("rastreadores")
      .update({
        plataforma_veiculo_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", rastreadorId);
  }

  return { success: true, alertaGerado };
}

async function handleVehicleCreated(
  supabase: SupabaseClientAny,
  payload: WebhookPayload
): Promise<{ success: boolean; alertaGerado: boolean; erro?: string }> {
  console.log(`[handleVehicleCreated] Processing...`);

  const vehicleData = payload.data?.vehicle || payload.vehicle || {};
  const placa = (vehicleData as Record<string, unknown>).plate as string;
  const platformVehicleId = (vehicleData as Record<string, unknown>).id as string;

  if (placa && platformVehicleId) {
    // Try to match with local vehicle and update platform ID
    const { data: veiculo } = await supabase
      .from("veiculos")
      .select("id")
      .eq("placa", placa.toUpperCase())
      .maybeSingle();

    if (veiculo) {
      await supabase
        .from("veiculos")
        .update({ id_plataforma_veiculo: platformVehicleId })
        .eq("id", veiculo.id);

      console.log(`[handleVehicleCreated] Updated veiculo ${veiculo.id} with platform ID ${platformVehicleId}`);
    }
  }

  return { success: true, alertaGerado: false };
}

async function handleVehicleDeleted(
  supabase: SupabaseClientAny,
  payload: WebhookPayload,
  veiculoId: string | null
): Promise<{ success: boolean; alertaGerado: boolean; erro?: string }> {
  console.log(`[handleVehicleDeleted] Processing... HIGH PRIORITY EVENT`);

  let alertaGerado = false;

  // Create high-priority alert
  if (veiculoId) {
    const { error: alertError } = await supabase.from("rastreador_alertas").insert({
      veiculo_id: veiculoId,
      tipo: "veiculo_removido",
      severidade: "alta",
      titulo: "Veículo removido da plataforma Softruck",
      mensagem: `Um veículo foi deletado na plataforma Softruck. Verificar se foi uma ação autorizada.`,
      status: "aberto",
      dados_extras: {
        payload: payload,
        origem: "webhook_softruck",
      },
    });

    if (!alertError) {
      alertaGerado = true;
    }
  }

  return { success: true, alertaGerado };
}

async function handleDeviceEvents(
  supabase: SupabaseClientAny,
  payload: WebhookPayload,
  rastreadorId: string | null
): Promise<{ success: boolean; alertaGerado: boolean; erro?: string }> {
  console.log(`[handleDeviceEvents] Processing device status event...`);

  let alertaGerado = false;

  // Check for critical events like offline or low battery
  const eventData = payload.data || payload;
  const status = (eventData as Record<string, unknown>).status as string;
  const batteryLevel = (eventData as Record<string, unknown>).battery_level as number;
  const connectionStatus = (eventData as Record<string, unknown>).connection_status as string;

  // Handle offline status
  if (connectionStatus === "offline" || status === "offline") {
    console.log(`[handleDeviceEvents] Device went offline`);
    
    if (rastreadorId) {
      await supabase.from("rastreador_alertas").insert({
        rastreador_id: rastreadorId,
        tipo: "offline",
        severidade: "media",
        titulo: "Dispositivo offline",
        mensagem: "O dispositivo Softruck ficou offline.",
        status: "aberto",
        dados_extras: { payload },
      });
      alertaGerado = true;
    }
  }

  // Handle low battery
  if (batteryLevel !== undefined && batteryLevel < 20) {
    console.log(`[handleDeviceEvents] Low battery: ${batteryLevel}%`);
    
    if (rastreadorId) {
      await supabase.from("rastreador_alertas").insert({
        rastreador_id: rastreadorId,
        tipo: "bateria_baixa",
        severidade: "media",
        titulo: "Bateria baixa",
        mensagem: `O dispositivo está com ${batteryLevel}% de bateria.`,
        status: "aberto",
        dados_extras: { payload, battery_level: batteryLevel },
      });
      alertaGerado = true;
    }
  }

  return { success: true, alertaGerado };
}
