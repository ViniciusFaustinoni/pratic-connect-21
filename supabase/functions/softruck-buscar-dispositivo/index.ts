/**
 * softruck-buscar-dispositivo
 *
 * Lookup ON-DEMAND na API Softruck por placa OU IMEI.
 * Quando o usuário busca em /monitoramento/rastreadores e nada aparece localmente,
 * o frontend chama esta função para verificar se o dispositivo existe na Softruck
 * e — se existir — fazer upsert na tabela `rastreadores` para que apareça na lista.
 *
 * Body:
 *   { busca: string } — pode ser placa (até 7 chars) ou IMEI (10+ dígitos)
 *
 * Resposta:
 *   { success, found: bool, rastreador_id?, imei?, placa?, vehicle_id?, message }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getSoftruckAuthToken } from '../_shared/softruck-id-resolver.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BASE_URL = 'https://api.softruck.com';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const buscaRaw = String(body?.busca ?? '').trim().toUpperCase();
    if (!buscaRaw) {
      return json({ success: false, error: 'Parâmetro "busca" obrigatório' }, 400);
    }

    const isImei = /^\d{10,}$/.test(buscaRaw);
    const placa = !isImei ? buscaRaw.replace(/[^A-Z0-9]/g, '') : null;

    // Auth Softruck
    let token = '';
    let publicKey = '';
    try {
      const auth = await getSoftruckAuthToken(supabaseUrl, supabaseKey, false);
      token = auth.token;
      publicKey = auth.publicKey;
    } catch (e: any) {
      return json({
        success: false,
        error: `Falha ao autenticar na Softruck: ${e?.message || e}. Verifique credenciais em Integrações.`,
      }, 502);
    }

    // Helper: fetch que renova o token automaticamente em caso de 401
    const softFetch = async (url: string): Promise<Response> => {
      let resp = await fetch(url, { headers: authHeaders(token, publicKey) });
      if (resp.status === 401) {
        console.warn('[softruck-buscar-dispositivo] 401 recebido, renovando token...');
        try {
          const refreshed = await getSoftruckAuthToken(supabaseUrl, supabaseKey, true);
          token = refreshed.token;
          publicKey = refreshed.publicKey;
          resp = await fetch(url, { headers: authHeaders(token, publicKey) });
        } catch (e) {
          console.error('[softruck-buscar-dispositivo] falha ao renovar token:', e);
        }
      }
      return resp;
    };

    let device: any = null;
    let vehicle: any = null;

    // Includes ricos para já trazer motorista/cliente/grupo/marca/modelo/cor
    const VEHICLE_INCLUDES =
      '&includes[device][]=imei' +
      '&includes[driver][]=name&includes[driver][]=document&includes[driver][]=phone' +
      '&includes[client][]=name&includes[client][]=document&includes[client][]=email&includes[client][]=phone' +
      '&includes[group][]=name' +
      '&includes[brand][]=name&includes[model][]=name&includes[color][]=name';

    if (isImei) {
      const resp = await softFetch(
        `${BASE_URL}/v2/devices?filters[devices.imei][eq]=${encodeURIComponent(buscaRaw)}&includes[vehicle][]=plate`,
      );
      if (!resp.ok) {
        const t = await resp.text();
        return json({ success: false, error: `Softruck ${resp.status}: ${t}` }, 502);
      }
      const j = await resp.json();
      device = j?.data?.[0] ?? null;
      const relVehicleId = device?.relationships?.vehicle?.id || device?.relationships?.vehicle?.data?.id;
      if (relVehicleId) {
        vehicle = await fetchVehicle(token, publicKey, relVehicleId, VEHICLE_INCLUDES);
      }
    } else if (placa) {
      const resp = await softFetch(
        `${BASE_URL}/v2/vehicles?filters[vehicles.plate][eq]=${encodeURIComponent(placa)}${VEHICLE_INCLUDES}`,
      );
      if (!resp.ok) {
        const t = await resp.text();
        return json({ success: false, error: `Softruck ${resp.status}: ${t}` }, 502);
      }
      const j = await resp.json();
      vehicle = j?.data?.[0] ?? null;
      const relDeviceId = vehicle?.relationships?.device?.id || vehicle?.relationships?.device?.data?.id;
      if (relDeviceId) {
        const dResp = await softFetch(`${BASE_URL}/v2/devices/${relDeviceId}`);
        if (dResp.ok) {
          const dj = await dResp.json();
          device = Array.isArray(dj?.data) ? dj.data[0] : dj?.data;
        }
      }
    }

    if (!device && !vehicle) {
      return json({
        success: true,
        found: false,
        message: `Não encontrado na Softruck (${isImei ? 'IMEI' : 'placa'}: ${buscaRaw}).`,
      });
    }

    const imei = device?.attributes?.imei || (isImei ? buscaRaw : null);
    const placaSoftruck = vehicle?.attributes?.plate || placa || null;
    const deviceId = device?.id ? String(device.id) : null;
    const vehicleId = vehicle?.id ? String(vehicle.id) : null;

    // Upsert na tabela rastreadores. Procura por imei OU plataforma_device_id.
    let existing: any = null;
    if (imei) {
      const r = await supabase
        .from('rastreadores')
        .select('id, imei, codigo, plataforma, plataforma_device_id, plataforma_veiculo_id, status, veiculo_id')
        .eq('plataforma', 'softruck')
        .eq('imei', imei)
        .maybeSingle();
      existing = r.data;
    }
    if (!existing && deviceId) {
      const r = await supabase
        .from('rastreadores')
        .select('id, imei, codigo, plataforma, plataforma_device_id, plataforma_veiculo_id, status, veiculo_id')
        .eq('plataforma', 'softruck')
        .eq('plataforma_device_id', deviceId)
        .maybeSingle();
      existing = r.data;
    }

    let rastreadorId = existing?.id ?? null;
    let acao: 'criado' | 'atualizado' | 'inalterado' = 'inalterado';

    if (!existing) {
      // Criar registro mínimo (em estoque, sem vínculo de veículo). O usuário
      // poderá depois vincular ao veículo correspondente — ou já vincular
      // automaticamente se houver veiculo local com a mesma placa.
      const insertPayload: Record<string, unknown> = {
        codigo: imei || `SFTRCK-${deviceId || placaSoftruck}`,
        imei: imei,
        plataforma: 'softruck',
        plataforma_device_id: deviceId,
        plataforma_veiculo_id: vehicleId,
        status: 'estoque',
      };

      // Tentar vincular a veículo local com mesma placa
      if (placaSoftruck) {
        const placaNorm = placaSoftruck.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        const { data: vLocal } = await supabase
          .from('veiculos')
          .select('id')
          .ilike('placa', placaNorm)
          .limit(1)
          .maybeSingle();
        if (vLocal?.id) {
          insertPayload.veiculo_id = vLocal.id;
          insertPayload.status = 'instalado';
        }
      }

      const { data: novo, error: insErr } = await supabase
        .from('rastreadores')
        .insert(insertPayload as any)
        .select('id')
        .single();

      if (insErr) {
        return json({
          success: false,
          error: `Falha ao criar registro local: ${insErr.message}`,
        }, 500);
      }
      rastreadorId = novo.id;
      acao = 'criado';
    } else {
      // Atualizar IDs faltantes
      const patch: Record<string, unknown> = {};
      if (deviceId && existing.plataforma_device_id !== deviceId) patch.plataforma_device_id = deviceId;
      if (vehicleId && existing.plataforma_veiculo_id !== vehicleId) patch.plataforma_veiculo_id = vehicleId;
      if (imei && existing.imei !== imei) patch.imei = imei;

      // Reconciliar veiculo_id local pela placa Softruck quando o rastreador
      // ainda não tem vínculo local (caso típico: KAIKE — placa vinculada na
      // Softruck mas rastreador local sem veiculo_id, então a busca por placa
      // na aba Rastreadores não retornava nada).
      if (!existing.veiculo_id && placaSoftruck) {
        const placaNorm = placaSoftruck.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        const { data: vLocal } = await supabase
          .from('veiculos')
          .select('id')
          .ilike('placa', placaNorm)
          .limit(1)
          .maybeSingle();
        if (vLocal?.id) {
          patch.veiculo_id = vLocal.id;
          if (existing.status === 'estoque') patch.status = 'instalado';
        }
      }

      if (Object.keys(patch).length > 0) {
        await supabase.from('rastreadores').update(patch).eq('id', existing.id);
        acao = 'atualizado';
      }
    }

    return json({
      success: true,
      found: true,
      acao,
      rastreador_id: rastreadorId,
      imei,
      placa: placaSoftruck,
      vehicle_id: vehicleId,
      device_id: deviceId,
      message: acao === 'criado'
        ? 'Dispositivo encontrado na Softruck e cadastrado localmente.'
        : acao === 'atualizado'
          ? 'Dispositivo já existia localmente — IDs Softruck atualizados.'
          : 'Dispositivo já estava sincronizado localmente.',
    });
  } catch (err: any) {
    console.error('[softruck-buscar-dispositivo] erro:', err);
    return json({ success: false, error: err?.message || 'Erro interno' }, 500);
  }
});

function authHeaders(token: string, publicKey: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${token}`,
    'public-key': publicKey,
    'Content-Type': 'application/json',
  };
}

async function fetchVehicle(token: string, publicKey: string, vehicleId: string, includes = ''): Promise<any | null> {
  try {
    const r = await fetch(`${BASE_URL}/v2/vehicles/${vehicleId}${includes ? `?${includes.replace(/^&/, '')}` : ''}`, {
      headers: authHeaders(token, publicKey),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j?.data) ? j.data[0] : j?.data;
  } catch {
    return null;
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
