// =============================================================================
// ads-executar-acao — ONDA 3 (Execucao com aprovacao na Meta)
// =============================================================================
// Aplica a REGRA DE OURO: nada que gaste dinheiro/altere campanha executa sem
// aprovacao explicita + permissao + auditoria.
//
// Fluxo (1 clique): usuario com foco_ads.executar aprova -> sistema executa na
// Meta -> registra log com undo_payload -> auditoria.
// Rejeicao: usuario com foco_ads.aprovar marca como rejeitada (nao executa).
//
// Seguranca:
//   - Valida JWT do aprovador (identifica quem aprovou).
//   - checkPermission antes de qualquer escrita.
//   - Idempotencia: acao ja executada/executando nao roda de novo.
//   - Token Meta nunca logado; usado so server-side.
//   - Captura estado anterior (undo_payload) ANTES de aplicar a mudanca.
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCredenciaisMetaAds, getCredenciaisGoogleAds } from "../_shared/credenciais-hibridas.ts";
import { getGoogleAccessToken, gaqlMutate, type GoogleAdsCreds } from "../_shared/google-ads-client.ts";
import { checkPermission } from "../_shared/check-permission.ts";
import { insertAuditLog } from "../_shared/auditLog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRAPH = "https://graph.facebook.com/v21.0";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function graphGet(id: string, fields: string, token: string) {
  const url = new URL(`${GRAPH}/${id}`);
  url.searchParams.set("fields", fields);
  url.searchParams.set("access_token", token);
  const r = await fetch(url.toString());
  const j = await r.json();
  if (!r.ok) throw new Error(`Meta GET ${r.status}: ${j?.error?.message || "erro"}`);
  return j;
}

async function graphPost(id: string, params: Record<string, string>, token: string) {
  const form = new URLSearchParams(params);
  form.set("access_token", token);
  const r = await fetch(`${GRAPH}/${id}`, { method: "POST", body: form });
  const j = await r.json();
  if (!r.ok) throw new Error(`Meta POST ${r.status}: ${j?.error?.message || "erro"}`);
  return j;
}

interface ResultadoExecucao {
  requestPayload: Record<string, unknown>;
  undoPayload: Record<string, unknown>;
  response: unknown;
}

// ----- Execucao na Meta -----
async function executarMeta(
  token: string, tipo: string, alvo: string, payload: Record<string, unknown>,
): Promise<ResultadoExecucao> {
  switch (tipo) {
    case "pausar": {
      const atual = await graphGet(alvo, "status", token);
      const resp = await graphPost(alvo, { status: "PAUSED" }, token);
      return { requestPayload: { status: "PAUSED" }, undoPayload: { tipo: "reativar", status: atual?.status ?? "ACTIVE" }, response: resp };
    }
    case "reativar": {
      const atual = await graphGet(alvo, "status", token);
      const resp = await graphPost(alvo, { status: "ACTIVE" }, token);
      return { requestPayload: { status: "ACTIVE" }, undoPayload: { tipo: "pausar", status: atual?.status ?? "PAUSED" }, response: resp };
    }
    case "ajustar_verba": {
      const atual = await graphGet(alvo, "daily_budget", token);
      const reais = Number(payload?.daily_budget ?? payload?.verba_diaria ?? 0);
      if (!reais || reais <= 0) throw new Error("daily_budget invalido no payload");
      const req = { daily_budget: String(Math.round(reais * 100)) };
      const resp = await graphPost(alvo, req, token);
      return { requestPayload: req, undoPayload: { tipo: "ajustar_verba", daily_budget: atual?.daily_budget ?? null }, response: resp };
    }
    case "duplicar": {
      const resp = await graphPost(`${alvo}/copies`, {}, token);
      return { requestPayload: {}, undoPayload: { tipo: "manual", nota: "Excluir a copia criada se necessario" }, response: resp };
    }
    default:
      throw new Error(`tipo de acao nao suportado: ${tipo}`);
  }
}

