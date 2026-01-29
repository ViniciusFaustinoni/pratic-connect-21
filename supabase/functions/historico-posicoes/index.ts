import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PontoPosicao {
  latitude: number;
  longitude: number;
  velocidade: number;
  ignicao: boolean;
  data_hora: string;
  endereco?: string;
  direcao?: number;
}

interface PontoParada {
  latitude: number;
  longitude: number;
  inicio: string;
  fim: string;
  duracao_minutos: number;
  endereco?: string;
}

interface Resumo {
  distancia_total_km: number;
  tempo_movimento_minutos: number;
  tempo_parado_minutos: number;
  velocidade_media_kmh: number;
  velocidade_maxima_kmh: number;
  total_pontos: number;
  total_paradas: number;
  periodo: {
    inicio: string;
    fim: string;
  };
}

// Fórmula Haversine para calcular distância
function calcularDistanciaHaversine(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371; // Raio da Terra em km
  const toRad = (deg: number) => deg * (Math.PI / 180);
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Calcular resumo do trajeto
function calcularResumo(pontos: PontoPosicao[]): Resumo {
  if (pontos.length === 0) {
    return {
      distancia_total_km: 0,
      tempo_movimento_minutos: 0,
      tempo_parado_minutos: 0,
      velocidade_media_kmh: 0,
      velocidade_maxima_kmh: 0,
      total_pontos: 0,
      total_paradas: 0,
      periodo: { inicio: '', fim: '' },
    };
  }

  let distanciaTotal = 0;
  let tempoMovimento = 0;
  let tempoParado = 0;
  let velocidadeMaxima = 0;
  let somaVelocidades = 0;
  let pontosComVelocidade = 0;

  for (let i = 1; i < pontos.length; i++) {
    const anterior = pontos[i - 1];
    const atual = pontos[i];

    // Distância Haversine
    distanciaTotal += calcularDistanciaHaversine(
      anterior.latitude, anterior.longitude,
      atual.latitude, atual.longitude
    );

    // Tempo entre pontos
    const diffMs = new Date(atual.data_hora).getTime() - new Date(anterior.data_hora).getTime();
    const diffMin = diffMs / 60000;

    if (anterior.velocidade > 0 || anterior.ignicao) {
      tempoMovimento += diffMin;
    } else {
      tempoParado += diffMin;
    }

    // Velocidades
    if (atual.velocidade > 0) {
      somaVelocidades += atual.velocidade;
      pontosComVelocidade++;
    }
    if (atual.velocidade > velocidadeMaxima) {
      velocidadeMaxima = atual.velocidade;
    }
  }

  return {
    distancia_total_km: Math.round(distanciaTotal * 10) / 10,
    tempo_movimento_minutos: Math.round(tempoMovimento),
    tempo_parado_minutos: Math.round(tempoParado),
    velocidade_media_kmh: pontosComVelocidade > 0 
      ? Math.round(somaVelocidades / pontosComVelocidade) 
      : 0,
    velocidade_maxima_kmh: Math.round(velocidadeMaxima),
    total_pontos: pontos.length,
    total_paradas: 0, // Será preenchido após identificar paradas
    periodo: {
      inicio: pontos[0].data_hora,
      fim: pontos[pontos.length - 1].data_hora,
    },
  };
}

// Aplicar downsampling por intervalo
function aplicarIntervalo(
  pontos: PontoPosicao[],
  intervaloMinutos: number
): PontoPosicao[] {
  if (pontos.length === 0) return [];
  
  const resultado: PontoPosicao[] = [pontos[0]];
  let ultimoTimestamp = new Date(pontos[0].data_hora).getTime();
  const intervaloMs = intervaloMinutos * 60 * 1000;

  for (let i = 1; i < pontos.length; i++) {
    const timestamp = new Date(pontos[i].data_hora).getTime();
    
    if (timestamp - ultimoTimestamp >= intervaloMs) {
      resultado.push(pontos[i]);
      ultimoTimestamp = timestamp;
    }
  }

  // Sempre incluir último ponto
  const ultimo = pontos[pontos.length - 1];
  if (resultado[resultado.length - 1] !== ultimo) {
    resultado.push(ultimo);
  }

  return resultado;
}

/**
 * Identifica pontos de parada no trajeto (velocidade = 0 por mais de 5 minutos)
 */
function identificarParadas(pontos: PontoPosicao[]): PontoParada[] {
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
      const duracao = (new Date(pontoFim.data_hora).getTime() - 
                       new Date(pontoInicio.data_hora).getTime()) / 60000;
      
      // Só considera paradas maiores que 5 minutos
      if (duracao >= 5) {
        paradas.push({
          latitude: pontoInicio.latitude,
          longitude: pontoInicio.longitude,
          inicio: pontoInicio.data_hora,
          fim: pontoFim.data_hora,
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
    const duracao = (new Date(pontoFim.data_hora).getTime() - 
                     new Date(pontoInicio.data_hora).getTime()) / 60000;
    
    if (duracao >= 5) {
      paradas.push({
        latitude: pontoInicio.latitude,
        longitude: pontoInicio.longitude,
        inicio: pontoInicio.data_hora,
        fim: pontoFim.data_hora,
        duracao_minutos: Math.round(duracao),
        endereco: pontoInicio.endereco,
      });
    }
  }
  
  return paradas;
}

// Buscar histórico local do banco
async function getHistoricoLocal(
  supabase: any,
  rastreadorId: string,
  dataInicio: string,
  dataFim: string
): Promise<PontoPosicao[]> {
  const { data, error } = await supabase
    .from('rastreador_posicoes')
    .select('latitude, longitude, velocidade, ignicao, direcao, endereco, data_posicao')
    .eq('rastreador_id', rastreadorId)
    .gte('data_posicao', dataInicio)
    .lte('data_posicao', dataFim)
    .order('data_posicao', { ascending: true })
    .limit(1000);

  if (error) throw error;

  return (data || []).map((p: any) => ({
    latitude: Number(p.latitude),
    longitude: Number(p.longitude),
    velocidade: p.velocidade || 0,
    ignicao: p.ignicao || false,
    data_hora: p.data_posicao,
    endereco: p.endereco,
    direcao: p.direcao,
  }));
}

// Buscar histórico via Softruck API
async function getHistoricoSoftruck(
  token: string,
  vehicleId: string,
  baseUrl: string,
  publicKey: string,
  dataInicio: string,
  dataFim: string
): Promise<PontoPosicao[]> {
  const url = new URL(`${baseUrl}/vehicles/${vehicleId}/trajectories/`);
  url.searchParams.set('filters[start_date]', dataInicio);
  url.searchParams.set('filters[end_date]', dataFim);
  url.searchParams.set('limit', '1000');

  console.log('[Softruck] Buscando trajeto:', url.toString());

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'public-key': publicKey,
      'Content-Type': 'application/json',
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Softruck] Erro:', response.status, errorText);
    throw new Error(`Erro Softruck: ${response.status}`);
  }

  const data = await response.json();
  
  return (data.data || []).map((item: any) => ({
    latitude: item.attributes?.latitude || item.latitude,
    longitude: item.attributes?.longitude || item.longitude,
    velocidade: item.attributes?.speed || item.speed || 0,
    ignicao: item.attributes?.ignition ?? false,
    data_hora: item.attributes?.timestamp || item.timestamp,
    endereco: item.attributes?.address,
    direcao: item.attributes?.heading || item.heading,
  }));
}

// Buscar histórico via Rede Veículos API
async function getHistoricoRedeVeiculos(
  token: string,
  codigoRastreador: string,
  baseUrl: string,
  dataInicio: string,
  dataFim: string
): Promise<PontoPosicao[] | null> {
  try {
    const url = `${baseUrl}/historico`;
    
    console.log('[RedeVeiculos] Buscando histórico:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        codigo_rastreador: codigoRastreador,
        data_inicio: dataInicio,
        data_fim: dataFim,
      })
    });

    if (response.ok) {
      const data = await response.json();
      return (data.posicoes || data.historico || []).map((item: any) => ({
        latitude: parseFloat(item.latitude || item.lat),
        longitude: parseFloat(item.longitude || item.lng || item.lon),
        velocidade: parseInt(item.velocidade || item.speed || 0),
        ignicao: Boolean(item.ignicao || item.ignition),
        data_hora: item.data_hora || item.timestamp,
        endereco: item.endereco || item.address,
        direcao: item.direcao || item.heading,
      }));
    }

    console.log('[RedeVeiculos] API não disponível, usando fallback local');
    return null; // Indica para usar banco local
  } catch (e) {
    console.log('[RedeVeiculos] Erro na API, usando fallback local:', e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Validar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Token de autenticação não fornecido');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Usuário não autenticado');
    }

    const { veiculo_id, data_inicio, data_fim, intervalo_minutos = 15 } = await req.json();

    if (!veiculo_id) {
      throw new Error('ID do veículo é obrigatório');
    }

    if (!data_inicio || !data_fim) {
      throw new Error('Período (data_inicio e data_fim) é obrigatório');
    }

    // Validar período máximo de 7 dias
    const diffMs = new Date(data_fim).getTime() - new Date(data_inicio).getTime();
    const diffDias = diffMs / (1000 * 60 * 60 * 24);

    if (diffDias > 7) {
      throw new Error('Período máximo de 7 dias');
    }

    if (diffDias < 0) {
      throw new Error('Data início deve ser anterior à data fim');
    }

    // Buscar associado do usuário
    const { data: associado, error: assocError } = await supabase
      .from('associados')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (assocError || !associado) {
      throw new Error('Associado não encontrado');
    }

    // Buscar veículo e verificar propriedade
    const { data: veiculo, error: veicError } = await supabase
      .from('veiculos')
      .select('id, placa, modelo, marca')
      .eq('id', veiculo_id)
      .eq('associado_id', associado.id)
      .maybeSingle();

    if (veicError || !veiculo) {
      throw new Error('Veículo não encontrado ou não pertence ao associado');
    }

    // Buscar rastreador com configuração da plataforma
    const { data: rastreador, error: rastError } = await supabase
      .from('rastreadores')
      .select(`
        *,
        config_plataforma:rastreadores_config_plataformas(*)
      `)
      .eq('veiculo_id', veiculo_id)
      .maybeSingle();

    if (rastError || !rastreador) {
      throw new Error('Rastreador não encontrado para este veículo');
    }

    const plataforma = rastreador.config_plataforma;
    let trajeto: PontoPosicao[] = [];
    let fonte: 'api' | 'local' = 'local';

    // Verificar se plataforma suporta histórico via API
    if (plataforma?.suporta_historico_trajeto) {
      try {
        // Obter token de autenticação da plataforma
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
        
        if (authData.success && authData.token) {
          const baseUrl = plataforma.ambiente_atual === 'producao' 
            ? plataforma.api_url_producao 
            : plataforma.api_url_sandbox;

          if (plataforma.plataforma === 'softruck') {
            const vehicleId = rastreador.plataforma_device_id || rastreador.id_plataforma;
            if (vehicleId) {
              trajeto = await getHistoricoSoftruck(
                authData.token,
                vehicleId,
                baseUrl,
                Deno.env.get('SOFTRUCK_PUBLIC_KEY') || '',
                data_inicio,
                data_fim
              );
              fonte = 'api';
            }
          } else if (plataforma.plataforma === 'rede_veiculos') {
            const codigo = rastreador.codigo || rastreador.id_plataforma;
            if (codigo) {
              const resultado = await getHistoricoRedeVeiculos(
                authData.token,
                codigo,
                baseUrl,
                data_inicio,
                data_fim
              );
              if (resultado) {
                trajeto = resultado;
                fonte = 'api';
              }
            }
          }
        }
      } catch (apiError) {
        console.log('[Historico] Erro API, usando fallback local:', apiError);
      }
    }

    // Fallback para banco local
    if (trajeto.length === 0) {
      trajeto = await getHistoricoLocal(supabase, rastreador.id, data_inicio, data_fim);
      fonte = 'local';
    }

    // Aplicar intervalo (downsampling)
    const trajetoFiltrado = aplicarIntervalo(trajeto, intervalo_minutos);

    // Identificar paradas (usar trajeto completo para melhor precisão)
    const paradas = identificarParadas(trajeto);

    // Calcular resumo
    const resumo = calcularResumo(trajeto);
    resumo.total_paradas = paradas.length;

    console.log(`[Historico] ${fonte}: ${trajeto.length} pontos, filtrado: ${trajetoFiltrado.length}, paradas: ${paradas.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        plataforma: plataforma?.plataforma || 'local',
        fonte,
        trajeto: trajetoFiltrado,
        paradas,
        resumo,
        veiculo: {
          id: veiculo.id,
          placa: veiculo.placa,
          modelo: veiculo.modelo,
          marca: veiculo.marca,
        },
        rastreador: {
          id: rastreador.id,
          codigo: rastreador.codigo,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Historico] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
