import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { servico_id } = await req.json();
    if (!servico_id) {
      return new Response(JSON.stringify({ success: false, error: "servico_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Buscar serviço com dados do associado
    const { data: servico, error: sErr } = await supabase
      .from("servicos")
      .select(`
        id, tipo, data_agendada, hora_agendada, periodo, confirmacao_whatsapp, permite_encaixe,
        logradouro, numero, bairro, cidade,
        associado:associados!associado_id(id, nome, telefone, whatsapp),
        cotacao:cotacoes!cotacao_id(id, lead:leads!cotacoes_lead_id_fkey(nome, telefone))
      `)
      .eq("id", servico_id)
      .single();

    if (sErr || !servico) {
      return new Response(JSON.stringify({ success: false, error: "Serviço não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Telefone do cliente
    let telefone: string | null = null;
    let nomeCliente = "Cliente";
    const associadoData = servico.associado as any;
    const cotacaoData = servico.cotacao as any;

    if (associadoData) {
      telefone = associadoData.whatsapp || associadoData.telefone;
      nomeCliente = associadoData.nome || "Cliente";
    } else if (cotacaoData?.lead) {
      telefone = (cotacaoData.lead as any).telefone;
      nomeCliente = (cotacaoData.lead as any).nome || "Cliente";
    }

    if (!telefone) {
      return new Response(JSON.stringify({ success: false, error: "Telefone não encontrado para este serviço" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const telefoneFormatado = telefone.replace(/\D/g, "");

    // Labels
    const tipoLabel = servico.tipo === "instalacao" ? "instalação"
      : servico.tipo === "vistoria" ? "vistoria"
      : servico.tipo === "remocao" ? "remoção"
      : servico.tipo === "manutencao" ? "manutenção" : "serviço";

    const horaFormatada = servico.hora_agendada?.slice(0, 5) || servico.periodo || "a confirmar";
    const periodoLabel = servico.periodo === "manha" ? "pela manhã"
      : servico.periodo === "tarde" ? "pela tarde"
      : horaFormatada !== "a confirmar" ? `às ${horaFormatada}` : "";

    const dataObj = new Date(servico.data_agendada + "T12:00:00");
    const dataFormatada = dataObj.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });

    const endereco = [servico.logradouro, servico.numero, servico.bairro, servico.cidade]
      .filter(Boolean).join(", ") || "endereço agendado";

    const nomeAbrev = nomeCliente.split(" ")[0];
    const param3 = `${dataFormatada} ${periodoLabel}`.trim();

    const mensagem = `Olá, *${nomeAbrev}*! 👋

Lembramos que seu(sua) *${tipoLabel}* está agendado(a) para *${dataFormatada}*:
🕐 ${horaFormatada}
📍 ${endereco}

✅ Responda *SIM* para confirmar
📅 Ou informe se precisa *reagendar*

*PRATIC Proteção Veicular*`;

    // Enviar via whatsapp-send-text
    const { error: sendError } = await supabase.functions.invoke("whatsapp-send-text", {
      body: {
        telefone: telefoneFormatado,
        mensagem,
        template_name: "confirmacao_vespera_v1",
        template_params: [nomeAbrev, tipoLabel, param3],
      },
    });

    if (sendError) {
      console.error("Erro ao enviar WhatsApp:", sendError);
      return new Response(JSON.stringify({ success: false, error: "Falha ao enviar mensagem WhatsApp" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Registrar confirmação
    await supabase.from("confirmacoes_agendamento").insert({
      servico_id: servico.id,
      telefone: telefoneFormatado,
      status: "enviada",
      mensagem_enviada_em: new Date().toISOString(),
      contexto_ia: {
        nome_cliente: nomeCliente,
        tipo_servico: servico.tipo,
        hora_agendada: servico.hora_agendada,
        endereco,
        disparo: "manual",
      },
    });

    // Atualizar status
    await supabase.from("servicos")
      .update({ confirmacao_whatsapp: "aguardando_confirmacao_vespera" })
      .eq("id", servico.id);

    console.log(`✅ Confirmação manual enviada para ${telefoneFormatado} (serviço ${servico.id})`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Erro geral:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
