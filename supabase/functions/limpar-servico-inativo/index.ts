import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar registros com em_servico=true e updated_at mais antigo que 20 minutos
    const limiteInatividade = new Date(Date.now() - 20 * 60 * 1000).toISOString();

    const { data: inativos, error: fetchError } = await supabase
      .from("vistoriadores_localizacao")
      .select("vistoriador_id, updated_at")
      .eq("em_servico", true)
      .lt("updated_at", limiteInatividade);

    if (fetchError) {
      console.error("Erro ao buscar inativos:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!inativos || inativos.length === 0) {
      console.log("Nenhum profissional inativo encontrado");
      return new Response(
        JSON.stringify({ message: "Nenhum inativo", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ids = inativos.map((i) => i.vistoriador_id);
    console.log(`Marcando ${ids.length} profissionais como offline:`, ids);

    const { error: updateError } = await supabase
      .from("vistoriadores_localizacao")
      .update({ em_servico: false, updated_at: new Date().toISOString() })
      .in("vistoriador_id", ids);

    if (updateError) {
      console.error("Erro ao atualizar inativos:", updateError);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ message: "OK", desativados: ids.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Erro inesperado:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
