import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PosicaoSoftruck {
  latitude: number;
  longitude: number;
  velocidade: number;
  direcao?: number;
  ignicao: boolean;
  data_posicao: string;
  endereco?: string;
  dados_extras?: Record<string, unknown>;
}

async function getPosicaoSoftruck(
  token: string,
  vehicleId: string,
  deviceId: string,
  baseUrl: string,
  publicKey: string
): Promise<PosicaoSoftruck> {
  const url = `${baseUrl}/vehicles/${vehicleId}/tracking/${deviceId}?format=JSON`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'public-key': publicKey,
      'Content-Type': 'application/json',
    }
  });

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

    // Verificar IDs necessários
    if (!rastreador.plataforma_veiculo_id || !rastreador.plataforma_device_id) {
      throw new Error('Rastreador não configurado com IDs da plataforma');
    }

    // Obter token via rastreador-auth
    const authResponse = await fetch(
      `${supabaseUrl}/functions/v1/rastreador-auth`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ plataforma: plataforma.codigo })
      }
    );

    const authData = await authResponse.json();
    if (!authData.success) {
      throw new Error('Falha na autenticação: ' + authData.error);
    }

    const baseUrl = plataforma.ambiente_atual === 'producao'
      ? plataforma.api_url_producao
      : plataforma.api_url_sandbox;

    const publicKey = Deno.env.get('SOFTRUCK_PUBLIC_KEY') || '';

    // Buscar posição
    const posicao = await getPosicaoSoftruck(
      authData.token,
      rastreador.plataforma_veiculo_id,
      rastreador.plataforma_device_id,
      baseUrl,
      publicKey
    );

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
        plataforma: plataforma.codigo,
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
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
