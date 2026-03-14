import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeocodeRequest {
  endereco: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
}

interface GeocodeResult {
  latitude: number | null;
  longitude: number | null;
  success: boolean;
  source: string;
  endereco_formatado?: string;
}

/**
 * Geocodifica um endereço usando OpenStreetMap Nominatim (gratuito)
 * Rate limit: 1 request/segundo - usar com moderação
 */
async function geocodeNominatim(endereco: string): Promise<GeocodeResult> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(endereco)}&countrycodes=br&limit=1`;
    
    console.log(`[Geocode] Buscando: ${endereco}`);
    
    let response = await fetch(url, {
      headers: { 
        'User-Agent': 'PraticConnect/1.0 (Sistema de Gestão de Proteção Veicular)',
        'Accept-Language': 'pt-BR,pt;q=0.9'
      }
    });
    
    // Retry on 429 (rate limit) — respect Retry-After header
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '2', 10);
      const waitMs = Math.min(retryAfter * 1000, 5000);
      console.warn(`[Geocode] Rate limited (429). Retrying after ${waitMs}ms...`);
      await new Promise(r => setTimeout(r, waitMs));
      response = await fetch(url, {
        headers: { 
          'User-Agent': 'PraticConnect/1.0 (Sistema de Gestão de Proteção Veicular)',
          'Accept-Language': 'pt-BR,pt;q=0.9'
        }
      });
    }
    
    if (!response.ok) {
      console.error(`[Geocode] Nominatim retornou status: ${response.status}`);
      return { latitude: null, longitude: null, success: false, source: 'nominatim', reason: response.status === 429 ? 'rate_limited' : 'http_error' };
    }
    
    const data = await response.json();
    
    if (data.length > 0) {
      const result = data[0];
      console.log(`[Geocode] Encontrado: ${result.display_name} (${result.lat}, ${result.lon})`);
      return {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        success: true,
        source: 'nominatim',
        endereco_formatado: result.display_name
      };
    }
    
    console.log(`[Geocode] Nenhum resultado para: ${endereco}`);
    return { latitude: null, longitude: null, success: false, source: 'nominatim' };
  } catch (error) {
    console.error(`[Geocode] Erro ao geocodificar: ${error}`);
    return { latitude: null, longitude: null, success: false, source: 'nominatim' };
  }
}

/**
 * Monta o endereço completo a partir dos componentes
 */
function montarEnderecoCompleto(req: GeocodeRequest): string {
  // Se já veio um endereço completo, usar ele
  if (req.endereco && req.endereco.length > 10) {
    return req.endereco;
  }
  
  // Montar a partir dos componentes
  const partes: string[] = [];
  
  if (req.logradouro) {
    partes.push(req.logradouro);
    if (req.numero) {
      partes.push(req.numero);
    }
  }
  
  if (req.bairro) {
    partes.push(req.bairro);
  }
  
  if (req.cidade) {
    partes.push(req.cidade);
  }
  
  if (req.uf) {
    partes.push(req.uf);
  }
  
  if (req.cep) {
    partes.push(req.cep.replace(/\D/g, ''));
  }
  
  // Adicionar Brasil para melhorar precisão
  partes.push('Brasil');
  
  return partes.join(', ');
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: GeocodeRequest = await req.json();
    
    console.log('[Geocode] Request recebido:', JSON.stringify(body));
    
    // Validar entrada
    if (!body.endereco && !body.logradouro && !body.cep) {
      return new Response(
        JSON.stringify({ 
          error: 'É necessário fornecer um endereço, logradouro ou CEP',
          success: false 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Montar endereço completo
    const enderecoCompleto = montarEnderecoCompleto(body);
    
    // Geocodificar
    const resultado = await geocodeNominatim(enderecoCompleto);
    
    // Se não encontrou e temos CEP, tentar apenas com cidade/bairro
    if (!resultado.success && body.cidade && body.bairro) {
      console.log('[Geocode] Tentando busca alternativa sem número...');
      const enderecoAlternativo = `${body.bairro}, ${body.cidade}, ${body.uf || ''}, Brasil`;
      const resultadoAlt = await geocodeNominatim(enderecoAlternativo);
      
      if (resultadoAlt.success) {
        return new Response(
          JSON.stringify({
            ...resultadoAlt,
            endereco_buscado: enderecoAlternativo,
            aproximado: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    return new Response(
      JSON.stringify({
        ...resultado,
        endereco_buscado: enderecoCompleto
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Erro interno';
    console.error('[Geocode] Erro:', errorMessage);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
