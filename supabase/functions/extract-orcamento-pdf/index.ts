import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { aiGatewayFetch } from "../_shared/ai-client.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const systemPrompt = `Você é um especialista em análise de orçamentos de reparo automotivo (Cilia, Audatex, Orion, Sinistro Auto e similares) em PDF.
Sua tarefa: extrair TODOS os dados estruturados do documento, preservando a hierarquia entre peças e suas operações de mão de obra.

REGRAS DE EXTRAÇÃO:

1) METADADOS DO CABEÇALHO (header):
   - Identifique placa, chassi (VIN), marca, modelo, ano, cor, KM, valor FIPE.
   - Identifique a oficina/reparador (nome, CNPJ, cidade/UF) quando disponível.
   - Identifique número/código do orçamento, data de emissão e tipo de sinistro (colisão, roubo, etc) quando explicitado.

2) ÁREAS DE IMPACTO (impact_areas):
   - Cilia/Audatex agrupam peças por região do veículo (ex: "Dianteira Esquerda", "Lateral Direita", "Traseira").
   - Liste cada área encontrada com a quantidade de peças que pertencem a ela.

3) PEÇAS (pecas) - uma linha por peça física:
   - operacao: SEMPRE classifique como uma das seguintes:
       * "T"   = Troca (peça nova substitui)
       * "R&I" = Remover e Instalar (peça reaproveitada, sem substituição)
       * "REP" = Reparar (a peça em si será reparada, não trocada)
       * "PIN" = Apenas pintar (peça já existente recebe pintura)
   - area_impacto: nome da área agrupadora (igual ao listado em impact_areas).
   - horas_funilaria, horas_pintura, horas_reparo: TODAS as horas associadas àquela peça específica (não some em linhas separadas — vincule à peça pai).
   - valor_unitario: preço LÍQUIDO (após desconto) da peça em si. Se for R&I/REP/PIN sem peça nova, valor_unitario = 0.
   - flags: marque "sem_amparo" se a peça aparece como não coberta/excluída do orçamento; "inclusao_manual" se foi incluída fora da varredura automática.
   - origem: original | seminova | paralela | reaproveitada (quando identificável).

4) SERVIÇOS AVULSOS (servicos) - apenas serviços que NÃO estão vinculados a uma peça específica:
   - Ex: lavagem, alinhamento geral, diagnóstico, transporte/guincho.
   - NÃO duplique aqui horas que já foram vinculadas a uma peça em "pecas".

5) RESUMO (resumo):
   - Some os totais conforme aparecem no rodapé do PDF (peças, mão de obra, total geral).

