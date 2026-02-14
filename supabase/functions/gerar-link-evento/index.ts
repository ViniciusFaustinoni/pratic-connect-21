import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sinistro_id } = await req.json();

    if (!sinistro_id) {
      return new Response(
        JSON.stringify({ success: false, error: "sinistro_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Invalidar links ativos existentes
    await supabase
      .from("sinistro_evento_links")
      .update({ status: "invalidado" })
      .eq("sinistro_id", sinistro_id)
      .eq("status", "ativo");

    // 2. Criar novo link (72h)
    const expiraEm = new Date();
    expiraEm.setHours(expiraEm.getHours() + 72);

    const { data: link, error: linkError } = await supabase
      .from("sinistro_evento_links")
      .insert({
        sinistro_id,
        expira_em: expiraEm.toISOString(),
        status: "ativo",
        etapa_atual: 0,
      })
      .select("id, token, expira_em")
      .single();

    if (linkError || !link) {
      console.error("[gerar-link-evento] Erro:", linkError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao gerar link" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Atualizar sinistro
    await supabase
      .from("sinistros")
      .update({ link_evento_id: link.id })
      .eq("id", sinistro_id);

    console.log(`[gerar-link-evento] Novo link: ${link.token} para sinistro ${sinistro_id}`);

    return new Response(
      JSON.stringify({ success: true, link_id: link.id, token: link.token, expira_em: link.expira_em }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[gerar-link-evento] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
