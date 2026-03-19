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

    // ===== PARTE 1: Recuperar imprevistos órfãos =====
    // Serviços com imprevisto registrado há mais de 30 min mas ainda em status ativo
    const threshold30min = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

    const { data: orfaos, error: orfaosError } = await supabase
      .from("servicos")
      .select("id")
      .not("imprevisto_registrado_em", "is", null)
      .lt("imprevisto_registrado_em", threshold30min)
      .in("status", ["em_andamento", "em_rota", "agendada", "imprevisto_pendente"]);

    if (orfaosError) {
      console.error("[cron-reagendamento] Erro ao buscar órfãos:", orfaosError.message);
    }

    let orfaosProcessados = 0;
    for (const orfao of orfaos || []) {
      try {
        await supabase
          .from("servicos")
          .update({
            status: "nao_compareceu",
            profissional_id: null,
            imprevisto_duplo_check: true,
            imprevisto_duplo_check_em: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", orfao.id);

        await supabase.functions.invoke("enviar-link-reagendamento", {
          body: { servico_id: orfao.id },
        });

        orfaosProcessados++;
        console.log(`[cron-reagendamento] Órfão recuperado: ${orfao.id}`);
      } catch (e: any) {
        console.error(`[cron-reagendamento] Erro no órfão ${orfao.id}:`, e.message);
      }
    }

    // ===== PARTE 2: Reagendamento automático de serviços do dia não iniciados =====
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
        await supabase
          .from("servicos")
          .update({
            status: "nao_compareceu",
            updated_at: new Date().toISOString(),
          })
          .eq("id", servico.id);

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
        orfaos_encontrados: orfaos?.length || 0,
        orfaos_processados: orfaosProcessados,
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
