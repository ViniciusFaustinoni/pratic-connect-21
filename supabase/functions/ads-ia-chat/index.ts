// =============================================================================
// ads-ia-chat — Copiloto de IA do Foco Ads (chat com tool-use)
// =============================================================================
// Claude Opus 4.8 (via callAI override -> Anthropic), com fallback ao Lovable
// Gateway. O modelo NAO recebe metricas no prompt: ele as obtem chamando
// ferramentas (tool-use) ancoradas nos dados reais — nunca inventa numero.
//
// Regra de Ouro: o chat ANALISA e SUGERE. Pode criar uma "acao proposta"
// (status 'proposta'), mas NUNCA executa — execucao exige aprovacao humana.
// Acesso restrito a quem tem foco_ads.ver (hoje so admin_master).
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-client.ts";
import { checkPermission } from "../_shared/check-permission.ts";
import { getCredenciaisMetaAds } from "../_shared/credenciais-hibridas.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODELO = { provider: "anthropic" as const, model: "claude-opus-4-8" };
const GRAPH = "https://graph.facebook.com/v21.0";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function dataCorte(dias: number): string {
  return new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Ferramentas (executadas no servidor)
// ---------------------------------------------------------------------------
async function toolConsultarMetricas(sb: any, args: any) {
  const dias = Math.min(Math.max(Number(args?.dias ?? 7), 1), 90);
  let q = sb.from("ads_insights_diarios")
    .select("entidade_id, plataforma, objetivo_norm, gasto, conversas, leads")
    .eq("entidade_tipo", "anuncio")
    .gte("data", dataCorte(dias));
  if (args?.plataforma) q = q.eq("plataforma", args.plataforma);
  const { data, error } = await q;
  if (error) return { erro: error.message };

  const seg: Record<string, { gasto: number; conversas: number; leads: number }> = {
    messaging: { gasto: 0, conversas: 0, leads: 0 },
    lead: { gasto: 0, conversas: 0, leads: 0 },
    outro: { gasto: 0, conversas: 0, leads: 0 },
  };
  const porAnuncio = new Map<string, { gasto: number; conversas: number; leads: number; objetivo: string }>();
  for (const r of data ?? []) {
    const o = seg[r.objetivo_norm] ? r.objetivo_norm : "outro";
    seg[o].gasto += Number(r.gasto || 0);
    seg[o].conversas += Number(r.conversas || 0);
    seg[o].leads += Number(r.leads || 0);
    const cur = porAnuncio.get(r.entidade_id) ?? { gasto: 0, conversas: 0, leads: 0, objetivo: o };
    cur.gasto += Number(r.gasto || 0);
    cur.conversas += Number(r.conversas || 0);
    cur.leads += Number(r.leads || 0);
    porAnuncio.set(r.entidade_id, cur);
  }

  // Enriquece top anuncios com nome + id externo.
  const ids = [...porAnuncio.keys()];
  const { data: ans } = ids.length
    ? await sb.from("ads_anuncios").select("id, nome, anuncio_externo, effective_status").in("id", ids)
    : { data: [] };
  const nomes = new Map<string, any>((ans ?? []).map((a: any) => [a.id, a]));

  const top = [...porAnuncio.entries()]
    .map(([id, m]) => ({
      anuncio: nomes.get(id)?.nome ?? id,
      anuncio_externo: nomes.get(id)?.anuncio_externo ?? null,
      effective_status: nomes.get(id)?.effective_status ?? null,
      objetivo: m.objetivo,
      gasto: Number(m.gasto.toFixed(2)),
      conversas: m.conversas,
      leads: m.leads,
      custo_por_conversa: m.conversas > 0 ? Number((m.gasto / m.conversas).toFixed(2)) : null,
      custo_por_lead: m.leads > 0 ? Number((m.gasto / m.leads).toFixed(2)) : null,
    }))
    .sort((a, b) => b.gasto - a.gasto)
    .slice(0, 15);

  return {
    periodo_dias: dias,
    nota: "messaging=WhatsApp, lead=formulario. NUNCA some/compare segmentos diferentes.",
    segmentos: {
      messaging: { ...seg.messaging, custo_por_conversa: seg.messaging.conversas > 0 ? Number((seg.messaging.gasto / seg.messaging.conversas).toFixed(2)) : null },
      lead: { ...seg.lead, custo_por_lead: seg.lead.leads > 0 ? Number((seg.lead.gasto / seg.lead.leads).toFixed(2)) : null },
      outro: seg.outro,
    },
    top_anuncios: top,
  };
}

async function toolConsultarAchados(sb: any) {
  const { data: analise } = await sb.from("ads_analises").select("id, resumo, created_at").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!analise?.id) return { achados: [], nota: "Nenhuma analise gerada ainda." };
  const { data } = await sb.from("ads_achados").select("severidade, tipo, titulo, descricao, evidencia, sugestao").eq("analise_id", analise.id);
  return { analise: analise.resumo, gerada_em: analise.created_at, achados: data ?? [] };
}

