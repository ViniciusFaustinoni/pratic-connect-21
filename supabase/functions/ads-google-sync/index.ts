// =============================================================================
// ads-google-sync — ONDA 4 (Ingestao Google Ads, somente leitura)
// =============================================================================
// Espelho do ads-meta-sync para Google. Puxa campanhas -> grupos -> anuncios e
// metricas AGREGADAS via GAQL e faz upsert nas tabelas ads_* (plataforma='google').
// NUNCA escreve no Google. Token critico nunca logado. LGPD: so agregados.
// Google nao tem "messaging" (WhatsApp): objetivo_norm = 'lead' (quando otimiza
// conversoes/lead) ou 'outro'.
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCredenciaisGoogleAds } from "../_shared/credenciais-hibridas.ts";
import { getGoogleAccessToken, gaqlSearch } from "../_shared/google-ads-client.ts";
import { insertAuditLog } from "../_shared/auditLog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Google nao tem WhatsApp messaging. Mapeia para 'lead' quando faz sentido.
function objetivoNorm(channelType?: string): "lead" | "outro" {
  const c = (channelType || "").toUpperCase();
  // Canais tipicamente usados para geracao de leads.
  if (["SEARCH", "DISPLAY", "DISCOVERY", "PERFORMANCE_MAX"].includes(c)) return "lead";
  return "outro";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const dias: number = Math.min(Math.max(Number(body?.dias ?? 7), 1), 90);

    const creds = await getCredenciaisGoogleAds(supabase);
    if (!creds) {
      return new Response(
        JSON.stringify({ ok: false, error: "Credenciais Google Ads nao configuradas (integracoes_credenciais: google_ads)." }),
        { status: 412, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const accessToken = await getGoogleAccessToken(creds);
    const since = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
    const until = new Date().toISOString().slice(0, 10);
    const contaExterna = creds.login_customer_id
      ? `${creds.login_customer_id}/${creds.customer_id}`
      : creds.customer_id;

    // ----- 1. Conta -----
    const { data: contaRow, error: contaErr } = await supabase
      .from("ads_contas")
      .upsert(
        {
          plataforma: "google",
          conta_externa: contaExterna,
          nome: `Google Ads ${creds.customer_id}`,
          moeda: "BRL",
          status: "ativa",
          ultima_sync_em: new Date().toISOString(),
        },
        { onConflict: "plataforma,conta_externa" },
      )
      .select("id")
      .single();
    if (contaErr) throw new Error(`upsert conta: ${contaErr.message}`);
    const contaId = contaRow.id as string;

    // ----- 2. Campanhas (+ canal -> objetivo_norm) -----
    const campanhasRows = await gaqlSearch(
      creds, accessToken,
      `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type FROM campaign`,
    );
    const mapaCampanha: Record<string, { id: string; objetivo_norm: string }> = {};
    for (const row of campanhasRows) {
      const c = row.campaign;
      const on = objetivoNorm(c.advertisingChannelType);
      const { data, error } = await supabase
        .from("ads_campanhas")
        .upsert(
          {
            conta_id: contaId,
            campanha_externa: String(c.id),
            nome: c.name,
            objetivo: c.advertisingChannelType,
            objetivo_norm: on,
            status: c.status,
          },
          { onConflict: "conta_id,campanha_externa" },
        )
        .select("id")
        .single();
      if (error) throw new Error(`upsert campanha ${c.id}: ${error.message}`);
      mapaCampanha[String(c.id)] = { id: data.id, objetivo_norm: on };
    }

    // ----- 3. Grupos de anuncios (ad groups -> conjuntos) -----
    const gruposRows = await gaqlSearch(
      creds, accessToken,
      `SELECT ad_group.id, ad_group.name, ad_group.status, campaign.id FROM ad_group`,
    );
    const mapaConjunto: Record<string, { id: string; objetivo_norm: string }> = {};
    for (const row of gruposRows) {
      const g = row.adGroup;
      const pai = mapaCampanha[String(row.campaign.id)];
      if (!pai) continue;
      const { data, error } = await supabase
        .from("ads_conjuntos")
        .upsert(
          {
            campanha_id: pai.id,
            conjunto_externo: String(g.id),
            nome: g.name,
            objetivo_norm: pai.objetivo_norm,
            status: g.status,
          },
          { onConflict: "campanha_id,conjunto_externo" },
        )
        .select("id")
        .single();
      if (error) throw new Error(`upsert conjunto ${g.id}: ${error.message}`);
      mapaConjunto[String(g.id)] = { id: data.id, objetivo_norm: pai.objetivo_norm };
    }

    // ----- 4. Anuncios (ad_group_ad) -----
    const anunciosRows = await gaqlSearch(
      creds, accessToken,
      `SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.status, ad_group.id FROM ad_group_ad`,
    );
    const mapaAnuncio: Record<string, { id: string; objetivo_norm: string }> = {};
    for (const row of anunciosRows) {
      const ad = row.adGroupAd;
      const pai = mapaConjunto[String(row.adGroup.id)];
      if (!pai) continue;
      const adId = String(ad.ad.id);
      const { data, error } = await supabase
        .from("ads_anuncios")
        .upsert(
          {
            conjunto_id: pai.id,
            anuncio_externo: adId,
            nome: ad.ad.name || `Ad ${adId}`,
            status: ad.status,
            effective_status: ad.status,
          },
          { onConflict: "conjunto_id,anuncio_externo" },
        )
        .select("id")
        .single();
      if (error) throw new Error(`upsert anuncio ${adId}: ${error.message}`);
      mapaAnuncio[adId] = { id: data.id, objetivo_norm: pai.objetivo_norm };
    }

    // ----- 5. Insights diarios por anuncio (segmentado por dia) -----
    const metricsRows = await gaqlSearch(
      creds, accessToken,
      `SELECT ad_group_ad.ad.id, segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
       FROM ad_group_ad
       WHERE segments.date BETWEEN '${since}' AND '${until}'`,
    );

    let linhasInsight = 0;
    for (const row of metricsRows) {
      const adId = String(row.adGroupAd?.ad?.id ?? "");
      const alvo = mapaAnuncio[adId];
      if (!alvo) continue;
      const m = row.metrics ?? {};
      const gasto = Number(m.costMicros ?? 0) / 1_000_000;
      const leads = Math.round(Number(m.conversions ?? 0));
      const insRow = {
        data: row.segments?.date,
        plataforma: "google",
        entidade_tipo: "anuncio",
        entidade_id: alvo.id,
        objetivo_norm: alvo.objetivo_norm,
        impressoes: Number(m.impressions ?? 0),
        cliques: Number(m.clicks ?? 0),
        gasto: Number(gasto.toFixed(2)),
        conversas: 0, // Google nao tem WhatsApp messaging
        leads,
        custo_por_conversa: null,
        custo_por_lead: leads > 0 ? Number((gasto / leads).toFixed(2)) : null,
        raw: row,
      };
      const { error } = await supabase
        .from("ads_insights_diarios")
        .upsert(insRow, { onConflict: "plataforma,entidade_tipo,entidade_id,data" });
      if (error) throw new Error(`upsert insight ${adId}: ${error.message}`);
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
      descricao: `Foco Ads: sync Google concluido (${linhasInsight} linhas de insight, ${dias}d)`,
      tabela: "ads_insights_diarios",
      dados_novos: resumo,
    });

    return new Response(JSON.stringify({ ok: true, ...resumo }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ads-google-sync] erro:", msg); // sem segredos
    await insertAuditLog(supabase, {
      usuario_nome: "sistema",
      acao: "sincronizar",
      modulo: "configuracoes",
      descricao: `Foco Ads: FALHA no sync Google — ${msg}`,
      tabela: "ads_insights_diarios",
    });
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
