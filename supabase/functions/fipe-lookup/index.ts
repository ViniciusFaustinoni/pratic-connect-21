import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// APIs FIPE alternativas
const FIPE_APIS = [
  'https://parallelum.com.br/fipe/api/v1',
  'https://veiculos.fipe.org.br/api/veiculos'
];

// Cache em memória para reduzir chamadas
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hora

function getCached<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// Função para normalizar texto para comparação
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// Função para fazer fuzzy match
function fuzzyMatch(search: string, target: string): boolean {
  const normalizedSearch = normalizeText(search);
  const normalizedTarget = normalizeText(target);
  return normalizedTarget.includes(normalizedSearch) || normalizedSearch.includes(normalizedTarget);
}

// Função para converter valor string para número
function parseValorFipe(valor: string): number {
  return parseFloat(
    valor
      .replace("R$ ", "")
      .replace(/\./g, "")
      .replace(",", ".")
  );
}

// Função para fazer fetch com retry e fallback
async function fetchWithRetry(path: string, maxRetries = 2): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const apiUrl = FIPE_APIS[0]; // Usar API principal
    const url = `${apiUrl}${path}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        }
      });
      
      if (response.ok) {
        return response;
      }
      
      // Se rate limited, esperar e tentar novamente
      if (response.status === 429) {
        console.log(`Rate limited, aguardando antes de retry (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
      
      // Para outros erros, retornar a resposta para tratamento
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Fetch error (attempt ${attempt + 1}):`, lastError.message);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  throw lastError || new Error('Falha ao conectar com API FIPE');
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Support both GET (legacy) and POST
    let action: string | null;
    let tipo: string;
    let params: Record<string, string> = {};

    if (req.method === 'POST') {
      const body = await req.json();
      action = body.action;
      tipo = body.tipo || 'carros';
      params = body;
    } else {
      const url = new URL(req.url);
      action = url.searchParams.get('action');
      tipo = url.searchParams.get('tipo') || 'carros';
      url.searchParams.forEach((value, key) => {
        params[key] = value;
      });
    }

    console.log(`FIPE Lookup - Action: ${action}, Tipo: ${tipo}, Params:`, JSON.stringify(params));

    if (!action) {
      return new Response(
        JSON.stringify({ success: false, error: 'Parâmetro "action" é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result: unknown;

    switch (action) {
      case 'marcas': {
        const cacheKey = `marcas_${tipo}`;
        const cached = getCached<Array<{ codigo: string; nome: string }>>(cacheKey);
        if (cached) {
          console.log('Usando cache para marcas');
          result = { success: true, data: cached };
          break;
        }

        const response = await fetchWithRetry(`/${tipo}/marcas`);
        const data = await response.json();
        console.log('Resposta marcas:', JSON.stringify(data).substring(0, 200));
        
        if (!response.ok || !Array.isArray(data)) {
          console.error('Erro ao buscar marcas:', response.status, data);
          throw new Error('Erro ao buscar marcas na API FIPE. Tente novamente em alguns segundos.');
        }
        
        const marcas = data.map((m: { codigo: string; nome: string }) => ({
          codigo: m.codigo,
          nome: m.nome
        }));
        setCache(cacheKey, marcas);
        result = { success: true, data: marcas };
        break;
      }

      case 'modelos': {
        const marcaCodigo = params.marcaCodigo || params.marca;
        if (!marcaCodigo) {
          return new Response(
            JSON.stringify({ success: false, error: 'Parâmetro "marcaCodigo" é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const cacheKey = `modelos_${tipo}_${marcaCodigo}`;
        const cached = getCached<{ modelos: Array<{ codigo: string; nome: string }> }>(cacheKey);
        if (cached) {
          console.log('Usando cache para modelos');
          result = { success: true, data: cached };
          break;
        }

        const response = await fetchWithRetry(`/${tipo}/marcas/${marcaCodigo}/modelos`);
        const data = await response.json();
        
        if (!response.ok || !data.modelos) {
          console.error('Erro ao buscar modelos:', response.status, data);
          throw new Error('Erro ao buscar modelos na API FIPE. Tente novamente em alguns segundos.');
        }
        
        const modelos = data.modelos.map((m: { codigo: number; nome: string }) => ({
          codigo: String(m.codigo),
          nome: m.nome
        }));
        const modelosResult = { modelos };
        setCache(cacheKey, modelosResult);
        result = { success: true, data: modelosResult };
        break;
      }

      case 'anos': {
        const marcaCodigo = params.marcaCodigo || params.marca;
        const modeloCodigo = params.modeloCodigo || params.modelo;
        if (!marcaCodigo || !modeloCodigo) {
          return new Response(
            JSON.stringify({ success: false, error: 'Parâmetros "marcaCodigo" e "modeloCodigo" são obrigatórios' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const cacheKey = `anos_${tipo}_${marcaCodigo}_${modeloCodigo}`;
        const cached = getCached<Array<{ codigo: string; nome: string }>>(cacheKey);
        if (cached) {
          console.log('Usando cache para anos');
          result = { success: true, data: cached };
          break;
        }

        const response = await fetchWithRetry(`/${tipo}/marcas/${marcaCodigo}/modelos/${modeloCodigo}/anos`);
        const data = await response.json();
        
        if (!response.ok || !Array.isArray(data)) {
          console.error('Erro ao buscar anos:', response.status, data);
          throw new Error('Erro ao buscar anos na API FIPE. Tente novamente em alguns segundos.');
        }
        
        const anos = data.map((a: { codigo: string; nome: string }) => ({
          codigo: a.codigo,
          nome: a.nome
        }));
        setCache(cacheKey, anos);
        result = { success: true, data: anos };
        break;
      }

      case 'preco': {
        const marcaCodigo = params.marcaCodigo || params.marca;
        const modeloCodigo = params.modeloCodigo || params.modelo;
        const anoCodigo = params.anoCodigo || params.ano;

        if (!marcaCodigo || !modeloCodigo || !anoCodigo) {
          return new Response(
            JSON.stringify({ success: false, error: 'Parâmetros "marcaCodigo", "modeloCodigo" e "anoCodigo" são obrigatórios' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const response = await fetchWithRetry(`/${tipo}/marcas/${marcaCodigo}/modelos/${modeloCodigo}/anos/${anoCodigo}`);
        if (!response.ok) {
          console.error('Erro ao buscar preço:', response.status);
          throw new Error('Erro ao buscar preço. Tente novamente em alguns segundos.');
        }
        const data = await response.json();

        result = {
          success: true,
          data: {
            codigoFipe: data.CodigoFipe,
            valor: data.Valor,
            valorNumerico: parseValorFipe(data.Valor),
            marca: data.Marca,
            modelo: data.Modelo,
            anoModelo: parseInt(data.AnoModelo) || data.AnoModelo,
            combustivel: data.Combustivel,
            mesReferencia: data.MesReferencia
          }
        };
        break;
      }

      case 'buscar-por-nome': {
        const marca = params.marca;
        const modelo = params.modelo;
        const ano = params.ano;

        if (!marca || !modelo) {
          return new Response(
            JSON.stringify({ success: false, error: 'Parâmetros "marca" e "modelo" são obrigatórios' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`Buscando FIPE: ${marca} ${modelo} ${ano || ''}`);

        // 1. Buscar marcas
        const marcasResp = await fetchWithRetry(`/${tipo}/marcas`);
        if (!marcasResp.ok) throw new Error('Erro ao buscar marcas');
        const marcasData: Array<{ codigo: string; nome: string }> = await marcasResp.json();

        // Fuzzy match para marca
        const marcaEncontrada = marcasData.find((m) => fuzzyMatch(marca, m.nome));

        if (!marcaEncontrada) {
          console.log(`Marca não encontrada: ${marca}`);
          return new Response(
            JSON.stringify({ success: false, found: false, error: 'Marca não encontrada' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`Marca encontrada: ${marcaEncontrada.nome} (${marcaEncontrada.codigo})`);

        // 2. Buscar modelos
        const modelosResp = await fetchWithRetry(`/${tipo}/marcas/${marcaEncontrada.codigo}/modelos`);
        if (!modelosResp.ok) throw new Error('Erro ao buscar modelos');
        const modelosData = await modelosResp.json();

        // Fuzzy match para modelo
        const modeloEncontrado = modelosData.modelos.find((m: { codigo: number; nome: string }) => 
          fuzzyMatch(modelo, m.nome)
        );

        if (!modeloEncontrado) {
          console.log(`Modelo não encontrado: ${modelo}`);
          return new Response(
            JSON.stringify({ success: false, found: false, error: 'Modelo não encontrado' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`Modelo encontrado: ${modeloEncontrado.nome} (${modeloEncontrado.codigo})`);

        // 3. Buscar anos
        const anosResp = await fetchWithRetry(
          `/${tipo}/marcas/${marcaEncontrada.codigo}/modelos/${modeloEncontrado.codigo}/anos`
        );
        if (!anosResp.ok) throw new Error('Erro ao buscar anos');
        const anosData: Array<{ codigo: string; nome: string }> = await anosResp.json();

        // Match para ano (se fornecido)
        let anoEncontrado = anosData[0]; // Default para o primeiro (mais recente)
        if (ano) {
          const anoMatch = anosData.find((a) => a.nome.includes(ano) || a.codigo.includes(ano));
          if (anoMatch) {
            anoEncontrado = anoMatch;
          }
        }

        console.log(`Ano selecionado: ${anoEncontrado.nome} (${anoEncontrado.codigo})`);

        // 4. Buscar preço
        const precoResp = await fetchWithRetry(
          `/${tipo}/marcas/${marcaEncontrada.codigo}/modelos/${modeloEncontrado.codigo}/anos/${anoEncontrado.codigo}`
        );
        if (!precoResp.ok) throw new Error('Erro ao buscar preço');
        const preco = await precoResp.json();

        console.log(`FIPE encontrado: ${preco.CodigoFipe} - ${preco.Valor}`);

        result = {
          success: true,
          found: true,
          data: {
            codigoFipe: preco.CodigoFipe,
            valor: preco.Valor,
            valorNumerico: parseValorFipe(preco.Valor),
            marca: preco.Marca,
            modelo: preco.Modelo,
            anoModelo: parseInt(preco.AnoModelo) || preco.AnoModelo,
            combustivel: preco.Combustivel,
            mesReferencia: preco.MesReferencia,
            // Códigos para referência
            marcaCodigo: marcaEncontrada.codigo,
            modeloCodigo: String(modeloEncontrado.codigo),
            anoCodigo: anoEncontrado.codigo
          }
        };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: `Action "${action}" não reconhecida` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro no fipe-lookup:', error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
