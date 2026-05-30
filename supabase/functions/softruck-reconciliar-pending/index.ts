// softruck-reconciliar-pending
// Caminho canônico para fechar ativações que pararam mid-flow:
// device/veículo existem na Softruck (plataforma_*_id preenchido localmente OU descobertos
// agora via /devices?filter[imei]), mas o UPDATE final de rastreadores + veiculos.softruck_vehicle_id
// não aconteceu.
//
// Substitui o "manual-fix" usado no caso RUM0H01. Primeiro caso oficial: QPW4H53.
//
// Entrada: { rastreador_id: string; dry_run?: boolean }
// Pré-condição: rastreador é softruck e está em estado pendente/incompleto + tem veiculo_id local.

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

  const r = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "public-key": creds.public_key },
    body: JSON.stringify({ username: creds.username, password: creds.password }),
  });
  if (!r.ok) throw new Error(`Falha auth Softruck: ${r.status}`);
  const d = await r.json();
  if (!d.data?.token) throw new Error("Token Softruck não retornado");
  await supabase.from("rastreadores_tokens_cache").insert({
    plataforma: "softruck",
    token: d.data.token,
    refresh_token: d.data.refresh_token || null,
    expires_at: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
  });
  return { token: d.data.token, publicKey: creds.public_key };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    let invokerId: string | null = null;
    let isService = false;
    // Aceita service key (chamadas internas/cron) ou JWT de usuário.
    if (authHeader.includes(serviceKey.slice(-12))) {
      isService = true;
    } else if (authHeader.startsWith("Bearer ")) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      invokerId = user?.id || null;
    }
    if (!isService && !invokerId) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { rastreador_id, dry_run } = body as { rastreador_id?: string; dry_run?: boolean };
    if (!rastreador_id) {
      return new Response(JSON.stringify({ error: "rastreador_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: rast, error: rastErr } = await supabase
      .from("rastreadores")
      .select("id, codigo, imei, veiculo_id, associado_id, plataforma, plataforma_device_id, plataforma_veiculo_id, softruck_chip_id, softruck_integration_status, status")
      .eq("id", rastreador_id)
      .single();
    if (rastErr || !rast) {
      return new Response(JSON.stringify({ error: "Rastreador não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (rast.plataforma !== "softruck") {
      return new Response(JSON.stringify({ error: "Rastreador não é Softruck" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!rast.veiculo_id) {
      return new Response(JSON.stringify({ error: "Sem veiculo_id local — nada a reconciliar" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: veic } = await supabase
      .from("veiculos")
      .select("id, placa, chassi, softruck_vehicle_id")
      .eq("id", rast.veiculo_id)
      .single();
    if (!veic) {
      return new Response(JSON.stringify({ error: "Veículo local não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Critério de "já reconciliado": IDs preenchidos no rastreador E softruck_vehicle_id sincronizado no veiculo
    const jaCompleto =
      !!rast.plataforma_device_id &&
      !!rast.plataforma_veiculo_id &&
      !!veic.softruck_vehicle_id &&
      veic.softruck_vehicle_id === rast.plataforma_veiculo_id &&
      rast.softruck_integration_status === "SUCCESS";

    if (jaCompleto) {
      return new Response(JSON.stringify({
        applied: false, reason: "already_reconciled",
        rastreador_id, imei: rast.imei,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Buscar config / token
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
    if (!resp.ok) {
      const txt = await resp.text();
      return new Response(JSON.stringify({ error: `Softruck devices ${resp.status}`, detail: txt }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const result = await resp.json();
    const device = result?.data?.[0];

    if (!device) {
      return new Response(JSON.stringify({
        applied: false, reason: "device_nao_existe",
        message: "Device com este IMEI não existe na Softruck. Use o fluxo normal de ativação (softruck-ativar-dispositivo).",
        imei,
      }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const remoteDeviceId = device.id;
    const remoteVehicleId = device?.relationships?.vehicle?.id
      || device?.relationships?.vehicle?.data?.id
      || null;
    const remotePlate = device?.relationships?.vehicle?.attributes?.plate
      || device?.relationships?.vehicle?.data?.attributes?.plate
      || null;

    if (!remoteVehicleId) {
      // === AUTO-DESVÍNCULO REVERSO ===
      // Device existe na Softruck mas vehicle vazio = desvínculo manual no painel da plataforma.
      // Refletir localmente em vez de re-vincular. Mesma rotina canônica de rastreador-reconciliar-softruck.
      if (dry_run) {
        return new Response(JSON.stringify({
          applied: false, dry_run: true, reason: "device_sem_vehicle_reverse_unbind",
          message: "Device existe na Softruck SEM veículo associado — desvínculo remoto detectado. Aplicaria desvínculo local.",
          device_id: remoteDeviceId,
          local: { veiculo_id: rast.veiculo_id, placa: veic.placa },
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const reverseAt = new Date().toISOString();
      const veiculoIdAnterior = rast.veiculo_id;
      const placaAnterior = veic.placa;
      const statusAnterior = rast.status;

      // Zera o softruck_vehicle_id no veículo (se estava setado)
      if (veic.softruck_vehicle_id) {
        await supabase.from("veiculos")
          .update({ softruck_vehicle_id: null })
          .eq("id", veiculoIdAnterior);
      }

      // Desvincula rastreador localmente
      const { error: upDesvErr } = await supabase
        .from("rastreadores")
        .update({
          veiculo_id: null,
          plataforma_veiculo_id: null,
          status: "estoque",
          softruck_integration_status: "RECONCILIADO_REMOTO",
          softruck_last_attempt_at: reverseAt,
          softruck_response_raw: {
            auto_desvinculo_remoto: true,
            source: "softruck-reconciliar-pending",
            detected_at: reverseAt,
            invoker: isService ? "service" : invokerId,
            veiculo_id_anterior: veiculoIdAnterior,
            placa_anterior: placaAnterior,
            remote: { device_id: remoteDeviceId, vehicle: null },
          },
          updated_at: reverseAt,
        })
        .eq("id", rast.id);
      if (upDesvErr) throw new Error(`auto-desvínculo update rastreadores: ${upDesvErr.message}`);

      // Histórico canônico
      await supabase.from("rastreadores_vinculo_historico").insert({
        rastreador_id: rast.id,
        veiculo_id_anterior: veiculoIdAnterior,
        veiculo_id_novo: null,
        status_anterior: statusAnterior,
        status_novo: "estoque",
        placa_anterior: placaAnterior,
        placa_nova: null,
        alterado_por: invokerId,
        alterado_por_nome: isService ? "cron/service" : null,
        origem: "auto_desvinculo_remoto_softruck",
        contexto: { softruck_device_id: remoteDeviceId, source: "softruck-reconciliar-pending" },
      });

      // Log API
      await supabase.from("rastreadores_api_logs").insert({
        rastreador_id: rast.id,
        veiculo_id: veiculoIdAnterior,
        plataforma: "softruck",
        operacao: "AUTO_DESVINCULO_REMOTO",
        request: { rastreador_id, imei, invoker: isService ? "service" : invokerId },
        response: { device_id: remoteDeviceId, vehicle: null, applied: true },
        status: "sucesso",
      });

      return new Response(JSON.stringify({
        applied: true,
        action: "auto_desvinculo_remoto",
        reason: "device_sem_vehicle",
        rastreador_id: rast.id,
        veiculo_id_anterior: veiculoIdAnterior,
        placa_anterior: placaAnterior,
        device_id: remoteDeviceId,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Comparar placas (normalizando)
    const norm = (s: string | null | undefined) => (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const placaLocal = norm(veic.placa);
    const placaRemota = norm(remotePlate);
    // 0KM: usamos chassi como placa na Softruck — aceita match com chassi
    const chassiLocal = norm(veic.chassi).substring(0, 16);
    const placaBate =
      (placaLocal && placaRemota && placaLocal === placaRemota) ||
      (chassiLocal && placaRemota && placaRemota.startsWith(chassiLocal.substring(0, Math.min(8, chassiLocal.length))));

    if (!placaBate) {
      return new Response(JSON.stringify({
        applied: false, reason: "placa_divergente",
        message: "Placa local difere da placa remota do device. NUNCA aplicar — usar rastreador-reconciliar-softruck para desvincular.",
        local: { placa: veic.placa, chassi: veic.chassi },
        remoto: { device_id: remoteDeviceId, vehicle_id: remoteVehicleId, placa: remotePlate },
      }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const plan = {
      rastreador: {
        id: rast.id,
        imei,
        before: {
          plataforma_device_id: rast.plataforma_device_id,
          plataforma_veiculo_id: rast.plataforma_veiculo_id,
          softruck_integration_status: rast.softruck_integration_status,
        },
        after: {
          plataforma_device_id: remoteDeviceId,
          plataforma_veiculo_id: remoteVehicleId,
          softruck_integration_status: "SUCCESS",
        },
      },
      veiculo: {
        id: veic.id,
        placa: veic.placa,
        before_softruck_vehicle_id: veic.softruck_vehicle_id,
        after_softruck_vehicle_id: remoteVehicleId,
      },
    };

    if (dry_run) {
      return new Response(JSON.stringify({ applied: false, dry_run: true, plan }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === APLICAR UPDATE FINAL CANÔNICO ===
    const reconciledAt = new Date().toISOString();
    const responseRaw = {
      reconciled_from_pending: true,
      source: "softruck-reconciliar-pending",
      reconciliado_em: reconciledAt,
      reconciliado_por: invokerId,
      remote: { device_id: remoteDeviceId, vehicle_id: remoteVehicleId, placa: remotePlate },
    };

    const { error: upRastErr } = await supabase
      .from("rastreadores")
      .update({
        plataforma_device_id: remoteDeviceId,
        plataforma_veiculo_id: remoteVehicleId,
        softruck_integration_status: "SUCCESS",
        softruck_last_attempt_at: reconciledAt,
        softruck_response_raw: responseRaw,
        updated_at: reconciledAt,
      })
      .eq("id", rast.id);
    if (upRastErr) throw new Error(`update rastreadores: ${upRastErr.message}`);

    const { error: upVeicErr } = await supabase
      .from("veiculos")
      .update({ softruck_vehicle_id: remoteVehicleId })
      .eq("id", veic.id);
    if (upVeicErr) throw new Error(`update veiculos.softruck_vehicle_id: ${upVeicErr.message}`);

    // Log canônico
    await supabase.from("rastreadores_api_logs").insert({
      rastreador_id: rast.id,
      veiculo_id: veic.id,
      plataforma: "softruck",
      operacao: "RECONCILED_FROM_PENDING",
      request: { rastreador_id, invoker: isService ? "service" : invokerId },
      response: responseRaw,
      status: "sucesso",
    });

    // Enfileirar GPS poll (não bloqueante)
    await supabase.from("softruck_gps_poll_queue").insert({
      rastreador_id: rast.id,
      softruck_device_id: remoteDeviceId,
      softruck_vehicle_id: remoteVehicleId,
      status: "pending",
      next_run_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ applied: true, plan }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[softruck-reconciliar-pending]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
