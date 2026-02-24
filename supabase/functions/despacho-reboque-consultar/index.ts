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
    const { token } = await req.json();
    if (!token) throw new Error("Token é obrigatório");

    // Buscar convite com dados relacionados
    const { data: convite, error } = await supabase
      .from("despacho_reboque_convites")
      .select(`
        id, token, status, token_expira_em, valor_saida, valor_km,
        latitude_prestador, longitude_prestador, distancia_km, valor_calculado,
        data_aceite, data_recusa, data_visualizacao,
        prestador:prestadores_assistencia(id, razao_social, nome_fantasia),
        despacho:despacho_reboque(
          id, chamado_id, hora_disparo, hora_limite, status as despacho_status,
          total_aceites, total_enviados, prestador_atribuido_id,
          valor_atribuido, distancia_atribuida_km
        )
      `)
      .eq("token", token)
      .single();

    if (error || !convite) {
      return new Response(
        JSON.stringify({ success: false, error: "Token inválido" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar expiração
    if (new Date(convite.token_expira_em) < new Date()) {
      return new Response(
        JSON.stringify({ success: true, status: "expirado", convite_status: "expirado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const despacho = convite.despacho as any;
    if (!despacho) throw new Error("Despacho não encontrado");

    // Buscar dados do chamado
    const { data: chamado } = await supabase
      .from("chamados_assistencia")
      .select(`
        id, protocolo, tipo_servico, status,
        origem_lat, origem_lng, origem_endereco, origem_logradouro, origem_cidade, origem_uf,
        rastreador_lat, rastreador_lng,
        destino_lat, destino_lng, destino_endereco, destino_logradouro,
        veiculo:veiculos(id, placa, marca, modelo, ano_modelo, cor),
        associado:associados(id, nome, telefone, whatsapp)
      `)
      .eq("id", despacho.chamado_id)
      .single();

    // Marcar como visualizado (se ainda era "enviado")
    if (convite.status === "enviado") {
      await supabase
        .from("despacho_reboque_convites")
        .update({ status: "visualizado", data_visualizacao: new Date().toISOString() })
        .eq("id", convite.id);
    }

    // Verificar se o despacho já foi cancelado
    if (despacho.despacho_status === "cancelado" || chamado?.status?.startsWith("cancelado")) {
      return new Response(
        JSON.stringify({ success: true, status: "cancelado", convite_status: convite.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se já foi atribuído
    const jaAtribuido = despacho.despacho_status === "atribuido";
    const euFuiAtribuido = jaAtribuido && despacho.prestador_atribuido_id === convite.prestador_id;

    // Se foi atribuído e não é o reboquista, retornar
    if (jaAtribuido && !euFuiAtribuido && convite.status !== "aceito") {
      return new Response(
        JSON.stringify({ success: true, status: "ja_atribuido", convite_status: "nao_atribuido" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Localização do veículo
    const veiculoLat = chamado?.rastreador_lat || chamado?.origem_lat;
    const veiculoLng = chamado?.rastreador_lng || chamado?.origem_lng;
    const enderecoVeiculo = chamado?.origem_logradouro || chamado?.origem_endereco || "";

    // Buscar status log se atribuído a este prestador
    let statusLog: any[] = [];
    if (euFuiAtribuido) {
      const { data: logs } = await supabase
        .from("despacho_reboque_status_log")
        .select("*")
        .eq("chamado_id", despacho.chamado_id)
        .eq("prestador_id", convite.prestador_id)
        .order("created_at", { ascending: true });
      statusLog = logs || [];
    }

    const veiculo = chamado?.veiculo as any;

    return new Response(
      JSON.stringify({
        success: true,
        status: euFuiAtribuido ? "atribuido_a_mim" : jaAtribuido ? "ja_atribuido" : "aguardando",
        convite_status: convite.status,
        convite_id: convite.id,
        prestador_id: (convite.prestador as any)?.id,
        despacho_status: despacho.despacho_status,
        hora_limite: despacho.hora_limite,
        hora_disparo: despacho.hora_disparo,
        valor_saida: convite.valor_saida,
        valor_km: convite.valor_km,
        valor_calculado: convite.valor_calculado,
        distancia_km: convite.distancia_km,
        veiculo: veiculo ? {
          placa: veiculo.placa,
          marca: veiculo.marca,
          modelo: veiculo.modelo,
          ano: veiculo.ano_modelo,
          cor: veiculo.cor,
        } : null,
        veiculo_lat: veiculoLat,
        veiculo_lng: veiculoLng,
        endereco_veiculo: enderecoVeiculo,
        endereco_cidade: chamado?.origem_cidade,
        endereco_uf: chamado?.origem_uf,
        associado: euFuiAtribuido ? {
          nome: (chamado?.associado as any)?.nome,
          telefone: (chamado?.associado as any)?.telefone,
          whatsapp: (chamado?.associado as any)?.whatsapp,
        } : null,
        destino: euFuiAtribuido ? {
          lat: chamado?.destino_lat,
          lng: chamado?.destino_lng,
          endereco: chamado?.destino_logradouro || chamado?.destino_endereco,
        } : null,
        status_log: statusLog,
        chamado_id: despacho.chamado_id,
        protocolo: chamado?.protocolo,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[despacho-consultar] Erro:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
