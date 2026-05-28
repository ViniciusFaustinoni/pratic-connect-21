/**
 * sga-inativar-associado-antigo
 *
 * Consumer canônico do enfileiramento `troca_titularidade:inativar_associado_antigo`.
 * Recebe { veiculo_id, associado_antigo_id, codigo_associado_hinova } e força
 * a situação INATIVA (2) no Hinova via /associado/alterar-situacao-para/2/:codigo.
 *
 * Chamado pelo cron-sga-retry. NÃO chama o gate de promoção sozinho — quem
 * orquestra isso é o cron, para manter um único ponto de invocação de
 * `troca-promover-com-sondagem` por etapa.
 */
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { alterarSituacaoAssociadoHinova } from "../_shared/hinova-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: any = {};
  try {
    body = await req.json();
  } catch (_e) {
    return new Response(
      JSON.stringify({ success: false, error: "body inválido" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const associadoAntigoId = body?.associado_antigo_id || null;
  let codigoHinova: number | null = body?.codigo_associado_hinova
    ? Number(body.codigo_associado_hinova)
    : null;

  // Fallback: resolve via tabela associados
  if (!codigoHinova && associadoAntigoId) {
    const { data: a } = await supabase
      .from("associados")
      .select("codigo_hinova")
      .eq("id", associadoAntigoId)
      .maybeSingle();
    if (a?.codigo_hinova) codigoHinova = Number(a.codigo_hinova);
  }

  if (!codigoHinova || !Number.isFinite(codigoHinova) || codigoHinova <= 0) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "codigo_hinova do associado antigo ausente — preencher manualmente",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 2 = INATIVO (Hinova). Override via env opcional.
  let codigoSituacaoInativo = Number.parseInt(
    Deno.env.get("HINOVA_CODIGO_SITUACAO_INATIVO") || "",
    10,
  );
  if (!Number.isFinite(codigoSituacaoInativo) || codigoSituacaoInativo <= 0) {
    codigoSituacaoInativo = 2;
  }

  try {
    const rs = await alterarSituacaoAssociadoHinova(
      supabase,
      codigoHinova,
      codigoSituacaoInativo,
    );
    if (rs?.ok) {
      console.log(
        `[sga-inativar-associado-antigo] ✅ codigo=${codigoHinova} situacao=${codigoSituacaoInativo}`,
      );
      return new Response(
        JSON.stringify({
          success: true,
          codigo_hinova: codigoHinova,
          codigo_situacao: codigoSituacaoInativo,
          mensagem: rs?.mensagem ?? null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const erro =
      rs?.mensagem ||
      (rs?.errors ?? []).join("; ") ||
      `HTTP ${rs?.status ?? 0}`;
    console.error(
      `[sga-inativar-associado-antigo] ❌ codigo=${codigoHinova}: ${erro}`,
    );
    return new Response(
      JSON.stringify({
        success: false,
        error: erro,
        http_status: rs?.status ?? 0,
        errors: rs?.errors ?? [],
      }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const erro = (e as Error)?.message || String(e);
    console.error(`[sga-inativar-associado-antigo] exception:`, erro);
    return new Response(
      JSON.stringify({ success: false, error: erro }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
