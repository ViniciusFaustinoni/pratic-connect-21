import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TrajetoPonto {
  latitude: number;
  longitude: number;
  velocidade: number;
  ignicao: boolean;
  data_posicao: string;
  endereco?: string;
}

interface PontoParada {
  latitude: number;
  longitude: number;
  inicio: string;
  fim: string;
  duracao_minutos: number;
  endereco?: string;
}

/**
 * Identifica pontos de parada no trajeto (velocidade = 0 por mais de 5 minutos)
 */
function identificarParadas(pontos: TrajetoPonto[]): PontoParada[] {
  const paradas: PontoParada[] = [];
  let inicioParada: number | null = null;
  
  for (let i = 0; i < pontos.length; i++) {
    const ponto = pontos[i];
    const estaParado = ponto.velocidade === 0 && !ponto.ignicao;
    
    if (estaParado && inicioParada === null) {
      inicioParada = i;
    } else if (!estaParado && inicioParada !== null) {
      const pontoInicio = pontos[inicioParada];
      const pontoFim = pontos[i - 1];
      const duracao = (new Date(pontoFim.data_posicao).getTime() - 
                       new Date(pontoInicio.data_posicao).getTime()) / 60000;
      
      // Só considera paradas maiores que 5 minutos
      if (duracao >= 5) {
        paradas.push({
          latitude: pontoInicio.latitude,
          longitude: pontoInicio.longitude,
          inicio: pontoInicio.data_posicao,
          fim: pontoFim.data_posicao,
          duracao_minutos: Math.round(duracao),
          endereco: pontoInicio.endereco,
        });
      }
      inicioParada = null;
    }
  }
  
  // Verificar se terminou em uma parada
  if (inicioParada !== null && pontos.length > 0) {
    const pontoInicio = pontos[inicioParada];
    const pontoFim = pontos[pontos.length - 1];
    const duracao = (new Date(pontoFim.data_posicao).getTime() - 
                     new Date(pontoInicio.data_posicao).getTime()) / 60000;
    
    if (duracao >= 5) {
      paradas.push({
        latitude: pontoInicio.latitude,
        longitude: pontoInicio.longitude,
        inicio: pontoInicio.data_posicao,
        fim: pontoFim.data_posicao,
        duracao_minutos: Math.round(duracao),
        endereco: pontoInicio.endereco,
      });
    }
  }
  
  return paradas;
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
      
      const queryParams = [
        `filters[from]=${encodeURIComponent(inicio)}`,
        `filters[to]=${encodeURIComponent(fim)}`,
        `filters[acc]=all`,
        `limit=100`,
      ].join('&');

      const url = `${baseUrl}/vehicles/${vehicleId}/trajectories/?${queryParams}`;

      console.log(`[Softruck] Buscando trajeto (tentativa ${tentativa}/${maxRetries}):`, url);

      const response = await fetch(url, {
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

    // Buscar rastreador
    const { data: rastreador, error: rastError } = await supabase
      .from('rastreadores')
      .select('*')
      .eq('id', rastreador_id)
      .single();

    if (rastError || !rastreador) {
      console.error('Erro ao buscar rastreador:', rastError);
      throw new Error('Rastreador não encontrado');
    }

    // Buscar config da plataforma separadamente
    const { data: plataforma } = await supabase
      .from('rastreadores_config_plataformas')
      .select('*')
      .eq('plataforma', rastreador.plataforma)
      .maybeSingle();

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

      // Transformar dados locais para formato padrão
      const trajeto: TrajetoPonto[] = (historico || []).map((p: any) => ({
        latitude: Number(p.latitude),
        longitude: Number(p.longitude),
        velocidade: p.velocidade || 0,
        ignicao: p.ignicao || false,
        data_posicao: p.data_posicao,
        endereco: p.endereco,
      }));

      // Identificar paradas mesmo em dados locais
      const paradas = identificarParadas(trajeto);

      return new Response(
        JSON.stringify({
          success: true,
          fonte: 'local',
          mensagem: plataforma 
            ? `${plataforma.nome_exibicao} não suporta histórico via API. Exibindo dados locais.`
            : 'Plataforma não configurada. Exibindo dados locais.',
          trajeto,
          paradas,
          total: trajeto.length,
          total_paradas: paradas.length,
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

    // Buscar histórico Softruck com retry - usar fallback para id_plataforma
    const vehicleId = rastreador.plataforma_veiculo_id || rastreador.plataforma_device_id || rastreador.id_plataforma;
    
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
    const trajeto: TrajetoPonto[] = dadosTrajeto.map((item: any) => ({
      latitude: item.attributes?.latitude || item.latitude,
      longitude: item.attributes?.longitude || item.longitude,
      velocidade: item.attributes?.speed || item.speed || 0,
      ignicao: item.attributes?.ignition ?? item.ignition ?? false,
      data_posicao: item.attributes?.timestamp || item.timestamp,
      endereco: item.attributes?.address || item.address,
    }));

    // Identificar paradas
    const paradas = identificarParadas(trajeto);

    console.log(`Trajeto Softruck: ${trajeto.length} pontos, ${paradas.length} paradas`);

    return new Response(
      JSON.stringify({
        success: true,
        fonte: 'api',
        trajeto,
        paradas,
        periodo: { inicio, fim },
        total: trajeto.length,
        total_paradas: paradas.length,
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