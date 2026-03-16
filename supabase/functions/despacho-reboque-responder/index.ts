import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { token, acao, latitude, longitude } = await req.json();

    if (!token) throw new Error("Token é obrigatório");
    if (!acao || !["aceitar", "recusar"].includes(acao)) throw new Error("Ação deve ser 'aceitar' ou 'recusar'");

    // Buscar convite
    const { data: convite, error: convErr } = await supabase
      .from("despacho_reboque_convites")
      .select(`
        *,
        despacho:despacho_reboque(
          id, chamado_id, hora_limite, status, total_aceites,
          chamado:chamados_assistencia(
            origem_lat, origem_lng, rastreador_lat, rastreador_lng
          )
        )
      `)
      .eq("token", token)
      .single();

    if (convErr || !convite) throw new Error("Token inválido ou expirado");

    // Validações
    if (new Date(convite.token_expira_em) < new Date()) {
      throw new Error("O prazo para responder este chamado expirou.");
    }

    if (convite.status !== "enviado" && convite.status !== "visualizado") {
      throw new Error("Você já respondeu a este chamado.");
    }

    const despacho = convite.despacho as any;
    if (!despacho) throw new Error("Despacho não encontrado");

    if (despacho.status !== "aguardando") {
      throw new Error("Este chamado já foi atribuído ou encerrado.");
    }

    if (new Date(despacho.hora_limite) < new Date()) {
      throw new Error("O prazo de 10 minutos expirou.");
    }

    // Verificar se o prestador já tem chamado ativo
    const { data: chamadoAtivo } = await supabase
      .from("chamados_assistencia")
      .select("id, protocolo")
      .eq("prestador_id", convite.prestador_id)
      .in("status", ["prestador_a_caminho", "em_atendimento", "prestador_despachado"])
      .limit(1)
      .maybeSingle();

    if (chamadoAtivo) {
      throw new Error("Você já tem um chamado ativo. Finalize o chamado atual antes de aceitar um novo.");
    }

    if (acao === "recusar") {
      await supabase
        .from("despacho_reboque_convites")
        .update({ status: "recusado", data_recusa: new Date().toISOString() })
        .eq("id", convite.id);

      await supabase.rpc("increment_field", { 
        table_name: "despacho_reboque", 
        field_name: "total_recusas", 
        row_id: despacho.id 
      }).catch(() => {
        // Fallback: update manually
        supabase.from("despacho_reboque")
          .update({ total_recusas: (despacho.total_recusas || 0) + 1 })
          .eq("id", despacho.id);
      });

      return new Response(
        JSON.stringify({ success: true, status: "recusado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACEITAR
    if (!latitude || !longitude) {
      throw new Error("Localização é obrigatória para aceitar o chamado.");
    }

    const chamado = despacho.chamado as any;
    const veiculoLat = chamado?.rastreador_lat || chamado?.origem_lat;
    const veiculoLng = chamado?.rastreador_lng || chamado?.origem_lng;

    if (!veiculoLat || !veiculoLng) {
      throw new Error("Localização do veículo indisponível.");
    }

    // Calcular distância e valor
    const distancia = haversineKm(latitude, longitude, veiculoLat, veiculoLng);
    const distanciaArredondada = Math.round(distancia * 100) / 100;
    const valorSaida = convite.valor_saida || 0;
    const valorKm = convite.valor_km || 0;
    const valorCalculado = Math.round((valorSaida + valorKm * distanciaArredondada) * 100) / 100;

    // Salvar aceite
    await supabase
      .from("despacho_reboque_convites")
      .update({
        status: "aceito",
        latitude_prestador: latitude,
        longitude_prestador: longitude,
        distancia_km: distanciaArredondada,
        valor_calculado: valorCalculado,
        data_aceite: new Date().toISOString(),
      })
      .eq("id", convite.id);

    // Incrementar total_aceites
    const { data: despachoAtualizado } = await supabase
      .from("despacho_reboque")
      .update({ total_aceites: (despacho.total_aceites || 0) + 1 })
      .eq("id", despacho.id)
      .select("total_aceites")
      .single();

    const totalAceites = despachoAtualizado?.total_aceites || (despacho.total_aceites || 0) + 1;

    console.log(`[despacho-responder] Aceite registrado: prestador=${convite.prestador_id}, distancia=${distanciaArredondada}km, valor=R$${valorCalculado}, total_aceites=${totalAceites}`);

    // Se atingiu 3 aceites, disparar atribuição imediata
    if (totalAceites >= 3) {
      console.log(`[despacho-responder] 3 aceites atingidos! Disparando atribuição imediata.`);
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      
      fetch(`${supabaseUrl}/functions/v1/despacho-reboque-atribuir`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ despacho_id: despacho.id }),
      }).catch((e) => console.error("[despacho-responder] Erro ao chamar atribuição:", e));
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: "aceito",
        distancia_km: distanciaArredondada,
        valor_calculado: valorCalculado,
        valor_saida: valorSaida,
        valor_km: valorKm,
        total_aceites: totalAceites,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[despacho-responder] Erro:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
