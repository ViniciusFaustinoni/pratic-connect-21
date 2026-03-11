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
    const { sinistro_id, auto_center_id, itens, cotacao_id } = await req.json();

    if (!sinistro_id || !auto_center_id || !itens || !cotacao_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Parâmetros obrigatórios: sinistro_id, auto_center_id, itens, cotacao_id" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Buscar auto center
    const { data: autoCenter, error: acError } = await supabase
      .from("auto_centers")
      .select("id, nome, nome_fantasia, razao_social, whatsapp")
      .eq("id", auto_center_id)
      .single();

    if (acError || !autoCenter) {
      console.error("[enviar-cotacao-pecas] Auto center não encontrado:", acError);
      return new Response(
        JSON.stringify({ success: false, error: "Auto center não encontrado" }),
        { status: 404, headers: corsHeaders }
      );
    }

    if (!autoCenter.whatsapp) {
      return new Response(
        JSON.stringify({ success: false, error: "Auto center sem WhatsApp cadastrado" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Buscar sinistro com veículo
    const { data: sinistro, error: sinError } = await supabase
      .from("sinistros")
      .select("id, protocolo, veiculo:veiculos(marca, modelo, ano_modelo, placa)")
      .eq("id", sinistro_id)
      .single();

    if (sinError || !sinistro) {
      console.error("[enviar-cotacao-pecas] Sinistro não encontrado:", sinError);
      return new Response(
        JSON.stringify({ success: false, error: "Sinistro não encontrado" }),
        { status: 404, headers: corsHeaders }
      );
    }

    const veiculo = sinistro.veiculo as any;
    const nomeAC = autoCenter.nome_fantasia || autoCenter.razao_social || autoCenter.nome || "Auto Center";

    // Montar lista de itens
    const itensTexto = itens
      .map((item: any, i: number) => `${i + 1}. ${item.descricao} — Qtd: ${item.quantidade || 1}`)
      .join("\n");

    // Montar mensagem
    const mensagem = `Olá ${nomeAC}! Aqui é a Pratic Car.\nPrecisamos de uma cotação de peças para:\n\n🚗 Veículo: ${veiculo?.marca || ""} ${veiculo?.modelo || ""} ${veiculo?.ano_modelo || ""} — Placa: ${veiculo?.placa || ""}\n\n📋 Itens para cotação:\n${itensTexto}\n\n⏰ Prazo para resposta: 24 horas\n📎 Referência: Evento #${sinistro.protocolo || ""}\n\nPor favor, responda com o valor de cada item e o prazo de entrega. Obrigado!`;

    console.log(`[enviar-cotacao-pecas] Enviando cotação para ${nomeAC} (${autoCenter.whatsapp})`);

    // Enviar via whatsapp-send-text (com template para Meta API)
    const { data: whatsResult, error: whatsError } = await supabase.functions.invoke(
      "whatsapp-send-text",
      {
        body: {
          telefone: autoCenter.whatsapp,
          mensagem,
          template_name: 'orcamento_oficina',
          template_params: [
            nomeAC,
            `${veiculo?.marca || ''} ${veiculo?.modelo || ''}`.trim(),
            veiculo?.placa || '',
            itens.map((item: any) => item.descricao).join(', ').substring(0, 200),
          ],
        },
      }
    );

    if (whatsError) {
      console.error("[enviar-cotacao-pecas] Erro ao enviar WhatsApp:", whatsError);
      // Atualizar cotação com erro
      await supabase
        .from("evento_cotacoes_pecas")
        .update({ mensagem_enviada: mensagem, status: "erro_envio" })
        .eq("id", cotacao_id);

      return new Response(
        JSON.stringify({ success: false, error: "Erro ao enviar WhatsApp: " + whatsError.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Atualizar cotação com sucesso
    await supabase
      .from("evento_cotacoes_pecas")
      .update({
        mensagem_enviada: mensagem,
        status: "enviado",
      })
      .eq("id", cotacao_id);

    console.log(`[enviar-cotacao-pecas] ✓ Cotação enviada para ${nomeAC}`);

    return new Response(
      JSON.stringify({
        success: true,
        auto_center: nomeAC,
        message_id: whatsResult?.message_id,
      }),
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error("[enviar-cotacao-pecas] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
