import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const statusValidos = ["chegou_local", "veiculo_carregado", "chegou_destino", "concluido"];

// Mapeamento de status do reboquista → status do chamado
const statusChamadoMap: Record<string, string> = {
  chegou_local: "em_atendimento",
  concluido: "concluido",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { token, status, latitude, longitude, observacao } = await req.json();

    if (!token || !status) throw new Error("token e status são obrigatórios");
    if (!statusValidos.includes(status)) {
      throw new Error(`Status inválido. Use: ${statusValidos.join(", ")}`);
    }

    // Buscar convite e validar
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
      throw new Error("Apenas o prestador atribuído pode atualizar o status");
    }

    // Inserir log de status
    await supabase.from("despacho_reboque_status_log").insert({
      chamado_id: despacho.chamado_id,
      prestador_id: convite.prestador_id,
      status,
      latitude: latitude || null,
      longitude: longitude || null,
      observacao: observacao || null,
    });

    // Atualizar status do chamado se necessário
    const novoStatusChamado = statusChamadoMap[status];
    if (novoStatusChamado) {
      const { data: chamadoAtual } = await supabase
        .from("chamados_assistencia")
        .select("status")
        .eq("id", despacho.chamado_id)
        .single();

      if (chamadoAtual && chamadoAtual.status !== novoStatusChamado) {
        await supabase
          .from("chamados_assistencia")
          .update({ status: novoStatusChamado })
          .eq("id", despacho.chamado_id);

        await supabase.from("chamados_assistencia_historico").insert({
          chamado_id: despacho.chamado_id,
          status_anterior: chamadoAtual.status,
          status_novo: novoStatusChamado,
          observacao: `Status atualizado pelo reboquista: ${status}${observacao ? ` — ${observacao}` : ""}`,
        });
      }

      // Se concluído, atualizar hora_conclusao no atendimento
      if (status === "concluido") {
        await supabase
          .from("chamados_assistencia_atendimentos")
          .update({
            status: "concluido",
            hora_conclusao: new Date().toISOString(),
          })
          .eq("chamado_id", despacho.chamado_id)
          .eq("prestador_id", convite.prestador_id);
      }

      if (status === "chegou_local") {
        await supabase
          .from("chamados_assistencia_atendimentos")
          .update({
            status: "no_local",
            hora_chegada: new Date().toISOString(),
          })
          .eq("chamado_id", despacho.chamado_id)
          .eq("prestador_id", convite.prestador_id);
      }
    }

    console.log(`[despacho-status] Status '${status}' registrado para chamado ${despacho.chamado_id}`);

    return new Response(
      JSON.stringify({ success: true, status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[despacho-status] Erro:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
