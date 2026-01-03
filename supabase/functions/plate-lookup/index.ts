import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalizar placa (remover traços, espaços, uppercase)
function normalizePlaca(placa: string): string {
  return placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

// Validar formato da placa (ABC1234 ou ABC1D23 Mercosul)
function validarPlaca(placa: string): boolean {
  const placaRegex = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;
  return placaRegex.test(placa);
}

// Formatar placa para exibição (ABC-1234 ou ABC1D23)
function formatarPlaca(placa: string): string {
  if (placa.length === 7) {
    // Verificar se é Mercosul (4º caractere é letra)
    if (/[A-Z]/.test(placa[4])) {
      return placa; // Mercosul não usa hífen
    }
    return `${placa.slice(0, 3)}-${placa.slice(3)}`;
  }
  return placa;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const placa = body.placa || body.plate;
    
    if (!placa) {
      throw new Error("Placa é obrigatória");
    }

    const placaNormalizada = normalizePlaca(placa);
    console.log(`[plate-lookup] Consultando placa: ${placaNormalizada}`);

    if (!validarPlaca(placaNormalizada)) {
      throw new Error("Formato de placa inválido. Use ABC1234 ou ABC1D23");
    }

    const apiKey = Deno.env.get('FIPE_PLACAS_API_KEY');
    if (!apiKey) {
      throw new Error("API de placas não configurada. Configure o secret FIPE_PLACAS_API_KEY");
    }

    // Consultar API de placas (fipeapi.com.br ou similar)
    // Ajustar URL e headers conforme a API contratada
    const apiUrl = `https://wdapi2.com.br/consulta/${placaNormalizada}/${apiKey}`;
    
    console.log(`[plate-lookup] Chamando API de placas...`);
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`[plate-lookup] Erro na API: ${response.status}`);
      throw new Error("Erro ao consultar API de placas");
    }

    const apiData = await response.json();
    console.log(`[plate-lookup] Resposta da API:`, JSON.stringify(apiData));

    // Verificar se encontrou o veículo
    if (apiData.error || apiData.mensagem || !apiData.MARCA) {
      throw new Error(apiData.mensagem || apiData.error || "Veículo não encontrado");
    }

    // Extrair dados do veículo da resposta da API
    // Formato típico: { MARCA: "I/CHEVROLET", MODELO: "ONIX 1.0", ano: "2022", ... }
    const vehicleData = {
      placa: formatarPlaca(placaNormalizada),
      marca: apiData.MARCA?.replace(/^I\//, '').trim() || '',
      modelo: apiData.MODELO?.trim() || '',
      submodelo: apiData.SUBMODELO?.trim() || '',
      anoFabricacao: parseInt(apiData.ano) || null,
      anoModelo: parseInt(apiData.anoModelo) || parseInt(apiData.ano) || null,
      cor: apiData.cor || apiData.COR || '',
      combustivel: apiData.combustivel || apiData.COMBUSTIVEL || '',
      chassi: apiData.chassi || '',
      municipio: apiData.municipio || '',
      uf: apiData.uf || '',
      situacao: apiData.situacao || '',
      origem: apiData.origem || '',
    };

    console.log(`[plate-lookup] Dados extraídos:`, JSON.stringify(vehicleData));

    // Tentar buscar valor FIPE via edge function fipe-lookup
    let fipeData = null;
    
    if (vehicleData.marca && vehicleData.modelo && vehicleData.anoModelo) {
      console.log(`[plate-lookup] Buscando FIPE para: ${vehicleData.marca} ${vehicleData.modelo} ${vehicleData.anoModelo}`);
      
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
        
        const fipeResponse = await fetch(
          `${supabaseUrl}/functions/v1/fipe-lookup`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseAnonKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              action: 'buscar-por-nome',
              tipo: 'carros',
              marca: vehicleData.marca,
              modelo: `${vehicleData.modelo} ${vehicleData.submodelo}`.trim(),
              ano: vehicleData.anoModelo.toString()
            })
          }
        );

        const fipeLookupData = await fipeResponse.json();
        console.log(`[plate-lookup] Resposta FIPE:`, JSON.stringify(fipeLookupData));
        
        if (fipeLookupData.success && fipeLookupData.found) {
          fipeData = {
            codigoFipe: fipeLookupData.data.codigoFipe,
            valorFipe: fipeLookupData.data.valorNumerico,
            valorFipeFormatado: fipeLookupData.data.valor,
            mesReferencia: fipeLookupData.data.mesReferencia,
            marcaFipe: fipeLookupData.data.marca,
            modeloFipe: fipeLookupData.data.modelo,
          };
        }
      } catch (fipeError) {
        console.error(`[plate-lookup] Erro ao buscar FIPE:`, fipeError);
        // Não falhar se FIPE não encontrar, apenas retornar sem valor FIPE
      }
    }

    const result = {
      success: true,
      extractedPlate: formatarPlaca(placaNormalizada),
      vehicleData: {
        placa: formatarPlaca(placaNormalizada),
        chassi: vehicleData.chassi || '',
        marca: vehicleData.marca,
        modelo: vehicleData.modelo,
        marca_modelo: `${vehicleData.marca} ${vehicleData.modelo}`.trim(),
        ano: vehicleData.anoModelo?.toString() || vehicleData.anoFabricacao?.toString() || '',
        cor: vehicleData.cor,
        combustivel: vehicleData.combustivel,
        municipio: vehicleData.municipio,
        uf: vehicleData.uf,
      },
      fipeData: fipeData ? {
        codigo: fipeData.codigoFipe,
        valor: fipeData.valorFipe,
        mesReferencia: fipeData.mesReferencia,
      } : null
    };

    console.log(`[plate-lookup] Retornando resultado:`, JSON.stringify(result));

    return new Response(
      JSON.stringify(result),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    console.error('[plate-lookup] Erro:', errorMessage);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
