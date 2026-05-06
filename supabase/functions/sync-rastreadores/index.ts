import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCredenciaisSoftruck } from "../_shared/credenciais-hibridas.ts";

// =====================================================
// CONFIGURAÇÃO
// =====================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PlataformaConfig {
  baseUrl: string;
  enabled: boolean;
  publicKey?: string;
  token?: string;
}

/**
 * Busca configuração da Softruck do banco para resolução de IMEIs
 */
async function getSoftruckConfigFromDB(supabase: any): Promise<PlataformaConfig> {
  const config: PlataformaConfig = { baseUrl: "https://api.softruck.com/v2", enabled: false };

  try {
    const { data: plataforma } = await supabase
      .from("rastreadores_config_plataformas")
      .select("ambiente_atual, api_url_producao, api_url_sandbox")
      .eq("plataforma", "softruck")
      .single();

    if (plataforma) {
      config.baseUrl = plataforma.ambiente_atual === "producao"
        ? (plataforma.api_url_producao || config.baseUrl)
        : (plataforma.api_url_sandbox || config.baseUrl);
    }

    const creds = await getCredenciaisSoftruck(supabase);
    if (creds) {
      config.publicKey = creds.public_key;
      config.enabled = true;
    }
  } catch (err) {
    console.error("[Config] Erro ao buscar config Softruck:", err);
  }

  return config;
}

// =====================================================
// AUTENTICAÇÃO SOFTRUCK
// =====================================================

