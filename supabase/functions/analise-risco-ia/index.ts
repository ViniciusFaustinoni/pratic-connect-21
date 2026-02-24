import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function calcularDistanciaKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcularVelocidadeMedia(posicoes: any[]): number | null {
  if (!posicoes || posicoes.length < 2) return null;
  let distanciaTotal = 0;
  let tempoTotalHoras = 0;
  for (let i = 1; i < posicoes.length; i++) {
    const p1 = posicoes[i - 1];
    const p2 = posicoes[i];
    if (p1.latitude && p1.longitude && p2.latitude && p2.longitude) {
      distanciaTotal += calcularDistanciaKm(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
    }
    const t1 = new Date(p1.data_posicao || p1.created_at).getTime();
    const t2 = new Date(p2.data_posicao || p2.created_at).getTime();
    tempoTotalHoras += Math.abs(t2 - t1) / 3600000;
  }
  if (tempoTotalHoras === 0) return null;
  return Math.round(distanciaTotal / tempoTotalHoras);
}

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

    // Se não forçar reanálise, buscar análise salva
    if (!forcar_reanalise) {
      const { data: analiseSalva } = await supabase
        .from("sinistro_analises_ia")
        .select("*")
        .eq("sinistro_id", sinistro_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (analiseSalva) {
        return new Response(JSON.stringify({
          pontuacao_risco: analiseSalva.pontuacao_risco,
          nivel: analiseSalva.nivel,
          resumo: analiseSalva.resumo,
          fatores: analiseSalva.fatores,
          recomendacao: analiseSalva.recomendacao,
          salvo_em: analiseSalva.created_at,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Não encontrou análise salva - retornar vazio para o componente mostrar botão
      return new Response(JSON.stringify({ sem_analise: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== FORÇAR ANÁLISE COM IA =====

    // Buscar sinistro com associado e veículo
    const { data: sinistro, error: errSinistro } = await supabase
      .from("sinistros")
      .select(`
        id, tipo, status, data_ocorrencia, created_at, protocolo,
        latitude_informada, longitude_informada,
        rastreador_lat_momento, rastreador_lng_momento,
        associado_id, veiculo_id,
        associado:associados!sinistros_associado_id_fkey(
          id, nome, status, data_adesao, created_at
        ),
        veiculo:veiculos!sinistros_veiculo_id_fkey(
          id, valor_fipe, placa, marca, modelo, ano_modelo
        )
      `)
      .eq("id", sinistro_id)
      .single();

    if (errSinistro || !sinistro) {
      return new Response(JSON.stringify({ error: "Sinistro não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar vistoria do evento (regulador)
    const { data: vistoria } = await supabase
      .from("vistorias_evento")
      .select("id, dados_vistoria, status, concluida_em")
      .eq("sinistro_id", sinistro_id)
      .eq("status", "concluida")
      .order("concluida_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Buscar eventos anteriores do associado
    const { data: eventosAnteriores } = await supabase
      .from("sinistros")
      .select("id, tipo, status, created_at")
      .eq("associado_id", sinistro.associado_id)
      .neq("id", sinistro_id)
      .order("created_at", { ascending: false })
      .limit(10);

    // Buscar posições do rastreador (4h antes do evento)
    let posicoes: any[] = [];
    if (sinistro.veiculo_id && sinistro.data_ocorrencia) {
      const dataEvento = new Date(sinistro.data_ocorrencia);
      const data4hAntes = new Date(dataEvento.getTime() - 4 * 3600000);
      const { data: pos } = await supabase
        .from("rastreador_posicoes")
        .select("latitude, longitude, velocidade, data_posicao, created_at")
        .eq("veiculo_id", sinistro.veiculo_id)
        .gte("data_posicao", data4hAntes.toISOString())
        .lte("data_posicao", dataEvento.toISOString())
        .order("data_posicao", { ascending: true })
        .limit(200);
      if (pos) posicoes = pos;
    }

    // Buscar adimplência
    const { data: cobrancas } = await supabase
      .from("asaas_cobrancas")
      .select("status, data_vencimento")
      .eq("associado_id", sinistro.associado_id)
      .in("status", ["OVERDUE", "PENDING"])
      .limit(5);

    // Buscar análise de consistência de relatos (se existir)
    const { data: analiseConsistencia } = await supabase
      .from("sinistro_analises_ia")
      .select("pontuacao_risco, resumo, dados_extras")
      .eq("sinistro_id", sinistro_id)
      .eq("tipo", "consistencia_relatos")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const inconsistenciaScore = analiseConsistencia?.pontuacao_risco || null;
    const inconsistenciaResumo = analiseConsistencia?.resumo || null;
    const inconsistencias = (analiseConsistencia?.dados_extras as any)?.inconsistencias || [];
    const inconsistenciasGraves = inconsistencias.filter((i: any) => i.gravidade === 'grave').length;
    const inconsistenciasModeradas = inconsistencias.filter((i: any) => i.gravidade === 'moderada').length;

    // ===== CÁLCULOS PRÉ-IA =====
    const horasComunicacao =
      sinistro.data_ocorrencia && sinistro.created_at
        ? Math.round(
            (new Date(sinistro.created_at).getTime() - new Date(sinistro.data_ocorrencia).getTime()) / 3600000
          )
        : null;

    let distanciaGps: number | null = null;
    if (
      sinistro.latitude_informada && sinistro.longitude_informada &&
      sinistro.rastreador_lat_momento && sinistro.rastreador_lng_momento
    ) {
      distanciaGps = Math.round(
        calcularDistanciaKm(
          sinistro.latitude_informada,
          sinistro.longitude_informada,
          sinistro.rastreador_lat_momento,
          sinistro.rastreador_lng_momento
        ) * 10
      ) / 10;
    }

    const velocidadeMedia = calcularVelocidadeMedia(posicoes);

    const dadosVistoria = vistoria?.dados_vistoria as any;
    const valorOrcamento = dadosVistoria?.valor_total_orcamento || null;
    const valorFipe = (sinistro as any).veiculo?.valor_fipe || null;
    const ratioCustoFipe =
      valorOrcamento && valorFipe ? Math.round((valorOrcamento / valorFipe) * 100) : null;

    const parecerRegulador = dadosVistoria?.parecer_tecnico || null;
    const recomendacaoRegulador = dadosVistoria?.recomendacao || null;
    const tipoDano = dadosVistoria?.tipo_dano || null;

    const tempoAssociacao = sinistro.associado?.data_adesao
      ? Math.round(
          (new Date().getTime() - new Date(sinistro.associado.data_adesao).getTime()) / (30 * 86400000)
        )
      : null;

    const inadimplente = cobrancas && cobrancas.length > 0;
    const qtdEventosAnteriores = eventosAnteriores?.length || 0;

    // ===== PROMPT PARA IA =====
    const prompt = `Você é um analista de risco de fraude em sinistros veiculares de uma associação de proteção veicular.

Analise os dados abaixo e forneça uma pontuação de risco de fraude de 0 a 10 (0 = nenhum risco, 10 = altíssimo risco).

DADOS DO SINISTRO:
- Protocolo: ${sinistro.protocolo || "N/A"}
- Tipo: ${sinistro.tipo || "N/A"}
- Data do evento: ${sinistro.data_ocorrencia || "N/A"}
- Data da comunicação: ${sinistro.created_at || "N/A"}
- Horas entre evento e comunicação: ${horasComunicacao !== null ? horasComunicacao + "h" : "Não calculável"}
- Distância GPS (local informado vs rastreador): ${distanciaGps !== null ? distanciaGps + " km" : "Dados insuficientes"}
- Velocidade média do veículo (4h antes): ${velocidadeMedia !== null ? velocidadeMedia + " km/h" : "Sem dados de rastreamento"}
- Quantidade de pontos de rastreamento: ${posicoes.length}

VEÍCULO:
- ${(sinistro as any).veiculo?.marca || ""} ${(sinistro as any).veiculo?.modelo || ""} ${(sinistro as any).veiculo?.ano_modelo || ""}
- Placa: ${(sinistro as any).veiculo?.placa || "N/A"}
- Valor FIPE: ${valorFipe ? "R$ " + valorFipe.toLocaleString("pt-BR") : "N/A"}

VISTORIA DO REGULADOR:
- Parecer técnico: ${parecerRegulador || "Sem vistoria concluída"}
- Recomendação: ${recomendacaoRegulador || "N/A"}
- Tipo de dano: ${tipoDano || "N/A"}
- Valor do orçamento: ${valorOrcamento ? "R$ " + valorOrcamento.toLocaleString("pt-BR") : "N/A"}
- Ratio custo/FIPE: ${ratioCustoFipe !== null ? ratioCustoFipe + "%" : "N/A"}

CONTEXTO DO ASSOCIADO:
- Tempo de associação: ${tempoAssociacao !== null ? tempoAssociacao + " meses" : "N/A"}
- Inadimplente: ${inadimplente ? "Sim" : "Não"}
- Eventos anteriores: ${qtdEventosAnteriores}

ANÁLISE DE CONSISTÊNCIA DOS RELATOS:
- Score de inconsistência: ${inconsistenciaScore !== null ? inconsistenciaScore + "/5" : "Não disponível"}
- Inconsistências graves: ${inconsistenciasGraves}
- Inconsistências moderadas: ${inconsistenciasModeradas}
- Resumo: ${inconsistenciaResumo || "Análise não realizada"}

REGRAS DE AVALIAÇÃO:
1. Se horas entre evento e comunicação > 6h, isso aumenta o risco
2. Se distância GPS > 10km entre local informado e posição do rastreador, aumenta risco significativamente
3. Se velocidade média é muito baixa (< 5km/h) ou inconsistente com colisão, atenção
4. Se o regulador recomenda "análise detalhada" ou semelhante, aumenta risco
5. Se ratio custo/FIPE > 40%, sinal de atenção
6. Múltiplos eventos anteriores em curto espaço de tempo aumentam risco
7. Inadimplência combinada com sinistro pode indicar risco
8. Se o score de inconsistência dos relatos for >= 3, isso AUMENTA significativamente o risco (relatos contraditórios)
9. Inconsistências graves (divergência de local, dinâmica, presença de terceiros) são fortíssimos indicadores de fraude

Analise criteriosamente e forneça sua avaliação.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é um analista de risco de fraude em sinistros veiculares. Responda APENAS usando a tool fornecida." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analise_risco",
              description: "Retorna a análise de risco de fraude do sinistro",
              parameters: {
                type: "object",
                properties: {
                  pontuacao_risco: {
                    type: "integer",
                    description: "Pontuação de risco de 0 a 10",
                  },
                  nivel: {
                    type: "string",
                    enum: ["baixo", "medio", "alto", "critico"],
                    description: "Nível de risco",
                  },
                  resumo: {
                    type: "string",
                    description: "Resumo de 2-3 frases da análise",
                  },
                  fatores: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        nome: { type: "string", description: "Nome do fator analisado" },
                        valor: { type: "string", description: "Valor encontrado" },
                        impacto: { type: "string", description: "Impacto no risco: positivo, neutro ou negativo" },
                        detalhe: { type: "string", description: "Explicação breve" },
                      },
                      required: ["nome", "valor", "impacto", "detalhe"],
                    },
                    description: "Lista de fatores analisados",
                  },
                  recomendacao: {
                    type: "string",
                    description: "Recomendação para o analista",
                  },
                },
                required: ["pontuacao_risco", "nivel", "resumo", "fatores", "recomendacao"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analise_risco" } },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes para análise de IA." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Erro ao processar análise de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("Resposta IA sem tool call:", JSON.stringify(aiData));
      return new Response(JSON.stringify({ error: "IA não retornou análise estruturada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analise = JSON.parse(toolCall.function.arguments);

    // Salvar no banco de dados
    const { error: errInsert } = await supabase
      .from("sinistro_analises_ia")
      .insert({
        sinistro_id,
        pontuacao_risco: analise.pontuacao_risco,
        nivel: analise.nivel,
        resumo: analise.resumo,
        fatores: analise.fatores,
        recomendacao: analise.recomendacao,
      });

    if (errInsert) {
      console.error("Erro ao salvar análise:", errInsert);
    }

    return new Response(JSON.stringify({
      ...analise,
      salvo_em: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Erro na análise de risco:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
