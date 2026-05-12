// Edge function: placa-ocr
// Lê a placa visível em uma foto da autovistoria via AI Gateway (Gemini)
// e compara, de forma resiliente a confusões comuns de OCR (0/O, 1/I etc.),
// com a placa esperada do veículo cadastrado.
//
// Request body:
//   {
//     url: string,                // URL pública da foto
//     placaEsperada?: string,     // placa do veículo cadastrado
//     fotoTipo?: string           // ex.: 'frente_centro' (apenas para log)
//   }
//
// Response:
//   {
//     placa: string | null,       // placa lida (normalizada, sem hífen)
//     match: boolean,             // true quando bate com placaEsperada
//     legivel: boolean,
//     confianca: number,          // 0..1
//     observacao?: string,
//     placaEsperadaNormalizada?: string,
//     skipped?: boolean           // true quando 0KM (não há placa real)
//   }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { aiGatewayFetch } from '../_shared/ai-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLACA_PLACEHOLDER_REGEX = /^0KM[A-Z0-9]{5}$/i;
const PLACA_ANTIGA_REGEX = /^[A-Z]{3}[0-9]{4}$/;
const PLACA_MERCOSUL_REGEX = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;

const LETTER_TO_DIGIT: Record<string, string> = {
  O: '0', Q: '0', D: '0',
  I: '1', L: '1',
  Z: '2',
  S: '5',
  G: '6',
  T: '7',
  B: '8',
};
const DIGIT_TO_LETTER: Record<string, string> = {
  '0': 'O', '1': 'I', '2': 'Z', '5': 'S', '6': 'G', '8': 'B',
};

const limparPlaca = (p: string) => (p || '').replace(/[-\s]/g, '').toUpperCase().trim();

type FormatoPlaca = 'antiga' | 'mercosul' | 'desconhecido';
const detectarFormato = (placa: string): FormatoPlaca => {
  if (PLACA_ANTIGA_REGEX.test(placa)) return 'antiga';
  if (PLACA_MERCOSUL_REGEX.test(placa)) return 'mercosul';
  return 'desconhecido';
};
const sanearParaFormato = (placa: string, formato: FormatoPlaca): string => {
  if (placa.length !== 7 || formato === 'desconhecido') return placa;
  return placa.split('').map((ch, i) => {
    let isLetterPos = false;
    let isDigitPos = false;
    if (formato === 'antiga') {
      isLetterPos = i <= 2;
      isDigitPos = i >= 3;
    } else {
      isLetterPos = i <= 2 || i === 4;
      isDigitPos = i === 3 || i === 5 || i === 6;
    }
    if (isLetterPos && DIGIT_TO_LETTER[ch]) return DIGIT_TO_LETTER[ch];
    if (isDigitPos && LETTER_TO_DIGIT[ch]) return LETTER_TO_DIGIT[ch];
    return ch;
  }).join('');
};
const placasEquivalentes = (a: string, b: string) => {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length !== 7 || b.length !== 7) return false;
  const fb = detectarFormato(b);
  if (fb !== 'desconhecido' && sanearParaFormato(a, fb) === b) return true;
  const fa = detectarFormato(a);
  if (fa !== 'desconhecido' && fa !== fb && sanearParaFormato(a, fa) === b) return true;
  return sanearParaFormato(a, 'antiga') === sanearParaFormato(b, 'antiga');
};