async function toolConsultarMetaAoVivo(sb: any, args: any) {
  const creds = await getCredenciaisMetaAds(sb);
  if (!creds) return { erro: "Credenciais Meta nao configuradas." };
  const raw = creds.ad_account_id.trim();
  const acct = raw.startsWith("act_") ? raw : `act_${raw.replace(/\D/g, "")}`;
  const nivel = args?.nivel === "campaign" ? "campaign" : "account";
  const dias = Math.min(Math.max(Number(args?.dias ?? 7), 1), 90);
  const since = dataCorte(dias);
  const until = new Date().toISOString().slice(0, 10);

  const url = new URL(`${GRAPH}/${acct}/insights`);
  url.searchParams.set("level", nivel);
  url.searchParams.set("time_range", JSON.stringify({ since, until }));
  url.searchParams.set("fields", "campaign_name,objective,impressions,clicks,spend,actions");
  url.searchParams.set("limit", "50");
  url.searchParams.set("access_token", creds.access_token); // nunca logar a URL
  const r = await fetch(url.toString());
  const j = await r.json();
  if (!r.ok) return { erro: `Meta API ${r.status}: ${j?.error?.message || "erro"}` };

  const linhas = (j.data ?? []).map((d: any) => ({
    campanha: d.campaign_name,
    objetivo: d.objective,
    gasto: Number(d.spend || 0),
    impressoes: Number(d.impressions || 0),
    cliques: Number(d.clicks || 0),
  }));
  return { fonte: "Meta ao vivo", periodo: { since, until }, nivel, linhas };
}

