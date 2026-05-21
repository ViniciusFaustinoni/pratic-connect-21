import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing_auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { cotacao_id } = await req.json().catch(() => ({}));
    if (!cotacao_id) {
      return new Response(JSON.stringify({ error: "cotacao_id_obrigatorio" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: cot } = await admin
      .from("cotacoes")
      .select("id, status, vendedor_id, veiculo_placa, plano_id")
      .eq("id", cotacao_id)
      .maybeSingle();

    if (!cot) {
      return new Response(JSON.stringify({ error: "cotacao_nao_encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["cancelada", "liberada", "expirada", "recusada"].includes(cot.status)) {
      return new Response(JSON.stringify({ error: "cotacao_nao_esta_finalizada", status: cot.status }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Bloqueio anti-sequestro: se a placa está presa por outro consultor, recusa
    if (cot.veiculo_placa) {
      const { data: presa } = await admin
        .from("cotacoes")
        .select("id, vendedor_id")
        .eq("veiculo_placa", cot.veiculo_placa)
        .in("status", ["rascunho", "enviada", "aceita"])
        .gt("placa_reservada_ate", new Date().toISOString())
        .neq("id", cotacao_id)
        .limit(1)
        .maybeSingle();
      if (presa && presa.vendedor_id !== user.id) {
        return new Response(JSON.stringify({ error: "placa_presa_por_terceiro" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Dono original tem prioridade; gestor pode forçar
    if (cot.vendedor_id && cot.vendedor_id !== user.id) {
      const { data: isManager } = await admin.rpc("has_role", { _user_id: user.id, _role: "diretor" });
      const { data: isCoord } = await admin.rpc("has_role", { _user_id: user.id, _role: "coordenador" });
      const { data: isGestor } = await admin.rpc("has_role", { _user_id: user.id, _role: "gestor" });
      if (!isManager && !isCoord && !isGestor) {
        return new Response(JSON.stringify({ error: "apenas_dono_ou_gestor" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const statusDestino = cot.plano_id ? "enviada" : "rascunho";

    const { error: errUpd } = await admin
      .from("cotacoes")
      .update({ status: statusDestino })
      .eq("id", cotacao_id);

    if (errUpd) {
      return new Response(JSON.stringify({ error: "falha_update", detalhe: errUpd.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, cotacao_id, status: statusDestino }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "erro_inesperado", detalhe: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
