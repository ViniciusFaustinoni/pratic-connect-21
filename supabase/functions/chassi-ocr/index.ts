import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const systemPrompt = `Você é um especialista em identificação de chassis de veículos (VIN - Vehicle Identification Number).

Analise a imagem e extraia o número do chassi visível.

O chassi (VIN) tem EXATAMENTE 17 caracteres alfanuméricos.
- Não contém as letras I, O, Q (para evitar confusão com 1, 0)
- Pode estar gravado em plaqueta metálica, carimbado na lataria, ou gravado no vidro
- Geralmente começa com 9B (veículos brasileiros) ou outros prefixos internacionais

Retorne APENAS um JSON válido com esta estrutura:
{
  "chassi": "string de 17 caracteres" ou null se não conseguir ler,
  "confianca": número de 0.0 a 1.0 indicando certeza da leitura,
  "legivel": true se conseguiu ler, false se não,
  "observacao": "breve explicação do que viu"
}

IMPORTANTE:
- Se a imagem estiver borrada, escura ou ilegível, retorne legivel: false e chassi: null
- Normalize o resultado: remova espaços e converta para maiúsculas
- Se tiver dúvida sobre algum caractere, indique na observação`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

  try {
    const { url, vistoriaId, chassiEsperado } = await req.json();

    if (!url) {
      clearTimeout(timeoutId);
      return new Response(
        JSON.stringify({ error: 'URL da imagem é obrigatória', chassi: null, confianca: 0, legivel: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      clearTimeout(timeoutId);
      return new Response(
        JSON.stringify({ error: 'Serviço de IA não configurado', chassi: null, confianca: 0, legivel: false }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Chassi-OCR] Analisando imagem:', url.substring(0, 100));
    console.log('[Chassi-OCR] Chassi esperado:', chassiEsperado || 'não informado');

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
              { type: 'text', text: 'Extraia o número do chassi (VIN) visível nesta imagem:' },
              { type: 'image_url', image_url: { url } },
            ],
          },
        ],
        max_tokens: 200,
        temperature: 0,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Chassi-OCR] Erro AI:', response.status, errorText);
      
      const errorResponse = { chassi: null, confianca: 0, legivel: false, validacao: null };
      
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
        JSON.stringify({ chassi: null, confianca: 0, legivel: false, observacao: 'Resposta vazia da IA' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Chassi-OCR] Resposta IA:', content.substring(0, 200));

    // Parsear JSON
    let result;
    try {
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(cleanContent);
    } catch {
      console.error('[Chassi-OCR] Parse JSON falhou:', content);
      return new Response(
        JSON.stringify({ chassi: null, confianca: 0, legivel: false, observacao: 'Erro ao interpretar resposta' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalizar chassi extraído
    let chassiExtraido = result.chassi;
    if (chassiExtraido) {
      chassiExtraido = chassiExtraido.toUpperCase().replace(/\s/g, '').replace(/[^A-Z0-9]/g, '');
      result.chassi = chassiExtraido;
    }

    // Determinar validação
    let validacao: 'confere' | 'diverge' | 'ilegivel' = 'ilegivel';
    
    if (!result.legivel || result.confianca < 0.7 || !chassiExtraido) {
      validacao = 'ilegivel';
    } else if (chassiEsperado) {
      // Normalizar chassi esperado para comparação
      const chassiEsperadoNormalizado = chassiEsperado.toUpperCase().replace(/\s/g, '').replace(/[^A-Z0-9]/g, '');
      
      if (chassiExtraido === chassiEsperadoNormalizado) {
        validacao = 'confere';
      } else {
        validacao = 'diverge';
        console.log('[Chassi-OCR] DIVERGÊNCIA DETECTADA!');
        console.log('  Esperado:', chassiEsperadoNormalizado);
        console.log('  Extraído:', chassiExtraido);
      }
    } else {
      // Sem chassi esperado para comparar, apenas marcar como extraído com sucesso
      validacao = 'confere'; // Será sobrescrito se houver chassi do veículo
    }

    result.validacao = validacao;

    // Salvar resultado na vistoria (em background)
    if (vistoriaId) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      // Se não temos chassi esperado, buscar do veículo vinculado
      if (!chassiEsperado) {
        const { data: vistoriaData } = await supabase
          .from('vistorias')
          .select('veiculo_id')
          .eq('id', vistoriaId)
          .single();
        
        if (vistoriaData?.veiculo_id) {
          const { data: veiculoData } = await supabase
            .from('veiculos')
            .select('chassi')
            .eq('id', vistoriaData.veiculo_id)
            .single();
          
          if (veiculoData?.chassi && chassiExtraido) {
            const chassiVeiculo = veiculoData.chassi.toUpperCase().replace(/\s/g, '').replace(/[^A-Z0-9]/g, '');
            validacao = chassiExtraido === chassiVeiculo ? 'confere' : 'diverge';
            result.validacao = validacao;
            result.chassiEsperado = chassiVeiculo;
            
            console.log('[Chassi-OCR] Comparação com veículo:');
            console.log('  Chassi veículo:', chassiVeiculo);
            console.log('  Chassi foto:', chassiExtraido);
            console.log('  Resultado:', validacao);
          }
        }
      }

      // Atualizar vistoria com resultado do OCR
      const { error: updateError } = await supabase
        .from('vistorias')
        .update({
          chassi_ocr: chassiExtraido || null,
          chassi_ocr_confianca: result.confianca ? Math.round(result.confianca * 100) : null,
          chassi_validacao: validacao,
        })
        .eq('id', vistoriaId);

      if (updateError) {
        console.error('[Chassi-OCR] Erro ao atualizar vistoria:', updateError.message);
      } else {
        console.log('[Chassi-OCR] Vistoria atualizada com sucesso');
      }
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[Chassi-OCR] Timeout');
      return new Response(
        JSON.stringify({ chassi: null, confianca: 0, legivel: false, error: 'Timeout - tente novamente' }),
        { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.error('[Chassi-OCR] Erro:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro interno',
        chassi: null, 
        confianca: 0, 
        legivel: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
