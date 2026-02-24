import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { sinistro_id, forcar_reanalise } = await req.json();
    if (!sinistro_id) {
      return new Response(JSON.stringify({ error: "sinistro_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check for saved analysis
    if (!forcar_reanalise) {
      const { data: salva } = await supabase
        .from("sinistro_analises_ia")
        .select("*")
        .eq("sinistro_id", sinistro_id)
        .eq("tipo", "consistencia_relatos")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (salva) {
        return new Response(JSON.stringify({
          ...salva.dados_extras,
          salvo_em: salva.created_at,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ sem_analise: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== COLLECT ALL REPORTS =====

    // 1. Sinistro data (description = relato da comunicação)
    const { data: sinistro, error: errSinistro } = await supabase
      .from("sinistros")
      .select(`
        id, protocolo, tipo, descricao, data_ocorrencia, created_at,
        associado_id,
        associado:associados!sinistros_associado_id_fkey(id, nome)
      `)
      .eq("id", sinistro_id)
      .single();

    if (errSinistro || !sinistro) {
      return new Response(JSON.stringify({ error: "Sinistro não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Link do evento (etapa2 = BO data, etapa3 = relato do associado)
    const { data: linkEvento } = await supabase
      .from("sinistro_evento_links")
      .select("dados_etapa2, dados_etapa3")
      .eq("sinistro_id", sinistro_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 3. Chat messages from AI (relato da comunicação via IA)
    let relatoComunicacaoIA = "";
    if (sinistro.associado_id) {
      // Find the AI solicitation linked to this sinistro
      const { data: solicitacao } = await supabase
        .from("chat_solicitacoes_ia")
        .select("created_at")
        .eq("resultado_id", sinistro_id)
        .eq("tipo", "sinistro")
        .maybeSingle();

      if (solicitacao) {
        const startDate = new Date(solicitacao.created_at);
        startDate.setHours(startDate.getHours() - 24);

        const { data: mensagens } = await supabase
          .from("chat_mensagens_ia")
          .select("role, content")
          .eq("associado_id", sinistro.associado_id)
          .gte("created_at", startDate.toISOString())
          .lte("created_at", solicitacao.created_at)
          .order("created_at", { ascending: true });

        if (mensagens && mensagens.length > 0) {
          // Extract only user messages that look like event descriptions
          const userMsgs = mensagens
            .filter((m: any) => m.role === "user")
            .map((m: any) => m.content)
            .filter((c: string) => c.length > 15);
          relatoComunicacaoIA = userMsgs.join("\n");
        }
      }
    }

    // Build the reports
    const relatoComunicacao = relatoComunicacaoIA || sinistro.descricao || "";
    const relatoBO = (linkEvento?.dados_etapa2 as any)?.resumo_bo || 
                     (linkEvento?.dados_etapa2 as any)?.relato_bo || 
                     (linkEvento?.dados_etapa2 as any)?.descricao_bo || "";
    const relatoLink = (linkEvento?.dados_etapa3 as any)?.relato_texto || "";

    // Count available reports
    const relatos: { nome: string; texto: string }[] = [];
    if (relatoComunicacao.trim()) relatos.push({ nome: "Comunicação Inicial", texto: relatoComunicacao });
    if (relatoBO.trim()) relatos.push({ nome: "Boletim de Ocorrência", texto: relatoBO });
    if (relatoLink.trim()) relatos.push({ nome: "Relato no Link do Evento", texto: relatoLink });

    if (relatos.length < 2) {
      return new Response(JSON.stringify({
        sem_analise: true,
        motivo: "Menos de 2 relatos disponíveis para comparação",
        relatos_disponiveis: relatos.length,
        relato_comunicacao: relatoComunicacao || null,
        relato_bo: relatoBO || null,
        relato_link: relatoLink || null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== AI CONSISTENCY ANALYSIS =====
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Você é um perito em análise de sinistros veiculares. Compare os relatos abaixo sobre o MESMO evento e identifique:
1. Consistências (informações que se alinham entre os relatos)
2. Inconsistências (divergências em datas, horários, locais, dinâmica do acidente, detalhes, etc.)
3. Omissões (informações presentes em um relato mas ausentes em outros)

${relatos.map((r, i) => `### RELATO ${i + 1} — ${r.nome}:\n"${r.texto}"\n`).join("\n")}

REGRAS:
- Foque em contradições factuais, não em diferenças de estilo narrativo
- Considere que pequenas variações de horário (<30min) são normais sob estresse
- Divergências no local exato, dinâmica da colisão, ou presença de terceiros são críticas
- Se um relato adiciona detalhes que outro omite, isso é uma OMISSÃO, não necessariamente inconsistência
- Pontue o impacto na credibilidade de 0 a 5 (0=totalmente consistente, 5=contradições graves)`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é um perito forense em sinistros. Responda APENAS usando a tool fornecida." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analise_consistencia",
              description: "Retorna a análise de consistência entre os relatos do sinistro",
              parameters: {
                type: "object",
                properties: {
                  pontuacao_inconsistencia: {
                    type: "integer",
                    description: "Pontuação de inconsistência de 0 a 5 (0=consistente, 5=contradições graves)",
                  },
                  resumo: {
                    type: "string",
                    description: "Resumo de 2-3 frases sobre a consistência dos relatos",
                  },
                  consistencias: {
                    type: "array",
                    items: { type: "string" },
                    description: "Lista de pontos consistentes entre os relatos",
                  },
                  inconsistencias: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        descricao: { type: "string", description: "Descrição da inconsistência" },
                        gravidade: { type: "string", enum: ["leve", "moderada", "grave"], description: "Gravidade" },
                        relatos_envolvidos: {
                          type: "array",
                          items: { type: "string" },
                          description: "Nomes dos relatos que divergem",
                        },
                      },
                      required: ["descricao", "gravidade", "relatos_envolvidos"],
                    },
                    description: "Lista de inconsistências encontradas",
                  },
                  omissoes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        descricao: { type: "string", description: "Informação omitida" },
                        presente_em: { type: "string", description: "Relato onde a informação está presente" },
                        ausente_em: { type: "string", description: "Relato(s) onde a informação está ausente" },
                      },
                      required: ["descricao", "presente_em", "ausente_em"],
                    },
                    description: "Lista de omissões entre relatos",
                  },
                  parecer: {
                    type: "string",
                    description: "Parecer final sobre a credibilidade dos relatos",
                  },
                },
                required: ["pontuacao_inconsistencia", "resumo", "consistencias", "inconsistencias", "omissoes", "parecer"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analise_consistencia" } },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro ao processar análise de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("Resposta IA sem tool call:", JSON.stringify(aiData));
      return new Response(JSON.stringify({ error: "IA não retornou análise estruturada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analise = JSON.parse(toolCall.function.arguments);

    // Build result with raw reports included
    const resultado = {
      ...analise,
      relato_comunicacao: relatoComunicacao || null,
      relato_bo: relatoBO || null,
      relato_link: relatoLink || null,
      relatos_disponiveis: relatos.length,
    };

    // Save to database
    const { error: errInsert } = await supabase
      .from("sinistro_analises_ia")
      .insert({
        sinistro_id,
        tipo: "consistencia_relatos",
        pontuacao_risco: analise.pontuacao_inconsistencia,
        nivel: analise.pontuacao_inconsistencia <= 1 ? "baixo" : analise.pontuacao_inconsistencia <= 3 ? "medio" : "alto",
        resumo: analise.resumo,
        fatores: [],
        recomendacao: analise.parecer,
        dados_extras: resultado,
      });

    if (errInsert) {
      console.error("Erro ao salvar análise:", errInsert);
    }

    return new Response(JSON.stringify({
      ...resultado,
      salvo_em: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Erro na análise de consistência:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
