import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

interface WebhookPayload {
  event?: string;
  timestamp?: string;
  data?: {
    type?: string;
    platform?: string;
    params?: Record<string, unknown>;
    device?: Record<string, unknown>;
    vehicle?: Record<string, unknown>;
    [key: string]: unknown;
  };
  type?: string;
  action?: string;
  device?: Record<string, unknown>;
  vehicle?: Record<string, unknown>;
}

// deno-lint-ignore no-explicit-any
type SupabaseClientAny = SupabaseClient<any, any, any>;

// Mapeamento de eventos para tipo/severidade de alerta
const EVENT_ALERT_MAP: Record<string, { tipo: string; severidade: string; titulo: string; mensagem: string }> = {
  "TASKS.UPDATED": { tipo: "os_atualizada", severidade: "baixa", titulo: "Ordem de serviço atualizada", mensagem: "Uma ordem de serviço foi atualizada na plataforma Softruck." },
  "TASKS.DELETED": { tipo: "os_removida", severidade: "media", titulo: "Ordem de serviço removida", mensagem: "Uma ordem de serviço foi removida da plataforma Softruck." },
  "TASKS.COMPLETED": { tipo: "os_concluida", severidade: "baixa", titulo: "Ordem de serviço concluída", mensagem: "Uma ordem de serviço foi concluída na plataforma Softruck." },
  "TASKS.UNCOMPLETED": { tipo: "os_reaberta", severidade: "media", titulo: "Ordem de serviço reaberta", mensagem: "Uma ordem de serviço foi reaberta na plataforma Softruck." },
  "TASKS.ASSIGNEE_UPDATED": { tipo: "prestador_atualizado", severidade: "baixa", titulo: "Prestador atualizado", mensagem: "O prestador de uma OS foi atualizado na plataforma Softruck." },
  "TASKS.ASSIGNEE_DELETED": { tipo: "prestador_atualizado", severidade: "baixa", titulo: "Prestador removido", mensagem: "O prestador de uma OS foi removido na plataforma Softruck." },
  "TASKS.SECTION_UPDATED": { tipo: "os_atualizada", severidade: "baixa", titulo: "Seção de OS atualizada", mensagem: "Uma seção da OS foi atualizada na plataforma Softruck." },
  "TASKS.SECTION_DELETED": { tipo: "os_atualizada", severidade: "baixa", titulo: "Seção de OS removida", mensagem: "Uma seção da OS foi removida na plataforma Softruck." },
  "TASKS.CUSTOM_FIELDS_UPDATED": { tipo: "os_atualizada", severidade: "baixa", titulo: "Campos customizados atualizados", mensagem: "Campos customizados de uma OS foram atualizados." },
  "TASKS.CUSTOM_FIELDS_DELETED": { tipo: "os_atualizada", severidade: "baixa", titulo: "Campos customizados removidos", mensagem: "Campos customizados de uma OS foram removidos." },
  "TASKS.ACKNOWLEDGEMENT_UPDATED": { tipo: "ciencia_os", severidade: "baixa", titulo: "Ciência de OS registrada", mensagem: "Uma ciência de ordem de serviço foi registrada." },
  "TASKS.ACKNOWLEDGEMENT_DELETED": { tipo: "ciencia_os", severidade: "baixa", titulo: "Ciência de OS removida", mensagem: "Uma ciência de ordem de serviço foi removida." },
  "DEVICES.ASSOCIATED": { tipo: "device_associado", severidade: "baixa", titulo: "Dispositivo associado", mensagem: "Um dispositivo foi associado a um veículo na plataforma Softruck." },
  "DEVICES.ASSOCIATION_UPDATED": { tipo: "device_atualizado", severidade: "baixa", titulo: "Associação de dispositivo atualizada", mensagem: "A associação de um dispositivo foi atualizada na plataforma Softruck." },
  "DEVICES.DISASSOCIATED": { tipo: "desinstalacao", severidade: "critica", titulo: "Dispositivo desassociado na plataforma", mensagem: "Um dispositivo foi removido do veículo na plataforma Softruck. Verificar se foi uma ação autorizada." },
  "VEHICLES.CREATED": { tipo: "veiculo_criado", severidade: "baixa", titulo: "Veículo criado na plataforma", mensagem: "Um novo veículo foi criado na plataforma Softruck." },
  "VEHICLES.DELETED": { tipo: "veiculo_removido", severidade: "alta", titulo: "Veículo removido da plataforma Softruck", mensagem: "Um veículo foi deletado na plataforma Softruck. Verificar se foi uma ação autorizada." },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  
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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // Extract event type - handle Softruck format: payload.data.type
    const eventoTipo = payload.event || payload.type || payload.data?.type || "unknown";
    const eventoAcao = payload.action || null;
    
    // Extract params from Softruck format
    const params = payload.data?.params || {};
    
    // Extract device/vehicle info from different payload structures
    const deviceData = payload.data?.device || payload.device || {};
    const vehicleData = payload.data?.vehicle || payload.vehicle || {};
    
    const deviceId = (params as Record<string, unknown>).device_id as string || 
                     (deviceData as Record<string, unknown>).id as string || null;
    const imei = (deviceData as Record<string, unknown>).imei as string || null;
    const vehicleId = (params as Record<string, unknown>).asset_id as string ||
                      (vehicleData as Record<string, unknown>).id as string || null;
    const placa = (vehicleData as Record<string, unknown>).plate as string || 
                  (params as Record<string, unknown>).label as string || null;

    console.log(`[softruck-webhook] Event: ${eventoTipo}, Action: ${eventoAcao}`);
    console.log(`[softruck-webhook] Device ID: ${deviceId}, IMEI: ${imei}, Vehicle ID: ${vehicleId}, Plate: ${placa}`);

    // Find related rastreador
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
      }
    }

    if (!veiculoId && placa) {
      const { data: veiculo } = await supabase
        .from("veiculos")
        .select("id")
        .eq("placa", placa.toUpperCase())
        .maybeSingle();
      
      if (veiculo) {
        veiculoId = veiculo.id;
      }
    }

    // Insert event record
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

    // Process the event
    let processResult: { success: boolean; alertaGerado: boolean; erro?: string } = {
      success: true,
      alertaGerado: false,
    };

    try {
      const eventoUpper = eventoTipo.toUpperCase();

      // Special handlers for events that need extra logic
      if (eventoUpper === "DEVICES.ASSOCIATED" || eventoUpper === "DEVICES.ASSOCIATION_UPDATED") {
        processResult = await handleDeviceAssociated(supabase, payload, params, rastreadorId, veiculoId);
      } else if (eventoUpper === "DEVICES.DISASSOCIATED") {
        processResult = await handleDeviceDisassociated(supabase, payload, params, rastreadorId, veiculoId);
      } else if (eventoUpper === "VEHICLES.CREATED") {
        processResult = await handleVehicleCreated(supabase, payload, params);
      } else if (eventoUpper === "VEHICLES.DELETED") {
        processResult = await handleVehicleDeleted(supabase, payload, params, veiculoId);
      } else if (eventoUpper === "DEVICE-EVENTS" || eventoUpper === "DEVICE_EVENTS") {
        processResult = await handleDeviceEvents(supabase, payload, rastreadorId);
      } else if (EVENT_ALERT_MAP[eventoUpper]) {
        // Generic handler for all mapped events (TASKS.*)
        processResult = await handleGenericEvent(supabase, eventoUpper, params, rastreadorId, veiculoId);
      } else {
        console.log(`[softruck-webhook] Unknown event type: ${eventoTipo}`);
      }
    } catch (processError) {
      console.error(`[softruck-webhook] Error processing event:`, processError);
      processResult = {
        success: false,
        alertaGerado: false,
        erro: processError instanceof Error ? processError.message : String(processError),
      };
    }

    // Update event record
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

