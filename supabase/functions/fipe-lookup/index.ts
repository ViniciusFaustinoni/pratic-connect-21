import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FIPE_API = 'http://api.fipeapi.com.br/v1';

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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('FIPE_API_KEY');
    if (!apiKey) {
      console.error('FIPE_API_KEY não configurada');
      throw new Error('API Key não configurada');
    }

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
        // GET /carros?{apiKey} - Lista marcas
        const response = await fetch(`${FIPE_API}/${tipo}?${apiKey}`);
        if (!response.ok) {
          console.error('Erro ao buscar marcas:', response.status);
          throw new Error('Erro ao buscar marcas');
        }
        const data = await response.json();
        // Mapear para formato esperado: { codigo, nome }
        const marcas = data.map((m: { id: string; name: string }) => ({
          codigo: m.id,
          nome: m.name
        }));
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
        // GET /carros/{id_marca}?{apiKey} - Lista modelos
        const response = await fetch(`${FIPE_API}/${tipo}/${marcaCodigo}?${apiKey}`);
        if (!response.ok) {
          console.error('Erro ao buscar modelos:', response.status);
          throw new Error('Erro ao buscar modelos');
        }
        const data = await response.json();
        // Mapear para formato esperado
        const modelos = data.map((m: { id_modelo: string; name: string }) => ({
          codigo: m.id_modelo,
          nome: m.name
        }));
        result = { success: true, data: { modelos } };
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
        // GET /carros/{id_marca}/{id_modelo}?{apiKey} - Lista anos
        const response = await fetch(`${FIPE_API}/${tipo}/${marcaCodigo}/${modeloCodigo}?${apiKey}`);
        if (!response.ok) {
          console.error('Erro ao buscar anos:', response.status);
          throw new Error('Erro ao buscar anos');
        }
        const data = await response.json();
        // Mapear para formato esperado
        const anos = data.map((a: { id: string; name: string; id_modelo_ano: string }) => ({
          codigo: a.id || a.id_modelo_ano,
          nome: a.name
        }));
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

        // GET /carros/{id_marca}/{id_modelo}/{id_ano}?{apiKey} - Busca preço
        const response = await fetch(
          `${FIPE_API}/${tipo}/${marcaCodigo}/${modeloCodigo}/${anoCodigo}?${apiKey}`
        );
        if (!response.ok) {
          console.error('Erro ao buscar preço:', response.status);
          throw new Error('Erro ao buscar preço');
        }
        const data = await response.json();

        result = {
          success: true,
          data: {
            codigoFipe: data.fipe_codigo,
            valor: data.preco,
            valorNumerico: parseValorFipe(data.preco),
            marca: data.marca,
            modelo: data.modelo,
            anoModelo: parseInt(data.ano) || data.ano_modelo,
            combustivel: data.combustivel,
            mesReferencia: data.ano_modelo || data.ano
          }
        };
        break;
      }

      case 'buscar-por-fipe': {
        const codigoFipe = params.codigoFipe || params.codigo;
        if (!codigoFipe) {
          return new Response(
            JSON.stringify({ success: false, error: 'Parâmetro "codigoFipe" é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // GET /fipe/{codigo-fipe}?{apiKey} - Busca por código FIPE
        const response = await fetch(`${FIPE_API}/fipe/${codigoFipe}?${apiKey}`);
        if (!response.ok) {
          console.error('Erro ao buscar por código FIPE:', response.status);
          throw new Error('Erro ao buscar por código FIPE');
        }
        const data = await response.json();
        
        // Retorna array, pegar primeiro item
        const veiculo = Array.isArray(data) ? data[0] : data;
        
        result = {
          success: true,
          found: !!veiculo,
          data: veiculo ? {
            codigoFipe: veiculo.fipe_codigo,
            valor: veiculo.preco,
            valorNumerico: parseValorFipe(veiculo.preco),
            marca: veiculo.marca,
            modelo: veiculo.modelo,
            anoModelo: parseInt(veiculo.ano),
            combustivel: veiculo.combustivel
          } : null
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
        const marcasResp = await fetch(`${FIPE_API}/${tipo}?${apiKey}`);
        if (!marcasResp.ok) throw new Error('Erro ao buscar marcas');
        const marcasData: Array<{ id: string; name: string }> = await marcasResp.json();
        const marcas = marcasData.map(m => ({ codigo: m.id, nome: m.name }));

        // Fuzzy match para marca
        const marcaEncontrada = marcas.find((m) => fuzzyMatch(marca, m.nome));

        if (!marcaEncontrada) {
          console.log(`Marca não encontrada: ${marca}`);
          return new Response(
            JSON.stringify({ success: false, found: false, error: 'Marca não encontrada' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`Marca encontrada: ${marcaEncontrada.nome} (${marcaEncontrada.codigo})`);

        // 2. Buscar modelos
        const modelosResp = await fetch(`${FIPE_API}/${tipo}/${marcaEncontrada.codigo}?${apiKey}`);
        if (!modelosResp.ok) throw new Error('Erro ao buscar modelos');
        const modelosData: Array<{ id_modelo: string; name: string }> = await modelosResp.json();
        const modelos = modelosData.map(m => ({ codigo: m.id_modelo, nome: m.name }));

        // Fuzzy match para modelo
        const modeloEncontrado = modelos.find((m) => fuzzyMatch(modelo, m.nome));

        if (!modeloEncontrado) {
          console.log(`Modelo não encontrado: ${modelo}`);
          return new Response(
            JSON.stringify({ success: false, found: false, error: 'Modelo não encontrado' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`Modelo encontrado: ${modeloEncontrado.nome} (${modeloEncontrado.codigo})`);

        // 3. Buscar anos
        const anosResp = await fetch(
          `${FIPE_API}/${tipo}/${marcaEncontrada.codigo}/${modeloEncontrado.codigo}?${apiKey}`
        );
        if (!anosResp.ok) throw new Error('Erro ao buscar anos');
        const anosData: Array<{ id: string; name: string; id_modelo_ano: string }> = await anosResp.json();
        const anos = anosData.map(a => ({ codigo: a.id || a.id_modelo_ano, nome: a.name }));

        // Match para ano (se fornecido)
        let anoEncontrado = anos[0]; // Default para o primeiro (mais recente)
        if (ano) {
          const anoMatch = anos.find((a) => a.nome.includes(ano) || a.codigo.startsWith(ano));
          if (anoMatch) {
            anoEncontrado = anoMatch;
          }
        }

        console.log(`Ano selecionado: ${anoEncontrado.nome} (${anoEncontrado.codigo})`);

        // 4. Buscar preço
        const precoResp = await fetch(
          `${FIPE_API}/${tipo}/${marcaEncontrada.codigo}/${modeloEncontrado.codigo}/${anoEncontrado.codigo}?${apiKey}`
        );
        if (!precoResp.ok) throw new Error('Erro ao buscar preço');
        const preco = await precoResp.json();

        console.log(`FIPE encontrado: ${preco.fipe_codigo} - ${preco.preco}`);

        result = {
          success: true,
          found: true,
          data: {
            codigoFipe: preco.fipe_codigo,
            valor: preco.preco,
            valorNumerico: parseValorFipe(preco.preco),
            marca: preco.marca,
            modelo: preco.modelo,
            anoModelo: parseInt(preco.ano) || preco.ano_modelo,
            combustivel: preco.combustivel,
            mesReferencia: preco.ano_modelo || preco.ano,
            // Códigos para referência
            marcaCodigo: marcaEncontrada.codigo,
            modeloCodigo: modeloEncontrado.codigo,
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
