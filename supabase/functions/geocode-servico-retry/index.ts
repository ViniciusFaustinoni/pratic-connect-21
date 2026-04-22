import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { servicoId } = await req.json();
    if (!servicoId || typeof servicoId !== 'string') {
      return new Response(JSON.stringify({ error: 'servicoId obrigatório', success: false }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Carrega endereço atual do serviço
    const { data: servico, error: errSel } = await supabase
      .from('servicos')
      .select('id, endereco_cep, endereco_logradouro, endereco_numero, endereco_bairro, endereco_cidade, endereco_uf, latitude, longitude')
      .eq('id', servicoId)
      .maybeSingle();

    if (errSel) throw errSel;
    if (!servico) {
      return new Response(JSON.stringify({ error: 'Serviço não encontrado', success: false }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Chama geocode-endereco
    const geoResp = await fetch(`${supabaseUrl}/functions/v1/geocode-endereco`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        cep: servico.endereco_cep,
        logradouro: servico.endereco_logradouro,
        numero: servico.endereco_numero,
        bairro: servico.endereco_bairro,
        cidade: servico.endereco_cidade,
        uf: servico.endereco_uf,
      }),
    });

    const geoData = await geoResp.json();

    if (!geoData?.success || !geoData.latitude || !geoData.longitude) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Não foi possível geolocalizar o endereço atual. Tente corrigir o endereço.',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { error: errUpd } = await supabase
      .from('servicos')
      .update({
        latitude: geoData.latitude,
        longitude: geoData.longitude,
      })
      .eq('id', servicoId);

    if (errUpd) throw errUpd;

    return new Response(JSON.stringify({
      success: true,
      latitude: geoData.latitude,
      longitude: geoData.longitude,
      aproximado: !!geoData.aproximado,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('[geocode-servico-retry] Erro:', msg);
    return new Response(JSON.stringify({ error: msg, success: false }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
