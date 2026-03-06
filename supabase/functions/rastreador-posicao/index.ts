import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCredenciaisSoftruck, getCredenciaisRedeVeiculos } from '../_shared/credenciais-hibridas.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
// deno-lint-ignore no-explicit-any
async function getSoftruckTokenComRetry(
  supabase: any,
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

  // Buscar public_key das credenciais híbridas
  const credenciais = await getCredenciaisSoftruck(supabase);
  const publicKey = credenciais?.public_key || '';

  return {
    token: authData.token,
    publicKey,
  };
}

/**
 * Busca posição do rastreador na Softruck com retry em erro 401
 */
// Função de delay para retry
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// deno-lint-ignore no-explicit-any
async function getPosicaoSoftruckComRetry(
  supabase: any,
  supabaseUrl: string,
  supabaseKey: string,
  vehicleId: string,
  deviceId: string,
  baseUrl: string,
  maxRetries = 3 // Aumentado para 3 tentativas
): Promise<PosicaoResponse> {
  let tokenRenovado = false;
  let lastError: Error | null = null;
  
  for (let tentativa = 1; tentativa <= maxRetries; tentativa++) {
    try {
      const { token, publicKey } = await getSoftruckTokenComRetry(
        supabase,
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
        await response.text(); // Consumir body
        
        if (tentativa < maxRetries) {
          console.log('[Softruck] Forçando renovação de token...');
          tokenRenovado = true;
          await delay(500); // Pequeno delay antes de retry
          continue;
        }
        
        throw new Error(`Token inválido após ${maxRetries} tentativas`);
      }

      // Erro 503 - serviço temporariamente indisponível, tentar novamente
      if (response.status === 503 || response.status === 502 || response.status === 504) {
        const errorText = await response.text();
        console.warn(`[Softruck] Erro ${response.status} na tentativa ${tentativa}/${maxRetries}: API temporariamente indisponível`);
        lastError = new Error(`API Softruck temporariamente indisponível (${response.status})`);
        
        if (tentativa < maxRetries) {
          const delayMs = tentativa * 1000; // Backoff: 1s, 2s, 3s
          console.log(`[Softruck] Aguardando ${delayMs}ms antes de nova tentativa...`);
          await delay(delayMs);
          continue;
        }
        
        throw lastError;
      }

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Erro Softruck ${response.status}: ${error}`);
      }

      const data = await response.json();

      // Formato API v2 Softruck:
      // A resposta pode vir como:
      // - data.data (objeto GeoJSON Feature) com geometry no nível raiz, OU
      // - data.data.attributes.geometry (geometry dentro de attributes)
      // - data.data.attributes contém: ign, spd, act, dir, bl, geometry, etc.
      const gpsData = data.data || data;
      if (!gpsData) {
        throw new Error('Resposta Softruck inválida');
      }

      console.log('[Softruck] Resposta recebida:', JSON.stringify(gpsData).slice(0, 400));

      const attrs = gpsData.attributes || gpsData || {};

      // Extrair coordenadas - pode estar em diferentes locais
      let latitude: number | null = null;
      let longitude: number | null = null;

      // Opção 1: geometry no nível raiz do gpsData
      if (gpsData.geometry?.coordinates) {
        longitude = parseFloat(gpsData.geometry.coordinates[0]);
        latitude = parseFloat(gpsData.geometry.coordinates[1]);
      }
      // Opção 2: geometry dentro de attributes (formato observado nos logs)
      else if (attrs.geometry?.coordinates) {
        longitude = parseFloat(attrs.geometry.coordinates[0]);
        latitude = parseFloat(attrs.geometry.coordinates[1]);
      }
      // Opção 3: lat/lng direto nos attributes
      else if (attrs.latitude && attrs.longitude) {
        latitude = parseFloat(attrs.latitude);
        longitude = parseFloat(attrs.longitude);
      }

      if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
        console.error('[Softruck] Resposta sem coordenadas válidas:', JSON.stringify(gpsData).slice(0, 500));
        throw new Error('Coordenadas não encontradas na resposta Softruck');
      }

      console.log(`[Softruck] Coordenadas extraídas: lat=${latitude}, lng=${longitude}`);

      // Converter timestamp Unix para ISO se necessário
      const actTimestamp = attrs.act;
      const dataPosicao = actTimestamp 
        ? new Date(actTimestamp * 1000).toISOString() 
        : (attrs.timestamp || new Date().toISOString());

      return {
        latitude,
        longitude,
        velocidade: parseInt(attrs.spd || attrs.speed || '0', 10),
        direcao: attrs.dir || attrs.course,
        ignicao: Boolean(attrs.ign || attrs.ignition),
        data_posicao: dataPosicao,
        endereco: attrs.address,
        dados_extras: {
          altitude: attrs.altitude,
          satellites: attrs.satellites,
          odometer: attrs.odometer,
          battery: attrs.bl || attrs.battery,
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
 * Usa o endpoint POST /obterUltimaPosicaoValida/ conforme documentação
 */
async function getPosicaoRedeVeiculos(
  token: string,
  imei: string,
  placa: string,
  cpfCnpj: string,
  baseUrl: string
): Promise<PosicaoResponse> {
  console.log(`[Rede Veículos] Buscando posição: imei=${imei}, placa=${placa}, cpfCnpj=${cpfCnpj?.slice(0, 4)}***`);
  
  const url = `${baseUrl}/obterUltimaPosicaoValida/`;
  
  const payload = JSON.stringify({
    chassi: "",
    placa: placa || "",
    imei: imei || "",
    cpfCnpjCliente: cpfCnpj || ""
  });
  
  console.log(`[Rede Veículos] POST ${url} payload=${payload}`);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `json=${encodeURIComponent(payload)}`
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro Rede Veículos ${response.status}: ${error}`);
  }

  const data = await response.json();
  
  console.log(`[Rede Veículos] Resposta:`, JSON.stringify(data).slice(0, 300));
  
  // Verificar se tem coordenadas válidas
  if (!data.latitude || !data.longitude) {
    throw new Error('Resposta Rede Veículos inválida - coordenadas ausentes');
  }

  return {
    latitude: parseFloat(data.latitude),
    longitude: parseFloat(data.longitude),
    velocidade: parseInt(data.velocidade || '0', 10),
    direcao: data.direcao ? parseInt(data.direcao, 10) : undefined,
    ignicao: data.ignicaoLigada === 'S',
    data_posicao: data.dataGPRS || data.dataGPS || new Date().toISOString(),
    endereco: data.endereco,
    dados_extras: {
      voltagemBateria: data.voltagemBateria,
      movimento: data.movimento,
      bloqueado: data.bloqueado,
      statusGPRS: data.statusGPRS,
      statusGPS: data.statusGPS,
      imei: data.imei,
      placa: data.placa,
      chassi: data.chassi,
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

    // Buscar rastreador com veículo e associado
    const { data: rastreador, error: rastError } = await supabase
      .from('rastreadores')
      .select(`
        *,
        veiculo:veiculos(
          id, placa, modelo, marca, chassi,
          associado:associados(cpf)
        )
      `)
      .eq('id', rastreador_id)
      .single();

    if (rastError || !rastreador) {
      console.error('[rastreador-posicao] Erro ao buscar rastreador:', rastError);
      throw new Error('Rastreador não encontrado');
    }

    const plataformaCodigo = rastreador.plataforma;

    if (!plataformaCodigo) {
      throw new Error('Plataforma não configurada para este rastreador');
    }

    // Buscar configuração da plataforma
    const { data: plataforma, error: platError } = await supabase
      .from('rastreadores_config_plataformas')
      .select('*')
      .eq('plataforma', plataformaCodigo)
      .single();

    if (platError || !plataforma) {
      console.error('[rastreador-posicao] Plataforma não encontrada:', plataformaCodigo, platError);
      throw new Error(`Configuração da plataforma ${plataformaCodigo} não encontrada`);
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
    if (plataformaCodigo === 'softruck') {
      if (!vehicleId || !deviceId) {
        throw new Error('Rastreador não configurado com IDs da plataforma');
      }
      
      console.log(`[Softruck] Usando vehicleId=${vehicleId}, deviceId=${deviceId}`);
      
      posicao = await getPosicaoSoftruckComRetry(
        supabase,
        supabaseUrl,
        supabaseKey,
        vehicleId,
        deviceId,
        baseUrl
      );
    } else if (plataformaCodigo === 'rede_veiculos') {
      // Buscar credenciais híbridas
      const credenciais = await getCredenciaisRedeVeiculos(supabase);
      
      if (!credenciais) {
        throw new Error('Token Rede Veículos não configurado');
      }
      
      // Obter dados necessários para a API (associados só tem CPF)
      const imei = rastreador.imei || rastreador.codigo || '';
      const placa = rastreador.veiculo?.placa || '';
      const cpfCnpj = rastreador.veiculo?.associado?.cpf || '';
      
      if (!imei && !placa) {
        throw new Error('IMEI ou Placa do veículo não configurados para Rede Veículos');
      }
      
      if (!cpfCnpj) {
        throw new Error('CPF/CNPJ do associado não encontrado para Rede Veículos');
      }
      
      console.log(`[Rede Veículos] Usando imei=${imei}, placa=${placa}`);
      
      posicao = await getPosicaoRedeVeiculos(credenciais.bearer_token, imei, placa, cpfCnpj, baseUrl);
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
