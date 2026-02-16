import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ valid: false, error: "Token não fornecido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Buscar link pelo token
    const { data: link, error: linkError } = await supabase
      .from("sinistro_evento_links")
      .select("*")
      .eq("token", token)
      .single();

    if (linkError || !link) {
      return new Response(
        JSON.stringify({ valid: false, reason: "link_nao_encontrado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se expirou
    if (link.status === "ativo" && new Date(link.expira_em) < new Date()) {
      await supabase
        .from("sinistro_evento_links")
        .update({ status: "expirado" })
        .eq("id", link.id);

      return new Response(
        JSON.stringify({ valid: false, reason: "expirado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (link.status !== "ativo" && link.status !== "completado") {
      return new Response(
        JSON.stringify({ valid: false, reason: link.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar dados do sinistro com campos adicionais para pagamento
    const { data: sinistro } = await supabase
      .from("sinistros")
      .select(`
        id, protocolo, tipo, data_ocorrencia, descricao, local_ocorrencia,
        valor_cota_participacao, cota_paga,
        associado:associados!sinistros_associado_id_fkey(id, nome, telefone, whatsapp, email, cpf, plano_id),
        veiculo:veiculos!sinistros_veiculo_id_fkey(id, placa, marca, modelo, ano_modelo, cor, valor_fipe)
      `)
      .eq("id", link.sinistro_id)
      .single();

    // Build cota info if applicable
    let cotaInfo = null;
    if (sinistro && sinistro.valor_cota_participacao && sinistro.valor_cota_participacao > 0) {
      const associado = sinistro.associado as any;
      const veiculo = sinistro.veiculo as any;
      let planoNome = "Plano";
      let percentual = 0;
      let cotaMinima = 0;

      if (associado?.plano_id) {
        const { data: plano } = await supabase
          .from("planos")
          .select("nome, cota_participacao, cota_minima")
          .eq("id", associado.plano_id)
          .single();

        if (plano) {
          planoNome = plano.nome || "Plano";
          percentual = plano.cota_participacao || 0;
          cotaMinima = plano.cota_minima || 0;
        }
      }

      // Calcular valor correto dinamicamente
      let valorCotaCalculado = sinistro.valor_cota_participacao;
      if (veiculo?.valor_fipe && percentual > 0) {
        valorCotaCalculado = Math.max(
          veiculo.valor_fipe * percentual / 100,
          cotaMinima
        );

        // Atualizar no banco se diferente
        if (valorCotaCalculado !== sinistro.valor_cota_participacao) {
          await supabase
            .from("sinistros")
            .update({ valor_cota_participacao: valorCotaCalculado })
            .eq("id", sinistro.id);
        }
      }

      cotaInfo = {
        valor_fipe: veiculo?.valor_fipe || 0,
        percentual,
        cota_minima: cotaMinima,
        valor_cota: valorCotaCalculado,
        plano_nome: planoNome,
      };
    }

    return new Response(
      JSON.stringify({
        valid: true,
        link: {
          id: link.id,
          etapa_atual: link.etapa_atual,
          expira_em: link.expira_em,
          dados_etapa1: link.dados_etapa1,
          dados_etapa2: link.dados_etapa2,
          dados_etapa3: link.dados_etapa3,
          etapa4_completada_em: link.etapa4_completada_em || null,
        },
        sinistro: sinistro ? {
          id: sinistro.id,
          protocolo: sinistro.protocolo,
          tipo: sinistro.tipo,
          data_ocorrencia: sinistro.data_ocorrencia,
          descricao: sinistro.descricao,
          local_ocorrencia: sinistro.local_ocorrencia,
          valor_cota_participacao: sinistro.valor_cota_participacao,
          cota_paga: sinistro.cota_paga,
          associado: {
            ...(sinistro.associado as any),
            plano_id: undefined, // don't expose
          },
          veiculo: sinistro.veiculo,
        } : null,
        cota: cotaInfo,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[validar-link-evento] Erro:", error);
    return new Response(
      JSON.stringify({ valid: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
