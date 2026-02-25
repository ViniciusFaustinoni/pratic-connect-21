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
    const { token, latitude, longitude } = await req.json();

    if (!token || latitude == null || longitude == null) {
      return new Response(
        JSON.stringify({ ok: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Buscar link ativo pelo token
    const { data: link, error: linkError } = await supabase
      .from("sinistro_evento_links")
      .select("sinistro_id")
      .eq("token", token)
      .in("status", ["ativo", "completado"])
      .single();

    if (linkError || !link) {
      return new Response(
        JSON.stringify({ ok: false }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Atualizar apenas se ainda não tiver posição
    await supabase
      .from("sinistros")
      .update({
        latitude_informada: latitude,
        longitude_informada: longitude,
      })
      .eq("id", link.sinistro_id)
      .is("latitude_informada", null);

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[salvar-posicao-comunicacao] Erro:", error);
    return new Response(
      JSON.stringify({ ok: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
