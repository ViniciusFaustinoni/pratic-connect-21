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

    // Buscar token de acompanhamento
    const { data: tokenData, error: tokenErr } = await supabase
      .from("acompanhamento_reboque_tokens")
      .select("*")
      .eq("token", token)
      .single();

    if (tokenErr || !tokenData) {
      return new Response(
        JSON.stringify({ success: false, error: "Link inválido" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar expiração
    if (new Date(tokenData.expira_em) < new Date()) {
      return new Response(
        JSON.stringify({ success: true, status: "expirado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar chamado
    const { data: chamado } = await supabase
      .from("chamados_assistencia")
      .select(`
        id, protocolo, tipo_servico, status,
        origem_lat, origem_lng, origem_endereco, origem_logradouro, origem_cidade, origem_uf,
        rastreador_lat, rastreador_lng,
        destino_lat, destino_lng, destino_endereco, destino_logradouro,
        prestador_nome, prestador_telefone,
        data_abertura, data_conclusao,
        veiculo:veiculos(id, placa, marca, modelo, ano_modelo, cor)
      `)
      .eq("id", tokenData.chamado_id)
      .single();

    if (!chamado) throw new Error("Chamado não encontrado");

    // Verificar cancelamento / conclusão
    const isCancelado = chamado.status?.startsWith("cancelado");
    const isConcluido = chamado.status === "concluido";

    // Posição do veículo
    const veiculoLat = chamado.rastreador_lat || chamado.origem_lat;
    const veiculoLng = chamado.rastreador_lng || chamado.origem_lng;

    // Última posição do reboquista
    const { data: ultimaPosicao } = await supabase
      .from("despacho_reboque_tracking")
      .select("latitude, longitude, velocidade, created_at")
      .eq("chamado_id", tokenData.chamado_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Status log completo
    const { data: statusLog } = await supabase
      .from("despacho_reboque_status_log")
      .select("*")
      .eq("chamado_id", tokenData.chamado_id)
      .order("created_at", { ascending: true });

    // Buscar despacho para dados extras
    const { data: despacho } = await supabase
      .from("despacho_reboque")
      .select("prestador_atribuido_id, distancia_atribuida_km")
      .eq("chamado_id", tokenData.chamado_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const veiculo = chamado.veiculo as any;

    return new Response(
      JSON.stringify({
        success: true,
        status: isCancelado ? "cancelado" : isConcluido ? "concluido" : "ativo",
        chamado_id: chamado.id,
        protocolo: chamado.protocolo,
        chamado_status: chamado.status,
        tipo_servico: chamado.tipo_servico,
        data_abertura: chamado.data_abertura,
        data_conclusao: chamado.data_conclusao,
        veiculo: veiculo ? {
          placa: veiculo.placa,
          marca: veiculo.marca,
          modelo: veiculo.modelo,
          ano: veiculo.ano_modelo,
          cor: veiculo.cor,
        } : null,
        veiculo_lat: veiculoLat,
        veiculo_lng: veiculoLng,
        endereco_veiculo: chamado.origem_logradouro || chamado.origem_endereco,
        endereco_cidade: chamado.origem_cidade,
        endereco_uf: chamado.origem_uf,
        destino: {
          lat: chamado.destino_lat,
          lng: chamado.destino_lng,
          endereco: chamado.destino_logradouro || chamado.destino_endereco,
        },
        prestador: {
          nome: chamado.prestador_nome,
          telefone: chamado.prestador_telefone,
        },
        ultima_posicao: ultimaPosicao ? {
          lat: ultimaPosicao.latitude,
          lng: ultimaPosicao.longitude,
          velocidade: ultimaPosicao.velocidade,
          timestamp: ultimaPosicao.created_at,
        } : null,
        distancia_km: despacho?.distancia_atribuida_km,
        status_log: statusLog || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[acompanhamento-consultar] Erro:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
