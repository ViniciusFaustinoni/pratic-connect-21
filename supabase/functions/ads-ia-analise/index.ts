// =============================================================================
// ads-ia-analise — ONDA 2 (IA analista: critica + sugestoes, SEM executar)
// =============================================================================
// Le os insights agregados (ads_insights_diarios), aplica os guardrails
// configuraveis e chama a IA (Claude/Opus por padrao, fallback Lovable) para
// gerar achados qualitativos. NAO executa nada na Meta.
//
// Anti-alucinacao (ver CLAUDE.md):
//   - Guardrails (custo/conversa, custo/lead, WITH_ISSUES) sao calculados em
//     CODIGO e sempre viram achados garantidos.
//   - A IA recebe SOMENTE numeros reais e e instruida a nunca inventar metrica;
//     cada achado da IA carrega 'evidencia' com os valores usados.
//   - Segmenta messaging (WhatsApp) vs lead (formulario) — nunca soma cru.
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-client.ts";
import { insertAuditLog } from "../_shared/auditLog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Modelo padrao para analise profunda; cai no Lovable Gateway se a chave faltar.
const MODELO_ANALISE = { provider: "anthropic" as const, model: "claude-opus-4-8" };

interface GuardrailCfg {
  custoMaxConversa: number;
  custoMaxLead: number;
  janelaHoras: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const dias: number = Math.min(Math.max(Number(body?.dias ?? 7), 1), 90);
    const contaId: string | null = body?.conta_id ?? null;
    const override = body?.modelo ?? MODELO_ANALISE;

    const since = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
    const until = new Date().toISOString().slice(0, 10);

    // ----- 1. Guardrails configuraveis -----
    const { data: gr } = await supabase
      .from("ads_guardrails_config")
      .select("chave, valor, janela_horas, ativo");
    const cfg: GuardrailCfg = {
      custoMaxConversa: Number(gr?.find((g) => g.chave === "custo_max_conversa_48h")?.valor ?? 25),
      custoMaxLead: Number(gr?.find((g) => g.chave === "custo_max_lead_48h")?.valor ?? 30),
      janelaHoras: Number(gr?.find((g) => g.chave === "custo_max_conversa_48h")?.janela_horas ?? 48),
    };

    // ----- 2. Carregar entidades (nomes + objetivo) -----
    const { data: anunciosRows, error: anErr } = await supabase
      .from("ads_anuncios")
      .select("id, nome, effective_status, conjunto_id, ads_conjuntos(nome, objetivo_norm, campanha_id, ads_campanhas(nome, objetivo_norm, conta_id))");
    if (anErr) throw new Error(`carregar anuncios: ${anErr.message}`);

    const anuncioMap = new Map<string, any>();
    for (const a of anunciosRows ?? []) {
      const conta = a?.ads_conjuntos?.ads_campanhas?.conta_id;
      if (contaId && conta !== contaId) continue;
      anuncioMap.set(a.id, a);
    }

    // ----- 3. Insights da janela (agregados por anuncio) -----
    const { data: insights, error: inErr } = await supabase
      .from("ads_insights_diarios")
      .select("entidade_id, objetivo_norm, gasto, conversas, leads, data")
      .eq("entidade_tipo", "anuncio")
      .gte("data", since)
      .lte("data", until);
    if (inErr) throw new Error(`carregar insights: ${inErr.message}`);

    // Janela de guardrail (ultimas N horas) para custo agregado por anuncio.
    const corteGuard = new Date(Date.now() - cfg.janelaHoras * 3600000).toISOString().slice(0, 10);
    type Agg = { nome: string; objetivo: string; gasto: number; conversas: number; leads: number; gastoGuard: number; conversasGuard: number; leadsGuard: number };
    const agg = new Map<string, Agg>();
    for (const ins of insights ?? []) {
      const a = anuncioMap.get(ins.entidade_id);
      if (!a) continue;
      const cur = agg.get(ins.entidade_id) ?? {
        nome: a.nome ?? ins.entidade_id,
        objetivo: ins.objetivo_norm,
        gasto: 0, conversas: 0, leads: 0, gastoGuard: 0, conversasGuard: 0, leadsGuard: 0,
      };
      cur.gasto += Number(ins.gasto || 0);
      cur.conversas += Number(ins.conversas || 0);
      cur.leads += Number(ins.leads || 0);
      if (ins.data >= corteGuard) {
        cur.gastoGuard += Number(ins.gasto || 0);
        cur.conversasGuard += Number(ins.conversas || 0);
        cur.leadsGuard += Number(ins.leads || 0);
      }
      agg.set(ins.entidade_id, cur);
    }

