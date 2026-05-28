/**
 * troca-resolver-pendencia-manual
 *
 * Endpoint chamado pela UI da Troca de Titularidade quando o operador
 * confirma que resolveu manualmente uma pendência SGA (caso típico:
 * `codigo_associado_nao_encontrado` — CPF "já existe" no Hinova mas o
 * /buscar volta 404. Operador preenche o `codigo_associado` no painel
 * SGA e clica "Marcar como resolvida").
 *
 * Comportamento:
 *   1) valida que o operador é interno (não anon)
 *   2) re-lê do SGA via `buscarAssociadoComVeiculosPorCpf` pra confirmar
 *      que o código agora existe
 *   3) grava `associados.codigo_hinova` se faltava
 *   4) marca o item da fila como `concluido`
 *   5) chama `troca-promover-com-sondagem` para tentar destravar a troca
 */
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buscarAssociadoComVeiculosPorCpf } from "../_shared/hinova-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Auth obrigatória (operador interno).
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ success: false, error: "auth obrigatória" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userResp } = await supabaseAuth.auth.getUser();
  const userId = userResp?.user?.id;
  if (!userId) {
    return new Response(
      JSON.stringify({ success: false, error: "sessão inválida" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
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
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const queueItemId = String(body?.queue_item_id || "").trim();
  if (!queueItemId) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "queue_item_id é obrigatório",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // 1) carrega item da fila + associado
  const { data: item } = await supabase
    .from("sga_sync_queue")
    .select("id, veiculo_id, associado_id, etapa_parou, status, origem")
    .eq("id", queueItemId)
    .maybeSingle();

  if (!item) {
    return new Response(
      JSON.stringify({ success: false, error: "item da fila não encontrado" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  if (
    item.origem !== "troca_titularidade" ||
    item.etapa_parou !== "troca_titularidade:codigo_associado_nao_encontrado"
  ) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "este item não é resolvível por esta edge",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  if (item.status === "concluido") {
    return new Response(
      JSON.stringify({ success: true, already: true }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const { data: assoc } = await supabase
    .from("associados")
    .select("id, cpf, codigo_hinova")
    .eq("id", item.associado_id)
    .maybeSingle();

  if (!assoc?.cpf) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "associado/CPF não encontrado para validar com SGA",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // 2) Confirma com SGA que o código agora existe
  let codigoSga: number | null = (assoc.codigo_hinova as number | null) ??
    null;
  try {
    const r = await buscarAssociadoComVeiculosPorCpf(supabase, assoc.cpf);
    const cod = (r as any)?.codigo_associado ?? (r as any)?.codigo ?? null;
    if (cod) codigoSga = Number(cod);
  } catch (e) {
    return new Response(
      JSON.stringify({
        success: false,
        error: `SGA ainda não devolve o associado: ${(e as Error)?.message}`,
      }),
      {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  if (!codigoSga) {
    return new Response(
      JSON.stringify({
        success: false,
        error:
          "SGA não retornou um codigo_associado válido — preencha manualmente no painel SGA e tente de novo",
      }),
      {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // 3) atualiza associado se necessário
  if (assoc.codigo_hinova !== codigoSga) {
    await supabase
      .from("associados")
      .update({ codigo_hinova: codigoSga, updated_at: new Date().toISOString() })
      .eq("id", assoc.id);
  }

  // 4) fecha a fila
  await supabase
    .from("sga_sync_queue")
    .update({
      status: "concluido",
      ultima_tentativa_em: new Date().toISOString(),
      erro_ultimo: `Resolvido manualmente por ${userId}`,
    })
    .eq("id", queueItemId);

  // 5) tenta promover a troca correspondente
  const { data: sol } = await supabase
    .from("solicitacoes_troca_titularidade")
    .select("id")
    .eq("veiculo_id", item.veiculo_id)
    .eq("novo_associado_id", item.associado_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sol?.id) {
    try {
      await supabase.functions.invoke("troca-promover-com-sondagem", {
        body: { solicitacao_id: sol.id },
      });
    } catch (e) {
      console.warn(
        "[troca-resolver-pendencia-manual] promover falhou:",
        (e as Error)?.message,
      );
    }
  }

  return new Response(
    JSON.stringify({ success: true, codigo_hinova: codigoSga }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
