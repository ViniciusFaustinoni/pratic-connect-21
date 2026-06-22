// =============================================================================
// ads-automacoes-run — ONDA 5 (Automacoes de guarda-corpo)
// =============================================================================
// Cron. Avalia os guardrails e, para cada AUTOMACAO LIGADA (ativo=true) que
// casa com uma violacao, age conforme o modo:
//   - 'sinalizar' (padrao, seguro): apenas notifica + audita. Nao executa.
//   - 'executar' (sensivel): cria a acao, executa via _shared/ads-executor e
//     notifica. So roda porque a automacao foi LIGADA de proposito.
// SEMPRE notifica (Regra de Ouro). Idempotente por automacao/anuncio/dia.
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aplicarAcao } from "../_shared/ads-executor.ts";
import { getUsersWithPermission } from "../_shared/check-permission.ts";
import { insertAuditLog } from "../_shared/auditLog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function notificar(supabase: any, titulo: string, mensagem: string, prioridade = "alta") {
  const userIds = await getUsersWithPermission("foco_ads.ver");
  if (!userIds.length) return;
  const linhas = userIds.map((uid) => ({
    user_id: uid,
    tipo: "foco_ads",
    titulo,
    mensagem,
    prioridade,
    modulo: "configuracoes",
    link: "/foco-ads/acoes",
    canal_sistema: true,
  }));
  await supabase.from("notificacoes").insert(linhas);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    // ----- 1. Automacoes LIGADAS -----
    const { data: automacoes } = await supabase
      .from("ads_automacoes")
      .select("*")
      .eq("ativo", true);
    if (!automacoes?.length) {
      return new Response(JSON.stringify({ ok: true, automacoes: 0, acoes: 0, nota: "Nenhuma automacao ligada." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ----- 2. Guardrails + dados -----
    const { data: gr } = await supabase.from("ads_guardrails_config").select("chave, valor, janela_horas");
    const custoMaxConversa = Number(gr?.find((g: any) => g.chave === "custo_max_conversa_48h")?.valor ?? 25);
    const custoMaxLead = Number(gr?.find((g: any) => g.chave === "custo_max_lead_48h")?.valor ?? 30);
    const janelaHoras = Number(gr?.find((g: any) => g.chave === "custo_max_conversa_48h")?.janela_horas ?? 48);
    const corte = new Date(Date.now() - janelaHoras * 3600000).toISOString().slice(0, 10);

    const { data: anuncios } = await supabase
      .from("ads_anuncios")
      .select("id, nome, anuncio_externo, effective_status");
    const anuncioMap = new Map<string, any>((anuncios ?? []).map((a: any) => [a.id, a]));

    const { data: insights } = await supabase
      .from("ads_insights_diarios")
      .select("entidade_id, plataforma, objetivo_norm, gasto, conversas, leads")
      .eq("entidade_tipo", "anuncio")
      .gte("data", corte);

    type Agg = { plataforma: string; objetivo: string; gasto: number; conversas: number; leads: number };
    const agg = new Map<string, Agg>();
    for (const r of insights ?? []) {
      const cur = agg.get(r.entidade_id) ?? { plataforma: r.plataforma, objetivo: r.objetivo_norm, gasto: 0, conversas: 0, leads: 0 };
      cur.gasto += Number(r.gasto || 0);
      cur.conversas += Number(r.conversas || 0);
      cur.leads += Number(r.leads || 0);
      agg.set(r.entidade_id, cur);
    }

    const hoje = new Date().toISOString().slice(0, 10);
    let totalAcoes = 0;
    let totalSinais = 0;

    // ----- 3. Avaliar cada automacao -----
    for (const auto of automacoes) {
      // Lista de anuncios que violam o gatilho desta automacao.
      const violacoes: { adId: string; motivo: string }[] = [];
      for (const [adId, m] of agg.entries()) {
        if (auto.plataforma !== "todas" && auto.plataforma !== m.plataforma) continue;
        if (auto.gatilho === "custo_conversa" && m.objetivo === "messaging" && m.conversas > 0) {
          const cpc = m.gasto / m.conversas;
          if (cpc > custoMaxConversa) violacoes.push({ adId, motivo: `custo/conversa R$ ${cpc.toFixed(2)} > R$ ${custoMaxConversa}` });
        } else if (auto.gatilho === "custo_lead" && m.objetivo === "lead" && m.leads > 0) {
          const cpl = m.gasto / m.leads;
          if (cpl > custoMaxLead) violacoes.push({ adId, motivo: `custo/lead R$ ${cpl.toFixed(2)} > R$ ${custoMaxLead}` });
        }
      }
      if (auto.gatilho === "with_issues") {
        for (const [adId, a] of anuncioMap.entries()) {
          if (String(a.effective_status || "").toUpperCase() === "WITH_ISSUES") {
            const plat = agg.get(adId)?.plataforma ?? "meta";
            if (auto.plataforma === "todas" || auto.plataforma === plat) {
              violacoes.push({ adId, motivo: "anuncio WITH_ISSUES" });
            }
          }
        }
      }

      for (const v of violacoes) {
        const ad = anuncioMap.get(v.adId);
        const nome = ad?.nome ?? v.adId;

        if (auto.modo === "executar") {
          // Idempotencia: 1 acao por automacao/anuncio/dia.
          const idemKey = `auto:${auto.id}:${v.adId}:${hoje}`;
          const { data: acao, error: insErr } = await supabase
            .from("ads_acoes_propostas")
            .insert({
              plataforma: agg.get(v.adId)?.plataforma ?? "meta",
              tipo: auto.acao_tipo,
              entidade_tipo: "anuncio",
              entidade_id: v.adId,
              entidade_externa_id: ad?.anuncio_externo ?? "",
              payload_proposto: auto.parametros ?? {},
              justificativa_ia: `Automacao "${auto.nome}": ${v.motivo}`,
              status: "aprovada",
              idempotency_key: idemKey,
              criado_por: null,
            })
            .select("*")
            .single();

          if (insErr) {
            // Conflito de idempotencia => ja agimos hoje; pula em silencio.
            if (String(insErr.message).toLowerCase().includes("duplicate")) continue;
            console.error("[ads-automacoes-run] erro criando acao:", insErr.message);
            continue;
          }

          const r = await aplicarAcao(supabase, acao, "automacao");
          totalAcoes++;
          await insertAuditLog(supabase, {
            usuario_nome: "automacao",
            acao: "executar",
            modulo: "configuracoes",
            descricao: r.ok
              ? `Foco Ads [AUTOMACAO ${auto.nome}]: ${auto.acao_tipo} em ${nome} — ${v.motivo}`
              : `Foco Ads [AUTOMACAO ${auto.nome}]: FALHA ${auto.acao_tipo} em ${nome} — ${r.erro}`,
            tabela: "ads_acoes_propostas",
            registro_id: acao.id,
          });
          if (auto.notificar) {
            await notificar(
              supabase,
              `Automação executou: ${auto.nome}`,
              r.ok
                ? `A automação "${auto.nome}" aplicou "${auto.acao_tipo}" no anúncio ${nome} (${v.motivo}). Revise se necessário.`
                : `A automação "${auto.nome}" tentou agir no anúncio ${nome} mas falhou: ${r.erro}.`,
            );
          }
        } else {
          // modo 'sinalizar': apenas avisa, nao executa.
          totalSinais++;
          if (auto.notificar) {
            await notificar(
              supabase,
              `Alerta: ${auto.nome}`,
              `O anúncio ${nome} disparou o guardrail "${auto.nome}" (${v.motivo}). Avalie em Foco Ads > Ações.`,
              "media",
            );
          }
        }
      }

      await supabase.from("ads_automacoes").update({ ultima_execucao_em: new Date().toISOString() }).eq("id", auto.id);
    }

    return new Response(
      JSON.stringify({ ok: true, automacoes: automacoes.length, acoes_executadas: totalAcoes, sinais: totalSinais }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ads-automacoes-run] erro:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
