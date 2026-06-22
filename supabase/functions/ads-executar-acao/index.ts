// =============================================================================
// ads-executar-acao — ONDA 3/4 (Execucao com aprovacao HUMANA: Meta + Google)
// =============================================================================
// Aplica a REGRA DE OURO: nada que gaste dinheiro/altere campanha executa sem
// aprovacao explicita + permissao + auditoria.
//
// Fluxo (1 clique): usuario com foco_ads.executar aprova -> sistema executa ->
// registra log com undo_payload -> auditoria.
// Rejeicao: usuario com foco_ads.aprovar marca como rejeitada (nao executa).
//
// A mecanica de escrita nas plataformas fica em _shared/ads-executor.ts
// (reutilizada pela automacao da Onda 5). Token nunca logado.
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aplicarAcao } from "../_shared/ads-executor.ts";
import { checkPermission } from "../_shared/check-permission.ts";
import { insertAuditLog } from "../_shared/auditLog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // ----- Autenticacao do aprovador -----
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(401, { ok: false, error: "Nao autorizado" });
  const token = authHeader.replace("Bearer ", "");
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await authClient.auth.getUser(token);
  if (userErr || !user) return json(401, { ok: false, error: "Token invalido" });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    const body = await req.json().catch(() => ({}));
    const acaoId: string = body?.acao_id;
    const decisao: "aprovar" | "rejeitar" = body?.decisao === "rejeitar" ? "rejeitar" : "aprovar";
    const comentario: string | null = body?.comentario ?? null;
    if (!acaoId) return json(400, { ok: false, error: "acao_id obrigatorio" });

    const { data: acao, error: acaoErr } = await supabase
      .from("ads_acoes_propostas")
      .select("*")
      .eq("id", acaoId)
      .maybeSingle();
    if (acaoErr) throw new Error(`carregar acao: ${acaoErr.message}`);
    if (!acao) return json(404, { ok: false, error: "Acao nao encontrada" });

    // ----- Rejeicao (nao executa) -----
    if (decisao === "rejeitar") {
      if (!(await checkPermission(user.id, "foco_ads.aprovar"))) {
        return json(403, { ok: false, error: "Sem permissao para rejeitar" });
      }
      if (acao.status !== "proposta" && acao.status !== "aprovada") {
        return json(409, { ok: false, error: `Acao em status '${acao.status}' nao pode ser rejeitada` });
      }
      await supabase.from("ads_aprovacoes").insert({
        acao_id: acaoId, aprovador_id: user.id, decisao: "rejeitou", comentario,
      });
      await supabase.from("ads_acoes_propostas").update({ status: "rejeitada" }).eq("id", acaoId);
      await insertAuditLog(supabase, {
        usuario_id: user.id, acao: "rejeitar", modulo: "configuracoes",
        descricao: `Foco Ads: acao ${acao.tipo} rejeitada`,
        tabela: "ads_acoes_propostas", registro_id: acaoId,
      });
      return json(200, { ok: true, status: "rejeitada" });
    }

    // ----- Aprovacao + Execucao (gasta/altera) -> exige foco_ads.executar -----
    if (!(await checkPermission(user.id, "foco_ads.executar"))) {
      return json(403, { ok: false, error: "Sem permissao para executar acoes" });
    }
    if (["executando", "executada"].includes(acao.status)) {
      return json(409, { ok: false, error: `Acao ja em '${acao.status}'` });
    }
    if (acao.status === "rejeitada" || acao.status === "revertida") {
      return json(409, { ok: false, error: `Acao em '${acao.status}' nao pode ser executada` });
    }

    // Registra a aprovacao humana ANTES de executar (o usuario aprovou de fato).
    await supabase.from("ads_aprovacoes").insert({
      acao_id: acaoId, aprovador_id: user.id, decisao: "aprovou", comentario,
    });

    const r = await aplicarAcao(supabase, acao, "humano");

    if (r.status === "sem_credenciais") {
      // Reverte o lock (nao houve execucao). Volta para 'aprovada'.
      await supabase.from("ads_acoes_propostas").update({ status: "aprovada" }).eq("id", acaoId);
      return json(412, { ok: false, error: r.erro });
    }

    await insertAuditLog(supabase, {
      usuario_id: user.id,
      acao: "executar",
      modulo: "configuracoes",
      descricao: r.ok
        ? `Foco Ads: acao ${acao.tipo} executada (${acao.plataforma}, alvo ${acao.entidade_externa_id})`
        : `Foco Ads: FALHA ao executar ${acao.tipo} — ${r.erro}`,
      tabela: "ads_acoes_propostas",
      registro_id: acaoId,
      dados_novos: r.ok ? { tipo: acao.tipo, undo: r.undo } : { erro: r.erro },
    });

    return json(r.code, { ok: r.ok, status: r.status, undo: r.undo, error: r.erro });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ads-executar-acao] erro:", msg);
    return json(500, { ok: false, error: msg });
  }
});