// ----- Execucao no Google -----
// Suporta pausar/reativar em campanha (campaigns) e conjunto (adGroups).
// ajustar_verba/duplicar ainda nao suportados no Google (orcamento e recurso
// separado; duplicacao exige montagem completa) — retorna erro explicito em vez
// de chutar uma chamada que mexe em verba as cegas.
async function executarGoogle(
  creds: GoogleAdsCreds, tipo: string, entidadeTipo: string, alvo: string,
): Promise<ResultadoExecucao> {
  const accessToken = await getGoogleAccessToken(creds);
  const cid = creds.customer_id;

  let service: string;
  let resourceName: string;
  if (entidadeTipo === "campanha") {
    service = "campaigns";
    resourceName = `customers/${cid}/campaigns/${alvo}`;
  } else if (entidadeTipo === "conjunto") {
    service = "adGroups";
    resourceName = `customers/${cid}/adGroups/${alvo}`;
  } else {
    throw new Error(`Google: ${entidadeTipo} ainda nao suportado para execucao (use campanha ou conjunto)`);
  }

  if (tipo === "pausar" || tipo === "reativar") {
    const novo = tipo === "pausar" ? "PAUSED" : "ENABLED";
    const anterior = tipo === "pausar" ? "ENABLED" : "PAUSED";
    const op = [{ updateMask: "status", update: { resourceName, status: novo } }];
    const resp = await gaqlMutate(creds, accessToken, service, op);
    return {
      requestPayload: { resourceName, status: novo },
      undoPayload: { tipo: tipo === "pausar" ? "reativar" : "pausar", status: anterior },
      response: resp,
    };
  }

  throw new Error(`Google: acao '${tipo}' ainda nao suportada (apenas pausar/reativar)`);
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

    // ----- Carregar acao -----
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
    // Idempotencia
    if (["executando", "executada"].includes(acao.status)) {
      return json(409, { ok: false, error: `Acao ja em '${acao.status}'` });
    }
    if (acao.status === "rejeitada" || acao.status === "revertida") {
      return json(409, { ok: false, error: `Acao em '${acao.status}' nao pode ser executada` });
    }

    const plataforma = (acao.plataforma as string) || "meta";
    const alvo = acao.entidade_externa_id as string;
    const payload = (acao.payload_proposto ?? {}) as Record<string, unknown>;

    // Carrega credenciais da plataforma correta ANTES de alterar estado.
    let metaToken: string | null = null;
    let googleCreds: GoogleAdsCreds | null = null;
    if (plataforma === "google") {
      googleCreds = await getCredenciaisGoogleAds(supabase);
      if (!googleCreds) return json(412, { ok: false, error: "Credenciais Google Ads nao configuradas" });
    } else {
      const creds = await getCredenciaisMetaAds(supabase);
      if (!creds) return json(412, { ok: false, error: "Credenciais Meta Ads nao configuradas" });
      metaToken = creds.access_token;
    }

    // Marca executando (lock otimista) + registra aprovacao
    await supabase.from("ads_acoes_propostas").update({ status: "executando" }).eq("id", acaoId);
    await supabase.from("ads_aprovacoes").insert({
      acao_id: acaoId, aprovador_id: user.id, decisao: "aprovou", comentario,
    });

    let requestPayload: Record<string, unknown> = {};
    let undoPayload: Record<string, unknown> = {};

    try {
      const resultado = plataforma === "google"
        ? await executarGoogle(googleCreds!, acao.tipo, acao.entidade_tipo, alvo)
        : await executarMeta(metaToken!, acao.tipo, alvo, payload);
      requestPayload = resultado.requestPayload;
      undoPayload = resultado.undoPayload;

      await supabase.from("ads_log_execucoes").insert({
        acao_id: acaoId,
        request_payload: { plataforma, tipo: acao.tipo, alvo, params: requestPayload }, // sem segredos
        response_meta: resultado.response,
        sucesso: true,
        undo_payload: undoPayload,
      });
      await supabase.from("ads_acoes_propostas").update({ status: "executada" }).eq("id", acaoId);
      await insertAuditLog(supabase, {
        usuario_id: user.id, acao: "executar", modulo: "configuracoes",
        descricao: `Foco Ads: acao ${acao.tipo} executada (${plataforma}, alvo ${alvo})`,
        tabela: "ads_acoes_propostas", registro_id: acaoId,
        dados_novos: { tipo: acao.tipo, params: requestPayload, undo: undoPayload },
      });
      return json(200, { ok: true, status: "executada", undo: undoPayload });
    } catch (execErr) {
      const msg = execErr instanceof Error ? execErr.message : String(execErr);
      await supabase.from("ads_log_execucoes").insert({
        acao_id: acaoId,
        request_payload: { tipo: acao.tipo, alvo, params: requestPayload },
        sucesso: false, erro: msg, undo_payload: undoPayload,
      });
      await supabase.from("ads_acoes_propostas").update({ status: "falha" }).eq("id", acaoId);
      await insertAuditLog(supabase, {
        usuario_id: user.id, acao: "executar", modulo: "configuracoes",
        descricao: `Foco Ads: FALHA ao executar ${acao.tipo} — ${msg}`,
        tabela: "ads_acoes_propostas", registro_id: acaoId,
      });
      return json(502, { ok: false, status: "falha", error: msg });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ads-executar-acao] erro:", msg);
    return json(500, { ok: false, error: msg });
  }
});
