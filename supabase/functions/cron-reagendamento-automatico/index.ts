import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Data de hoje no fuso de Brasília
    const now = new Date();
    const brasiliaDate = now.toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const [dia, mes, ano] = brasiliaDate.split("/");
    const hoje = `${ano}-${mes}-${dia}`;

    console.log(`[cron-reagendamento] Executando para data: ${hoje}`);

    // Buscar vistorias agendadas para hoje que não foram iniciadas
    const { data: servicos, error } = await supabase
      .from("servicos")
      .select("id, tipo, status, reagendamento_enviado_em")
      .eq("data_agendada", hoje)
      .eq("status", "agendada")
      .is("reagendamento_enviado_em", null)
      .in("tipo", [
        "vistoria_adesao",
        "vistoria_transferencia",
        "vistoria_substituicao",
        "revistoria",
        "instalacao",
        "manutencao",
        "retirada",
      ]);

    if (error) throw error;

    console.log(`[cron-reagendamento] Encontrados ${servicos?.length || 0} serviços pendentes`);

    let processados = 0;
    for (const servico of servicos || []) {
      try {
        // Mudar status para nao_compareceu
        await supabase
          .from("servicos")
          .update({
            status: "nao_compareceu",
            updated_at: new Date().toISOString(),
          })
          .eq("id", servico.id);

        // Enviar link de reagendamento
        await supabase.functions.invoke("enviar-link-reagendamento", {
          body: { servico_id: servico.id },
        });

        processados++;
        console.log(`[cron-reagendamento] Processado: ${servico.id}`);
      } catch (e: any) {
        console.error(`[cron-reagendamento] Erro no serviço ${servico.id}:`, e.message);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: hoje,
        total_encontrados: servicos?.length || 0,
        total_processados: processados,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[cron-reagendamento] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
