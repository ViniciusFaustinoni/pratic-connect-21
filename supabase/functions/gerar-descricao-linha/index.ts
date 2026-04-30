import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

import { aiGatewayFetch } from "../_shared/ai-client.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { product_line_id } = await req.json();
    if (!product_line_id) {
      return new Response(JSON.stringify({ error: "product_line_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch product line
    const { data: linha } = await supabase
      .from("product_lines")
      .select("id, name, slug, vehicle_type, icon")
      .eq("id", product_line_id)
      .single();

    if (!linha) {
      return new Response(JSON.stringify({ error: "Linha não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch plans for this line
    const { data: planos } = await supabase
      .from("planos")
      .select("id, nome, descricao, valor_mensal_base, valor_adesao, cobertura_fipe_percentual, is_active")
      .eq("product_line_id", product_line_id)
      .eq("is_active", true);

    const planIds = (planos || []).map((p: any) => p.id);

    // Fetch coverages and benefits in parallel
    const [coberturas, beneficios, regras] = await Promise.all([
      planIds.length > 0
        ? supabase
            .from("planos_coberturas")
            .select("plano_id, valor_cobertura, coberturas(nome, subtitulo)")
            .in("plano_id", planIds)
            .then((r) => r.data || [])
        : Promise.resolve([]),
      planIds.length > 0
        ? supabase
            .from("planos_beneficios")
            .select("plano_id, benefits(nome, preco_sugerido)")
            .in("plano_id", planIds)
            .then((r) => r.data || [])
        : Promise.resolve([]),
      supabase
        .from("entity_eligibility_rules")
        .select("rule_type, config")
        .eq("entity_type", "product_line")
        .eq("entity_id", product_line_id)
        .then((r) => r.data || []),
    ]);

    // Build context
    const planosTexto = (planos || [])
      .map((p: any) => {
        const cobs = coberturas
          .filter((c: any) => c.plano_id === p.id)
          .map((c: any) => `${c.coberturas?.nome}: R$${c.valor_cobertura}`)
          .join(", ");
        const bens = beneficios
          .filter((b: any) => b.plano_id === p.id)
          .map((b: any) => b.benefits?.nome)
          .filter(Boolean)
          .join(", ");
        return `- ${p.nome}: mensal R$${p.valor_mensal_base || "?"}, adesão R$${p.valor_adesao || "?"}, FIPE ${p.cobertura_fipe_percentual || "?"}%${cobs ? `. Coberturas: ${cobs}` : ""}${bens ? `. Benefícios: ${bens}` : ""}`;
      })
      .join("\n");

    const regrasTexto = regras
      .map((r: any) => `${r.rule_type}: ${JSON.stringify(r.config)}`)
      .join("\n");

    const prompt = `Você é um especialista em copywriting para proteção veicular. Crie uma descrição CURTA (máximo 4 parágrafos, 600 caracteres) para o agente de WhatsApp usar ao apresentar a linha de produto "${linha.name}" (tipo: ${linha.vehicle_type || linha.slug}).

A descrição deve:
- Ser persuasiva e focada em CONVERSÃO
- Destacar os principais diferenciais e coberturas
- Usar linguagem acessível para o cliente final no WhatsApp
- Não incluir valores exatos (o agente calcula automaticamente)
- Transmitir segurança e confiança

CONTEXTO DA LINHA:
Planos disponíveis:
${planosTexto || "Nenhum plano cadastrado ainda."}

Regras de elegibilidade:
${regrasTexto || "Sem restrições específicas."}

Escreva APENAS a descrição, sem títulos, sem aspas, sem markdown.`;

    const aiResponse = await aiGatewayFetch({
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é um copywriter especialista em proteção veicular no Brasil. Escreva textos curtos, persuasivos e focados em conversão para WhatsApp." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", status, errorText);
      return new Response(JSON.stringify({ error: "Erro ao gerar descrição com IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const descricao = aiData.choices?.[0]?.message?.content?.trim() || "";

    return new Response(JSON.stringify({ descricao }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("gerar-descricao-linha error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
