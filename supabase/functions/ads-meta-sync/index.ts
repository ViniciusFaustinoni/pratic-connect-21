// =============================================================================
// ads-meta-sync — ONDA 1 (Ingestao Meta, somente leitura)
// =============================================================================
// Puxa entidades (campanhas/conjuntos/anuncios) e insights AGREGADOS da Meta
// Marketing API e faz upsert nas tabelas ads_*. NUNCA escreve na Meta.
//
// Seguranca / regras (ver CLAUDE.md):
//   - Token critico (ads_management): lido via getCredenciaisMetaAds, NUNCA logado.
//   - LGPD: somente metricas agregadas; nenhum PII de lead.
//   - Segmenta objetivo: messaging (WhatsApp) vs lead (formulario) — nao soma cru.
//   - Escrita no banco via service_role (bypassa RLS).
//
// Invocacao: cron (sem corpo) ou POST { dias?: number, ad_account_id?: string }.
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCredenciaisMetaAds } from "../_shared/credenciais-hibridas.ts";
import { insertAuditLog } from "../_shared/auditLog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRAPH_VERSION = "v21.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

// Normaliza o objetivo bruto da Meta para nossas 3 categorias de negocio.
function normalizarObjetivo(objetivo?: string | null): "messaging" | "lead" | "outro" {
  const o = (objetivo || "").toUpperCase();
  if (o.includes("MESSAGE") || o.includes("MESSAGING") || o.includes("CONVERSATION")) return "messaging";
  if (o.includes("LEAD")) return "lead";
  return "outro";
}

// Soma, dentro de um insight da Meta, as acoes do tipo desejado (conversas/leads).
function somarAcoes(acoes: any[] | undefined, tiposAlvo: string[]): number {
  if (!Array.isArray(acoes)) return 0;
  return acoes
    .filter((a) => tiposAlvo.some((t) => String(a.action_type || "").includes(t)))
    .reduce((acc, a) => acc + Number(a.value || 0), 0);
}

