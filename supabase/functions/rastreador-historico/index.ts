import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { rastreador_id, data_inicio, data_fim } = await req.json();

    if (!rastreador_id) {
      throw new Error('rastreador_id é obrigatório');
    }

    // Buscar rastreador com config da plataforma
    const { data: rastreador, error: rastError } = await supabase
      .from('rastreadores')
      .select(`
        *,
        config_plataforma:rastreadores_config_plataformas(*)
      `)
      .eq('id', rastreador_id)
      .single();

    if (rastError || !rastreador) {
      throw new Error('Rastreador não encontrado');
    }

    const plataforma = rastreador.config_plataforma;

    // Verificar suporte a histórico
    if (!plataforma?.suporta_historico_trajeto) {
      // Buscar do banco local
      let query = supabase
        .from('rastreador_posicoes')
        .select('*')
        .eq('rastreador_id', rastreador_id)
        .order('data_posicao', { ascending: true });

      if (data_inicio) {
        query = query.gte('data_posicao', data_inicio);
      }
      if (data_fim) {
        query = query.lte('data_posicao', data_fim);
      }

      const { data: historico } = await query.limit(1000);

      return new Response(
        JSON.stringify({
          success: true,
          fonte: 'local',
          mensagem: plataforma 
            ? `${plataforma.nome_exibicao} não suporta histórico via API. Exibindo dados locais.`
            : 'Plataforma não configurada. Exibindo dados locais.',
          trajeto: historico || [],
          total: historico?.length || 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter token via rastreador-auth
    const authResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/rastreador-auth`,
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ plataforma: plataforma.plataforma })
      }
    );
    
    const authData = await authResponse.json();
    if (!authData.success) {
      throw new Error('Falha na autenticação: ' + (authData.error || 'Token não obtido'));
    }

    const baseUrl = plataforma.ambiente_atual === 'producao' 
      ? plataforma.api_url_producao 
      : plataforma.api_url_sandbox;

    // Definir período (últimas 24h se não informado)
    const inicio = data_inicio || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const fim = data_fim || new Date().toISOString();

    // Buscar histórico Softruck
    const vehicleId = rastreador.plataforma_device_id || rastreador.id_plataforma;
    
    if (!vehicleId) {
      throw new Error('ID do veículo na plataforma não configurado');
    }

    const url = new URL(`${baseUrl}/vehicles/${vehicleId}/trajectories/`);
    url.searchParams.set('filters[start_date]', inicio);
    url.searchParams.set('filters[end_date]', fim);
    url.searchParams.set('limit', '500');

    console.log('Buscando trajeto Softruck:', url.toString());

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authData.token}`,
        'public-key': Deno.env.get('SOFTRUCK_PUBLIC_KEY') || '',
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro Softruck:', response.status, errorText);
      throw new Error(`Erro Softruck: ${response.status}`);
    }

    const data = await response.json();

    // Transformar dados
    const trajeto = (data.data || []).map((item: any) => ({
      latitude: item.attributes?.latitude || item.latitude,
      longitude: item.attributes?.longitude || item.longitude,
      velocidade: item.attributes?.speed || item.speed || 0,
      ignicao: item.attributes?.ignition ?? item.ignition ?? false,
      data_posicao: item.attributes?.timestamp || item.timestamp,
      endereco: item.attributes?.address || item.address,
    }));

    console.log(`Trajeto Softruck: ${trajeto.length} pontos`);

    return new Response(
      JSON.stringify({
        success: true,
        fonte: 'api',
        trajeto,
        periodo: { inicio, fim },
        total: trajeto.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro histórico:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
