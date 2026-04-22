import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReqBody {
  // Enterprise antiga onde os veículos foram criados por engano
  enterpriseAntiga?: string; // default Pratic Master
  // Se true, deleta o veículo da enterprise antiga após recriar
  deletarAntigos?: boolean;
  dryRun?: boolean;
}

const ENTERPRISE_PRATIC_MASTER = 'oydMqwmvgeLJ1kB';

async function callSoftruck(supabaseUrl: string, serviceKey: string, operation: string, data: Record<string, unknown>) {
  const r = await fetch(`${supabaseUrl}/functions/v1/softruck-api`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
    body: JSON.stringify({ operation, data }),
  });
  return await r.json();
}

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
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ success: false, error: 'Token inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', userData.user.id);
    const roleSet = new Set((roles || []).map((r: any) => r.role));
    if (!(roleSet.has('admin') || roleSet.has('diretor'))) {
      return new Response(JSON.stringify({ success: false, error: 'Sem permissão' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json().catch(() => ({}))) as ReqBody;
    const enterpriseAntiga = body.enterpriseAntiga || ENTERPRISE_PRATIC_MASTER;
    const deletarAntigos = body.deletarAntigos ?? true;
    const dryRun = body.dryRun ?? false;

    console.log(`[softruck-recriar] Iniciando — antiga=${enterpriseAntiga}, deletar=${deletarAntigos}, dryRun=${dryRun}`);

    // Buscar veículos no banco que estão associados à enterprise antiga (via softruck_response_raw ou softruck_vehicle_id)
    // Heurística: pegar todos os rastreadores Softruck que têm plataforma_veiculo_id e estão SUCCESS
    const { data: candidatos, error: cErr } = await supabase
      .from('rastreadores')
      .select(`
        id, imei, veiculo_id, associado_id, associado_email, plataforma_device_id, plataforma_veiculo_id, softruck_integration_status,
        veiculos:veiculo_id(id, placa, softruck_vehicle_id)
      `)
      .eq('plataforma', 'softruck')
      .eq('softruck_integration_status', 'SUCCESS')
      .not('plataforma_veiculo_id', 'is', null);

    if (cErr) throw new Error(`Erro ao buscar candidatos: ${cErr.message}`);

    console.log(`[softruck-recriar] ${candidatos?.length || 0} candidatos no banco`);

    // Para cada candidato, verificar via API se está na enterprise antiga
    const aMigrar: any[] = [];
    for (const r of candidatos || []) {
      const buscar = await callSoftruck(supabaseUrl, serviceKey, 'buscar-veiculo-id', { veiculoId: r.plataforma_veiculo_id });
      const enterpriseId = buscar?.data?.data?.relationships?.enterprise?.data?.id
        || buscar?.data?.data?.relationships?.enterprise?.id;
      if (enterpriseId === enterpriseAntiga) {
        aMigrar.push(r);
      }
    }

    console.log(`[softruck-recriar] ${aMigrar.length} veículos na enterprise antiga ${enterpriseAntiga}`);

    if (dryRun) {
      return new Response(JSON.stringify({
        success: true,
        dryRun: true,
        a_migrar: aMigrar.map((r: any) => ({
          rastreador_id: r.id,
          placa: r.veiculos?.placa,
          softruck_vehicle_id_antigo: r.plataforma_veiculo_id,
          softruck_device_id: r.plataforma_device_id,
        })),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const resultados: any[] = [];

    for (const r of aMigrar) {
      const placa = r.veiculos?.placa;
      const result: any = { rastreador_id: r.id, placa, ok: false };

      try {
        // 1. Limpar IDs antigos no banco para que softruck-ativar-dispositivo crie novamente
        await supabase
          .from('rastreadores')
          .update({
            plataforma_device_id: null,
            plataforma_veiculo_id: null,
            softruck_chip_id: null,
            softruck_integration_status: 'PENDING',
          })
          .eq('id', r.id);

        await supabase
          .from('veiculos')
          .update({ softruck_vehicle_id: null })
          .eq('id', r.veiculo_id);

        // 2. Chamar ativar-dispositivo (usa enterprise correta via getEnterpriseId)
        const ativarRes = await fetch(`${supabaseUrl}/functions/v1/softruck-ativar-dispositivo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
          body: JSON.stringify({
            imei: r.imei,
            veiculoId: r.veiculo_id,
            associadoId: r.associado_id,
            associadoEmail: r.associado_email,
          }),
        });
        const ativar = await ativarRes.json();

        if (!ativar.success) {
          throw new Error(ativar.error || 'Falha ao recriar');
        }

        result.softruck_vehicle_id_novo = ativar.softruck_vehicle_id;
        result.softruck_device_id_novo = ativar.softruck_device_id;

        // 3. Deletar veículo antigo na enterprise errada (se solicitado)
        if (deletarAntigos && r.plataforma_veiculo_id) {
          const del = await callSoftruck(supabaseUrl, serviceKey, 'deletar-veiculo', { veiculoId: r.plataforma_veiculo_id });
          result.delete_old = del.success;
        }

        result.ok = true;
      } catch (err) {
        result.error = err instanceof Error ? err.message : 'erro desconhecido';
      }

      resultados.push(result);
      await new Promise(r => setTimeout(r, 400));
    }

    return new Response(JSON.stringify({
      success: true,
      total_migrados: resultados.filter(r => r.ok).length,
      total_falhas: resultados.filter(r => !r.ok).length,
      resultados,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[softruck-recriar] Erro geral:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
