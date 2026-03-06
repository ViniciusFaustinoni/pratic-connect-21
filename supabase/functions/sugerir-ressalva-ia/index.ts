import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { associado_id, veiculo_id, servico_id, checklist_nok, ressalvas_instalador } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch context data in parallel
    const [associadoRes, veiculoRes, historicoRes, ressalvasRes] = await Promise.all([
      supabase.from("associados").select("nome, cpf, status, data_adesao, cidade, uf").eq("id", associado_id).single(),
      supabase.from("veiculos").select("placa, marca, modelo, ano, cor").eq("id", veiculo_id).single(),
      supabase.from("associados_historico").select("tipo, descricao, created_at").eq("associado_id", associado_id).order("created_at", { ascending: false }).limit(15),
      supabase.from("associados_historico").select("descricao, created_at").eq("associado_id", associado_id).in("tipo", ["ressalva_registrada", "ressalva_aprovada_monitoramento", "ressalva_declinada_monitoramento"]).order("created_at", { ascending: false }).limit(5),
    ]);

    const associado = associadoRes.data;
    const veiculo = veiculoRes.data;
    const historico = historicoRes.data || [];
    const ressalvasAnteriores = ressalvasRes.data || [];

    const prompt = `Você é um analista técnico de monitoramento veicular. Uma instalação de rastreador foi aprovada com ressalvas pelo coordenador de monitoramento. Gere um texto profissional e conciso para registro no histórico do associado documentando a situação.

DADOS DO ASSOCIADO:
${associado ? `Nome: ${associado.nome}, CPF: ${associado.cpf}, Status: ${associado.status}, Adesão: ${associado.data_adesao}, Cidade: ${associado.cidade}/${associado.uf}` : "Dados indisponíveis"}

DADOS DO VEÍCULO:
${veiculo ? `Placa: ${veiculo.placa}, ${veiculo.marca} ${veiculo.modelo} ${veiculo.ano}, Cor: ${veiculo.cor}` : "Dados indisponíveis"}

ITENS NOK DO CHECKLIST:
${checklist_nok && checklist_nok.length > 0 ? checklist_nok.map((i: any) => `- ${i.label}${i.observacao ? ': ' + i.observacao : ''}`).join('\n') : "Nenhum item NOK"}

OBSERVAÇÕES DO INSTALADOR:
${ressalvas_instalador || "Nenhuma observação"}

RESSALVAS ANTERIORES DO ASSOCIADO:
${ressalvasAnteriores.length > 0 ? ressalvasAnteriores.map((r: any) => `- ${r.created_at?.substring(0, 10)}: ${r.descricao}`).join('\n') : "Nenhuma ressalva anterior"}

HISTÓRICO RECENTE:
${historico.slice(0, 5).map((h: any) => `- ${h.created_at?.substring(0, 10)}: [${h.tipo}] ${h.descricao}`).join('\n')}

Responda SOMENTE com um JSON usando tool calling.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é um analista técnico. Gere registros concisos e profissionais." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "registrar_ressalva",
              description: "Registra a sugestão de ressalva com texto e pontos de atenção",
              parameters: {
                type: "object",
                properties: {
                  texto_sugerido: {
                    type: "string",
                    description: "Texto completo da ressalva para registro no histórico. Profissional, conciso, 2-4 frases."
                  },
                  pontos_atencao: {
                    type: "array",
                    items: { type: "string" },
                    description: "Lista de 2-5 pontos de atenção identificados na análise"
                  }
                },
                required: ["texto_sugerido", "pontos_atencao"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "registrar_ressalva" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes para IA." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return structured output");
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sugerir-ressalva-ia error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
