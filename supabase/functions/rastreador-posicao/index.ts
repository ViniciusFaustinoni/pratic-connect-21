import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PosicaoResponse {
  latitude: number;
  longitude: number;
  velocidade: number;
  direcao?: number;
  ignicao: boolean;
  data_posicao: string;
  endereco?: string;
  dados_extras?: Record<string, unknown>;
}

/**
 * Obtém token Softruck com suporte a retry em caso de erro 401
 */
async function getSoftruckTokenComRetry(
  supabaseUrl: string,
  supabaseKey: string,
  forceRefresh = false
): Promise<{ token: string; publicKey: string }> {
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
    throw new Error('Falha na autenticação: ' + authData.error);
  }

  return {
    token: authData.token,
    publicKey: Deno.env.get('SOFTRUCK_PUBLIC_KEY') || '',
  };
}

/**
 * Busca posição do rastreador na Softruck com retry em erro 401
 */
async function getPosicaoSoftruckComRetry(
  supabaseUrl: string,
  supabaseKey: string,
  vehicleId: string,
  deviceId: string,
  baseUrl: string,
  maxRetries = 2
): Promise<PosicaoResponse> {
  let tokenRenovado = false;
  
  for (let tentativa = 1; tentativa <= maxRetries; tentativa++) {
    try {
      const { token, publicKey } = await getSoftruckTokenComRetry(
        supabaseUrl, 
        supabaseKey, 
        tokenRenovado // força refresh se já teve erro 401
      );

      const url = `${baseUrl}/vehicles/${vehicleId}/tracking/${deviceId}?format=JSON`;
      
      console.log(`[Softruck] Buscando posição (tentativa ${tentativa}/${maxRetries})`);

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
        const error = await response.text();
        throw new Error(`Erro Softruck ${response.status}: ${error}`);
      }

      const data = await response.json();

      if (!data.data?.attributes) {
        throw new Error('Resposta Softruck inválida');
      }

      const attrs = data.data.attributes;

      return {
        latitude: attrs.latitude,
        longitude: attrs.longitude,
        velocidade: attrs.speed || 0,
        direcao: attrs.course,
        ignicao: attrs.ignition || false,
        data_posicao: attrs.timestamp || new Date().toISOString(),
        endereco: attrs.address,
        dados_extras: {
          altitude: attrs.altitude,
          satellites: attrs.satellites,
          odometer: attrs.odometer,
          battery: attrs.battery,
        }
      };

    } catch (error) {
      if (tentativa === maxRetries) {
        throw error;
      }
      console.error(`[Softruck] Erro na tentativa ${tentativa}:`, error);
    }
  }

  throw new Error('Erro inesperado ao buscar posição');
}

/**
 * Busca posição do rastreador na Rede Veículos
 */