ATENÇÃO: NÃO invente valores. Se um campo não existe no PDF, omita ou retorne null. Quantidade padrão = 1.`;

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
    // Convert to base64 in chunks to avoid stack overflow on large PDFs
    const bytes = new Uint8Array(pdfBuffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const pdfBase64 = btoa(binary);

    // Hash do PDF (para idempotência futura na Fase 4)
    const hashBuffer = await crypto.subtle.digest('SHA-256', pdfBuffer);
    const orcamento_hash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const response = await aiGatewayFetch({
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analise este PDF de orçamento de reparo automotivo e extraia metadados, áreas de impacto, peças (com horas vinculadas), serviços avulsos e resumo.',
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
              description: 'Extrai metadados, áreas de impacto, peças (com horas vinculadas), serviços avulsos e resumo de um orçamento de reparo automotivo em PDF.',
              parameters: {
                type: 'object',
                properties: {
                  header: {
                    type: 'object',
                    description: 'Metadados do cabeçalho do orçamento.',
                    properties: {
                      placa: { type: ['string', 'null'] },
                      chassi: { type: ['string', 'null'] },
                      marca: { type: ['string', 'null'] },
                      modelo: { type: ['string', 'null'] },
                      ano: { type: ['string', 'null'] },
                      cor: { type: ['string', 'null'] },
                      km: { type: ['number', 'null'] },
                      valor_fipe: { type: ['number', 'null'] },
                      oficina_nome: { type: ['string', 'null'] },
                      oficina_cnpj: { type: ['string', 'null'] },
                      oficina_cidade_uf: { type: ['string', 'null'] },
                      numero_orcamento: { type: ['string', 'null'] },
                      data_emissao: { type: ['string', 'null'], description: 'YYYY-MM-DD se possível' },
                      tipo_sinistro: { type: ['string', 'null'] },
                    },
                    required: [
                      'placa', 'chassi', 'marca', 'modelo', 'ano', 'cor', 'km', 'valor_fipe',
                      'oficina_nome', 'oficina_cnpj', 'oficina_cidade_uf',
                      'numero_orcamento', 'data_emissao', 'tipo_sinistro',
                    ],
                    additionalProperties: false,
                  },
                  impact_areas: {
                    type: 'array',
                    description: 'Áreas de impacto identificadas no orçamento.',
                    items: {
                      type: 'object',
                      properties: {
                        nome: { type: 'string', description: 'Ex: Dianteira Esquerda, Traseira, Lateral Direita' },
                        qtd_pecas: { type: 'number' },
                      },
                      required: ['nome', 'qtd_pecas'],
                      additionalProperties: false,
                    },
                  },
                  pecas: {
                    type: 'array',
                    description: 'Peças do orçamento. Cada peça pode ter horas de funilaria/pintura/reparo vinculadas.',
                    items: {
                      type: 'object',
                      properties: {
                        descricao: { type: 'string' },
                        operacao: {
                          type: 'string',
                          enum: ['T', 'R&I', 'REP', 'PIN'],
                          description: 'T=Troca, R&I=Remover e Instalar, REP=Reparar, PIN=Pintar',
                        },
                        area_impacto: { type: ['string', 'null'] },
                        quantidade: { type: 'number' },
                        valor_unitario: { type: 'number', description: 'Preço líquido da peça (0 se R&I/REP/PIN sem peça nova)' },
                        valor_total: { type: 'number' },
                        horas_funilaria: { type: ['number', 'null'] },
                        horas_pintura: { type: ['number', 'null'] },
                        horas_reparo: { type: ['number', 'null'] },
                        valor_mao_obra: { type: ['number', 'null'], description: 'Custo total de MO vinculada a esta peça (somatório das horas x valor/hora)' },
                        origem: {
                          type: ['string', 'null'],
                          enum: ['original', 'seminova', 'paralela', 'reaproveitada', null],
                        },
                        flags: {
                          type: 'array',
                          items: { type: 'string', enum: ['sem_amparo', 'inclusao_manual'] },
                        },
                      },
                      required: ['descricao', 'operacao', 'quantidade', 'valor_unitario', 'valor_total', 'flags'],
                      additionalProperties: false,
                    },
                  },
                  servicos: {
                    type: 'array',
                    description: 'Serviços avulsos NÃO vinculados a peça específica (lavagem, guincho, diagnóstico, etc).',
                    items: {
                      type: 'object',
                      properties: {
                        descricao: { type: 'string' },
                        horas: { type: ['number', 'null'] },
                        valor_unitario: { type: ['number', 'null'] },
                        valor_total: { type: 'number' },
                        tipo_servico: { type: ['string', 'null'] },
                      },
                      required: ['descricao', 'valor_total'],
                      additionalProperties: false,
                    },
                  },
                  resumo: {
                    type: 'object',
                    properties: {
                      total_pecas: { type: 'number' },
                      total_mao_obra: { type: 'number' },
                      total_geral: { type: 'number' },
                    },
                    required: ['total_pecas', 'total_mao_obra', 'total_geral'],
                    additionalProperties: false,
                  },
                },
                required: ['header', 'impact_areas', 'pecas', 'servicos', 'resumo'],
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

    // Backfill defensivo: garante presença dos novos campos
    extracted.header = extracted.header ?? null;
    extracted.impact_areas = extracted.impact_areas ?? [];
    extracted.pecas = (extracted.pecas ?? []).map((p: any) => ({
      ...p,
      flags: Array.isArray(p.flags) ? p.flags : [],
      operacao: p.operacao ?? 'T',
    }));
    extracted.servicos = extracted.servicos ?? [];
    extracted.orcamento_hash = orcamento_hash;

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
