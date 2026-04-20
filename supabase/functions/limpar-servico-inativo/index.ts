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

    // Buscar registros com em_servico=true e updated_at mais antigo que 30 minutos
    const limiteInatividade = new Date(Date.now() - 30 * 60 * 1000).toISOString();

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

    const candidatos = inativos.map((i) => i.vistoriador_id);

    // Salvaguarda: nunca derrubar profissionais com tarefa ATIVA em campo
    const { data: tarefasAtivas, error: tarefasError } = await supabase
      .from("servicos")
      .select("profissional_id")
      .in("profissional_id", candidatos)
      .in("status", ["em_rota", "em_andamento"]);

    if (tarefasError) {
      console.error("Erro ao validar tarefas ativas:", tarefasError);
    }

    const idsEmCampo = new Set(
      (tarefasAtivas || [])
        .map((t) => t.profissional_id)
        .filter((id): id is string => !!id)
    );

    const ids = candidatos.filter((id) => !idsEmCampo.has(id));

    if (idsEmCampo.size > 0) {
      console.log(
        `Skip: ${idsEmCampo.size} profissional(is) em tarefa ativa preservados:`,
        Array.from(idsEmCampo)
      );
    }

    if (ids.length === 0) {
      return new Response(
        JSON.stringify({
          message: "Todos os candidatos estão em tarefa ativa — nenhum desativado",
          desativados: 0,
          preservados: idsEmCampo.size,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
      JSON.stringify({
        message: "OK",
        desativados: ids.length,
        preservados: idsEmCampo.size,
      }),
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
