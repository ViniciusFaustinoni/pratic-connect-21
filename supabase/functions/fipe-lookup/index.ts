import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FIPE_API = 'https://parallelum.com.br/fipe/api/v1';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const tipo = url.searchParams.get('tipo') || 'carros';

    console.log(`FIPE Lookup - Action: ${action}, Tipo: ${tipo}`);

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Parâmetro "action" é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result: unknown;

    switch (action) {
      case 'marcas': {
        const response = await fetch(`${FIPE_API}/${tipo}/marcas`);
        if (!response.ok) throw new Error('Erro ao buscar marcas');
        result = await response.json();
        break;
      }

      case 'modelos': {
        const marca = url.searchParams.get('marca');
        if (!marca) {
          return new Response(
            JSON.stringify({ error: 'Parâmetro "marca" é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const response = await fetch(`${FIPE_API}/${tipo}/marcas/${marca}/modelos`);
        if (!response.ok) throw new Error('Erro ao buscar modelos');
        result = await response.json();
        break;
      }

      case 'anos': {
        const marca = url.searchParams.get('marca');
        const modelo = url.searchParams.get('modelo');
        if (!marca || !modelo) {
          return new Response(
            JSON.stringify({ error: 'Parâmetros "marca" e "modelo" são obrigatórios' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const response = await fetch(`${FIPE_API}/${tipo}/marcas/${marca}/modelos/${modelo}/anos`);
        if (!response.ok) throw new Error('Erro ao buscar anos');
        result = await response.json();
        break;
      }

      case 'preco': {
        const codigo = url.searchParams.get('codigo');
        if (!codigo) {
          return new Response(
            JSON.stringify({ error: 'Parâmetro "codigo" é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // A API Parallelum não suporta busca direta por código, então precisamos fazer o fallback
        // Retornamos erro para indicar que deve usar buscar-por-nome
        return new Response(
          JSON.stringify({ 
            error: 'Use action=buscar-por-nome para busca por nome da marca/modelo',
            message: 'A busca direta por código não é suportada'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'buscar-por-nome': {
        const marca = url.searchParams.get('marca');
        const modelo = url.searchParams.get('modelo');
        const ano = url.searchParams.get('ano');

        if (!marca || !modelo) {
          return new Response(
            JSON.stringify({ error: 'Parâmetros "marca" e "modelo" são obrigatórios' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`Buscando FIPE: ${marca} ${modelo} ${ano || ''}`);

        // 1. Buscar marcas
        const marcasResp = await fetch(`${FIPE_API}/${tipo}/marcas`);
        if (!marcasResp.ok) throw new Error('Erro ao buscar marcas');
        const marcas: Array<{ codigo: string; nome: string }> = await marcasResp.json();

        // Fuzzy match para marca
        const marcaEncontrada = marcas.find((m) =>
          m.nome.toLowerCase().includes(marca.toLowerCase()) ||
          marca.toLowerCase().includes(m.nome.toLowerCase())
        );

        if (!marcaEncontrada) {
          console.log(`Marca não encontrada: ${marca}`);
          return new Response(
            JSON.stringify({ found: false, error: 'Marca não encontrada' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`Marca encontrada: ${marcaEncontrada.nome} (${marcaEncontrada.codigo})`);

        // 2. Buscar modelos
        const modelosResp = await fetch(`${FIPE_API}/${tipo}/marcas/${marcaEncontrada.codigo}/modelos`);
        if (!modelosResp.ok) throw new Error('Erro ao buscar modelos');
        const modelosData: { modelos: Array<{ codigo: number; nome: string }> } = await modelosResp.json();

        // Fuzzy match para modelo
        const modeloNormalizado = modelo.toLowerCase().replace(/[^a-z0-9]/g, '');
        const modeloEncontrado = modelosData.modelos.find((m) => {
          const nomeNormalizado = m.nome.toLowerCase().replace(/[^a-z0-9]/g, '');
          return nomeNormalizado.includes(modeloNormalizado) ||
            modeloNormalizado.includes(nomeNormalizado.split(' ')[0]);
        });

        if (!modeloEncontrado) {
          console.log(`Modelo não encontrado: ${modelo}`);
          return new Response(
            JSON.stringify({ found: false, error: 'Modelo não encontrado' }),
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
          const anoMatch = anos.find((a) => a.nome.includes(ano) || a.codigo.includes(ano));
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
        const preco: {
          Valor: string;
          Marca: string;
          Modelo: string;
          AnoModelo: number;
          Combustivel: string;
          CodigoFipe: string;
          MesReferencia: string;
        } = await precoResp.json();

        // Converter valor para número
        const valorNumerico = parseFloat(
          preco.Valor.replace('R$ ', '').replace('.', '').replace(',', '.')
        );

        console.log(`FIPE encontrado: ${preco.CodigoFipe} - ${preco.Valor}`);

        result = {
          found: true,
          codigo: preco.CodigoFipe,
          valor: preco.Valor,
          valorNumerico,
          mesReferencia: preco.MesReferencia,
          marca: preco.Marca,
          modelo: preco.Modelo,
          anoModelo: preco.AnoModelo,
          combustivel: preco.Combustivel,
        };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Action "${action}" não reconhecida` }),
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
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
