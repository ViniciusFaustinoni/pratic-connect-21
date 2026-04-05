import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE_URL = 'https://api.softruck.com';

let cachedToken: string | null = null;
let tokenExpiresAt: number | null = null;

async function getAuthToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && tokenExpiresAt && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }
  const publicKey = Deno.env.get('SOFTRUCK_PUBLIC_KEY');
  const username = Deno.env.get('SOFTRUCK_USERNAME');
  const password = Deno.env.get('SOFTRUCK_PASSWORD');
  if (!publicKey || !username || !password) throw new Error('Credenciais Softruck não configuradas');

  const response = await fetch(`${BASE_URL}/v2/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'public-key': publicKey },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) throw new Error(`Login Softruck falhou: ${response.status}`);
  const data = await response.json();
  cachedToken = data.token || data.access_token || data.data?.token;
  if (!cachedToken) throw new Error('Token Softruck não retornado');
  tokenExpiresAt = Date.now() + 6 * 24 * 60 * 60 * 1000;
  return cachedToken!;
}

async function softruckGet(endpoint: string, token: string, retry = 0): Promise<any> {
  const publicKey = Deno.env.get('SOFTRUCK_PUBLIC_KEY') || '';
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'public-key': publicKey, 'Content-Type': 'application/json' },
  });
  if (response.status === 401 && retry < 1) {
    const newToken = await getAuthToken(true);
    return softruckGet(endpoint, newToken, retry + 1);
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Softruck ${response.status}: ${text}`);
  }
  return response.json();
}

function extractVehicleId(device: any): string | null {
  const rel = device?.relationships?.vehicle;
  if (!rel) return null;
  if (rel.id) return rel.id;
  if (rel.data?.id) return rel.data.id;
  if (typeof rel === 'object' && rel.type === 'vehicles' && rel.id) return rel.id;
  return null;
}

function isImei(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits === value;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const batchSize = body.batch_size || 30;
    const offset = body.offset || 0;
    const mode = body.mode || 'populate';

    const { data: rastreadores, error } = await supabase
      .from('rastreadores')
      .select('id, codigo, plataforma_device_id, plataforma_veiculo_id')
      .eq('plataforma', 'softruck')
      .not('plataforma_device_id', 'is', null)
      .is('plataforma_veiculo_id', null)
      .range(offset, offset + batchSize - 1);

    if (error) throw error;
    if (!rastreadores || rastreadores.length === 0) {
      return new Response(
        JSON.stringify({ sucesso: true, mensagem: 'Nenhum rastreador para processar', processados: 0, offset }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[popular-ids] Processando ${rastreadores.length} rastreadores (offset ${offset})`);
    const token = await getAuthToken();
    let atualizados = 0;
    let falhas = 0;
    let semVeiculo = 0;
    const erros: string[] = [];
    const debugData: any[] = [];

    for (const rast of rastreadores) {
      try {
        const deviceIdOrImei = rast.plataforma_device_id;

        let softruckDeviceId: string | null = null;
        let vehicleId: string | null = null;

        if (isImei(deviceIdOrImei)) {
          // É IMEI — buscar por filtro de IMEI
          const result = await softruckGet(
            `/v2/devices?filters[devices.imei][eq]=${encodeURIComponent(deviceIdOrImei)}&includes[vehicle][]=plate`,
            token
          );
          if (mode === 'debug') debugData.push({ codigo: rast.codigo, type: 'imei', response: result });

          if (result?.data?.length > 0) {
            softruckDeviceId = result.data[0].id;
            vehicleId = extractVehicleId(result.data[0]);
          }
        } else {
          // Já é ID alfanumérico da Softruck — buscar by ID
          const result = await softruckGet(
            `/v2/devices/${deviceIdOrImei}?includes[vehicle][]=plate`,
            token
          );
          if (mode === 'debug') debugData.push({ codigo: rast.codigo, type: 'id', response: result });

          const device = Array.isArray(result?.data) ? result.data[0] : result?.data;
          if (device) {
            softruckDeviceId = device.id || deviceIdOrImei;
            vehicleId = extractVehicleId(device);
          }
        }

        if (vehicleId) {
          const upd: Record<string, string> = { plataforma_veiculo_id: vehicleId };
          if (softruckDeviceId && softruckDeviceId !== deviceIdOrImei) {
            upd.plataforma_device_id = softruckDeviceId;
          }
          await supabase.from('rastreadores').update(upd).eq('id', rast.id);
          atualizados++;
          console.log(`[popular-ids] ✓ ${rast.codigo}: vehicle=${vehicleId}`);
        } else if (softruckDeviceId) {
          // Device existe mas sem vehicle
          semVeiculo++;
          erros.push(`${rast.codigo}: device ${softruckDeviceId} sem vehicle`);
        } else {
          falhas++;
          erros.push(`${rast.codigo}: device não encontrado`);
        }

        await new Promise(r => setTimeout(r, 150));
      } catch (err) {
        falhas++;
        erros.push(`${rast.codigo}: ${err.message}`);
      }
    }

    const resultado = {
      sucesso: true,
      offset,
      batch_size: batchSize,
      total_lote: rastreadores.length,
      atualizados,
      sem_veiculo: semVeiculo,
      falhas,
      proximo_offset: offset + batchSize,
      erros: erros.slice(0, 30),
      ...(mode === 'debug' ? { debug: debugData } : {}),
    };

    console.log(`[popular-ids] ${atualizados} ok, ${semVeiculo} sem veículo, ${falhas} falhas`);

    return new Response(
      JSON.stringify(resultado),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[popular-ids] Erro:', err);
    return new Response(
      JSON.stringify({ sucesso: false, erro: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
