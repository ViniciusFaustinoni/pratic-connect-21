// =============================================================================
// ads-executor — nucleo de execucao de acoes (Meta + Google), reutilizavel.
// =============================================================================
// Usado por:
//   - ads-executar-acao  (execucao com aprovacao HUMANA)
//   - ads-automacoes-run (execucao AUTONOMA, so com flag de automacao ligada)
//
// Este modulo NAO faz checagem de permissao nem registra aprovacao — isso e
// responsabilidade do chamador. Ele apenas: carrega credenciais da plataforma,
// aplica a mudanca, grava ads_log_execucoes com undo_payload e atualiza o status
// da acao. Segredos nunca sao logados.
// =============================================================================

import { getCredenciaisMetaAds, getCredenciaisGoogleAds } from "./credenciais-hibridas.ts";
import { getGoogleAccessToken, gaqlMutate, type GoogleAdsCreds } from "./google-ads-client.ts";

const GRAPH = "https://graph.facebook.com/v21.0";

export interface ResultadoExecucao {
  requestPayload: Record<string, unknown>;
  undoPayload: Record<string, unknown>;
  response: unknown;
}

export interface AplicarResultado {
  ok: boolean;
  /** 200 sucesso, 412 sem credenciais, 502 falha na plataforma. */
  code: number;
  status: "executada" | "falha" | "sem_credenciais";
  undo?: Record<string, unknown>;
  erro?: string;
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

export async function executarMeta(
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

export async function executarGoogle(
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

/**
 * Aplica uma acao ja existente (linha de ads_acoes_propostas). Faz todo o ciclo
 * de execucao + log + atualizacao de status. NAO checa permissao nem aprovacao.
 * `origem` apenas rotula o log (ex.: 'humano' | 'automacao').
 */
export async function aplicarAcao(
  supabase: any,
  acao: any,
  origem: "humano" | "automacao",
): Promise<AplicarResultado> {
  const plataforma = (acao.plataforma as string) || "meta";
  const alvo = acao.entidade_externa_id as string;
  const payload = (acao.payload_proposto ?? {}) as Record<string, unknown>;

  // Credenciais da plataforma — sem mudar estado se faltarem.
  let metaToken: string | null = null;
  let googleCreds: GoogleAdsCreds | null = null;
  if (plataforma === "google") {
    googleCreds = await getCredenciaisGoogleAds(supabase);
    if (!googleCreds) return { ok: false, code: 412, status: "sem_credenciais", erro: "Credenciais Google Ads nao configuradas" };
  } else {
    const creds = await getCredenciaisMetaAds(supabase);
    if (!creds) return { ok: false, code: 412, status: "sem_credenciais", erro: "Credenciais Meta Ads nao configuradas" };
    metaToken = creds.access_token;
  }

  await supabase.from("ads_acoes_propostas").update({ status: "executando" }).eq("id", acao.id);

  try {
    const resultado = plataforma === "google"
      ? await executarGoogle(googleCreds!, acao.tipo, acao.entidade_tipo, alvo)
      : await executarMeta(metaToken!, acao.tipo, alvo, payload);

    await supabase.from("ads_log_execucoes").insert({
      acao_id: acao.id,
      request_payload: { origem, plataforma, tipo: acao.tipo, alvo, params: resultado.requestPayload }, // sem segredos
      response_meta: resultado.response,
      sucesso: true,
      undo_payload: resultado.undoPayload,
    });
    await supabase.from("ads_acoes_propostas").update({ status: "executada" }).eq("id", acao.id);
    return { ok: true, code: 200, status: "executada", undo: resultado.undoPayload };
  } catch (execErr) {
    const msg = execErr instanceof Error ? execErr.message : String(execErr);
    await supabase.from("ads_log_execucoes").insert({
      acao_id: acao.id,
      request_payload: { origem, plataforma, tipo: acao.tipo, alvo },
      sucesso: false, erro: msg,
    });
    await supabase.from("ads_acoes_propostas").update({ status: "falha" }).eq("id", acao.id);
    return { ok: false, code: 502, status: "falha", erro: msg };
  }
}
