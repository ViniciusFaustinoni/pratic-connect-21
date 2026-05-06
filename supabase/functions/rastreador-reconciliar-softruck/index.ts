import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCredenciaisSoftruck } from "../_shared/credenciais-hibridas.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getSoftruckToken(supabase: any, baseUrl: string) {
  const { data: cached } = await supabase
    .from("rastreadores_tokens_cache")
    .select("token, expires_at")
    .eq("plataforma", "softruck")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const creds = await getCredenciaisSoftruck(supabase);
  if (!creds) throw new Error("Credenciais Softruck não configuradas");

  if (cached?.token) return { token: cached.token, publicKey: creds.public_key };

  const response = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "public-key": creds.public_key },
    body: JSON.stringify({ username: creds.username, password: creds.password }),
  });
  if (!response.ok) throw new Error(`Falha auth Softruck: ${response.status}`);
  const data = await response.json();
  if (!data.data?.token) throw new Error("Token Softruck não retornado");

  await supabase.from("rastreadores_tokens_cache").insert({
    plataforma: "softruck",
    token: data.data.token,
    refresh_token: data.data.refresh_token || null,
    expires_at: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
  });

  return { token: data.data.token, publicKey: creds.public_key };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth do chamador
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { rastreador_id, action } = body as { rastreador_id?: string; action?: "check" | "apply" };
    if (!rastreador_id) {
      return new Response(JSON.stringify({ error: "rastreador_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: rast, error: rastErr } = await supabase
      .from("rastreadores")
      .select("id, codigo, imei, veiculo_id, plataforma, plataforma_device_id, plataforma_veiculo_id, status")
      .eq("id", rastreador_id)
      .single();
    if (rastErr || !rast) throw new Error("Rastreador não encontrado");
    if (rast.plataforma !== "softruck") throw new Error("Rastreador não é Softruck");

    // Buscar config
    const { data: plataforma } = await supabase
      .from("rastreadores_config_plataformas")
      .select("ambiente_atual, api_url_producao, api_url_sandbox")
      .eq("plataforma", "softruck").single();
    const baseUrl = plataforma?.ambiente_atual === "producao"
      ? (plataforma?.api_url_producao || "https://api.softruck.com/v2")
      : (plataforma?.api_url_sandbox || "https://api.softruck.com/v2");

    const { token, publicKey } = await getSoftruckToken(supabase, baseUrl);

    const imei = rast.imei || rast.codigo;
    const url = `${baseUrl}/devices?filters[devices.imei][eq]=${encodeURIComponent(imei)}&includes[vehicle][]=plate`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, "public-key": publicKey, "Content-Type": "application/json" },
    });
    if (!resp.ok) throw new Error(`Softruck devices ${resp.status}`);
    const result = await resp.json();
    const device = result?.data?.[0];

    const remoteVehicleId = device?.relationships?.vehicle?.id
      || device?.relationships?.vehicle?.data?.id
      || null;
    const remotePlate = device?.relationships?.vehicle?.attributes?.plate
      || device?.relationships?.vehicle?.data?.attributes?.plate
      || null;

    // Buscar placa local
    let localPlaca: string | null = null;
    if (rast.veiculo_id) {
      const { data: v } = await supabase.from("veiculos").select("placa").eq("id", rast.veiculo_id).single();
      localPlaca = v?.placa || null;
    }

    const divergencia = !!rast.veiculo_id && !remoteVehicleId;
    const conflito = !!remoteVehicleId && !!rast.veiculo_id
      && remotePlate && localPlaca && remotePlate.toUpperCase() !== localPlaca.toUpperCase();

    const summary = {
      rastreador_id,
      imei,
      local: { veiculo_id: rast.veiculo_id, placa: localPlaca, status: rast.status },
      softruck: { device_id: device?.id || null, vehicle_id: remoteVehicleId, placa: remotePlate },
      divergencia_desvinculo: divergencia,
      conflito_placa: conflito,
    };

    if (action !== "apply") {
      return new Response(JSON.stringify(summary), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (conflito) {
      return new Response(JSON.stringify({
        ...summary,
        applied: false,
        error: "Conflito de placa detectado. Resolver manualmente — não aplicado.",
      }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!divergencia) {
      return new Response(JSON.stringify({ ...summary, applied: false, message: "Nada a reconciliar" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Aplicar desvínculo local
    const veiculoIdAnterior = rast.veiculo_id;

    if (veiculoIdAnterior) {
      await supabase.from("veiculos")
        .update({ softruck_vehicle_id: null })
        .eq("id", veiculoIdAnterior);
    }

    await supabase.from("rastreadores").update({
      veiculo_id: null,
      plataforma_veiculo_id: null,
      status: "estoque",
      softruck_integration_status: "RECONCILIADO",
      softruck_response_raw: {
        reconciliado_em: new Date().toISOString(),
        reconciliado_por: user.id,
        veiculo_id_anterior: veiculoIdAnterior,
        placa_anterior: localPlaca,
      },
    }).eq("id", rastreador_id);

    // Log no histórico de vínculo
    const { data: profile } = await supabase
      .from("profiles").select("nome").eq("user_id", user.id).maybeSingle();

    await supabase.from("rastreadores_vinculo_historico").insert({
      rastreador_id,
      veiculo_id_anterior: veiculoIdAnterior,
      veiculo_id_novo: null,
      status_anterior: rast.status,
      status_novo: "estoque",
      placa_anterior: localPlaca,
      placa_nova: null,
      alterado_por: user.id,
      alterado_por_nome: profile?.nome || null,
      origem: "reconciliacao_softruck",
      contexto: { softruck_device_id: device?.id, summary },
    });

    return new Response(JSON.stringify({ ...summary, applied: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[reconciliar-softruck]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
