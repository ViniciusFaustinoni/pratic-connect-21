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

    const { servico_id } = await req.json();
    if (!servico_id) throw new Error("servico_id obrigatório");

    console.log(`[enviar-link-reagendamento] Recebido servico_id: ${servico_id}`);

    // Buscar serviço com dados do associado
    const { data: servico, error: sErr } = await supabase
      .from("servicos")
      .select("id, reagendamento_token, associado_id, tipo, reagendamento_enviado_em")
      .eq("id", servico_id)
      .single();

    if (sErr) {
      console.error(`[enviar-link-reagendamento] Erro na query (servico_id=${servico_id}):`, sErr.message, sErr.code, sErr.details);
      throw new Error(`Serviço não encontrado: ${sErr.message}`);
    }
    if (!servico) throw new Error("Serviço não encontrado (null)");

    // Guard de idempotência: se já enviou, não reenvia
    if (servico.reagendamento_enviado_em) {
      console.log(`[enviar-link-reagendamento] Link já enviado em ${servico.reagendamento_enviado_em}, skip.`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "já enviado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar associado
    const { data: associado } = await supabase
      .from("associados")
      .select("nome, telefone, whatsapp")
      .eq("id", servico.associado_id)
      .single();

    if (!associado) throw new Error("Associado não encontrado");

    const telefone = (associado.whatsapp || associado.telefone || "").replace(/\D/g, "");
    if (!telefone) throw new Error("Associado sem telefone");

    // Gerar URL de reagendamento
    const appUrl = Deno.env.get("APP_URL") || "https://pratic-connect-21.lovable.app";
    const linkReagendamento = `${appUrl}/reagendar/${servico.reagendamento_token}`;
    const primeiroNome = associado.nome?.split(" ")[0] || "Associado";

    const TIPO_LABELS: Record<string, string> = {
      vistoria_adesao: "vistoria",
      vistoria_transferencia: "vistoria",
      vistoria_substituicao: "vistoria",
      revistoria: "vistoria",
      instalacao: "instalação do rastreador",
      manutencao: "manutenção do rastreador",
      retirada: "retirada do rastreador",
    };
    const tipoLabel = TIPO_LABELS[servico.tipo] || "serviço";

    const mensagem = `Olá ${primeiroNome}, seu(sua) ${tipoLabel} não pôde ser realizado(a). ` +
      `Acesse o link abaixo para agendar um novo dia, horário e endereço:\n\n` +
      `${linkReagendamento}\n\n` +
      `Equipe PRATIC 🚗`;

    // Enviar via whatsapp-send-text usando template Meta
    const { error: sendErr } = await supabase.functions.invoke("whatsapp-send-text", {
      body: {
        telefone: telefone.startsWith("55") ? telefone : `55${telefone}`,
        mensagem, // fallback para Evolution API
        template_name: "reagendamento_servico",
        template_params: [primeiroNome, tipoLabel],
        template_button_params: [servico.reagendamento_token],
        referencia_tipo: "reagendamento_vistoria",
        referencia_id: servico_id,
      },
    });

    if (sendErr) {
      console.warn("Erro ao enviar WhatsApp (não crítico):", sendErr);
    }

    // Atualizar reagendamento_enviado_em
    await supabase
      .from("servicos")
      .update({ reagendamento_enviado_em: new Date().toISOString() })
      .eq("id", servico_id);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[enviar-link-reagendamento] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
