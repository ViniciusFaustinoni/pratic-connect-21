import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const systemPrompt = `Extraia a quilometragem total do odômetro. Retorne JSON: {"km":número|null,"confianca":0-1,"legivel":true|false,"observacao":"breve"}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

  try {
    const { url, vistoriaId } = await req.json();

    if (!url) {
      clearTimeout(timeoutId);
      return new Response(
        JSON.stringify({ error: 'URL da imagem é obrigatória', km: null, confianca: 0, legivel: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      clearTimeout(timeoutId);
      return new Response(
        JSON.stringify({ error: 'Serviço de IA não configurado', km: null, confianca: 0, legivel: false }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[OCR] Analisando URL completa:', url);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'KM total do odômetro:' },
              { type: 'image_url', image_url: { url } },
            ],
          },
        ],
        max_tokens: 150,
        temperature: 0,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[OCR] Erro AI:', response.status, errorText);
      
      const errorResponse = { km: null, confianca: 0, legivel: false };
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ ...errorResponse, error: 'Limite de requisições excedido' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ ...errorResponse, error: 'Créditos de IA esgotados' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ ...errorResponse, error: 'Erro ao processar imagem' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ km: null, confianca: 0, legivel: false, observacao: 'Resposta vazia' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[OCR] Resposta:', content.substring(0, 100));

    // Parsear JSON
    let result;
    try {
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(cleanContent);
    } catch {
      console.error('[OCR] Parse falhou:', content);
      return new Response(
        JSON.stringify({ km: null, confianca: 0, legivel: false, observacao: 'Erro ao interpretar' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atualizar vistoria se confiança alta (em background)
    if (result.km && result.confianca >= 0.7 && vistoriaId) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      supabase
        .from('vistorias')
        .update({ km_atual: result.km })
        .eq('id', vistoriaId)
        .then(({ error }) => {
          if (error) console.error('[OCR] Erro update:', error.message);
          else console.log('[OCR] KM salvo:', result.km);
        });
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[OCR] Timeout');
      return new Response(
        JSON.stringify({ km: null, confianca: 0, legivel: false, error: 'Timeout - tente novamente' }),
        { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.error('[OCR] Erro:', error);
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
