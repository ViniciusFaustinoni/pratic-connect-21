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
    const { despacho_id } = await req.json();
    if (!despacho_id) throw new Error("despacho_id é obrigatório");

    console.log(`[despacho-atribuir] Iniciando atribuição para despacho ${despacho_id}`);

    // Buscar despacho
    const { data: despacho, error: despErr } = await supabase
      .from("despacho_reboque")
      .select("*")
      .eq("id", despacho_id)
      .single();

    if (despErr || !despacho) throw new Error("Despacho não encontrado");

    // Se já foi atribuído/cancelado, ignorar
    if (despacho.status !== "aguardando") {
      console.log(`[despacho-atribuir] Despacho já processado (status: ${despacho.status})`);
      return new Response(
        JSON.stringify({ success: true, status: despacho.status, message: "Despacho já processado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar aceites ordenados por valor (menor primeiro), desempate por data_aceite
    const { data: aceites } = await supabase
      .from("despacho_reboque_convites")
      .select(`
        *,
        prestador:prestadores_assistencia(id, razao_social, nome_fantasia, telefone, whatsapp)
      `)
      .eq("despacho_id", despacho_id)
      .eq("status", "aceito")
      .order("valor_calculado", { ascending: true })
      .order("data_aceite", { ascending: true });

    if (!aceites || aceites.length === 0) {
      // Ninguém aceitou
      console.log(`[despacho-atribuir] Nenhum aceite recebido`);

      await supabase
        .from("despacho_reboque")
        .update({ status: "expirado" })
        .eq("id", despacho_id);

      // Registrar no histórico do chamado
      await supabase.from("chamados_assistencia_historico").insert({
        chamado_id: despacho.chamado_id,
        status_anterior: "aguardando_aceites",
        status_novo: "aguardando_aceites",
        observacao: `⚠️ Nenhum reboquista aceitou o chamado em 10 minutos (ciclo ${despacho.ciclo}). Intervenção manual necessária.`,
      });

      // Marcar convites sem resposta como expirados
      await supabase
        .from("despacho_reboque_convites")
        .update({ status: "expirado" })
        .eq("despacho_id", despacho_id)
        .eq("status", "enviado");

      await supabase
        .from("despacho_reboque_convites")
        .update({ status: "expirado" })
        .eq("despacho_id", despacho_id)
        .eq("status", "visualizado");

      return new Response(
        JSON.stringify({ success: true, status: "expirado", aceites: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Atribuir ao mais barato (primeiro da lista já ordenada)
    const vencedor = aceites[0];
    const prestador = vencedor.prestador as any;

    console.log(`[despacho-atribuir] Atribuindo a ${prestador?.razao_social || prestador?.nome_fantasia} — R$${vencedor.valor_calculado} — ${vencedor.distancia_km}km`);

    // Atualizar despacho
    await supabase
      .from("despacho_reboque")
      .update({
        status: "atribuido",
        prestador_atribuido_id: vencedor.prestador_id,
        valor_atribuido: vencedor.valor_calculado,
        distancia_atribuida_km: vencedor.distancia_km,
      })
      .eq("id", despacho_id);

    // Marcar demais aceites como não atribuídos
    for (const aceite of aceites.slice(1)) {
      await supabase
        .from("despacho_reboque_convites")
        .update({ status: "nao_atribuido" })
        .eq("id", aceite.id);
    }

    // Marcar convites sem resposta como expirados
    await supabase
      .from("despacho_reboque_convites")
      .update({ status: "expirado" })
      .eq("despacho_id", despacho_id)
      .in("status", ["enviado", "visualizado"]);

    // Atualizar chamado
    await supabase
      .from("chamados_assistencia")
      .update({
        status: "prestador_a_caminho",
        prestador_id: vencedor.prestador_id,
        prestador_nome: prestador?.razao_social || prestador?.nome_fantasia || null,
        prestador_telefone: prestador?.whatsapp || prestador?.telefone || null,
      })
      .eq("id", despacho.chamado_id);

    // Criar atendimento
    await supabase.from("chamados_assistencia_atendimentos").insert({
      chamado_id: despacho.chamado_id,
      prestador_id: vencedor.prestador_id,
      status: "aceito",
      hora_acionamento: despacho.hora_disparo,
      hora_aceite: vencedor.data_aceite,
      valor_servico: vencedor.valor_calculado,
      km_origem_destino: vencedor.distancia_km,
    });

    // Registrar status inicial
    await supabase.from("despacho_reboque_status_log").insert({
      chamado_id: despacho.chamado_id,
      prestador_id: vencedor.prestador_id,
      status: "a_caminho",
      latitude: vencedor.latitude_prestador,
      longitude: vencedor.longitude_prestador,
    });

    // Histórico do chamado
    const maiorValor = aceites[aceites.length - 1].valor_calculado;
    await supabase.from("chamados_assistencia_historico").insert({
      chamado_id: despacho.chamado_id,
      status_anterior: "aguardando_aceites",
      status_novo: "prestador_a_caminho",
      observacao: `Reboque atribuído automaticamente a ${prestador?.razao_social || prestador?.nome_fantasia} — R$ ${vencedor.valor_calculado} — ${vencedor.distancia_km} km (${aceites.length} aceites recebidos, atribuído ao menor valor${aceites.length > 1 ? ` de R$ ${maiorValor} mais caro` : ""})`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        status: "atribuido",
        prestador_id: vencedor.prestador_id,
        prestador_nome: prestador?.razao_social || prestador?.nome_fantasia,
        valor: vencedor.valor_calculado,
        distancia_km: vencedor.distancia_km,
        total_aceites: aceites.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[despacho-atribuir] Erro:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