    // ----- 4. Achados DETERMINISTICOS (guardrails) — sempre garantidos -----
    const achadosDet: any[] = [];
    for (const [adId, m] of agg.entries()) {
      // Custo por conversa (so messaging)
      if (m.objetivo === "messaging" && m.conversasGuard > 0) {
        const cpc = m.gastoGuard / m.conversasGuard;
        if (cpc > cfg.custoMaxConversa) {
          achadosDet.push({
            severidade: "alta", tipo: "custo_conversa", entidade_tipo: "anuncio", entidade_id: adId,
            titulo: `Custo por conversa acima do limite (${m.nome})`,
            descricao: `Custo/conversa de R$ ${cpc.toFixed(2)} nas ultimas ${cfg.janelaHoras}h, acima do teto de R$ ${cfg.custoMaxConversa.toFixed(2)}.`,
            evidencia: { custo_por_conversa: Number(cpc.toFixed(2)), limite: cfg.custoMaxConversa, gasto: Number(m.gastoGuard.toFixed(2)), conversas: m.conversasGuard, janela_horas: cfg.janelaHoras },
            sugestao: "Revisar segmentacao/criativo ou pausar o anuncio.",
            acao_sugerida: { tipo: "pausar", entidade_tipo: "anuncio", entidade_id: adId },
          });
        }
      }
      // Custo por lead (so lead/formulario)
      if (m.objetivo === "lead" && m.leadsGuard > 0) {
        const cpl = m.gastoGuard / m.leadsGuard;
        if (cpl > cfg.custoMaxLead) {
          achadosDet.push({
            severidade: "alta", tipo: "custo_lead", entidade_tipo: "anuncio", entidade_id: adId,
            titulo: `Custo por lead acima do limite (${m.nome})`,
            descricao: `Custo/lead de R$ ${cpl.toFixed(2)} nas ultimas ${cfg.janelaHoras}h, acima do teto de R$ ${cfg.custoMaxLead.toFixed(2)}.`,
            evidencia: { custo_por_lead: Number(cpl.toFixed(2)), limite: cfg.custoMaxLead, gasto: Number(m.gastoGuard.toFixed(2)), leads: m.leadsGuard, janela_horas: cfg.janelaHoras },
            sugestao: "Revisar formulario/criativo/segmentacao ou pausar o anuncio.",
            acao_sugerida: { tipo: "pausar", entidade_tipo: "anuncio", entidade_id: adId },
          });
        }
      }
    }
    // WITH_ISSUES
    for (const [adId, a] of anuncioMap.entries()) {
      if (String(a.effective_status || "").toUpperCase() === "WITH_ISSUES") {
        achadosDet.push({
          severidade: "critica", tipo: "with_issues", entidade_tipo: "anuncio", entidade_id: adId,
          titulo: `Anuncio com problema (${a.nome ?? adId})`,
          descricao: "Anuncio com effective_status=WITH_ISSUES na Meta.",
          evidencia: { effective_status: a.effective_status },
          sugestao: "Verificar reprovacao/limitacao na Meta e corrigir o anuncio.",
          acao_sugerida: null,
        });
      }
    }

    // ----- 5. Dataset compacto para a IA (somente numeros reais, agregados) -----
    const datasetIA = [...agg.entries()].map(([adId, m]) => ({
      ad_id: adId,
      anuncio: m.nome,
      objetivo: m.objetivo,
      periodo_dias: dias,
      gasto: Number(m.gasto.toFixed(2)),
      conversas: m.conversas,
      leads: m.leads,
      custo_por_conversa: m.conversas > 0 ? Number((m.gasto / m.conversas).toFixed(2)) : null,
      custo_por_lead: m.leads > 0 ? Number((m.gasto / m.leads).toFixed(2)) : null,
    }));

