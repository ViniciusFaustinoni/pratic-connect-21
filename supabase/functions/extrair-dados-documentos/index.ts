import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const systemPrompt = `Você é um analista especializado em documentos brasileiros. Analise as imagens dos documentos enviados e extraia TODAS as informações relevantes de forma estruturada.

Tipos de documento que você pode identificar:
- CNH (Carteira Nacional de Habilitação) - contém dados pessoais completos
- RG (Registro Geral / Identidade) - contém dados pessoais
- CPF (Cadastro de Pessoa Física)
- CRLV (Certificado de Registro e Licenciamento de Veículo) - contém dados do veículo
- Comprovante de Residência - contém endereço completo
- Documento do veículo (fotos)

Para cada documento analise e extraia o máximo de dados possível.

IMPORTANTE:
- Extraia TODOS os campos legíveis, mesmo parcialmente
- Para datas, use o formato YYYY-MM-DD
- Para CPF, use o formato 000.000.000-00
- Para telefone, use (00) 00000-0000
- Se não conseguir ler algum campo, retorne null
- Indique o nível de confiança de cada campo extraído

Retorne APENAS um JSON válido no formato:
{
  "documentos": [
    {
      "tipo": "cnh|rg|cpf|crlv|comprovante_residencia|foto_veiculo|outro",
      "legivel": true|false,
      "confianca_geral": 0-100,
      "dados": {
        // Campos variam por tipo de documento
      }
    }
  ],
  "dados_consolidados": {
    "cliente": {
      "nome": "string ou null",
      "cpf": "000.000.000-00 ou null",
      "rg": "string ou null",
      "data_nascimento": "YYYY-MM-DD ou null",
      "nome_mae": "string ou null",
      "nome_pai": "string ou null",
      "nacionalidade": "string ou null",
      "naturalidade": "string ou null",
      "sexo": "M|F ou null",
      "cnh_numero": "string ou null",
      "cnh_categoria": "string ou null",
      "cnh_validade": "YYYY-MM-DD ou null"
    },
    "endereco": {
      "cep": "00000-000 ou null",
      "logradouro": "string ou null",
      "numero": "string ou null",
      "complemento": "string ou null",
      "bairro": "string ou null",
      "cidade": "string ou null",
      "estado": "UF ou null"
    },
    "veiculo": {
      "placa": "string ou null",
      "chassi": "string ou null",
      "renavam": "string ou null",
      "marca": "string ou null",
      "modelo": "string ou null",
      "ano_fabricacao": "number ou null",
      "ano_modelo": "number ou null",
      "cor": "string ou null",
      "combustivel": "string ou null",
      "categoria": "string ou null",
      "especie": "string ou null",
      "capacidade": "string ou null",
      "potencia": "string ou null",
      "cilindradas": "string ou null"
    }
  },
  "campos_faltantes": ["lista de campos obrigatórios não encontrados"],
  "avisos": ["lista de avisos ou problemas encontrados"]
}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { urls } = await req.json();

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'URLs dos documentos são obrigatórias' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Serviço de IA não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Construir conteúdo com múltiplas imagens
    const imageContents = urls.map((url: string) => ({
      type: 'image_url',
      image_url: { url }
    }));

    const userContent = [
      { 
        type: 'text', 
        text: `Analise estes ${urls.length} documento(s) e extraia todas as informações disponíveis. Retorne os dados consolidados de todos os documentos.` 
      },
      ...imageContents
    ];

    console.log('Calling Lovable AI for document extraction:', urls.length, 'documents');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        max_tokens: 2000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns segundos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos de IA esgotados. Entre em contato com o suporte.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Erro ao processar documentos com IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content in AI response');
      return new Response(
        JSON.stringify({ error: 'Resposta vazia da IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Tentar parsear o JSON da resposta
    let result;
    try {
      // Remover possíveis backticks de markdown
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse OCR result:', content);
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao interpretar resultado da análise',
          rawResponse: content,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extraction result:', JSON.stringify(result, null, 2));

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extrair-dados-documentos function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
