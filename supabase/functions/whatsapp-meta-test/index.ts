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
    const { phone_number_id } = await req.json();

    if (!phone_number_id) {
      return new Response(
        JSON.stringify({ success: false, error: "phone_number_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = Deno.env.get("META_WHATSAPP_ACCESS_TOKEN");
    if (!accessToken) {
      return new Response(
        JSON.stringify({ success: false, error: "META_WHATSAPP_ACCESS_TOKEN não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Testar conexão com a API da Meta
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phone_number_id}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("[whatsapp-meta-test] Erro:", result);
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error?.message || "Erro ao conectar com a API da Meta",
          details: result.error,
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Atualizar config no banco
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await supabase
      .from("whatsapp_meta_config")
      .update({
        testado: true,
        testado_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("phone_number_id", phone_number_id);

    console.log("[whatsapp-meta-test] ✓ Conexão bem-sucedida:", result.display_phone_number);

    return new Response(
      JSON.stringify({
        success: true,
        phone_number: result.display_phone_number,
        verified_name: result.verified_name,
        quality_rating: result.quality_rating,
        platform_type: result.platform_type,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[whatsapp-meta-test] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
