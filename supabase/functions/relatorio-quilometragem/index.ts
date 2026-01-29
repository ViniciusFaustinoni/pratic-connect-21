import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface QuilometragemVeiculo {
  veiculo_id: string;
  placa: string;
  marca: string;
  modelo: string;
  associado_nome: string;
  km_inicial: number | null;
  km_final: number | null;
  km_percorrido: number;
  distancia_calculada_km: number;
  total_posicoes: number;
  dias_com_registro: number;
}

// Fórmula Haversine para calcular distância entre pontos
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { mes, ano, associado_id } = await req.json();

    if (!mes || !ano) {
      throw new Error('Mês e ano são obrigatórios');
    }

    // Período do mês
    const dataInicio = new Date(ano, mes - 1, 1);
    const dataFim = new Date(ano, mes, 0, 23, 59, 59);

    // Buscar veículos com rastreadores instalados
    let veiculosQuery = supabase
      .from('veiculos')
      .select(`
        id, placa, marca, modelo,
        associado:associados(id, nome),
        rastreador:rastreadores!rastreadores_veiculo_id_fkey(id, codigo)
      `)
      .not('rastreador', 'is', null);

    if (associado_id) {
      veiculosQuery = veiculosQuery.eq('associado_id', associado_id);
    }

    const { data: veiculos, error: veicError } = await veiculosQuery;

    if (veicError) throw veicError;

    const resultado: QuilometragemVeiculo[] = [];

    // Para cada veículo, buscar posições do período
    for (const veiculo of veiculos || []) {
      const rastreador = Array.isArray(veiculo.rastreador) 
        ? veiculo.rastreador[0] 
        : veiculo.rastreador;

      if (!rastreador) continue;

      // Buscar posições do período
      const { data: posicoes } = await supabase
        .from('rastreador_posicoes')
        .select('latitude, longitude, odometro, data_posicao')
        .eq('rastreador_id', rastreador.id)
        .gte('data_posicao', dataInicio.toISOString())
        .lte('data_posicao', dataFim.toISOString())
        .order('data_posicao', { ascending: true });

      if (!posicoes || posicoes.length === 0) {
        resultado.push({
          veiculo_id: veiculo.id,
          placa: veiculo.placa || '',
          marca: veiculo.marca || '',
          modelo: veiculo.modelo || '',
          associado_nome: (veiculo.associado as any)?.nome || '',
          km_inicial: null,
          km_final: null,
          km_percorrido: 0,
          distancia_calculada_km: 0,
          total_posicoes: 0,
          dias_com_registro: 0,
        });
        continue;
      }

      // Calcular distância total via Haversine
      let distanciaTotal = 0;
      for (let i = 1; i < posicoes.length; i++) {
        const anterior = posicoes[i - 1];
        const atual = posicoes[i];
        
        const dist = calcularDistanciaHaversine(
          Number(anterior.latitude), Number(anterior.longitude),
          Number(atual.latitude), Number(atual.longitude)
        );
        
        // Ignorar saltos muito grandes (possível erro de GPS)
        if (dist < 100) {
          distanciaTotal += dist;
        }
      }

      // Odômetro inicial e final (se disponível)
      const kmInicial = posicoes[0]?.odometro || null;
      const kmFinal = posicoes[posicoes.length - 1]?.odometro || null;
      const kmPercorrido = (kmFinal && kmInicial) ? kmFinal - kmInicial : 0;

      // Dias únicos com registro
      const diasUnicos = new Set(
        posicoes.map(p => new Date(p.data_posicao).toISOString().split('T')[0])
      );

      resultado.push({
        veiculo_id: veiculo.id,
        placa: veiculo.placa || '',
        marca: veiculo.marca || '',
        modelo: veiculo.modelo || '',
        associado_nome: (veiculo.associado as any)?.nome || '',
        km_inicial: kmInicial,
        km_final: kmFinal,
        km_percorrido: Math.round(kmPercorrido),
        distancia_calculada_km: Math.round(distanciaTotal * 10) / 10,
        total_posicoes: posicoes.length,
        dias_com_registro: diasUnicos.size,
      });
    }

    // Ordenar por quilometragem
    resultado.sort((a, b) => b.distancia_calculada_km - a.distancia_calculada_km);

    // Totais
    const totais = {
      total_veiculos: resultado.length,
      total_km: resultado.reduce((sum, v) => sum + v.distancia_calculada_km, 0),
      media_km: resultado.length > 0 
        ? Math.round(resultado.reduce((sum, v) => sum + v.distancia_calculada_km, 0) / resultado.length)
        : 0,
      periodo: {
        mes,
        ano,
        inicio: dataInicio.toISOString(),
        fim: dataFim.toISOString(),
      },
    };

    console.log(`[Quilometragem] ${resultado.length} veículos, ${Math.round(totais.total_km)} km total`);

    return new Response(
      JSON.stringify({
        success: true,
        dados: resultado,
        totais,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Quilometragem] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
