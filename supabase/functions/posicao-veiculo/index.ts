import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PosicaoPadrao {
  latitude: number;
  longitude: number;
  velocidade: number;
  direcao?: number;
  ignicao: boolean;
  data_posicao: string;
  dados_extras?: Record<string, unknown>;
}

interface PosicaoResponse {
  success: boolean;
  plataforma: 'softruck' | 'rede_veiculos';
  tempo_real: boolean;
  offline: boolean;
  mensagem?: string;
  posicao: {
    latitude: number;
    longitude: number;
    data_hora: string;
    velocidade: number;
    ignicao: boolean;
    direcao?: number;
    endereco_aproximado: string | null;
    status_rastreador: 'online' | 'offline' | 'atencao';
    bateria_percentual?: number;
    odometro?: number;
    sinal_gsm?: number;
  } | null;
  veiculo: {
    id: string;
    placa: string;
    modelo: string;
    marca: string;
  } | null;
  rastreador: {
    id: string;
    codigo: string;
  } | null;
}

// Calcular status baseado na última comunicação
function calcularStatusRastreador(ultimaComunicacao: string | null): 'online' | 'offline' | 'atencao' {
  if (!ultimaComunicacao) return 'offline';
  
  const agora = new Date();
  const ultima = new Date(ultimaComunicacao);
  const diffMinutos = (agora.getTime() - ultima.getTime()) / 60000;
  
  if (diffMinutos < 10) return 'online';
  if (diffMinutos < 60) return 'atencao';
  return 'offline';
}

// Reverse geocoding com Nominatim
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    
    const response = await fetch(url, {
      headers: { 
        'User-Agent': 'PraticConnect/1.0',
        'Accept-Language': 'pt-BR,pt;q=0.9'
      }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    const addr = data.address || {};
    const partes = [
      addr.road || addr.street,
      addr.house_number,
      addr.suburb || addr.neighbourhood,
      addr.city || addr.town || addr.municipality,
      addr.state
    ].filter(Boolean);
    
    return partes.join(', ') || data.display_name || null;
  } catch (error) {
    console.error('[Geocode] Erro reverse:', error);
    return null;
  }
}

// Buscar posição Softruck com retry em erro 401
async function getPosicaoSoftruckComRetry(
  supabaseUrl: string,
  supabaseKey: string,
  vehicleId: string,
  deviceId: string,
  baseUrl: string,
  publicKey: string,
  maxRetries = 2
): Promise<PosicaoPadrao> {
  let tokenRenovado = false;
  
  for (let tentativa = 1; tentativa <= maxRetries; tentativa++) {
    try {
      // Obter token (força refresh se já teve erro 401)
      const authResponse = await fetch(
        `${supabaseUrl}/functions/v1/rastreador-auth`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ plataforma: 'softruck', force_refresh: tokenRenovado })
        }
      );

      const authData = await authResponse.json();
      if (!authData.success) {
        throw new Error('Falha na autenticação Softruck: ' + authData.error);
      }

      const token = authData.token;
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

