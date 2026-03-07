import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const { nome, categoria, corpo, header_tipo, header_texto, rodape, variaveis_exemplo, motivo_rejeicao } = await req.json();

    if (!nome || !corpo) {
      return new Response(JSON.stringify({ error: "Nome e corpo são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é um especialista em aprovação de templates do WhatsApp Business API (Meta).

Sua tarefa é analisar um template e prever se ele será APROVADO ou REJEITADO pela Meta, com base nas políticas oficiais:

## Regras principais da Meta para templates:
1. **Conteúdo proibido**: Não pode conter ameaças, conteúdo discriminatório, linguagem abusiva, produtos ilegais, álcool, tabaco, armas, apostas, conteúdo adulto, golpes ou phishing.
2. **Variáveis**: Devem usar formato {{1}}, {{2}}, etc. Cada variável DEVE ter um exemplo. Variáveis não podem compor 100% da mensagem.
3. **Formatação**: Corpo máximo 1024 chars. Cabeçalho texto máx 60 chars. Rodapé máx 60 chars.
4. **Categoria correta**: UTILITY para transacionais (boletos, confirmações, atualizações de status). MARKETING para promoções e engajamento. AUTHENTICATION para códigos OTP.
5. **Boas práticas**: Mensagem clara e objetiva. Identificar a empresa. Não parecer spam. Variáveis com contexto claro. Não pedir dados sensíveis (senhas, cartões).
6. **Nome do template**: Apenas minúsculas, números e underscores. Deve ser descritivo.

**IMPORTANTE**: Se o motivo da rejeição anterior pela Meta for fornecido, priorize resolver esse problema específico nas suas sugestões e gere um corpo_sugerido corrigido que resolva o problema.

Analise o template fornecido e retorne sua avaliação usando a função disponível.`;

    const userPrompt = `Analise este template WhatsApp:

**Nome**: ${nome}
**Categoria**: ${categoria}
**Header tipo**: ${header_tipo || 'nenhum'}
${header_texto ? `**Header texto**: ${header_texto}` : ''}
**Corpo**: ${corpo}
${rodape ? `**Rodapé**: ${rodape}` : ''}
${variaveis_exemplo ? `**Exemplos de variáveis**: ${JSON.stringify(variaveis_exemplo)}` : ''}

Avalie se este template será aprovado pela Meta e forneça feedback detalhado.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "template_validation_result",
              description: "Retorna o resultado da validação do template WhatsApp",
              parameters: {
                type: "object",
                properties: {
                  score: {
                    type: "number",
                    description: "Nota de 1 a 10 indicando a chance de aprovação (10 = certeza de aprovação)",
                  },
                  aprovado: {
                    type: "boolean",
                    description: "Se o template provavelmente será aprovado pela Meta",
                  },
                  problemas: {
                    type: "array",
                    items: { type: "string" },
                    description: "Lista de problemas encontrados que podem causar rejeição",
                  },
                  sugestoes: {
                    type: "array",
                    items: { type: "string" },
                    description: "Lista de sugestões de melhoria para aumentar a chance de aprovação",
                  },
                  resumo: {
                    type: "string",
                    description: "Resumo geral da avaliação em 1-2 frases",
                  },
                },
                required: ["score", "aprovado", "problemas", "sugestoes", "resumo"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "template_validation_result" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido, tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("Erro ao consultar IA");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("Resposta inesperada da IA");
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Erro validação template:", e);
    return new Response(JSON.stringify({ error: e.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
