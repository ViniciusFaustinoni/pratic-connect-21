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
      console.error("[plate-lookup] FIPE_PLACAS_API_KEY não configurada");
      throw new Error("API de placas não configurada. Configure o secret FIPE_PLACAS_API_KEY");
    }

    // Consultar API de placas (placas.fipeapi.com.br)
    const apiUrl = `https://placas.fipeapi.com.br/placas/${placaNormalizada}?key=${apiKey}`;
    
    console.log(`[plate-lookup] Chamando API: placas.fipeapi.com.br`);
    
    let response: Response;
    try {
      response = await fetch(apiUrl);
    } catch (fetchError) {
      console.error(`[plate-lookup] Erro de conexão:`, fetchError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Serviço de consulta de placas indisponível. Preencha os dados manualmente.' 
        }),
        { 
          status: 503, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!response.ok) {
      console.error(`[plate-lookup] Erro HTTP: ${response.status}`);
      
      if (response.status === 403) {
        throw new Error("Chave de API inválida ou sem créditos. Verifique sua conta no fipeapi.com.br");
      }
      if (response.status === 429) {
        throw new Error("Limite de consultas excedido. Tente novamente em alguns minutos.");
      }
      if (response.status === 404) {
        throw new Error("Veículo não encontrado na base de dados.");
      }
      
      throw new Error(`Erro na consulta de placa (código ${response.status})`);
    }

    const apiData = await response.json();
    console.log(`[plate-lookup] Resposta da API:`, JSON.stringify(apiData));

    // Extrair dados aninhados (estrutura: { data: { veiculo: {...}, fipes: [...] } })
    const veiculo = apiData.data?.veiculo || apiData.veiculo || apiData;
    const fipesArray = apiData.data?.fipes || apiData.fipes || [];

    if (!veiculo || !veiculo.marca_modelo) {
      console.error("[plate-lookup] Veículo não encontrado ou sem dados");
      throw new Error("Veículo não encontrado na base de dados");
    }

    // Separar marca e modelo (vem junto: "VW/GOL 1.0")
    const marcaModelo = veiculo.marca_modelo || '';
    const [marca, ...modeloParts] = marcaModelo.split('/');
    const modelo = modeloParts.join('/').trim();

    console.log(`[plate-lookup] Marca: ${marca}, Modelo: ${modelo}`);

    const vehicleData = {
      placa: veiculo.placa || formatarPlaca(placaNormalizada),
      chassi: veiculo.chassi || '',
      marca: marca.trim(),
      modelo: modelo,
      marca_modelo: marcaModelo,
      ano: veiculo.ano || '',
      cor: veiculo.cor || '',
      combustivel: veiculo.combustivel || '',
      municipio: veiculo.municipio || '',
      uf: veiculo.uf || '',
      motor: veiculo.n_motor || '',
      renavam: veiculo.renavam || '',
      potencia: veiculo.potencia || '',
      cilindradas: veiculo.cilindradas || '',
      tipo_veiculo: veiculo.tipo_de_veiculo || '',
      categoria: veiculo.categoria || '',
      procedencia: veiculo.procedencia || '',
    };

    // FIPE já vem na resposta da API
    const fipeData = fipesArray[0] ? {
      codigo: fipesArray[0].codigo,
      valor: fipesArray[0].valor,
      mesReferencia: fipesArray[0].mes_referencia,
    } : null;

    const result = {
      success: true,
      extractedPlate: formatarPlaca(placaNormalizada),
      vehicleData,
      fipeData,
    };

    console.log(`[plate-lookup] Sucesso:`, JSON.stringify(result));

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
