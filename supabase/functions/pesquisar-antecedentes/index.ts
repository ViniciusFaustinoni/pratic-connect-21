import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cpf_cnpj, nome } = await req.json();

    if (!cpf_cnpj || !nome) {
      return new Response(
        JSON.stringify({ error: 'CPF/CNPJ e nome são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isPJ = cpf_cnpj.length > 11;
    const tipoDoc = isPJ ? 'CNPJ' : 'CPF';

    const prompt = `Você é um assistente de pesquisa jurídica para uma associação de proteção veicular (Pratic Car). 
Pesquise e organize informações PÚBLICAS sobre a seguinte pessoa/empresa:

${tipoDoc}: ${cpf_cnpj}
Nome: ${nome}

Retorne um JSON estruturado com as seguintes seções (use tool calling):

1. situacao_cadastral: Status do ${tipoDoc} na Receita Federal (regular, suspenso, cancelado, inapto). Se PJ: razão social, sócios, atividade econômica, data abertura.

2. processos: Processos judiciais públicos envolvendo este ${tipoDoc}/nome. Para cada: número, vara, tipo de ação, partes. Alerte se houver muitos processos.

3. protestos: Títulos protestados em cartório encontrados para este ${tipoDoc}.

4. redes_sociais: Perfis públicos encontrados em redes sociais. Verificar se a pessoa existe e se o perfil condiz com as informações declaradas.

5. noticias: Menções em notícias públicas envolvendo este nome/${tipoDoc}.

6. score_risco: Baseado em TODOS os dados encontrados, calcule: "baixo" (sem irregularidades), "atencao" (alguns processos ou protestos), "alto" (múltiplos processos, ${tipoDoc} irregular, ou padrão suspeito).

IMPORTANTE: Baseie-se apenas em informações que seriam publicamente disponíveis. Não invente dados. Se não encontrar informações em alguma categoria, indique "Nenhuma informação pública encontrada".`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'Você é um assistente de pesquisa jurídica especializado em levantamento de antecedentes para associações de proteção veicular.' },
          { role: 'user', content: prompt },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'retornar_antecedentes',
              description: 'Retorna os antecedentes pesquisados de forma estruturada',
              parameters: {
                type: 'object',
                properties: {
                  situacao_cadastral: { type: 'string', description: 'Situação cadastral do CPF/CNPJ' },
                  processos: { type: 'string', description: 'Processos judiciais públicos encontrados' },
                  protestos: { type: 'string', description: 'Protestos em cartório' },
                  redes_sociais: { type: 'string', description: 'Perfis de redes sociais públicos' },
                  noticias: { type: 'string', description: 'Menções em notícias' },
                  score_risco: { type: 'string', enum: ['baixo', 'atencao', 'alto'], description: 'Score de risco calculado' },
                },
                required: ['situacao_cadastral', 'processos', 'protestos', 'redes_sociais', 'noticias', 'score_risco'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'retornar_antecedentes' } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos ao workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const text = await response.text();
      console.error('AI gateway error:', status, text);
      return new Response(
        JSON.stringify({ error: 'Erro no serviço de IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await response.json();
    
    // Extrair resultado do tool call
    let resultado: any = {};
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        resultado = JSON.parse(toolCall.function.arguments);
      } catch {
        // Fallback: usar o conteúdo da mensagem
        resultado = {
          situacao_cadastral: aiData.choices?.[0]?.message?.content || 'Não foi possível processar',
          processos: '',
          protestos: '',
          redes_sociais: '',
          noticias: '',
          score_risco: 'baixo',
        };
      }
    }

    return new Response(
      JSON.stringify(resultado),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('pesquisar-antecedentes error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
