import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Obtém token Softruck com suporte a retry
 */
async function getSoftruckToken(
  supabaseUrl: string,
  supabaseKey: string,
  forceRefresh = false
): Promise<string> {
  const authResponse = await fetch(
    `${supabaseUrl}/functions/v1/rastreador-auth`,
    {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ plataforma: 'softruck', force_refresh: forceRefresh })
    }
  );
  
  const authData = await authResponse.json();
  if (!authData.success) {
    throw new Error('Falha na autenticação: ' + (authData.error || 'Token não obtido'));
  }
  
  return authData.token;
}

/**
 * Busca trajeto Softruck com retry em erro 401
 */
async function buscarTrajetoSoftruckComRetry(
  supabaseUrl: string,
  supabaseKey: string,
  vehicleId: string,
  baseUrl: string,
  inicio: string,
  fim: string,
  maxRetries = 2
): Promise<any[]> {
  let tokenRenovado = false;
  const publicKey = Deno.env.get('SOFTRUCK_PUBLIC_KEY') || '';
  
  for (let tentativa = 1; tentativa <= maxRetries; tentativa++) {
    try {
      const token = await getSoftruckToken(supabaseUrl, supabaseKey, tokenRenovado);
      
      const url = new URL(`${baseUrl}/vehicles/${vehicleId}/trajectories/`);
      url.searchParams.set('filters[start_date]', inicio);
      url.searchParams.set('filters[end_date]', fim);
      url.searchParams.set('limit', '500');

      console.log(`[Softruck] Buscando trajeto (tentativa ${tentativa}/${maxRetries}):`, url.toString());

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'public-key': publicKey,
          'Content-Type': 'application/json',
        }
      });

      // Erro 401 - tentar renovar token
      if (response.status === 401) {
        console.warn(`[Softruck] Erro 401 na tentativa ${tentativa}/${maxRetries}`);
        
        if (tentativa < maxRetries) {
          console.log('[Softruck] Forçando renovação de token...');
          tokenRenovado = true;
          continue;
        }
        
        const errorText = await response.text();
        throw new Error(`Token inválido após ${maxRetries} tentativas: ${errorText}`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro Softruck:', response.status, errorText);
        throw new Error(`Erro Softruck: ${response.status}`);
      }

      const data = await response.json();
      return data.data || [];
      
    } catch (error) {
      if (tentativa === maxRetries) {
        throw error;
      }
      console.error(`[Softruck] Erro na tentativa ${tentativa}:`, error);
    }
  }
  
  return [];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    const baseUrl = plataforma.ambiente_atual === 'producao' 
      ? plataforma.api_url_producao 
      : plataforma.api_url_sandbox;

    // Definir período (últimas 24h se não informado)
    const inicio = data_inicio || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const fim = data_fim || new Date().toISOString();

    // Buscar histórico Softruck com retry
    const vehicleId = rastreador.plataforma_device_id || rastreador.id_plataforma;
    
    if (!vehicleId) {
      throw new Error('ID do veículo na plataforma não configurado');
    }

    const dadosTrajeto = await buscarTrajetoSoftruckComRetry(
      supabaseUrl,
      supabaseKey,
      vehicleId,
      baseUrl,
      inicio,
      fim
    );

    // Transformar dados
    const trajeto = dadosTrajeto.map((item: any) => ({
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
