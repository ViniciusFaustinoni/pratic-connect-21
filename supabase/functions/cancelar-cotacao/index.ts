import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CATEGORIAS_VALIDAS = [
  "cliente_desistiu",
  "comprou_concorrente",
  "valor_alto",
  "nao_atendeu",
  "duplicada",
  "placa_liberada_manual",
  "outro",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing_auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { cotacao_id, categoria, motivo, status_destino } = body ?? {};

    if (!cotacao_id || typeof cotacao_id !== "string") {
      return new Response(JSON.stringify({ error: "cotacao_id_obrigatorio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!categoria || !CATEGORIAS_VALIDAS.includes(categoria)) {
      return new Response(JSON.stringify({ error: "categoria_invalida", categorias: CATEGORIAS_VALIDAS }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!motivo || typeof motivo !== "string" || motivo.trim().length < 10) {
      return new Response(JSON.stringify({ error: "motivo_minimo_10_chars" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const novoStatus = status_destino === "liberada" ? "liberada" : "cancelada";

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: cot, error: errFetch } = await admin
      .from("cotacoes")
      .select("id, status, vendedor_id, numero, veiculo_placa")
      .eq("id", cotacao_id)
      .maybeSingle();
    if (errFetch || !cot) {
      return new Response(JSON.stringify({ error: "cotacao_nao_encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (["cancelada", "liberada", "expirada", "recusada"].includes(cot.status)) {
      return new Response(JSON.stringify({ error: "cotacao_ja_finalizada", status: cot.status }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Quem pode liberar/cancelar cotação alheia? Gestores via has_role
    if (cot.vendedor_id && cot.vendedor_id !== user.id) {
      const { data: isManager } = await admin.rpc("has_role", { _user_id: user.id, _role: "diretor" });
      const { data: isCoord } = await admin.rpc("has_role", { _user_id: user.id, _role: "coordenador" });
      const { data: isGestor } = await admin.rpc("has_role", { _user_id: user.id, _role: "gestor" });
      if (!isManager && !isCoord && !isGestor) {
        return new Response(JSON.stringify({ error: "sem_permissao_cotacao_alheia" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const motivoFinal = `[${categoria}] ${motivo.trim()}`;

    const { error: errUpd } = await admin
      .from("cotacoes")
      .update({
        status: novoStatus,
        motivo_cancelamento: motivoFinal,
        categoria_cancelamento: categoria,
        cancelada_em: new Date().toISOString(),
        cancelada_por: user.id,
        placa_reservada_ate: new Date().toISOString(),
      })
      .eq("id", cotacao_id);

    if (errUpd) {
      return new Response(JSON.stringify({ error: "falha_update", detalhe: errUpd.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, cotacao_id, status: novoStatus, placa: cot.veiculo_placa }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: "erro_inesperado", detalhe: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