    // ----- 6. Chamar IA (qualitativa) — opcional e tolerante a falha -----
    let achadosIA: any[] = [];
    let modeloUsado = `${override.provider}/${override.model}`;
    if (datasetIA.length > 0) {
      const system = [
        "Voce e um analista senior de trafego pago (Meta Ads).",
        "Use SOMENTE os numeros fornecidos no JSON. NUNCA invente metricas nem valores.",
        "messaging (conversas de WhatsApp) e lead (formulario) sao objetivos diferentes: nao some nem compare cru.",
        "Gere achados qualitativos (tendencias, eficiencia relativa, criativos a escalar/cortar).",
        "Responda APENAS um JSON valido no formato:",
        '{"achados":[{"severidade":"baixa|media|alta","tipo":"string","entidade_id":"ad_id ou null","titulo":"string","descricao":"string","sugestao":"string","evidencia":{...numeros usados...}}]}',
      ].join("\n");
      const userMsg = `Dados agregados do periodo (${since} a ${until}):\n${JSON.stringify(datasetIA)}`;

      const r = await callAI({
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 2000,
        override,
        fallbackToLovable: true,
      });

      if (r.ok) {
        try {
          const content = r.data?.choices?.[0]?.message?.content ?? "{}";
          const parsed = typeof content === "string" ? JSON.parse(content) : content;
          achadosIA = Array.isArray(parsed?.achados) ? parsed.achados : [];
        } catch (e) {
          console.warn("[ads-ia-analise] falha ao parsear resposta IA:", String(e).slice(0, 200));
        }
      } else {
        console.warn("[ads-ia-analise] IA indisponivel:", r.errorMessage);
        modeloUsado = `${modeloUsado} (indisponivel)`;
      }
    }

    // ----- 7. Persistir analise + achados -----
    const { data: analise, error: anaErr } = await supabase
      .from("ads_analises")
      .insert({
        conta_id: contaId,
        periodo_inicio: since,
        periodo_fim: until,
        modelo_ia: modeloUsado,
        status: "concluida",
        resumo: `Guardrails: ${achadosDet.length} | IA: ${achadosIA.length} | anuncios analisados: ${agg.size}`,
      })
      .select("id")
      .single();
    if (anaErr) throw new Error(`criar analise: ${anaErr.message}`);
    const analiseId = analise.id as string;

    const todos = [
      ...achadosDet,
      ...achadosIA.map((a) => ({
        severidade: ["baixa", "media", "alta", "critica"].includes(a?.severidade) ? a.severidade : "media",
        tipo: String(a?.tipo ?? "ia"),
        entidade_tipo: a?.entidade_id ? "anuncio" : null,
        entidade_id: a?.entidade_id && anuncioMap.has(a.entidade_id) ? a.entidade_id : null,
        titulo: String(a?.titulo ?? "Sugestao da IA"),
        descricao: a?.descricao ?? null,
        evidencia: a?.evidencia ?? null,
        sugestao: a?.sugestao ?? null,
        acao_sugerida: null,
      })),
    ].map((a) => ({ ...a, analise_id: analiseId }));

    if (todos.length > 0) {
      const { error: achErr } = await supabase.from("ads_achados").insert(todos);
      if (achErr) throw new Error(`inserir achados: ${achErr.message}`);
    }

    await insertAuditLog(supabase, {
      usuario_nome: "sistema",
      acao: "criar",
      modulo: "configuracoes",
      descricao: `Foco Ads: analise IA gerada (${todos.length} achados; modelo ${modeloUsado})`,
      tabela: "ads_analises",
      registro_id: analiseId,
      dados_novos: { guardrails: achadosDet.length, ia: achadosIA.length, anuncios: agg.size },
    });

    return new Response(
      JSON.stringify({ ok: true, analise_id: analiseId, achados: todos.length, guardrails: achadosDet.length, ia: achadosIA.length, modelo: modeloUsado }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ads-ia-analise] erro:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
