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
    const event = payload.event || "";

    console.log(`[chatwoot-webhook] Evento recebido: ${event}`);

    // Aceitar tanto "message_created" quanto "automation_event.message_created"
    if (!event.includes("message_created")) {
      return new Response(
        JSON.stringify({ success: true, ignorado: true, motivo: `Evento ${event} ignorado` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extrair primeira mensagem do array messages
    const msg = payload.messages?.[0] || {};
    const messageType = msg.message_type;

    // message_type: 0/"incoming" = cliente enviou, 1/"outgoing" = agente/Maya respondeu.
    // Ignoramos tipos 2 (activity) e 3 (template) por padrão.
    const isIncoming = messageType === 0 || messageType === "incoming";
    const isOutgoing = messageType === 1 || messageType === "outgoing";

    if (!isIncoming && !isOutgoing) {
      console.log(`[chatwoot-webhook] Mensagem ignorada (type: ${messageType})`);
      return new Response(
        JSON.stringify({ success: true, ignorado: true, motivo: `Tipo ${messageType} não suportado` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const direcao = isIncoming ? "entrada" : "saida";

    // Extrair conteúdo da mensagem
    const content = msg.content || msg.processed_message_content || "";

    // Extrair telefone: priorizar contact_inbox.source_id, fallback meta.sender.phone_number
    let telefone =
      payload.contact_inbox?.source_id ||
      payload.meta?.sender?.phone_number ||
      "";

    // Limpar telefone - remover + e caracteres não numéricos
    telefone = telefone.replace(/\D/g, "");

    if (!telefone) {
      console.warn("[chatwoot-webhook] Telefone não encontrado no payload:", JSON.stringify(payload).substring(0, 500));
      return new Response(
        JSON.stringify({ success: false, error: "Telefone não encontrado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!content || content.trim() === "") {
      console.log(`[chatwoot-webhook] Mensagem vazia ignorada (tel: ${telefone}, direcao: ${direcao})`);
      return new Response(
        JSON.stringify({ success: true, ignorado: true, motivo: "Mensagem vazia" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Nome do contato via meta.sender.name (sempre o cliente, independente da direção — usado para agrupar)
    const nomeContato = payload.meta?.sender?.name || "Desconhecido";

    // message_id: preferir source_id (wamid do WhatsApp), fallback id numérico
    const messageId = msg.source_id
      ? `chatwoot_${msg.source_id}`
      : `chatwoot_${msg.id || Date.now()}`;

    console.log(`[chatwoot-webhook] Processando ${direcao} de/para ${telefone} (${nomeContato}): "${content.substring(0, 80)}"`);

    // Salvar na tabela whatsapp_mensagens (idempotente por message_id)
    const { error: msgError } = await supabase.from("whatsapp_mensagens").insert({
      telefone,
      nome_contato: nomeContato,
      tipo: "text",
      mensagem: content,
      status: "entregue",
      direcao,
      message_id: messageId,
      referencia_tipo: "chatwoot",
    });

    if (msgError) {
      console.error(`[chatwoot-webhook] Erro ao salvar mensagem (${direcao}):`, msgError.message);
    } else if (direcao === "saida") {
      console.log(`[chatwoot-webhook] ✓ Saída registrada (tel: ${telefone})`);
    }

    // Só enfileira IA para entradas — saídas não devem disparar resposta da Maya
    let filaError: { message: string } | null = null;
    if (isIncoming) {
      const { error } = await supabase.from("whatsapp_fila_ia").insert({
        telefone,
        texto: content,
        tipo_msg: "text",
        message_id: messageId,
        status: "pendente",
        tentativas: 0,
      });
      filaError = error;

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
