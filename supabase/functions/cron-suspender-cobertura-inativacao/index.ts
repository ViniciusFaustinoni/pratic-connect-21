// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    // Find vehicles linked to contracts signed > 48h ago without completed installation
    const { data: contratos, error: errContratos } = await supabase
      .from('contratos')
      .select('id, veiculo_id, data_assinatura')
      .not('data_assinatura', 'is', null)
      .lte('data_assinatura', fortyEightHoursAgo)
      .eq('status', 'ativo');

    if (errContratos) throw errContratos;
    if (!contratos?.length) {
      return new Response(JSON.stringify({ message: 'Nenhum contrato para verificar' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let suspensos = 0;
    let revertidos = 0;

    for (const contrato of contratos) {
      if (!contrato.veiculo_id) continue;

      // Check if vehicle has a completed installation service
      const { data: servicoConcluido } = await supabase
        .from('servicos')
        .select('id')
        .eq('veiculo_id', contrato.veiculo_id)
        .eq('tipo', 'instalacao')
        .eq('status', 'concluida')
        .limit(1);

      const temInstalacao = (servicoConcluido?.length ?? 0) > 0;

      // Get current vehicle state
      const { data: veiculo } = await supabase
        .from('veiculos')
        .select('cobertura_suspensa')
        .eq('id', contrato.veiculo_id)
        .single();

      if (!veiculo) continue;

      if (!temInstalacao && !veiculo.cobertura_suspensa) {
        // Suspend coverage
        await supabase
          .from('veiculos')
          .update({
            cobertura_suspensa: true,
            cobertura_suspensa_motivo: 'Rastreador não ativado em 48h',
            cobertura_suspensa_em: new Date().toISOString(),
          })
          .eq('id', contrato.veiculo_id);
        suspensos++;
      } else if (temInstalacao && veiculo.cobertura_suspensa) {
        // Revert suspension
        await supabase
          .from('veiculos')
          .update({
            cobertura_suspensa: false,
            cobertura_suspensa_motivo: null,
            cobertura_suspensa_em: null,
          })
          .eq('id', contrato.veiculo_id);
        revertidos++;
      }
    }

    return new Response(
      JSON.stringify({ suspensos, revertidos, total_verificados: contratos.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
