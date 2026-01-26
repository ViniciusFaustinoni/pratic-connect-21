import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReverseGeocodeRequest {
  latitude: number;
  longitude: number;
}

interface ReverseGeocodeResult {
  success: boolean;
  endereco?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  endereco_completo?: string;
  error?: string;
}

/**
 * Faz reverse geocoding usando OpenStreetMap Nominatim (gratuito)
 * Rate limit: 1 request/segundo - usar com moderação
 */
async function reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&accept-language=pt-BR`;
    
    console.log(`[reverse-geocode] Buscando endereço para: ${latitude}, ${longitude}`);
    
    const response = await fetch(url, {
      headers: { 
        'User-Agent': 'PraticConnect/1.0 (Sistema de Gestão de Proteção Veicular)',
        'Accept-Language': 'pt-BR,pt;q=0.9'
      }
    });
    
    if (!response.ok) {
      console.error(`[reverse-geocode] Nominatim retornou status: ${response.status}`);
      return { success: false, error: `Nominatim retornou status: ${response.status}` };
    }
    
    const data = await response.json();
    
    if (data.error) {
      console.error(`[reverse-geocode] Erro Nominatim: ${data.error}`);
      return { success: false, error: data.error };
    }
    
    const address = data.address || {};
    
    // Montar endereço legível
    const rua = address.road || address.pedestrian || address.street || '';
    const numero = address.house_number || '';
    const bairro = address.suburb || address.neighbourhood || address.district || '';
    const cidade = address.city || address.town || address.municipality || address.village || '';
    const uf = address.state_code?.toUpperCase() || address.state || '';
    const cep = address.postcode || '';
    
    // Montar endereço completo formatado
    let enderecoCompleto = '';
    
    if (rua) {
      enderecoCompleto = rua;
      if (numero) {
        enderecoCompleto += `, ${numero}`;
      }
    }
    
    if (bairro) {
      enderecoCompleto += enderecoCompleto ? ` - ${bairro}` : bairro;
    }
    
    if (cidade) {
      enderecoCompleto += enderecoCompleto ? `, ${cidade}` : cidade;
    }
    
    if (uf) {
      enderecoCompleto += enderecoCompleto ? ` - ${uf}` : uf;
    }
    
    // Se não conseguiu montar nada, usar display_name
    if (!enderecoCompleto && data.display_name) {
      enderecoCompleto = data.display_name;
    }
    
    console.log(`[reverse-geocode] Endereço encontrado: ${enderecoCompleto}`);
    
    return {
      success: true,
      endereco: rua + (numero ? `, ${numero}` : ''),
      bairro,
      cidade,
      uf,
      cep,
      endereco_completo: enderecoCompleto,
    };
  } catch (error) {
    console.error(`[reverse-geocode] Erro: ${error}`);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: ReverseGeocodeRequest = await req.json();
    
    console.log('[reverse-geocode] Request recebido:', JSON.stringify(body));
    
    // Validar entrada
    if (typeof body.latitude !== 'number' || typeof body.longitude !== 'number') {
      return new Response(
        JSON.stringify({ 
          error: 'É necessário fornecer latitude e longitude como números',
          success: false 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validar range das coordenadas
    if (body.latitude < -90 || body.latitude > 90 || body.longitude < -180 || body.longitude > 180) {
      return new Response(
        JSON.stringify({ 
          error: 'Coordenadas fora do range válido',
          success: false 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Fazer reverse geocode
    const resultado = await reverseGeocode(body.latitude, body.longitude);
    
    return new Response(
      JSON.stringify(resultado),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Erro interno';
    console.error('[reverse-geocode] Erro:', errorMessage);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
