import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackfillRequest {
  limit?: number;
  dryRun?: boolean;
}

const RATE_LIMIT_MS = 300;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ success: false, error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id);
    const roleSet = new Set((roles || []).map((r: any) => r.role));
    if (!(roleSet.has('admin') || roleSet.has('diretor'))) {
      return new Response(JSON.stringify({ success: false, error: 'Sem permissão' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json().catch(() => ({}))) as BackfillRequest;
    const limit = Math.min(Math.max(body.limit ?? 30, 1), 100);
    const dryRun = body.dryRun ?? false;

    console.log(`[rv-backfill] Iniciando — limit=${limit}, dryRun=${dryRun}`);

    // Buscar rastreadores Rede Veículos instalados sem device_id
    const { data: rastreadores, error: rError } = await supabase
      .from('rastreadores')
      .select(`
        id, imei, veiculo_id, associado_id, plataforma, status, plataforma_device_id,
        veiculos:veiculo_id(id, rede_veiculos_veiculo_id)
      `)
      .eq('plataforma', 'rede_veiculos')
      .eq('status', 'instalado')
      .not('veiculo_id', 'is', null)
      .not('imei', 'is', null)
      .limit(limit * 3);

    if (rError) {
      throw new Error(`Erro ao buscar rastreadores: ${rError.message}`);
    }

    // Filtrar localmente os que ainda não têm vínculo na Rede Veículos
    const candidatos = (rastreadores || []).filter((r: any) => {
      const veiculoSemId = !r.veiculos?.rede_veiculos_veiculo_id;
      const rastreadorSemDevice = !r.plataforma_device_id;
      return veiculoSemId && rastreadorSemDevice;
    }).slice(0, limit);

    const total = candidatos.length;
    console.log(`[rv-backfill] ${total} candidatos`);

    if (dryRun) {
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          total_encontrados: total,
          rastreadores: candidatos.map((r: any) => ({ id: r.id, imei: r.imei, veiculo_id: r.veiculo_id })),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let sucessos = 0;
    let falhas = 0;
    const erros: Array<{ rastreador_id: string; imei: string; error: string }> = [];

    for (const r of candidatos) {
      try {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));

        const res = await fetch(`${supabaseUrl}/functions/v1/rede-veiculos-vincular-cliente`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            imei: r.imei,
            veiculoId: r.veiculo_id,
            associadoId: r.associado_id,
          }),
        });

        const result = await res.json();
        if (result.success) {
          sucessos++;
          console.log(`[rv-backfill] ✓ ${r.imei}`);
        } else {
          falhas++;
          erros.push({ rastreador_id: r.id, imei: r.imei, error: result.error || 'erro desconhecido' });
          console.warn(`[rv-backfill] ✗ ${r.imei}: ${result.error}`);
        }
      } catch (err) {
        falhas++;
        const msg = err instanceof Error ? err.message : 'erro desconhecido';
        erros.push({ rastreador_id: r.id, imei: r.imei, error: msg });
        console.error(`[rv-backfill] ✗ ${r.imei}:`, err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_processados: total,
        sucessos,
        falhas,
        erros: erros.slice(0, 20),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[rv-backfill] Erro geral:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