// Buscar posição Rede Veículos
async function getPosicaoRedeVeiculos(
  token: string,
  codigoRastreador: string,
  baseUrl: string
): Promise<PosicaoPadrao> {
  const url = `${baseUrl}/veiculos/${codigoRastreador}/posicao`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro Rede Veículos ${response.status}: ${error}`);
  }

  const data = await response.json();

  // Mapear resposta para formato padronizado
  return {
    latitude: parseFloat(data.latitude || data.lat || 0),
    longitude: parseFloat(data.longitude || data.lng || data.lon || 0),
    velocidade: parseInt(data.velocidade || data.speed || 0),
    direcao: data.direcao || data.heading || data.curso,
    ignicao: Boolean(data.ignicao || data.ignition || data.ign),
    data_posicao: data.data_hora || data.timestamp || new Date().toISOString(),
    dados_extras: {
      odometer: data.odometro || data.hodometro,
      battery: data.bateria || data.battery,
      gsm: data.sinal || data.gsm,
      altitude: data.altitude,
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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Cliente admin para operações de banco
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
    
    // Cliente para validar JWT do usuário
    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

    // Validar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autenticado');
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Token inválido');
    }

    const { veiculo_id } = await req.json();

    if (!veiculo_id) {
      throw new Error('veiculo_id é obrigatório');
    }

    // Buscar associado do usuário
    const { data: associado, error: assocError } = await supabaseAdmin
      .from('associados')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (assocError || !associado) {
      throw new Error('Associado não encontrado');
    }

    // Verificar se o veículo pertence ao associado
    const { data: veiculo, error: veicError } = await supabaseAdmin
      .from('veiculos')
      .select('id, placa, modelo, marca, associado_id')
      .eq('id', veiculo_id)
      .single();

    if (veicError || !veiculo) {
      throw new Error('Veículo não encontrado');
    }

    if (veiculo.associado_id !== associado.id) {
      throw new Error('Veículo não pertence ao associado');
    }

    // Buscar rastreador do veículo com plataforma
    const { data: rastreador, error: rastError } = await supabaseAdmin
      .from('rastreadores')
      .select(`
        *,
        plataforma:rastreadores_config_plataformas(*)
      `)
      .eq('veiculo_id', veiculo_id)
      .single();

    if (rastError || !rastreador) {
      return new Response(
        JSON.stringify({
          success: true,
          tempo_real: false,
          offline: true,
          mensagem: 'Rastreador não encontrado para este veículo',
          posicao: null,
          veiculo: {
            id: veiculo.id,
            placa: veiculo.placa,
            modelo: veiculo.modelo || '',
            marca: veiculo.marca || '',
          },
          rastreador: null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const plataforma = rastreador.plataforma;
    const plataformaCodigo = plataforma?.codigo || rastreador.plataforma_id || 'softruck';

    // Verificar se tem última posição conhecida para fallback
    const ultimaPosicaoConhecida = rastreador.ultima_posicao_lat && rastreador.ultima_posicao_lng
      ? {
          latitude: rastreador.ultima_posicao_lat,
          longitude: rastreador.ultima_posicao_lng,
          data_hora: rastreador.ultima_comunicacao,
          velocidade: rastreador.ultima_velocidade || 0,
          ignicao: rastreador.ultima_ignicao || false,
          direcao: undefined,
          endereco_aproximado: null,
          status_rastreador: calcularStatusRastreador(rastreador.ultima_comunicacao),
        }
      : null;

    // Verificar se plataforma suporta tempo real
    if (plataforma && !plataforma.suporta_posicao_tempo_real) {
      const endereco = ultimaPosicaoConhecida
        ? await reverseGeocode(ultimaPosicaoConhecida.latitude, ultimaPosicaoConhecida.longitude)
        : null;

      return new Response(
        JSON.stringify({
          success: true,
          plataforma: plataformaCodigo,
          tempo_real: false,
          offline: false,
          mensagem: `${plataforma.nome} não suporta posição em tempo real`,
          posicao: ultimaPosicaoConhecida 
            ? { ...ultimaPosicaoConhecida, endereco_aproximado: endereco }
            : null,
          veiculo: {
            id: veiculo.id,
            placa: veiculo.placa,
            modelo: veiculo.modelo || '',
            marca: veiculo.marca || '',
          },
          rastreador: {
            id: rastreador.id,
            codigo: rastreador.codigo,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let posicao: PosicaoPadrao | null = null;

    try {
      if (plataformaCodigo === 'rede_veiculos') {
        // Rede Veículos
        const redeToken = Deno.env.get('REDE_VEICULOS_TOKEN');
        if (!redeToken) {
          throw new Error('Token Rede Veículos não configurado');
        }

        const baseUrl = plataforma?.ambiente_atual === 'producao'
          ? (plataforma?.api_url_producao || 'https://api.redesimples.com.br/api/v2')
          : (plataforma?.api_url_sandbox || 'https://sandbox.redesimples.com.br/api/v2');

        posicao = await getPosicaoRedeVeiculos(
          redeToken,
          rastreador.codigo,
          baseUrl
        );
      } else {
        // Softruck (padrão) - com retry automático em erro 401
        // Fallback: usa id_plataforma se campos específicos estiverem vazios
        const vehicleId = rastreador.plataforma_veiculo_id || rastreador.id_plataforma;
        const deviceId = rastreador.plataforma_device_id || rastreador.id_plataforma;

        if (!vehicleId || !deviceId) {
          throw new Error('Rastreador não configurado com IDs da plataforma');
        }

        console.log(`[Softruck] Usando vehicleId=${vehicleId}, deviceId=${deviceId}`);

        const baseUrl = plataforma?.ambiente_atual === 'producao'
          ? (plataforma?.api_url_producao || 'https://api.softruck.com.br')
          : (plataforma?.api_url_sandbox || 'https://sandbox.softruck.com.br');

        const publicKey = Deno.env.get('SOFTRUCK_PUBLIC_KEY') || '';

        posicao = await getPosicaoSoftruckComRetry(
          supabaseUrl,
          supabaseKey,
          vehicleId,
          deviceId,
          baseUrl,
          publicKey
        );
      }

    } catch (apiError) {
      console.error('[posicao-veiculo] Erro API plataforma:', apiError);
      
      // Fallback para última posição conhecida
      if (ultimaPosicaoConhecida) {
        const endereco = await reverseGeocode(
          ultimaPosicaoConhecida.latitude,
          ultimaPosicaoConhecida.longitude
        );

        return new Response(
          JSON.stringify({
            success: true,
            plataforma: plataformaCodigo,
            tempo_real: false,
            offline: true,
            mensagem: 'Rastreador offline. Exibindo última posição conhecida.',
            posicao: { ...ultimaPosicaoConhecida, endereco_aproximado: endereco },
            veiculo: {
              id: veiculo.id,
              placa: veiculo.placa,
              modelo: veiculo.modelo || '',
              marca: veiculo.marca || '',
            },
            rastreador: {
              id: rastreador.id,
              codigo: rastreador.codigo,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw apiError;
    }

    // Reverse geocoding
    const endereco = await reverseGeocode(posicao.latitude, posicao.longitude);

    // Atualizar rastreador no banco
    await supabaseAdmin
      .from('rastreadores')
      .update({
        ultima_posicao_lat: posicao.latitude,
        ultima_posicao_lng: posicao.longitude,
        ultima_velocidade: posicao.velocidade,
        ultima_ignicao: posicao.ignicao,
        ultima_comunicacao: posicao.data_posicao,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rastreador.id);

    // Salvar no histórico
    await supabaseAdmin
      .from('rastreador_posicoes')
      .insert({
        rastreador_id: rastreador.id,
        latitude: posicao.latitude,
        longitude: posicao.longitude,
        velocidade: posicao.velocidade,
        direcao: posicao.direcao,
        ignicao: posicao.ignicao,
        data_posicao: posicao.data_posicao,
        endereco: endereco,
        dados_extras: posicao.dados_extras,
      });

    // Log de sucesso
    const tempoMs = Date.now() - startTime;
    await supabaseAdmin
      .from('rastreadores_logs')
      .insert({
        rastreador_id: rastreador.id,
        plataforma: plataformaCodigo,
        operacao: 'posicao_app_associado',
        status: 'sucesso',
        tempo_ms: tempoMs,
      });

    const statusRastreador = calcularStatusRastreador(posicao.data_posicao);

    return new Response(
      JSON.stringify({
        success: true,
        plataforma: plataformaCodigo,
        tempo_real: true,
        offline: statusRastreador === 'offline',
        posicao: {
          latitude: posicao.latitude,
          longitude: posicao.longitude,
          data_hora: posicao.data_posicao,
          velocidade: posicao.velocidade,
          ignicao: posicao.ignicao,
          direcao: posicao.direcao,
          endereco_aproximado: endereco,
          status_rastreador: statusRastreador,
          bateria_percentual: posicao.dados_extras?.battery as number | undefined,
          odometro: posicao.dados_extras?.odometer as number | undefined,
          sinal_gsm: posicao.dados_extras?.gsm as number | undefined,
        },
        veiculo: {
          id: veiculo.id,
          placa: veiculo.placa,
          modelo: veiculo.modelo || '',
          marca: veiculo.marca || '',
        },
        rastreador: {
          id: rastreador.id,
          codigo: rastreador.codigo,
        },
      } as PosicaoResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[posicao-veiculo] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