async function getSoftruckToken(supabase: any, config: PlataformaConfig): Promise<string> {
  // Check cache first
  const { data: cached } = await supabase
    .from("rastreadores_tokens_cache")
    .select("token, expires_at")
    .eq("plataforma", "softruck")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (cached?.token) {
    console.log("[Softruck] Usando token do cache");
    return cached.token;
  }

  console.log("[Softruck] Obtendo novo token...");
  const creds = await getCredenciaisSoftruck(supabase);
  if (!creds) throw new Error("Credenciais Softruck não encontradas");

  const response = await fetch(`${config.baseUrl}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "public-key": creds.public_key,
    },
    body: JSON.stringify({ username: creds.username, password: creds.password }),
  });

  if (!response.ok) {
    throw new Error(`Falha auth Softruck: ${response.status}`);
  }

  const data = await response.json();
  if (!data.data?.token) throw new Error("Token Softruck não retornado");

  const { data: plat } = await supabase
    .from("rastreadores_config_plataformas")
    .select("id")
    .eq("plataforma", "softruck")
    .single();

  await supabase.from("rastreadores_tokens_cache").insert({
    plataforma: "softruck",
    plataforma_id: plat?.id || null,
    token: data.data.token,
    refresh_token: data.data.refresh_token || null,
    expires_at: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
  });

  return data.data.token;
}

// =====================================================
// RESOLVER IMEI BRUTO → HASH ID via API Softruck
// =====================================================

async function resolveImeiToDeviceId(
  token: string,
  publicKey: string,
  baseUrl: string,
  imei: string
): Promise<{ deviceHashId: string; vehicleId: string | null } | null> {
  try {
    const url = `${baseUrl}/devices?filters[devices.imei][eq]=${encodeURIComponent(imei)}&includes[vehicle][]=plate`;
    console.log(`[Resolver] Buscando device por IMEI: ${imei}`);

    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "public-key": publicKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.warn(`[Resolver] IMEI ${imei}: HTTP ${response.status}`);
      return null;
    }

    const result = await response.json();
    const device = result?.data?.[0];

    if (!device?.id) {
      console.warn(`[Resolver] IMEI ${imei}: não encontrado na API`);
      return null;
    }

    const vehicleId = device?.relationships?.vehicle?.id
      || device?.relationships?.vehicle?.data?.id
      || null;

    console.log(`[Resolver] IMEI ${imei} → device=${device.id}, vehicle=${vehicleId}`);
    return { deviceHashId: device.id, vehicleId };
  } catch (e) {
    console.error(`[Resolver] Erro IMEI ${imei}:`, e);
    return null;
  }
}

// =====================================================
// HANDLER PRINCIPAL — Apenas resolução de IMEIs
// =====================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("=".repeat(50));
  console.log(`[sync-rastreadores] Resolução de IDs: ${new Date().toISOString()}`);

  try {
    let batchSize = 200;
    try {
      const body = await req.json();
      if (body?.batch_size) batchSize = Math.min(body.batch_size, 500);
    } catch {
      // Sem body
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Variáveis SUPABASE não configuradas");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const config = await getSoftruckConfigFromDB(supabase);

    if (!config.enabled || !config.publicKey) {
      return new Response(
        JSON.stringify({ success: true, message: "Softruck não configurada", resolvidos: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar rastreadores Softruck com IMEI bruto (plataforma_device_id numérico com 10+ dígitos)
    const { data: pendentes, error } = await supabase
      .from("rastreadores")
      .select("id, codigo, imei, plataforma_device_id, plataforma_veiculo_id, veiculo_id")
      .eq("plataforma", "softruck")
      .eq("status", "instalado")
      .not("plataforma_device_id", "is", null)
      .limit(batchSize);

    if (error) throw new Error(`Erro ao buscar rastreadores: ${error.message}`);

    // Filtrar apenas os que têm IMEI bruto
    const comImei = (pendentes || []).filter(
      (r: any) => r.plataforma_device_id && /^\d{10,}$/.test(r.plataforma_device_id)
    );

    if (comImei.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum IMEI pendente para resolver", resolvidos: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[sync-rastreadores] ${comImei.length} IMEIs brutos para resolver`);

    let token: string;
    try {
      token = await getSoftruckToken(supabase, config);
    } catch (err) {
      throw new Error(`Falha ao obter token Softruck: ${err}`);
    }

    let resolvidos = 0;
    let falhas = 0;

    for (const rast of comImei) {
      const resolved = await resolveImeiToDeviceId(
        token, config.publicKey!, config.baseUrl, rast.plataforma_device_id
      );

      if (resolved) {
        const updateData: Record<string, unknown> = {
          plataforma_device_id: resolved.deviceHashId,
        };
        if (resolved.vehicleId) {
          updateData.plataforma_veiculo_id = resolved.vehicleId;
          updateData.softruck_integration_status = 'OK';
        } else {
          // Softruck reporta device SEM veículo. Se localmente havia vínculo,
          // marcamos divergência (não zeramos veiculo_id automaticamente —
          // respeita mem://logic/operations/rastreador-vinculo-preservacao).
          if (rast.veiculo_id || rast.plataforma_veiculo_id) {
            console.warn(`[Sync] Desvínculo detectado no Softruck IMEI=${rast.imei || rast.codigo} (rastreador ${rast.id})`);
            updateData.plataforma_veiculo_id = null;
            updateData.softruck_integration_status = 'DIVERGENCIA_DESVINCULO';
            updateData.softruck_response_raw = {
              detectado_em: new Date().toISOString(),
              motivo: 'softruck_sem_veiculo',
              veiculo_id_local: rast.veiculo_id,
              plataforma_veiculo_id_anterior: rast.plataforma_veiculo_id,
            };
          }
        }

        await supabase.from("rastreadores").update(updateData).eq("id", rast.id);

        if (resolved.vehicleId && rast.veiculo_id) {
          await supabase.from("veiculos")
            .update({ softruck_vehicle_id: resolved.vehicleId })
            .eq("id", rast.veiculo_id);
        }

        resolvidos++;
      } else {
        falhas++;
      }

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    const duracao = Date.now() - startTime;
    console.log(`[sync-rastreadores] Concluído: ${resolvidos} resolvidos, ${falhas} falhas, ${duracao}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        total_pendentes: comImei.length,
        resolvidos,
        falhas,
        duracao_ms: duracao,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[sync-rastreadores] ERRO:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duracao_ms: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
