// Retorna o plano vigente do antigo titular para uma cotação de troca de
// titularidade. Usado pelo link público quando o vendedor não incluiu nenhum
// plano de comparação na cotação.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { cotacao_id } = await req.json();
    if (!cotacao_id || typeof cotacao_id !== 'string') {
      return new Response(JSON.stringify({ error: 'cotacao_id obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: sol } = await supabase
      .from('solicitacoes_troca_titularidade')
      .select('id, associado_antigo_id, veiculo_id')
      .eq('cotacao_id', cotacao_id)
      .maybeSingle();

    if (!sol?.veiculo_id || !sol?.associado_antigo_id) {
      return new Response(JSON.stringify({ plano: null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: contrato } = await supabase
      .from('contratos')
      .select('plano_id, valor_mensal, valor_adesao')
      .eq('veiculo_id', sol.veiculo_id)
      .eq('associado_id', sol.associado_antigo_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!contrato?.plano_id) {
      return new Response(JSON.stringify({ plano: null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: plano } = await supabase
      .from('planos')
      .select('id, nome, codigo, coberturas, valor_adesao, nivel')
      .eq('id', contrato.plano_id)
      .maybeSingle();

    if (!plano) {
      return new Response(JSON.stringify({ plano: null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        plano: {
          id: plano.id,
          nome: plano.nome,
          codigo: plano.codigo,
          valorMensal: contrato.valor_mensal ?? 0,
          valorAdesao: contrato.valor_adesao ?? plano.valor_adesao ?? 0,
          coberturas: plano.coberturas ?? [],
          nivel: (plano as any).nivel ?? undefined,
          origem: 'plano_vigente_antigo',
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('[troca-plano-vigente] erro:', err);
    return new Response(JSON.stringify({ error: err?.message ?? 'erro' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
