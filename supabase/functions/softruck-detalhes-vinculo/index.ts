/**
 * softruck-detalhes-vinculo
 *
 * Retorna em tempo real (sem persistir nada) o vínculo Softruck de um rastreador
 * — veículo, motorista, cliente, grupo, marca/modelo/cor — para exibição no
 * drawer quando o rastreador local não tem `veiculo_id` mas existe vínculo na
 * Softruck.
 *
 * Body: { rastreador_id?: string, vehicle_id?: string, imei?: string }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getSoftruckAuthToken } from '../_shared/softruck-id-resolver.ts';
import { extractVinculoSoftruck } from '../_shared/softruck-vinculo.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BASE_URL = 'https://api.softruck.com';
const VEHICLE_INCLUDES =
  'includes[device][]=imei' +
  '&includes[driver][]=name&includes[driver][]=document&includes[driver][]=phone' +
  '&includes[client][]=name&includes[client][]=document&includes[client][]=email&includes[client][]=phone' +
  '&includes[group][]=name' +
  '&includes[brand][]=name&includes[model][]=name&includes[color][]=name';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    let vehicleId: string | null = body?.vehicle_id ? String(body.vehicle_id) : null;
    let imei: string | null = body?.imei ? String(body.imei) : null;
    const rastreadorId: string | null = body?.rastreador_id ? String(body.rastreador_id) : null;

    if (!vehicleId && rastreadorId) {
      const { data: r } = await supabase
        .from('rastreadores')
        .select('plataforma_veiculo_id, plataforma_device_id, imei')
        .eq('id', rastreadorId)
        .maybeSingle();
      vehicleId = r?.plataforma_veiculo_id ?? null;
      imei = imei || r?.imei || null;
    }

    if (!vehicleId && !imei) {
      return json({ success: false, error: 'Informe vehicle_id, imei ou rastreador_id válido.' }, 400);
    }

    let token = '', publicKey = '';
    try {
      const auth = await getSoftruckAuthToken(supabaseUrl, supabaseKey, false);
      token = auth.token;
      publicKey = auth.publicKey;
    } catch (e: any) {
      return json({ success: false, error: `Auth Softruck falhou: ${e?.message || e}` }, 502);
    }

    const headers = {
      'Authorization': `Bearer ${token}`,
      'public-key': publicKey,
      'Content-Type': 'application/json',
    };

    let vehicle: any = null;
    let device: any = null;

    // 1. Caminho preferencial: vehicle_id direto
    if (vehicleId) {
      const r = await fetch(`${BASE_URL}/v2/vehicles/${vehicleId}?${VEHICLE_INCLUDES}`, { headers });
      if (r.ok) {
        const j = await r.json();
        vehicle = Array.isArray(j?.data) ? j.data[0] : j?.data;
      }
    }

    // 2. Se ainda não temos veículo, tenta resolver via IMEI
    if (!vehicle && imei) {
      const dResp = await fetch(
        `${BASE_URL}/v2/devices?filters[devices.imei][eq]=${encodeURIComponent(imei)}`,
        { headers },
      );
      if (dResp.ok) {
        const dj = await dResp.json();
        device = dj?.data?.[0] ?? null;
        const relV = device?.relationships?.vehicle?.id || device?.relationships?.vehicle?.data?.id;
        if (relV) {
          const vr = await fetch(`${BASE_URL}/v2/vehicles/${relV}?${VEHICLE_INCLUDES}`, { headers });
          if (vr.ok) {
            const vj = await vr.json();
            vehicle = Array.isArray(vj?.data) ? vj.data[0] : vj?.data;
          }
        }
      }
    }

    if (!vehicle && !device) {
      return json({ success: true, found: false });
    }

    return json({ success: true, found: true, vinculo: extractVinculoSoftruck(vehicle, device) });
  } catch (err: any) {
    console.error('[softruck-detalhes-vinculo]', err);
    return json({ success: false, error: err?.message || 'Erro interno' }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