async function graphGet(path: string, token: string, params: Record<string, string>) {
  const url = new URL(`${GRAPH}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token); // nunca logar a URL completa
  const resp = await fetch(url.toString());
  const json = await resp.json();
  if (!resp.ok) {
    // Loga so a mensagem da Meta, nunca o token.
    throw new Error(`Meta API ${resp.status}: ${json?.error?.message || "erro desconhecido"}`);
  }
  return json;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const dias: number = Math.min(Math.max(Number(body?.dias ?? 7), 1), 90);

    const creds = await getCredenciaisMetaAds(supabase);
    if (!creds) {
      return new Response(
        JSON.stringify({ ok: false, error: "Credenciais Meta Ads nao configuradas (integracoes_credenciais: meta_ads)." }),
        { status: 412, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const adAccountId = (body?.ad_account_id || creds.ad_account_id).trim();
    const token = creds.access_token;
    const since = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
    const until = new Date().toISOString().slice(0, 10);

    // ----- 1. Upsert da conta -----
    const contaInfo = await graphGet(adAccountId, token, {
      fields: "name,currency,account_status",
    });
    const { data: contaRow, error: contaErr } = await supabase
      .from("ads_contas")
      .upsert(
        {
          plataforma: "meta",
          conta_externa: adAccountId,
          nome: contaInfo?.name ?? null,
          moeda: contaInfo?.currency ?? "BRL",
          status: contaInfo?.account_status === 1 ? "ativa" : "pausada",
          ultima_sync_em: new Date().toISOString(),
        },
        { onConflict: "plataforma,conta_externa" },
      )
      .select("id")
      .single();
    if (contaErr) throw new Error(`upsert conta: ${contaErr.message}`);
    const contaId = contaRow.id as string;

    // ----- 2. Campanhas -----
    const campanhas = await graphGet(`${adAccountId}/campaigns`, token, {
      fields: "id,name,objective,status",
      limit: "200",
    });
    const mapaCampanha: Record<string, { id: string; objetivo_norm: string }> = {};
    for (const c of campanhas?.data ?? []) {
      const objetivo_norm = normalizarObjetivo(c.objective);
      const { data: row, error } = await supabase
        .from("ads_campanhas")
        .upsert(
          {
            conta_id: contaId,
            campanha_externa: c.id,
            nome: c.name,
            objetivo: c.objective,
            objetivo_norm,
            status: c.status,
          },
          { onConflict: "conta_id,campanha_externa" },
        )
        .select("id")
        .single();
      if (error) throw new Error(`upsert campanha ${c.id}: ${error.message}`);
      mapaCampanha[c.id] = { id: row.id, objetivo_norm };
    }

    // ----- 3. Conjuntos (ad sets) -----
    const conjuntos = await graphGet(`${adAccountId}/adsets`, token, {
      fields: "id,name,campaign_id,optimization_goal,daily_budget,status",
      limit: "300",
    });
    const mapaConjunto: Record<string, { id: string; objetivo_norm: string }> = {};
    for (const s of conjuntos?.data ?? []) {
      const pai = mapaCampanha[s.campaign_id];
      if (!pai) continue;
      const { data: row, error } = await supabase
        .from("ads_conjuntos")
        .upsert(
          {
            campanha_id: pai.id,
            conjunto_externo: s.id,
            nome: s.name,
            objetivo_norm: pai.objetivo_norm,
            optimization_goal: s.optimization_goal,
            verba_diaria: s.daily_budget ? Number(s.daily_budget) / 100 : null, // centavos -> reais
            status: s.status,
          },
          { onConflict: "campanha_id,conjunto_externo" },
        )
        .select("id")
        .single();
      if (error) throw new Error(`upsert conjunto ${s.id}: ${error.message}`);
      mapaConjunto[s.id] = { id: row.id, objetivo_norm: pai.objetivo_norm };
    }

    // ----- 4. Anuncios (captura effective_status -> WITH_ISSUES) -----
    const anuncios = await graphGet(`${adAccountId}/ads`, token, {
      fields: "id,name,adset_id,status,effective_status",
      limit: "500",
    });
    const mapaAnuncio: Record<string, { id: string; objetivo_norm: string }> = {};
    for (const a of anuncios?.data ?? []) {
      const pai = mapaConjunto[a.adset_id];
      if (!pai) continue;
      const { data: row, error } = await supabase
        .from("ads_anuncios")
        .upsert(
          {
            conjunto_id: pai.id,
            anuncio_externo: a.id,
            nome: a.name,
            status: a.status,
            effective_status: a.effective_status,
          },
          { onConflict: "conjunto_id,anuncio_externo" },
        )
        .select("id")
        .single();
      if (error) throw new Error(`upsert anuncio ${a.id}: ${error.message}`);
      mapaAnuncio[a.id] = { id: row.id, objetivo_norm: pai.objetivo_norm };
    }

    // ----- 5. Insights diarios por anuncio (agregado, segmentado) -----
    const insights = await graphGet(`${adAccountId}/insights`, token, {
      level: "ad",
      time_increment: "1",
      time_range: JSON.stringify({ since, until }),
      fields: "ad_id,impressions,clicks,spend,actions",
      limit: "1000",
    });

    let linhasInsight = 0;
    for (const ins of insights?.data ?? []) {
      const alvo = mapaAnuncio[ins.ad_id];
      if (!alvo) continue;
      const conversas = somarAcoes(ins.actions, [
        "onsite_conversion.messaging_conversation_started",
        "messaging_conversation_started",
      ]);
      const leads = somarAcoes(ins.actions, ["lead", "leadgen"]);
      const gasto = Number(ins.spend || 0);
      const row = {
        data: ins.date_start,
        plataforma: "meta",
        entidade_tipo: "anuncio",
        entidade_id: alvo.id,
        objetivo_norm: alvo.objetivo_norm,
        impressoes: Number(ins.impressions || 0),
        cliques: Number(ins.clicks || 0),
        gasto,
        conversas,
        leads,
        custo_por_conversa: conversas > 0 ? Number((gasto / conversas).toFixed(2)) : null,
        custo_por_lead: leads > 0 ? Number((gasto / leads).toFixed(2)) : null,
        raw: ins,
      };
      const { error } = await supabase
        .from("ads_insights_diarios")
        .upsert(row, { onConflict: "plataforma,entidade_tipo,entidade_id,data" });
      if (error) throw new Error(`upsert insight ${ins.ad_id}/${ins.date_start}: ${error.message}`);
      linhasInsight++;
    }

    const resumo = {
      conta: contaId,
      campanhas: Object.keys(mapaCampanha).length,
      conjuntos: Object.keys(mapaConjunto).length,
      anuncios: Object.keys(mapaAnuncio).length,
      insights: linhasInsight,
      periodo: { since, until },
    };

    await insertAuditLog(supabase, {
      usuario_nome: "sistema",
      acao: "sincronizar",
      modulo: "configuracoes",
      descricao: `Foco Ads: sync Meta concluido (${linhasInsight} linhas de insight, ${dias}d)`,
      tabela: "ads_insights_diarios",
      dados_novos: resumo,
    });

    return new Response(JSON.stringify({ ok: true, ...resumo }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ads-meta-sync] erro:", msg); // msg nunca contem o token
    await insertAuditLog(supabase, {
      usuario_nome: "sistema",
      acao: "sincronizar",
      modulo: "configuracoes",
      descricao: `Foco Ads: FALHA no sync Meta — ${msg}`,
      tabela: "ads_insights_diarios",
    });
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
