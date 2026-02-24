import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { token, latitude, longitude, velocidade, precisao } = await req.json();

    if (!token || !latitude || !longitude) {
      throw new Error("token, latitude e longitude são obrigatórios");
    }

    // Buscar convite e validar que é o prestador atribuído
    const { data: convite } = await supabase
      .from("despacho_reboque_convites")
      .select(`
        prestador_id,
        despacho:despacho_reboque(chamado_id, prestador_atribuido_id, status)
      `)
      .eq("token", token)
      .single();

    if (!convite) throw new Error("Token inválido");

    const despacho = convite.despacho as any;
    if (despacho?.prestador_atribuido_id !== convite.prestador_id) {
      throw new Error("Apenas o prestador atribuído pode enviar tracking");
    }

    // Inserir posição
    await supabase.from("despacho_reboque_tracking").insert({
      chamado_id: despacho.chamado_id,
      prestador_id: convite.prestador_id,
      latitude,
      longitude,
      velocidade: velocidade || null,
      precisao: precisao || null,
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[despacho-tracking] Erro:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
