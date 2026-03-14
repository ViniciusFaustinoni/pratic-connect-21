import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Buscar itens pendentes ou com erro (max 3 tentativas)
    const { data: itens, error: fetchError } = await supabase
      .from("whatsapp_fila_ia")
      .select("*")
      .in("status", ["pendente", "erro"])
      .lt("tentativas", 3)
      .order("created_at", { ascending: true })
      .limit(10);

    if (fetchError) throw fetchError;

    if (!itens || itens.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processados: 0, mensagem: "Fila vazia" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[processar-fila-ia] ${itens.length} item(ns) na fila`);

    let processados = 0;
    let erros = 0;

    for (const item of itens) {
      // Marcar como processando
      await supabase
        .from("whatsapp_fila_ia")
        .update({ status: "processando" })
        .eq("id", item.id);

      try {
        const telLimpo = item.telefone.replace(/\D/g, "");

        // Montar payload sintético no formato Evolution API
        const syntheticPayload: Record<string, unknown> = {
          event: "messages.upsert",
          sender: `${telLimpo}@s.whatsapp.net`,
          _meta_delegate: true,
          _from_queue: true,
          data: {
            key: {
              remoteJid: `${telLimpo}@s.whatsapp.net`,
              fromMe: false,
              id: item.message_id || `meta_queue_${Date.now()}`,
            },
            message:
              item.tipo_msg === "location" && item.latitude && item.longitude
                ? { locationMessage: { degreesLatitude: item.latitude, degreesLongitude: item.longitude } }
                : { conversation: item.texto || "[Mensagem recebida]" },
          },
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 140000); // 140s timeout

        const res = await fetch(`${supabaseUrl}/functions/v1/whatsapp-webhook`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify(syntheticPayload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          await supabase
            .from("whatsapp_fila_ia")
            .update({
              status: "concluido",
              processed_at: new Date().toISOString(),
              tentativas: item.tentativas + 1,
            })
            .eq("id", item.id);
          processados++;
          console.log(`[processar-fila-ia] ✓ Processado: ${item.id} (tel: ${telLimpo})`);
        } else {
          const errorText = await res.text();
          throw new Error(`HTTP ${res.status}: ${errorText.substring(0, 200)}`);
        }
      } catch (err: any) {
        const novaTentativa = item.tentativas + 1;
        const novoStatus = novaTentativa >= 3 ? "falha_definitiva" : "erro";

        await supabase
          .from("whatsapp_fila_ia")
          .update({
            status: novoStatus,
            erro: err.message?.substring(0, 500) || "Erro desconhecido",
            tentativas: novaTentativa,
            processed_at: novoStatus === "falha_definitiva" ? new Date().toISOString() : null,
          })
          .eq("id", item.id);

        erros++;
        console.error(`[processar-fila-ia] ✗ Erro item ${item.id} (tentativa ${novaTentativa}):`, err.message);

        // Se falha definitiva, enviar fallback ao associado
        if (novoStatus === "falha_definitiva") {
          try {
            await fetch(`${supabaseUrl}/functions/v1/whatsapp-send-text`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({
                telefone: item.telefone,
                mensagem: "Desculpe, estou com dificuldades para processar sua mensagem no momento. Por favor, tente novamente mais tarde ou entre em contato com nossa central. 🙏",
                allow_text: true,
              }),
            });
            console.log(`[processar-fila-ia] Fallback enviado para ${item.telefone}`);
          } catch (_) {
            console.error(`[processar-fila-ia] Falha ao enviar fallback para ${item.telefone}`);
          }
        }
      }
    }

    console.log(`[processar-fila-ia] Concluído: ${processados} ok, ${erros} erros`);

    return new Response(
      JSON.stringify({ success: true, processados, erros, total: itens.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[processar-fila-ia] ERRO GERAL:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