async function getPosicaoRedeVeiculos(
  token: string,
  codigo: string,
  baseUrl: string
): Promise<PosicaoResponse> {
  console.log(`[Rede Veículos] Buscando posição para código: ${codigo}`);
  
  const url = `${baseUrl}/veiculos/${codigo}/posicao`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro Rede Veículos ${response.status}: ${error}`);
  }

  const data = await response.json();
  
  // Formato esperado da Rede Veículos
  // { latitude, longitude, velocidade, ignicao, data_hora, ... }
  if (!data.latitude || !data.longitude) {
    throw new Error('Resposta Rede Veículos inválida - coordenadas ausentes');
  }

  return {
    latitude: data.latitude,
    longitude: data.longitude,
    velocidade: data.velocidade || 0,
    direcao: data.direcao,
    ignicao: data.ignicao ?? false,
    data_posicao: data.data_hora || data.dataHora || new Date().toISOString(),
    endereco: data.endereco,
    dados_extras: {
      odometro: data.odometro,
      bateria: data.bateria,
      tensao: data.tensao,
    }
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { rastreador_id } = await req.json();

    if (!rastreador_id) {
      throw new Error('rastreador_id é obrigatório');
    }

    // Buscar rastreador com plataforma
    const { data: rastreador, error: rastError } = await supabase
      .from('rastreadores')
      .select(`
        *,
        plataforma:rastreadores_config_plataformas(*),
        veiculo:veiculos(id, placa, modelo, marca)
      `)
      .eq('id', rastreador_id)
      .single();

    if (rastError || !rastreador) {
      throw new Error('Rastreador não encontrado');
    }

    const plataforma = rastreador.plataforma;

    if (!plataforma) {
      throw new Error('Plataforma não configurada para este rastreador');
    }

    // Verificar se plataforma suporta posição tempo real
    if (!plataforma.suporta_posicao_tempo_real) {
      return new Response(
        JSON.stringify({
          success: true,
          tempo_real: false,
          mensagem: `${plataforma.nome} não suporta posição em tempo real`,
          posicao: rastreador.ultima_posicao_lat ? {
            latitude: rastreador.ultima_posicao_lat,
            longitude: rastreador.ultima_posicao_lng,
            velocidade: rastreador.ultima_velocidade || 0,
            ignicao: rastreador.ultima_ignicao || false,
            data_posicao: rastreador.ultima_comunicacao,
            endereco: null,
          } : null,
          veiculo: rastreador.veiculo,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fallback: usa id_plataforma se campos específicos estiverem vazios
    const vehicleId = rastreador.plataforma_veiculo_id || rastreador.id_plataforma;
    const deviceId = rastreador.plataforma_device_id || rastreador.id_plataforma;

    const baseUrl = plataforma.ambiente_atual === 'producao'
      ? plataforma.api_url_producao
      : plataforma.api_url_sandbox;

    let posicao: PosicaoResponse;

    // Roteamento por plataforma
    const plataformaCodigo = plataforma.codigo || plataforma.plataforma;
    
    if (plataformaCodigo === 'softruck') {
      if (!vehicleId || !deviceId) {
        throw new Error('Rastreador não configurado com IDs da plataforma');
      }
      
      console.log(`[Softruck] Usando vehicleId=${vehicleId}, deviceId=${deviceId}`);
      
      posicao = await getPosicaoSoftruckComRetry(
        supabaseUrl,
        supabaseKey,
        vehicleId,
        deviceId,
        baseUrl
      );
    } else if (plataformaCodigo === 'rede_veiculos') {
      const redeToken = Deno.env.get('REDE_VEICULOS_TOKEN');
      
      if (!redeToken) {
        throw new Error('Token Rede Veículos não configurado');
      }
      
      const codigo = rastreador.codigo || rastreador.id_plataforma;
      
      if (!codigo) {
        throw new Error('Código do veículo não configurado para Rede Veículos');
      }
      
      console.log(`[Rede Veículos] Usando código=${codigo}`);
      
      posicao = await getPosicaoRedeVeiculos(redeToken, codigo, baseUrl);
    } else {
      throw new Error(`Plataforma ${plataformaCodigo} não suportada`);
    }

    // Atualizar rastreador
    await supabase
      .from('rastreadores')
      .update({
        ultima_posicao_lat: posicao.latitude,
        ultima_posicao_lng: posicao.longitude,
        ultima_velocidade: posicao.velocidade,
        ultima_ignicao: posicao.ignicao,
        ultima_comunicacao: posicao.data_posicao,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rastreador_id);

    // Salvar no histórico
    await supabase
      .from('rastreador_posicoes')
      .insert({
        rastreador_id,
        latitude: posicao.latitude,
        longitude: posicao.longitude,
        velocidade: posicao.velocidade,
        direcao: posicao.direcao,
        ignicao: posicao.ignicao,
        data_posicao: posicao.data_posicao,
        endereco: posicao.endereco,
        dados_extras: posicao.dados_extras,
      });

    // Log
    const tempoMs = Date.now() - startTime;
    await supabase
      .from('rastreadores_logs')
      .insert({
        rastreador_id,
        plataforma: plataformaCodigo,
        operacao: 'posicao_tempo_real',
        status: 'sucesso',
        tempo_ms: tempoMs,
      });

    return new Response(
      JSON.stringify({
        success: true,
        tempo_real: true,
        posicao,
        veiculo: rastreador.veiculo,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro posição:', error);
    
    // Log de erro
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      
      await supabase
        .from('rastreadores_logs')
        .insert({
          plataforma: 'unknown',
          operacao: 'posicao_tempo_real',
          status: 'erro',
          erro_mensagem: error instanceof Error ? error.message : 'Erro desconhecido',
          tempo_ms: Date.now() - startTime,
        });
    } catch (logError) {
      console.error('Falha ao registrar log:', logError);
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
