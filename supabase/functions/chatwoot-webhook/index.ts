import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-chatwoot-token",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Validar token do Chatwoot (opcional)
    const chatwootToken = Deno.env.get("CHATWOOT_WEBHOOK_TOKEN");
    if (chatwootToken) {
      const headerToken = req.headers.get("x-chatwoot-token") || req.headers.get("X-Chatwoot-Token");
      if (headerToken !== chatwootToken) {
        console.warn("[chatwoot-webhook] Token inválido recebido");
        return new Response(JSON.stringify({ error: "Token inválido" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const payload = await req.json();
    const event = payload.event;

    console.log(`[chatwoot-webhook] Evento recebido: ${event}`);

    // Só processar mensagens criadas do tipo incoming
    if (event !== "message_created") {
      return new Response(
        JSON.stringify({ success: true, ignorado: true, motivo: `Evento ${event} ignorado` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const messageType = payload.message_type;
    if (messageType !== "incoming" && messageType !== 0) {
      console.log(`[chatwoot-webhook] Mensagem não-incoming ignorada (type: ${messageType})`);
      return new Response(
        JSON.stringify({ success: true, ignorado: true, motivo: "Mensagem não é incoming" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extrair dados do payload
    const content = payload.content || payload.message?.content || "";
    const sender = payload.sender || {};
    const conversation = payload.conversation || {};
    const contactInbox = conversation.contact_inbox || {};
    const contact = conversation.contact || sender;

    // Extrair telefone de múltiplas fontes possíveis
    let telefone =
      sender.phone_number ||
      contact.phone_number ||
      contactInbox.source_id ||
      "";

    // Limpar telefone - remover @s.whatsapp.net e caracteres não numéricos
    telefone = telefone.replace(/@s\.whatsapp\.net$/i, "").replace(/\D/g, "");

    if (!telefone) {
      console.warn("[chatwoot-webhook] Telefone não encontrado no payload:", JSON.stringify(payload).substring(0, 500));
      return new Response(
        JSON.stringify({ success: false, error: "Telefone não encontrado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!content || content.trim() === "") {
      console.log(`[chatwoot-webhook] Mensagem vazia ignorada (tel: ${telefone})`);
      return new Response(
        JSON.stringify({ success: true, ignorado: true, motivo: "Mensagem vazia" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const nomeContato = sender.name || contact.name || "Desconhecido";
    const messageId = payload.id ? `chatwoot_${payload.id}` : `chatwoot_${Date.now()}`;

    console.log(`[chatwoot-webhook] Processando msg de ${telefone} (${nomeContato}): "${content.substring(0, 80)}"`);

    // Salvar na tabela whatsapp_mensagens
    const { error: msgError } = await supabase.from("whatsapp_mensagens").insert({
      telefone,
      nome_contato: nomeContato,
      tipo: "text",
      mensagem: content,
      status: "entregue",
      direcao: "entrada",
      message_id: messageId,
      referencia_tipo: "chatwoot",
    });

    if (msgError) {
      console.error("[chatwoot-webhook] Erro ao salvar mensagem:", msgError.message);
    }

    // Inserir na fila IA para processamento assíncrono
    const { error: filaError } = await supabase.from("whatsapp_fila_ia").insert({
      telefone,
      texto: content,
      tipo_msg: "text",
      message_id: messageId,
      status: "pendente",
      tentativas: 0,
    });

    if (filaError) {
      console.error("[chatwoot-webhook] Erro ao inserir na fila IA:", filaError.message);
    } else {
      console.log(`[chatwoot-webhook] ✓ Mensagem enfileirada para IA (tel: ${telefone})`);

      // Fire-and-forget: disparar processamento da fila
      try {
        fetch(`${supabaseUrl}/functions/v1/processar-fila-ia`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({}),
        }).catch(() => {});
      } catch (_) {
        // Ignora - o cron vai pegar
      }
    }

    return new Response(
      JSON.stringify({ success: true, telefone, mensagem_salva: !msgError, fila_ia: !filaError }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[chatwoot-webhook] ERRO GERAL:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