const systemPrompt = `Você é um OCR especialista em PLACAS DE VEÍCULOS BRASILEIROS.

A placa pode estar em dois formatos:
- ANTIGA: 3 letras + 4 dígitos (ex: ABC1234)
- MERCOSUL: 3 letras + 1 dígito + 1 letra + 2 dígitos (ex: ABC1D23)

Analise a imagem e extraia APENAS o texto da placa visível (dianteira ou traseira).

Retorne APENAS um JSON válido:
{
  "placa": "AAA9A99 ou AAA9999 sem hífen e em maiúsculas, ou null se ilegível",
  "confianca": número de 0.0 a 1.0,
  "legivel": true se conseguiu ler a placa, false caso contrário,
  "observacao": "breve descrição do que viu"
}

REGRAS:
- Remova hífens, espaços e caracteres especiais
- Converta para maiúsculas
- Se houver mais de uma placa visível (dianteira + traseira de outro carro), retorne a MAIS LEGÍVEL e centralizada
- Se a foto não tiver placa visível, retorne legivel:false e placa:null
- Se a placa estiver borrada/cortada, retorne legivel:false`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const body = await req.json().catch(() => ({}));
    const { url, placaEsperada, fotoTipo } = body as {
      url?: string;
      placaEsperada?: string;
      fotoTipo?: string;
    };

    if (!url) {
      clearTimeout(timeoutId);
      return new Response(
        JSON.stringify({ error: 'URL da imagem é obrigatória', placa: null, match: false, legivel: false, confianca: 0 }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Veículo 0KM: não há placa real, pula validação.
    if (placaEsperada && PLACA_PLACEHOLDER_REGEX.test(placaEsperada.trim())) {
      clearTimeout(timeoutId);
      return new Response(
        JSON.stringify({
          placa: null,
          match: true,
          legivel: true,
          confianca: 1,
          skipped: true,
          observacao: 'Veículo 0KM — validação de placa pulada.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      clearTimeout(timeoutId);
      return new Response(
        JSON.stringify({ error: 'Serviço de IA não configurado', placa: null, match: false, legivel: false, confianca: 0 }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log('[Placa-OCR] foto=%s url=%s placa_esperada=%s', fotoTipo || '?', url.substring(0, 100), placaEsperada || '');

    const response = await aiGatewayFetch({
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
              { type: 'text', text: 'Extraia o texto da placa visível nesta imagem:' },
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
      console.error('[Placa-OCR] erro AI %d: %s', response.status, errorText);
      const base = { placa: null, match: false, legivel: false, confianca: 0 };
      if (response.status === 429) {
        return new Response(JSON.stringify({ ...base, error: 'Limite de requisições excedido' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ ...base, error: 'Créditos de IA esgotados' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ ...base, error: 'Erro ao processar imagem' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(
        JSON.stringify({ placa: null, match: false, legivel: false, confianca: 0, observacao: 'Resposta vazia da IA' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let result: { placa?: string | null; confianca?: number; legivel?: boolean; observacao?: string };
    try {
      const clean = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(clean);
    } catch {
      console.error('[Placa-OCR] parse JSON falhou:', content);
      return new Response(
        JSON.stringify({ placa: null, match: false, legivel: false, confianca: 0, observacao: 'Erro ao interpretar resposta' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const placaLida = result.placa ? limparPlaca(result.placa) : null;
    const placaEsperadaNorm = placaEsperada ? limparPlaca(placaEsperada) : '';
    const confianca = typeof result.confianca === 'number' ? result.confianca : 0;
    const legivel = !!result.legivel && !!placaLida;

    let match = false;
    if (legivel && placaEsperadaNorm) {
      match = placasEquivalentes(placaLida!, placaEsperadaNorm);
    } else if (legivel && !placaEsperadaNorm) {
      // Sem placa de referência (caso edge), considera "ok" para não bloquear o fluxo.
      match = true;
    }

    console.log('[Placa-OCR] resultado lida=%s esperada=%s match=%s confianca=%s',
      placaLida, placaEsperadaNorm, match, confianca);

    return new Response(
      JSON.stringify({
        placa: placaLida,
        match,
        legivel,
        confianca,
        observacao: result.observacao || null,
        placaEsperadaNormalizada: placaEsperadaNorm || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[Placa-OCR] timeout');
      return new Response(
        JSON.stringify({ placa: null, match: false, legivel: false, confianca: 0, error: 'Timeout — tente novamente' }),
        { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    console.error('[Placa-OCR] erro:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Erro interno',
        placa: null, match: false, legivel: false, confianca: 0,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
