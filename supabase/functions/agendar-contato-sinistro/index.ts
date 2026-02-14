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

    // 1. Criar link expirável (72h)
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
      .select("id, token")
      .single();

    if (linkError || !link) {
      console.error("[agendar-contato-sinistro] Erro ao criar link:", linkError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao criar link do evento" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[agendar-contato-sinistro] Link criado: ${link.id} token: ${link.token}`);

    // 2. Atualizar sinistro com link_evento_id
    await supabase
      .from("sinistros")
      .update({ link_evento_id: link.id })
      .eq("id", sinistro_id);

    // 3. Calcular dia seguinte às 08:00 (horário de Brasília = UTC-3)
    const agora = new Date();
    const amanha = new Date(agora);
    amanha.setDate(amanha.getDate() + 1);
    // 08:00 Brasília = 11:00 UTC
    amanha.setUTCHours(11, 0, 0, 0);

    const { error: contatoError } = await supabase
      .from("sinistro_contatos_agendados")
      .insert({
        sinistro_id,
        tipo_contato: "whatsapp_pos_colisao",
        agendado_para: amanha.toISOString(),
        status: "agendado",
        link_id: link.id,
      });

    if (contatoError) {
      console.error("[agendar-contato-sinistro] Erro ao agendar contato:", contatoError);
    }

    console.log(`[agendar-contato-sinistro] Contato agendado para: ${amanha.toISOString()}`);

    return new Response(
      JSON.stringify({
        success: true,
        link_id: link.id,
        token: link.token,
        agendado_para: amanha.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[agendar-contato-sinistro] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
