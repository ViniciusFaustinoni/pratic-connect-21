import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const systemPrompt = `Você é um especialista em leitura de odômetros veiculares.
Analise a imagem do painel/odômetro do veículo e extraia a quilometragem exibida.

REGRAS:
1. Identifique o odômetro no painel (digital ou analógico)
2. O odômetro mostra a quilometragem TOTAL do veículo (não a parcial/trip)
3. Procure por valores com 5-6 dígitos (ex: 45123, 123456)
4. Ignore: velocidade atual, RPM, temperatura, trip/parcial
5. Se houver decimais, arredonde para inteiro
6. Se múltiplos valores, escolha o maior (geralmente é o total)

RETORNE APENAS JSON (sem markdown, sem explicação):
{
  "km": número inteiro ou null,
  "confianca": 0.0 a 1.0,
  "legivel": true ou false,
  "observacao": "explicação breve"
}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, vistoriaId } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL da imagem é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Serviço de IA não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Analisando odômetro:', url);

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
              { type: 'text', text: 'Extraia a quilometragem total deste odômetro.' },
              { type: 'image_url', image_url: { url } },
            ],
          },
        ],
        max_tokens: 200,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido', km: null, confianca: 0, legivel: false }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos de IA esgotados', km: null, confianca: 0, legivel: false }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Erro ao processar imagem', km: null, confianca: 0, legivel: false }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ km: null, confianca: 0, legivel: false, observacao: 'Resposta vazia da IA' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Resposta da IA:', content);

    // Parsear JSON da resposta
    let result;
    try {
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(cleanContent);
    } catch {
      console.error('Falha ao parsear:', content);
      return new Response(
        JSON.stringify({ km: null, confianca: 0, legivel: false, observacao: 'Erro ao interpretar resposta' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Se temos km com boa confiança, atualizar a vistoria
    if (result.km && result.confianca >= 0.7 && vistoriaId) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const { error: updateError } = await supabase
        .from('vistorias')
        .update({ km_atual: result.km })
        .eq('id', vistoriaId);

      if (updateError) {
        console.error('Erro ao atualizar km:', updateError);
      } else {
        console.log(`KM ${result.km} salvo na vistoria ${vistoriaId}`);
      }
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro interno',
        km: null, 
        confianca: 0, 
        legivel: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
