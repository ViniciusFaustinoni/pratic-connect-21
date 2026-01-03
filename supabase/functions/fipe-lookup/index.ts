import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FIPE_API = 'https://parallelum.com.br/fipe/api/v1';

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
        const response = await fetch(`${FIPE_API}/${tipo}/marcas`);
        if (!response.ok) throw new Error('Erro ao buscar marcas');
        const data = await response.json();
        result = { success: true, data };
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
        const response = await fetch(`${FIPE_API}/${tipo}/marcas/${marcaCodigo}/modelos`);
        if (!response.ok) throw new Error('Erro ao buscar modelos');
        const data = await response.json();
        result = { success: true, data };
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
        const response = await fetch(`${FIPE_API}/${tipo}/marcas/${marcaCodigo}/modelos/${modeloCodigo}/anos`);
        if (!response.ok) throw new Error('Erro ao buscar anos');
        const data = await response.json();
        result = { success: true, data };
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

        const response = await fetch(
          `${FIPE_API}/${tipo}/marcas/${marcaCodigo}/modelos/${modeloCodigo}/anos/${anoCodigo}`
        );
        if (!response.ok) throw new Error('Erro ao buscar preço');
        const data = await response.json();

        result = {
          success: true,
          data: {
            codigoFipe: data.CodigoFipe,
            valor: data.Valor,
            valorNumerico: parseValorFipe(data.Valor),
            marca: data.Marca,
            modelo: data.Modelo,
            anoModelo: data.AnoModelo,
            combustivel: data.Combustivel,
            mesReferencia: data.MesReferencia,
            tipoVeiculo: data.TipoVeiculo,
            siglaCombustivel: data.SiglaCombustivel
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
        const marcasResp = await fetch(`${FIPE_API}/${tipo}/marcas`);
        if (!marcasResp.ok) throw new Error('Erro ao buscar marcas');
        const marcas: Array<{ codigo: string; nome: string }> = await marcasResp.json();

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
        const modelosResp = await fetch(`${FIPE_API}/${tipo}/marcas/${marcaEncontrada.codigo}/modelos`);
        if (!modelosResp.ok) throw new Error('Erro ao buscar modelos');
        const modelosData: { modelos: Array<{ codigo: number; nome: string }> } = await modelosResp.json();

        // Fuzzy match para modelo
        const modeloEncontrado = modelosData.modelos.find((m) => fuzzyMatch(modelo, m.nome));

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
          `${FIPE_API}/${tipo}/marcas/${marcaEncontrada.codigo}/modelos/${modeloEncontrado.codigo}/anos`
        );
        if (!anosResp.ok) throw new Error('Erro ao buscar anos');
        const anos: Array<{ codigo: string; nome: string }> = await anosResp.json();

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
          `${FIPE_API}/${tipo}/marcas/${marcaEncontrada.codigo}/modelos/${modeloEncontrado.codigo}/anos/${anoEncontrado.codigo}`
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
            anoModelo: preco.AnoModelo,
            combustivel: preco.Combustivel,
            mesReferencia: preco.MesReferencia,
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
