import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const systemPrompt = `Você é um analista especializado em documentos brasileiros. Analise a imagem do documento e extraia as informações relevantes.

Tipos de documento que você pode identificar:
- CNH (Carteira Nacional de Habilitação)
- CRLV (Certificado de Registro e Licenciamento de Veículo)
- RG (Registro Geral / Identidade)
- Comprovante de Residência
- Documento do veículo (fotos)
- Outro

Para cada documento, extraia:
1. Tipo do documento identificado
2. Nome completo (se visível)
3. CPF (se visível, formato: 000.000.000-00)
4. Data de validade (se aplicável, formato: YYYY-MM-DD)
5. Se o documento está legível
6. Se o documento parece válido (não adulterado, não vencido se tiver validade)
7. Sugestão de ação: aprovar, reprovar ou revisar
8. Motivo da sugestão
9. Nível de confiança (0-100)

IMPORTANTE: 
- Verifique se o documento está vencido comparando com a data atual
- Se não conseguir ler algum campo, informe como null
- Se houver suspeita de adulteração ou documento ilegível, sugira reprovar
- Seja conservador: em caso de dúvida, sugira revisar

Retorne APENAS um JSON válido no formato:
{
  "tipo": "cnh|crlv|rg|comprovante_residencia|foto_veiculo|outro",
  "nome": "Nome Completo ou null",
  "cpf": "000.000.000-00 ou null",
  "validade": "YYYY-MM-DD ou null",
  "legivel": true|false,
  "valido": true|false,
  "sugestao": "aprovar|reprovar|revisar",
  "motivo": "Explicação breve da sugestão",
  "confianca": 0-100
}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, tipoEsperado, cpfEsperado, nomeEsperado } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL do documento é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Serviço de OCR não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Adicionar contexto extra ao prompt se tivermos dados esperados
    let userPrompt = 'Analise este documento e extraia as informações.';
    if (tipoEsperado) {
      userPrompt += ` Tipo esperado: ${tipoEsperado}.`;
    }
    if (cpfEsperado) {
      userPrompt += ` CPF esperado no cadastro: ${cpfEsperado}. Verifique se confere.`;
    }
    if (nomeEsperado) {
      userPrompt += ` Nome esperado no cadastro: ${nomeEsperado}. Verifique se confere.`;
    }

    console.log('Calling OpenAI Vision API for document:', url);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              { type: 'image_url', image_url: { url } },
            ],
          },
        ],
        max_tokens: 500,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Erro ao processar documento com IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content in OpenAI response');
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

    console.log('OCR result:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in document-ocr function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