async function toolProporAcao(sb: any, userId: string, args: any) {
  if (!args?.entidade_externa_id) return { erro: "entidade_externa_id obrigatorio" };
  const tipo = ["pausar", "reativar", "ajustar_verba", "duplicar"].includes(args?.tipo) ? args.tipo : "pausar";
  const payload: Record<string, unknown> = {};
  if (tipo === "ajustar_verba") {
    const v = Number(args?.daily_budget);
    if (!v || v <= 0) return { erro: "daily_budget invalido" };
    payload.daily_budget = v;
  }
  const { data, error } = await sb.from("ads_acoes_propostas").insert({
    plataforma: args?.plataforma === "google" ? "google" : "meta",
    tipo,
    entidade_tipo: ["campanha", "conjunto", "anuncio"].includes(args?.entidade_tipo) ? args.entidade_tipo : "anuncio",
    entidade_externa_id: args.entidade_externa_id,
    payload_proposto: payload,
    justificativa_ia: args?.justificativa ?? "Sugestao do copiloto IA",
    status: "proposta",
    criado_por: userId,
  }).select("id").single();
  if (error) return { erro: error.message };
  return { ok: true, acao_id: data.id, status: "proposta", nota: "Acao criada para APROVACAO. Nada foi executado." };
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "consultar_metricas",
      description: "Metricas agregadas dos dados ja sincronizados (banco). Segmenta messaging (WhatsApp) vs lead (formulario). Use para perguntas sobre gasto, custo por lead/conversa, anuncios.",
      parameters: {
        type: "object",
        properties: {
          dias: { type: "integer", description: "Janela em dias (1-90). Padrao 7." },
          plataforma: { type: "string", enum: ["meta", "google"], description: "Filtrar plataforma (opcional)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_achados",
      description: "Retorna os achados/criticas da analise de IA mais recente (guardrails de custo, WITH_ISSUES, sugestoes).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_meta_ao_vivo",
      description: "Puxa numeros FRESCOS direto da Meta (server-side) para a conta configurada. Use quando o usuario pedir dados em tempo real ou recentes que talvez nao estejam sincronizados.",
      parameters: {
        type: "object",
        properties: {
          nivel: { type: "string", enum: ["account", "campaign"], description: "Granularidade. Padrao account." },
          dias: { type: "integer", description: "Janela em dias (1-90). Padrao 7." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propor_acao",
      description: "Cria uma ACAO PROPOSTA (pausar/reativar/ajustar_verba/duplicar) para aprovacao humana. NAO executa. Use so quando o usuario pedir explicitamente para propor uma mudanca.",
      parameters: {
        type: "object",
        properties: {
          tipo: { type: "string", enum: ["pausar", "reativar", "ajustar_verba", "duplicar"] },
          entidade_tipo: { type: "string", enum: ["campanha", "conjunto", "anuncio"] },
          entidade_externa_id: { type: "string", description: "ID da entidade na plataforma (ex.: id da campanha/anuncio na Meta)." },
          plataforma: { type: "string", enum: ["meta", "google"] },
          daily_budget: { type: "number", description: "Para ajustar_verba: nova verba diaria em reais." },
          justificativa: { type: "string" },
        },
        required: ["tipo", "entidade_externa_id"],
      },
    },
  },
];

const SYSTEM_PROMPT = [
  "Voce e o copiloto do Foco Ads, especialista em trafego pago (Meta + Google).",
  "Responda em portugues do Brasil, de forma objetiva e acionavel.",
  "REGRAS CRITICAS:",
  "- Use SOMENTE numeros vindos das ferramentas. NUNCA invente metricas. Se nao tem o dado, chame a ferramenta.",
  "- messaging (conversas WhatsApp) e lead (formulario) sao objetivos diferentes: NUNCA some nem compare cru.",
  "- Guardrails: custo/conversa > R$25 em 48h e custo/lead > R$30 em 48h sao sinais de alerta; anuncio WITH_ISSUES tambem.",
  "- Voce ANALISA e SUGERE. Pode criar uma acao proposta com propor_acao, mas ela so executa apos APROVACAO humana. Nunca diga que executou algo.",
  "- Ao sugerir uma acao, explique o porque com os numeros reais que embasam.",
].join("\n");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Auth + permissao (admin-only via foco_ads.ver)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(401, { ok: false, error: "Nao autorizado" });
  const token = authHeader.replace("Bearer ", "");
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userErr } = await authClient.auth.getUser(token);
  if (userErr || !user) return json(401, { ok: false, error: "Token invalido" });
  if (!(await checkPermission(user.id, "foco_ads.ver"))) return json(403, { ok: false, error: "Sem acesso ao Foco Ads" });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    const body = await req.json().catch(() => ({}));
    const historico = Array.isArray(body?.messages) ? body.messages.slice(-20) : [];

    const messages: any[] = [{ role: "system", content: SYSTEM_PROMPT }, ...historico];

    let resposta = "";
    for (let iter = 0; iter < 6; iter++) {
      const r = await callAI({
        messages,
        tools: TOOLS,
        max_tokens: 2000,
        temperature: 0.2,
        override: MODELO,
        fallbackToLovable: true,
      });
      if (!r.ok) {
        return json(r.status === 429 ? 429 : 500, { ok: false, error: r.errorMessage ?? "Falha na IA" });
      }
      const message = r.data?.choices?.[0]?.message;
      if (!message) { resposta = "Tive um problema técnico. Pode repetir?"; break; }

      if (message.tool_calls?.length) {
        messages.push(message);
        for (const tc of message.tool_calls) {
          let args: any = {};
          try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* ignore */ }
          let result: any;
          switch (tc.function.name) {
            case "consultar_metricas": result = await toolConsultarMetricas(sb, args); break;
            case "consultar_achados": result = await toolConsultarAchados(sb); break;
            case "consultar_meta_ao_vivo": result = await toolConsultarMetaAoVivo(sb, args); break;
            case "propor_acao": result = await toolProporAcao(sb, user.id, args); break;
            default: result = { erro: `ferramenta desconhecida: ${tc.function.name}` };
          }
          messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
        }
        continue; // deixa o modelo interpretar os resultados
      }

      resposta = message.content ?? "";
      break;
    }

    return json(200, { ok: true, resposta });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ads-ia-chat] erro:", msg);
    return json(500, { ok: false, error: msg });
  }
});
