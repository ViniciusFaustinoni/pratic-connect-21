import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const systemPrompt = `Você é um especialista em análise de orçamentos de reparo automotivo em PDF.
Analise o conteúdo do PDF e extraia TODOS os itens encontrados.

REGRAS IMPORTANTES:
- Peças com operação "T" (Troca) devem ser tipo "peca"
- Peças com operação "R&I" (Remover & Instalar) devem ser tipo "peca" com observação "R&I"
- Serviços de mão de obra (funilaria, pintura, reparação, vidraçaria, tapeçaria, elétrica, mecânica) devem ser tipo "mao_de_obra"
- Para peças: use o preço líquido (após desconto) como valor_unitario
- Para mão de obra: use o valor total da categoria
- Quantidade padrão é 1, a menos que explicitamente indicado diferente
- Extraia o resumo geral com totais`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfUrl } = await req.json();
    if (!pdfUrl) {
      return new Response(JSON.stringify({ error: 'pdfUrl é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    // Fetch the PDF and convert to base64
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Falha ao baixar PDF: ${pdfResponse.status}`);
    }
    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analise este PDF de orçamento de reparo automotivo e extraia todas as peças, serviços de mão de obra e o resumo de valores.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`,
                },
              },
            ],
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extrair_orcamento',
              description: 'Extrai peças, serviços e resumo de um orçamento de reparo automotivo em PDF',
              parameters: {
                type: 'object',
                properties: {
                  pecas: {
                    type: 'array',
                    description: 'Lista de peças extraídas do orçamento',
                    items: {
                      type: 'object',
                      properties: {
                        descricao: { type: 'string', description: 'Nome/título da peça' },
                        operacao: { type: 'string', description: 'Tipo de operação: T (troca) ou R&I (remover e instalar)' },
                        quantidade: { type: 'number', description: 'Quantidade (padrão 1)' },
                        valor_unitario: { type: 'number', description: 'Preço líquido unitário da peça (após desconto)' },
                        valor_total: { type: 'number', description: 'Valor total (qtd x unitário)' },
                        origem: { type: 'string', description: 'Origem da peça se identificável: original, seminova, paralela' },
                      },
                      required: ['descricao', 'quantidade', 'valor_unitario', 'valor_total'],
                      additionalProperties: false,
                    },
                  },
                  servicos: {
                    type: 'array',
                    description: 'Lista de serviços de mão de obra',
                    items: {
                      type: 'object',
                      properties: {
                        descricao: { type: 'string', description: 'Descrição do serviço (ex: Funilaria, Pintura, Reparação)' },
                        horas: { type: 'number', description: 'Quantidade de horas' },
                        valor_unitario: { type: 'number', description: 'Valor por hora ou valor total do serviço' },
                        valor_total: { type: 'number', description: 'Valor total do serviço' },
                        tipo_servico: { type: 'string', description: 'Tipo: funilaria, pintura, reparacao, vidracaria, tapecaria, eletrica, mecanica' },
                      },
                      required: ['descricao', 'valor_total'],
                      additionalProperties: false,
                    },
                  },
                  resumo: {
                    type: 'object',
                    description: 'Resumo geral dos valores',
                    properties: {
                      total_pecas: { type: 'number', description: 'Total de peças' },
                      total_mao_obra: { type: 'number', description: 'Total de mão de obra' },
                      total_geral: { type: 'number', description: 'Total geral do orçamento' },
                    },
                    required: ['total_pecas', 'total_mao_obra', 'total_geral'],
                    additionalProperties: false,
                  },
                },
                required: ['pecas', 'servicos', 'resumo'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'extrair_orcamento' } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit excedido. Tente novamente em alguns segundos.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos insuficientes para IA.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`Erro na IA: ${response.status}`);
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall || toolCall.function.name !== 'extrair_orcamento') {
      throw new Error('IA não retornou dados estruturados');
    }

    const extracted = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('extract-orcamento-pdf error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
