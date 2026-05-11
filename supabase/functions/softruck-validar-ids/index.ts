// Valida IDs Softruck gravados em rastreadores contra o painel Softruck
// (lista todos vehicles + devices via API e gera relatório de divergências).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE_URL = 'https://api.softruck.com';

let cachedToken: string | null = null;
let tokenExp = 0;
async function getToken(force = false): Promise<string> {
  if (!force && cachedToken && Date.now() < tokenExp) return cachedToken;
  const publicKey = Deno.env.get('SOFTRUCK_PUBLIC_KEY')!;
  const username = Deno.env.get('SOFTRUCK_USERNAME')!;
  const password = Deno.env.get('SOFTRUCK_PASSWORD')!;
  const r = await fetch(`${BASE_URL}/v2/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'public-key': publicKey },
    body: JSON.stringify({ username, password }),
  });
  if (!r.ok) throw new Error(`Auth Softruck ${r.status}: ${await r.text()}`);
  const j = await r.json();
  const token = j.token || j.access_token || j.data?.token;
  if (!token) throw new Error('Token Softruck ausente');
  cachedToken = token;
  tokenExp = Date.now() + 6 * 24 * 60 * 60 * 1000;
  return token;
}

async function sr(method: string, endpoint: string, token: string, retry = 0): Promise<any> {
  const publicKey = Deno.env.get('SOFTRUCK_PUBLIC_KEY')!;
  const r = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'public-key': publicKey,
    },
  });
  if (r.status === 401 && retry < 1) {
    return sr(method, endpoint, await getToken(true), retry + 1);
  }
  const text = await r.text();
  if (!r.ok) throw new Error(`Softruck ${endpoint} ${r.status}: ${text}`);
  try { return JSON.parse(text); } catch { return text; }
}

async function listAll(path: string, attrs: string[], token: string): Promise<any[]> {
  const limit = 100;
  let page = 1;
  const all: any[] = [];
  for (;;) {
    const qs = attrs.map(a => `attributes[]=${a}`).join('&');
    const data = await sr('GET', `${path}?${qs}&limit=${limit}&page=${page}`, token);
    const arr = (data?.data ?? []) as any[];
    all.push(...arr);
    if (arr.length < limit) break;
    page++;
    if (page > 50) break; // safety
  }
  return all;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Filtro opcional: { rastreadorId } ou { veiculoId } ou { placa }
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const { rastreadorId, veiculoId, placa } = body as { rastreadorId?: string; veiculoId?: string; placa?: string };

    let q = supabase
      .from('rastreadores')
      .select('id, codigo, imei, plataforma, plataforma_device_id, plataforma_veiculo_id, veiculo_id, status, veiculos:veiculo_id(placa)')
      .eq('plataforma', 'softruck');

    if (rastreadorId) q = q.eq('id', rastreadorId);
    if (veiculoId) q = q.eq('veiculo_id', veiculoId);

    const { data: rastreadores, error } = await q;
    if (error) throw error;

    const filtered = placa
      ? (rastreadores ?? []).filter((r: any) => (r.veiculos?.placa || '').toUpperCase() === placa.toUpperCase())
      : (rastreadores ?? []);

    const token = await getToken();

    // Lista painel
    const [vehiclesRaw, devicesRaw] = await Promise.all([
      listAll('/v2/vehicles', ['plate', 'vin'], token),
      listAll('/v2/devices', ['name', 'imei', 'code'], token),
    ]);

    const vehicleById = new Map<string, any>();
    const vehicleByPlate = new Map<string, any>();
    for (const v of vehiclesRaw) {
      vehicleById.set(String(v.id), v);
      const plate = (v.attributes?.plate || '').toUpperCase();
      if (plate) vehicleByPlate.set(plate, v);
    }
    const deviceById = new Map<string, any>();
    const deviceByImei = new Map<string, any>();
    for (const d of devicesRaw) {
      deviceById.set(String(d.id), d);
      const imei = (d.attributes?.imei || '').replace(/\D/g, '');
      if (imei) deviceByImei.set(imei, d);
    }

    const report = filtered.map((r: any) => {
      const placaLocal = (r.veiculos?.placa || '').toUpperCase();
      const imeiLocal = (r.imei || '').replace(/\D/g, '');
      const vehById = r.plataforma_veiculo_id ? vehicleById.get(String(r.plataforma_veiculo_id)) : null;
      const vehByPlate = placaLocal ? vehicleByPlate.get(placaLocal) : null;
      const devById = r.plataforma_device_id ? deviceById.get(String(r.plataforma_device_id)) : null;
      const devByImei = imeiLocal ? deviceByImei.get(imeiLocal) : null;

      const issues: string[] = [];
      if (r.plataforma_veiculo_id && !vehById) issues.push('vehicle_id_nao_existe_no_painel');
      if (r.plataforma_device_id && !devById) issues.push('device_id_nao_existe_no_painel');
      if (vehById && placaLocal && (vehById.attributes?.plate || '').toUpperCase() !== placaLocal) issues.push('placa_diverge_painel');
      if (devById && imeiLocal && (devById.attributes?.imei || '').replace(/\D/g, '') !== imeiLocal) issues.push('imei_diverge_painel');
      if (!r.plataforma_veiculo_id && vehByPlate) issues.push('placa_existe_no_painel_mas_id_local_vazio');
      if (!r.plataforma_device_id && devByImei) issues.push('imei_existe_no_painel_mas_id_local_vazio');

      return {
        rastreador_id: r.id,
        codigo: r.codigo,
        placa: placaLocal || null,
        imei: imeiLocal || null,
        status_local: r.status,
        ids_locais: {
          vehicle_id: r.plataforma_veiculo_id,
          device_id: r.plataforma_device_id,
        },
        painel_match: {
          vehicle_by_id: vehById ? { id: vehById.id, plate: vehById.attributes?.plate, vin: vehById.attributes?.vin } : null,
          vehicle_by_plate: vehByPlate ? { id: vehByPlate.id, plate: vehByPlate.attributes?.plate } : null,
          device_by_id: devById ? { id: devById.id, imei: devById.attributes?.imei, name: devById.attributes?.name } : null,
          device_by_imei: devByImei ? { id: devByImei.id, imei: devByImei.attributes?.imei } : null,
        },
        sugestoes: {
          vehicle_id_correto: vehByPlate?.id ?? null,
          device_id_correto: devByImei?.id ?? null,
        },
        issues,
        ok: issues.length === 0,
      };
    });

    const summary = {
      total_rastreadores: report.length,
      ok: report.filter(r => r.ok).length,
      com_divergencia: report.filter(r => !r.ok).length,
      total_vehicles_painel: vehiclesRaw.length,
      total_devices_painel: devicesRaw.length,
    };

    return new Response(JSON.stringify({ success: true, summary, report }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
