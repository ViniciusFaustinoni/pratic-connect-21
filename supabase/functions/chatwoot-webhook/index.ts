import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-chatwoot-token",
};

// Mapeia status do Chatwoot/WhatsApp → status canônico interno
// sent → enviada (✓), delivered → entregue (✓✓ cinza), read → lida (✓✓ azul), failed → erro (✗)
const STATUS_MAP: Record<string, string> = {
  sent: "enviada",
  delivered: "entregue",
  read: "lida",
  failed: "erro",
};

// Hierarquia para impedir regressão: nunca sobrescrever um status "mais avançado"
// com um anterior (defesa contra eventos fora de ordem).
// Ex.: se já está "lida", um delivered atrasado NÃO pode rebaixar para "entregue".
const STATUS_NIVEL: Record<string, number> = {
  enviando: 0,
  enviada: 1,
  entregue: 2,
  lida: 3,
  reproduzida: 3,
  erro: -1, // erro é terminal lateral; trata à parte
};

function statusInferiorOuIgual(novo: string): string[] {
  // retorna os status que NÃO devem ser sobrescritos pelo `novo`
  const nivelNovo = STATUS_NIVEL[novo] ?? 0;
  return Object.keys(STATUS_NIVEL).filter(
    (s) => STATUS_NIVEL[s] >= 0 && STATUS_NIVEL[s] > nivelNovo,
  );
}

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

    // ============================================================
    // BRANCH NOVO: message_updated → status de entrega/leitura (✓ → ✓✓ → ✓✓ azul)
    // ============================================================
    if (event.includes("message_updated")) {
      const msg = payload.messages?.[0] || payload || {};
      const rawStatus = msg.status || msg.message_status || "";
      const sourceId = msg.source_id || null;

      if (!sourceId) {
        console.log("[chatwoot-webhook] message_updated sem source_id, ignorando");
        return new Response(
          JSON.stringify({ success: true, ignorado: true, motivo: "source_id ausente" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const novoStatus = STATUS_MAP[String(rawStatus).toLowerCase()];
      if (!novoStatus) {
        console.log(`[chatwoot-webhook] message_updated status desconhecido (${rawStatus}), ignorando`);
        return new Response(
          JSON.stringify({ success: true, ignorado: true, motivo: `status ${rawStatus} não mapeado` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Monta UPDATE com timestamps coerentes e proteção contra regressão.
      const updateData: Record<string, any> = {
        status: novoStatus,
        updated_at: new Date().toISOString(),
      };
      if (novoStatus === "entregue") updateData.delivered_at = new Date().toISOString();
      if (novoStatus === "lida") {
        updateData.read_at = new Date().toISOString();
        // garante coerência: lida implica entregue
        updateData.delivered_at = updateData.delivered_at ?? new Date().toISOString();
      }

      // Casa tanto saídas Meta-diretas (`wamid...`) quanto entradas via Chatwoot (`chatwoot_wamid...`)
      const idsCandidatos = [sourceId, `chatwoot_${sourceId}`];
      const naoRegredir = statusInferiorOuIgual(novoStatus);

      let q = supabase
        .from("whatsapp_mensagens")
        .update(updateData)
        .in("message_id", idsCandidatos);

      // Proteção: NUNCA rebaixar status (lida não vira entregue, entregue não vira enviada)
      if (naoRegredir.length > 0) {
        q = q.not("status", "in", `(${naoRegredir.map((s) => `"${s}"`).join(",")})`);
      }

      const { error: upErr, count } = await q.select("id", { count: "exact", head: true });

      if (upErr) {
        console.error(`[chatwoot-webhook] status update FALHOU ${sourceId} → ${novoStatus}: ${upErr.message}`);
      } else {
        console.log(`[chatwoot-webhook] status update ${sourceId} → ${novoStatus} (${count ?? 0} linhas)`);
      }

      // Heartbeat de telemetria — mesma tabela usada pelo meta-webhook
      try {
        await supabase
          .from("whatsapp_meta_config")
          .update({
            last_webhook_at: new Date().toISOString(),
            last_webhook_event: `chatwoot:${event}`,
            last_webhook_statuses_count: 1,
            last_webhook_error: null,
          })
          .neq("id", "00000000-0000-0000-0000-000000000000");
      } catch (telErr) {
        console.error("[chatwoot-webhook] telemetria falhou:", telErr);
      }

      return new Response(
        JSON.stringify({ success: true, source_id: sourceId, status: novoStatus, linhas: count ?? 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
