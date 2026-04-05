import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { resolveSoftruckIds, getSoftruckAuthToken } from "../_shared/softruck-id-resolver.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Buscar rastreadores Softruck instalados SEM plataforma_veiculo_id, COM veículo vinculado
    const { data: rastreadores, error } = await supabase
      .from('rastreadores')
      .select(`
        id, codigo, plataforma_device_id, plataforma_veiculo_id,
        veiculo_id,
        veiculo:veiculos(id, placa, softruck_vehicle_id)
      `)
      .eq('plataforma', 'softruck')
      .eq('status', 'instalado')
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

    // Get auth token once
    const { token, publicKey } = await getSoftruckAuthToken(supabaseUrl, supabaseKey);

    let atualizados = 0;
    let semVeiculo = 0;
    let falhas = 0;
    const erros: string[] = [];
    const debugData: any[] = [];

    for (const rast of rastreadores) {
      try {
        const veiculo = rast.veiculo as any;

        const resolved = await resolveSoftruckIds({
          supabase,
          rastreadorId: rast.id,
          plataformaDeviceId: rast.plataforma_device_id,
          plataformaVeiculoId: rast.plataforma_veiculo_id,
          veiculoId: veiculo?.id || rast.veiculo_id,
          veiculoPlaca: veiculo?.placa || null,
          softruckVehicleId: veiculo?.softruck_vehicle_id || null,
          token,
          publicKey,
          persistOnResolve: true,
        });

        if (mode === 'debug') {
          debugData.push({ codigo: rast.codigo, resolved });
        }

        if (resolved) {
          atualizados++;
          console.log(`[popular-ids] ✓ ${rast.codigo}: vehicle=${resolved.vehicleId} via ${resolved.source}`);
        } else {
          semVeiculo++;
          erros.push(`${rast.codigo}: vehicle não encontrado (placa=${veiculo?.placa || 'N/A'})`);
        }

        // Rate limiting
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