async function handleGenericEvent(
  supabase: SupabaseClientAny,
  eventoTipo: string,
  params: Record<string, unknown>,
  rastreadorId: string | null,
  veiculoId: string | null
): Promise<{ success: boolean; alertaGerado: boolean; erro?: string }> {
  const config = EVENT_ALERT_MAP[eventoTipo];
  if (!config) return { success: true, alertaGerado: false };

  console.log(`[handleGenericEvent] Creating alert for ${eventoTipo}`);

  const { error } = await supabase.from("rastreador_alertas").insert({
    rastreador_id: rastreadorId,
    veiculo_id: veiculoId,
    tipo: config.tipo,
    severidade: config.severidade,
    titulo: config.titulo,
    mensagem: config.mensagem,
    status: "aberto",
    dados_extras: { params, evento_tipo: eventoTipo, origem: "webhook_softruck" },
  });

  if (error) {
    console.error(`[handleGenericEvent] Failed to create alert:`, error);
    return { success: false, alertaGerado: false, erro: error.message };
  }

  return { success: true, alertaGerado: true };
}

async function handleDeviceAssociated(
  supabase: SupabaseClientAny,
  payload: WebhookPayload,
  params: Record<string, unknown>,
  rastreadorId: string | null,
  _veiculoId: string | null
): Promise<{ success: boolean; alertaGerado: boolean; erro?: string }> {
  console.log(`[handleDeviceAssociated] Processing...`);

  // Create alert
  const config = EVENT_ALERT_MAP["DEVICES.ASSOCIATED"];
  let alertaGerado = false;
  
  if (config) {
    const { error } = await supabase.from("rastreador_alertas").insert({
      rastreador_id: rastreadorId,
      veiculo_id: _veiculoId,
      tipo: config.tipo,
      severidade: config.severidade,
      titulo: config.titulo,
      mensagem: config.mensagem,
      status: "aberto",
      dados_extras: { params, origem: "webhook_softruck" },
    });
    if (!error) alertaGerado = true;
  }

  if (!rastreadorId) {
    return { success: true, alertaGerado };
  }

  const vehicleData = payload.data?.vehicle || payload.vehicle || {};
  const newVehicleId = (params as Record<string, unknown>).asset_id as string ||
                       (vehicleData as Record<string, unknown>).id as string;

  if (newVehicleId) {
    await supabase
      .from("rastreadores")
      .update({
        plataforma_veiculo_id: newVehicleId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", rastreadorId);
  }

  return { success: true, alertaGerado };
}

async function handleDeviceDisassociated(
  supabase: SupabaseClientAny,
  payload: WebhookPayload,
  params: Record<string, unknown>,
  rastreadorId: string | null,
  veiculoId: string | null
): Promise<{ success: boolean; alertaGerado: boolean; erro?: string }> {
  console.log(`[handleDeviceDisassociated] Processing... CRITICAL EVENT`);

  let alertaGerado = false;

  if (rastreadorId || veiculoId) {
    const { error: alertError } = await supabase.from("rastreador_alertas").insert({
      rastreador_id: rastreadorId,
      veiculo_id: veiculoId,
      tipo: "desinstalacao",
      severidade: "critica",
      titulo: "Dispositivo desassociado na plataforma",
      mensagem: "Um dispositivo foi removido do veículo na plataforma Softruck. Verificar se foi uma ação autorizada.",
      status: "aberto",
      dados_extras: { params, payload, origem: "webhook_softruck" },
    });

    if (!alertError) {
      alertaGerado = true;
    }

    try {
      await supabase.functions.invoke("disparar-notificacao", {
        body: {
          tipo: "rastreador_desassociado",
          titulo: "⚠️ ALERTA CRÍTICO: Dispositivo Desassociado",
          mensagem: "Um dispositivo Softruck foi desassociado. Verifique imediatamente se foi uma ação autorizada.",
          dados: { rastreador_id: rastreadorId, veiculo_id: veiculoId, params },
          canais: ["sistema", "email"],
        },
      });
    } catch (notifError) {
      console.error(`[handleDeviceDisassociated] Failed to send notification:`, notifError);
    }
  }

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
  payload: WebhookPayload,
  params: Record<string, unknown>
): Promise<{ success: boolean; alertaGerado: boolean; erro?: string }> {
  console.log(`[handleVehicleCreated] Processing...`);

  const vehicleData = payload.data?.vehicle || payload.vehicle || {};
  const placa = (params as Record<string, unknown>).label as string || 
                (vehicleData as Record<string, unknown>).plate as string;
  const platformVehicleId = (params as Record<string, unknown>).id as string || 
                            (vehicleData as Record<string, unknown>).id as string;

  let alertaGerado = false;

  // Create info alert
  const config = EVENT_ALERT_MAP["VEHICLES.CREATED"];
  if (config) {
    const { error } = await supabase.from("rastreador_alertas").insert({
      tipo: config.tipo,
      severidade: config.severidade,
      titulo: config.titulo,
      mensagem: `${config.mensagem}${placa ? ` Placa: ${placa}` : ""}`,
      status: "aberto",
      dados_extras: { params, origem: "webhook_softruck" },
    });
    if (!error) alertaGerado = true;
  }

  if (placa && platformVehicleId) {
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
    }
  }

  return { success: true, alertaGerado };
}

async function handleVehicleDeleted(
  supabase: SupabaseClientAny,
  payload: WebhookPayload,
  params: Record<string, unknown>,
  veiculoId: string | null
): Promise<{ success: boolean; alertaGerado: boolean; erro?: string }> {
  console.log(`[handleVehicleDeleted] Processing... HIGH PRIORITY EVENT`);

  let alertaGerado = false;

  const { error: alertError } = await supabase.from("rastreador_alertas").insert({
    veiculo_id: veiculoId,
    tipo: "veiculo_removido",
    severidade: "alta",
    titulo: "Veículo removido da plataforma Softruck",
    mensagem: "Um veículo foi deletado na plataforma Softruck. Verificar se foi uma ação autorizada.",
    status: "aberto",
    dados_extras: { params, payload, origem: "webhook_softruck" },
  });

  if (!alertError) {
    alertaGerado = true;
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

  const eventData = payload.data || payload;
  const status = (eventData as Record<string, unknown>).status as string;
  const batteryLevel = (eventData as Record<string, unknown>).battery_level as number;
  const connectionStatus = (eventData as Record<string, unknown>).connection_status as string;

  if (connectionStatus === "offline" || status === "offline") {
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

  if (batteryLevel !== undefined && batteryLevel < 20) {
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
