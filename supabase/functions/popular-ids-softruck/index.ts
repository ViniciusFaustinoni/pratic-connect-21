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

  if (!publicKey || !username || !password) {
    throw new Error('Credenciais Softruck não configuradas');
  }

  const response = await fetch(`${BASE_URL}/v2/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'public-key': publicKey },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw new Error(`Login Softruck falhou: ${response.status}`);
  }

  const data = await response.json();
  cachedToken = data.token || data.access_token;
  tokenExpiresAt = Date.now() + 55 * 60 * 1000;
  return cachedToken!;
}

async function softruckGet(endpoint: string, token: string, retry = 0): Promise<any> {
  const publicKey = Deno.env.get('SOFTRUCK_PUBLIC_KEY') || '';
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'public-key': publicKey,
      'Content-Type': 'application/json',
    },
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const batchSize = body.batch_size || 50;
    const offset = body.offset || 0;

    // Buscar rastreadores sem plataforma_veiculo_id
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
    const erros: string[] = [];

    for (const rast of rastreadores) {
      try {
        // O plataforma_device_id pode ser o IMEI ou já o ID do device na Softruck
        const imei = rast.plataforma_device_id;
        
        // Buscar device por IMEI na Softruck
        const deviceResult = await softruckGet(
          `/v2/devices?filters[devices.imei][eq]=${encodeURIComponent(imei.replace(/\D/g, ''))}`,
          token
        );

        const devices = deviceResult?.data;
        if (!devices || devices.length === 0) {
          // Tentar buscar como device ID direto
          try {
            const deviceDirect = await softruckGet(`/v2/devices/${imei}`, token);
            if (deviceDirect?.data) {
              const device = Array.isArray(deviceDirect.data) ? deviceDirect.data[0] : deviceDirect.data;
              const deviceId = device.id;
              const vehicleRel = device.relationships?.vehicle;
              const vehicleId = vehicleRel?.id || vehicleRel?.data?.id || null;

              const updateData: Record<string, string> = {};
              if (deviceId && deviceId !== imei) updateData.plataforma_device_id = deviceId;
              if (vehicleId) updateData.plataforma_veiculo_id = vehicleId;

              if (Object.keys(updateData).length > 0) {
                await supabase.from('rastreadores').update(updateData).eq('id', rast.id);
                atualizados++;
                console.log(`[popular-ids] ${rast.codigo}: device=${deviceId}, vehicle=${vehicleId}`);
              } else {
                falhas++;
                erros.push(`${rast.codigo}: device encontrado mas sem vehicle`);
              }
              continue;
            }
          } catch {
            // Ignorar, device não encontrado
          }
          
          falhas++;
          erros.push(`${rast.codigo}: device não encontrado (IMEI: ${imei})`);
          continue;
        }

        const device = devices[0];
        const softruckDeviceId = device.id;
        const vehicleRel = device.relationships?.vehicle;
        const vehicleId = vehicleRel?.id || vehicleRel?.data?.id || null;

        const updateData: Record<string, string> = {};
        // Atualizar device_id se for diferente (IMEI → ID real)
        if (softruckDeviceId && softruckDeviceId !== imei) {
          updateData.plataforma_device_id = softruckDeviceId;
        }
        if (vehicleId) {
          updateData.plataforma_veiculo_id = vehicleId;
        }

        if (Object.keys(updateData).length > 0) {
          await supabase.from('rastreadores').update(updateData).eq('id', rast.id);
          atualizados++;
          console.log(`[popular-ids] ${rast.codigo}: device=${softruckDeviceId}, vehicle=${vehicleId}`);
        } else {
          falhas++;
          erros.push(`${rast.codigo}: sem vehicle associado na Softruck`);
        }

        // Rate limiting: aguardar 200ms entre requests
        await new Promise(r => setTimeout(r, 200));
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
      falhas,
      proximo_offset: offset + batchSize,
      erros: erros.slice(0, 20),
    };

    console.log(`[popular-ids] Resultado: ${atualizados} atualizados, ${falhas} falhas`);

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
