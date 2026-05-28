/**
 * troca-promover-com-sondagem
 *
 * Wrapper canônico chamado por todos os pontos que querem promover uma troca
 * de `efetivacao_pendente` para `efetivada`:
 *   - edge `efetivar-troca-titularidade` (após manipulação inline)
 *   - `cron-softruck-troca-retry` (após sucesso/falha do retry)
 *   - `cron-sga-retry` (após resolver etapas SGA)
 *   - `cron-troca-promocao-gate` (varredura de rede de segurança)
 *
 * Fluxo:
 *   1) sondar plataforma do rastreador via helper compartilhado (leitura HTTP real)
 *   2) persistir resultado em `solicitacoes_troca_titularidade.plataforma_rastreador_*`
 *   3) invocar fn_promover_troca_se_completo (gate único)
 *   4) devolver pontas pendentes para o caller logar/exibir
 */
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createServiceClient,
  sondarPlataformaTroca,
} from "../_shared/troca-plataforma-probe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch (_e) {
    return new Response(
      JSON.stringify({ success: false, error: "body inválido" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const solicitacaoId = String(body?.solicitacao_id || "").trim();
  if (!solicitacaoId) {
    return new Response(
      JSON.stringify({ success: false, error: "solicitacao_id é obrigatório" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const supabase = createServiceClient();

  // 1) sonda real
  const probe = await sondarPlataformaTroca(supabase, solicitacaoId);

  // 2) persiste resultado (somente quando o status muda algo relevante).
  //    Mapeia ProbeStatus → plataforma_rastreador_status (texto livre).
  const novoPlatStatus = probe.status === "sincronizado"
    ? "sincronizado"
    : probe.status === "nao_aplicavel"
    ? "nao_aplicavel"
    : probe.status === "falha"
    ? "falha"
    : "pendente";

  const updatePayload: Record<string, unknown> = {
    plataforma_rastreador_status: novoPlatStatus,
    plataforma_rastreador_erro: probe.status === "sincronizado" ||
        probe.status === "nao_aplicavel"
      ? null
      : `${probe.motivo}${
        probe.detalhes ? " — " + JSON.stringify(probe.detalhes).slice(0, 400) : ""
      }`,
  };

  if (probe.status === "sincronizado") {
    updatePayload.plataforma_rastreador_sincronizado_em = new Date()
      .toISOString();
  }

  await supabase
    .from("solicitacoes_troca_titularidade")
    .update(updatePayload)
    .eq("id", solicitacaoId)
    .then(({ error }) => {
      if (error) {
        console.warn(
          "[troca-promover-com-sondagem] update plataforma_rastreador_*:",
          error.message,
        );
      }
    });

  // 3) chama o gate SQL
  let gate: any = null;
  try {
    const { data, error } = await supabase.rpc("fn_promover_troca_se_completo", {
      _solicitacao_id: solicitacaoId,
    });
    if (error) throw error;
    gate = Array.isArray(data) ? data[0] : data;
  } catch (e) {
    console.warn(
      "[troca-promover-com-sondagem] fn_promover_troca_se_completo:",
      (e as Error)?.message,
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      solicitacao_id: solicitacaoId,
      probe,
      gate,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
