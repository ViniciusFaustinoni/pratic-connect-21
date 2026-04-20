import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logEdgeFunction } from "../_shared/log-edge-function.ts";

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

// Função auxiliar para tentar consulta com uma chave específica
async function tentarConsulta(placa: string, apiKey: string): Promise<Response> {
  const apiUrl = `https://placas.fipeapi.com.br/placas/${placa}?key=${apiKey}`;
  return await fetch(apiUrl);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const _startTime = Date.now();
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

    const fallbackKey = Deno.env.get('FIPE_PLACAS_API_KEY_FALLBACK');

    console.log(`[plate-lookup] Chamando API: placas.fipeapi.com.br (chave primária)`);
    
    let response: Response;
    let usedFallback = false;

    try {
      response = await tentarConsulta(placaNormalizada, apiKey);
    } catch (fetchError) {
      console.error(`[plate-lookup] Erro de conexão:`, fetchError);
      return new Response(
        JSON.stringify({ 
          success: false,
          rateLimited: false,
          error: 'Serviço de consulta de placas indisponível. Preencha os dados manualmente.' 
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Se chave primária falhou por limite/créditos, tentar fallback
    if ([403, 429, 439].includes(response.status) && fallbackKey) {
      console.log(`[plate-lookup] Chave primária retornou ${response.status}, tentando fallback...`);
      try {
        response = await tentarConsulta(placaNormalizada, fallbackKey);
        usedFallback = true;
        console.log(`[plate-lookup] Fallback retornou status ${response.status}`);
      } catch (fallbackError) {
        console.error(`[plate-lookup] Erro de conexão na fallback:`, fallbackError);
      }
    }

    if (!response.ok) {
      console.error(`[plate-lookup] Erro HTTP: ${response.status} (fallback: ${usedFallback})`);
      
      if (response.status === 403) {
        return new Response(
          JSON.stringify({ success: false, error: "Chave de API sem créditos. Preencha os dados manualmente.", rateLimited: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 429 || response.status === 439) {
        return new Response(
          JSON.stringify({ success: false, error: "Limite de consultas excedido. Preencha os dados manualmente.", rateLimited: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ success: false, error: "Veículo não encontrado na base de dados.", rateLimited: false }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      let errorBody = '';
      try { errorBody = await response.text(); } catch (_) {}
      console.error(`[plate-lookup] Corpo do erro: ${errorBody}`);
      
      logEdgeFunction({ functionName: "plate-lookup", plataforma: "plate_lookup", operacao: "lookup", status: "sucesso", tempoMs: Date.now() - _startTime });
      
      return new Response(
        JSON.stringify({ success: false, error: `Erro na consulta de placa (código ${response.status}). Tente novamente em instantes.`, rateLimited: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiData = await response.json();
    console.log(`[plate-lookup] Resposta da API RAW (fallback: ${usedFallback}):`, JSON.stringify(apiData));

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

    // ============= ANO FABRICAÇÃO vs ANO MODELO =============
    // A API pode entregar de várias formas:
    //   - veiculo.ano = "2014"          (um único valor)
    //   - veiculo.ano = "2014/2015"     (fab/mod no mesmo campo)
    //   - veiculo.ano_fabricacao + veiculo.ano_modelo (separados)
    // Mapeamos os 3 cenários priorizando os campos separados quando existirem.
    const anoRaw = String(veiculo.ano || '').trim();
    let anoFabricacao = '';
    let anoModelo = '';

    if (veiculo.ano_fabricacao || veiculo.ano_modelo) {
      anoFabricacao = String(veiculo.ano_fabricacao || veiculo.ano_modelo || '').trim();
      anoModelo = String(veiculo.ano_modelo || veiculo.ano_fabricacao || '').trim();
    } else if (anoRaw.includes('/')) {
      const [fab, mod] = anoRaw.split('/').map(s => s.trim());
      anoFabricacao = fab || '';
      anoModelo = mod || fab || '';
    } else if (anoRaw) {
      // Único valor — sem como saber se é fab ou mod, usamos o mesmo nos dois.
      // O front/CRLV deve corrigir o ano modelo quando aplicável.
      anoFabricacao = anoRaw;
      anoModelo = anoRaw;
    }

    console.log(`[plate-lookup] Ano fab: ${anoFabricacao}, Ano mod: ${anoModelo}`);

    const vehicleData = {
      placa: veiculo.placa || formatarPlaca(placaNormalizada),
      chassi: veiculo.chassi || '',
      marca: marca.trim(),
      modelo: modelo,
      marca_modelo: marcaModelo,
      ano: anoModelo || anoFabricacao || '', // legado (mantém compat)
      ano_fabricacao: anoFabricacao,
      ano_modelo: anoModelo,
      cor: veiculo.cor || '',
      combustivel: veiculo.combustivel || '',
      municipio: veiculo.municipio || '',
      uf: veiculo.uf || '',
      motor: veiculo.n_motor || '',
      renavam: veiculo.renavam || '',
      potencia: veiculo.potencia || '',
      cilindradas: veiculo.cilindradas || '',
      tipo_de_veiculo: veiculo.tipo_de_veiculo || veiculo.tipo_veiculo || '',
      categoria: veiculo.categoria || '',
      procedencia: veiculo.procedencia || '',
      numero_portas: veiculo.quantidade_passageiro || veiculo.qt_portas || veiculo.quantidade_passageiros || '',
      cambio: veiculo.caixa_cambio || veiculo.cambio || '',
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

    logEdgeFunction({ functionName: "plate-lookup", plataforma: "plate_lookup", operacao: "lookup", status: "erro", erroMensagem: (error instanceof Error ? error.message : "Erro desconhecido"), tempoMs: Date.now() - _startTime });
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
