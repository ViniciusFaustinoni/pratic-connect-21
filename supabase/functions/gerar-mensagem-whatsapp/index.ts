import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface BeneficiosPorCategoria {
  coberturas: string[];
  assistencia: string[];
  extras: string[];
}

interface Plano {
  nome: string;
  valorMensal: number;
  coberturas: string[];
  beneficiosPorCategoria?: BeneficiosPorCategoria;
  naoInclui?: string[];
}

interface CotacaoPayload {
  cliente: {
    nome: string;
  };
  veiculo: {
    marca: string;
    modelo: string;
    ano: number;
    placa?: string;
  };
  valorFipe: number;
  valorAdesao: number;
  validadeDias: number;
  planos: Plano[];
  linkCotacao?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: CotacaoPayload = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Gerando mensagem WhatsApp para cotação:", {
      cliente: payload.cliente.nome,
      veiculo: `${payload.veiculo.marca} ${payload.veiculo.modelo}`,
      planosCount: payload.planos.length,
    });

    const systemPrompt = `Você é um assistente de vendas da PRATICCAR que gera mensagens de WhatsApp para compartilhar cotações de proteção veicular.

REGRAS IMPORTANTES:
1. Seja amigável e profissional
2. Use emojis de forma moderada (não exagere)
3. Formate para WhatsApp (use *negrito* para destaques)
4. Liste TODOS os benefícios de cada plano fornecidos - não omita nenhum
5. Quando houver múltiplos planos, apresente-os de forma comparativa com separadores visuais
6. Inclua o link da cotação se fornecido
7. Termine com um call-to-action amigável
8. Mantenha o texto conciso mas COMPLETO
9. Use ━━━━ para separar planos diferentes
10. Destaque os valores em negrito

ESTRUTURA OBRIGATÓRIA:
- Saudação personalizada com nome do cliente
- Informações do veículo (marca, modelo, ano)
- Valor FIPE
- Apresentação de CADA plano com:
  - Nome do plano em destaque
  - Valor mensal em destaque
  - Benefícios ORGANIZADOS POR CATEGORIA (quando disponível):
    🛡️ *Coberturas:* liste com ✓ (Roubo, Furto, Colisão, Perda Total, etc)
    🚗 *Assistência 24h:* liste com ✓ (Reboque, Rastreador, Guincho, etc)
    ✨ *Benefícios Extras:* liste com ✓ (Carro Reserva, Kit Gás, 100% FIPE, etc)
- Taxa de Adesão
- Validade da cotação
- Link para ver mais detalhes (se houver)
- Call-to-action perguntando qual opção interessou

IMPORTANTE: Se os benefícios vierem já categorizados em "beneficiosPorCategoria", USE essa estrutura para organizar. Apresente cada categoria com seu emoji e título.`;

    // Formatar planos com benefícios categorizados
    const formatarPlano = (plano: Plano, index: number) => {
      let texto = `PLANO ${index + 1}: ${plano.nome}\nValor Mensal: R$ ${plano.valorMensal.toFixed(2)}\n`;
      
      // Se temos benefícios categorizados, usar essa estrutura
      if (plano.beneficiosPorCategoria) {
        const { coberturas, assistencia, extras } = plano.beneficiosPorCategoria;
        
        if (coberturas && coberturas.length > 0) {
          texto += `\n🛡️ COBERTURAS:\n${coberturas.map(c => `- ${c}`).join('\n')}`;
        }
        if (assistencia && assistencia.length > 0) {
          texto += `\n🚗 ASSISTÊNCIA 24H:\n${assistencia.map(c => `- ${c}`).join('\n')}`;
        }
        if (extras && extras.length > 0) {
          texto += `\n✨ BENEFÍCIOS EXTRAS:\n${extras.map(c => `- ${c}`).join('\n')}`;
        }
      } else if (plano.coberturas && plano.coberturas.length > 0) {
        // Fallback: listar todos juntos
        texto += `\nBenefícios inclusos:\n${plano.coberturas.map(c => `- ${c}`).join('\n')}`;
      }
      
      if (plano.naoInclui && plano.naoInclui.length > 0) {
        texto += `\n\nNão inclui:\n${plano.naoInclui.map(n => `- ${n}`).join('\n')}`;
      }
      
      return texto;
    };

    const userPrompt = `Gere uma mensagem de WhatsApp para a seguinte cotação:

CLIENTE: ${payload.cliente.nome}

VEÍCULO: ${payload.veiculo.marca} ${payload.veiculo.modelo} ${payload.veiculo.ano}${payload.veiculo.placa ? ` (Placa: ${payload.veiculo.placa})` : ''}

VALOR FIPE: R$ ${payload.valorFipe.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

PLANOS (${payload.planos.length} opção${payload.planos.length > 1 ? 'ões' : ''}):
${payload.planos.map((plano, index) => formatarPlano(plano, index)).join('\n\n---\n\n')}

TAXA DE ADESÃO: R$ ${payload.valorAdesao.toFixed(2)}
VALIDADE: ${payload.validadeDias} dias
${payload.linkCotacao ? `LINK DA COTAÇÃO: ${payload.linkCotacao}` : ''}

Gere APENAS o texto da mensagem, sem explicações adicionais. MANTENHA a organização por categorias (Coberturas, Assistência 24h, Benefícios Extras) na mensagem final.`;

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
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro na API Lovable AI:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Taxa de requisições excedida, tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes para geração de mensagem." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`Erro na API: ${response.status}`);
    }

    const data = await response.json();
    const mensagem = data.choices?.[0]?.message?.content;

    if (!mensagem) {
      throw new Error("Resposta da IA sem conteúdo");
    }

    console.log("Mensagem gerada com sucesso, tamanho:", mensagem.length);

    return new Response(
      JSON.stringify({ mensagem }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro ao gerar mensagem WhatsApp:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
