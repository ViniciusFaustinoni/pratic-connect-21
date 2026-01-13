import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const systemPrompt = `Você é um analista especializado em documentos brasileiros. Analise a imagem do documento e:
1. IDENTIFIQUE AUTOMATICAMENTE o tipo do documento
2. EXTRAIA todos os dados relevantes

## Tipos de Documento que você pode identificar:

### CNH (Carteira Nacional de Habilitação)
Extrair: nome, cpf, rg, data_nascimento, validade, categoria

### RG (Registro Geral / Identidade)
Extrair: nome, rg, cpf (se disponível), data_nascimento, data_expedicao

### CRLV (Certificado de Registro e Licenciamento de Veículo)
Extrair: placa, renavam, chassi, marca, modelo, ano_fabricacao, ano_modelo, cor, combustivel, nome_proprietario

### Comprovante de Residência (conta de luz, água, telefone, etc.)
Extrair: logradouro, numero, complemento, bairro, cidade, uf, cep, nome_titular

### Outro documento
Identificar e extrair o que for possível

## Regras:
- Verifique se o documento está vencido comparando com a data atual
- Se não conseguir ler algum campo, use null
- Se houver suspeita de adulteração ou documento ilegível, sugira reprovar
- Seja conservador: em caso de dúvida, sugira revisar
- Para CPF, formate como 000.000.000-00
- Para datas, formate como YYYY-MM-DD
- Para placa, aceite formato antigo (ABC-1234) ou Mercosul (ABC1D23)

## RETORNE APENAS UM JSON VÁLIDO no formato:
{
  "tipo_detectado": "cnh" | "rg" | "crlv" | "comprovante_residencia" | "outro",
  "sucesso": true | false,
  "dados": {
    // campos extraídos específicos do tipo de documento
  },
  "legivel": true | false,
  "valido": true | false,
  "sugestao": "aprovar" | "reprovar" | "revisar",
  "motivo": "Explicação breve da sugestão",
  "confianca": 0.0 a 1.0
}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { url, cpfEsperado, nomeEsperado } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL do documento é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Serviço de OCR não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Adicionar contexto extra ao prompt se tivermos dados esperados
    let userPrompt = 'Analise este documento e extraia todas as informações. DETECTE AUTOMATICAMENTE o tipo do documento.';
    if (cpfEsperado) {
      userPrompt += ` CPF esperado no cadastro: ${cpfEsperado}. Verifique se confere.`;
    }
    if (nomeEsperado) {
      userPrompt += ` Nome esperado no cadastro: ${nomeEsperado}. Verifique se confere.`;
    }

    console.log('Calling Lovable AI Gateway for document OCR:', url);

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
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              { type: 'image_url', image_url: { url } },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido, tente novamente mais tarde.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos esgotados, adicione créditos ao workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Erro ao processar documento com IA' }),
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
