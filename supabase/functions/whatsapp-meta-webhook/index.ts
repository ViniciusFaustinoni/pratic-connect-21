import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

/**
 * Envia mensagem WhatsApp via edge function whatsapp-send-text
 */
async function enviarWhatsApp(supabaseUrl: string, serviceKey: string, telefone: string, mensagem: string) {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ telefone, mensagem }),
    });
    const result = await res.json();
    if (!result.success) {
      console.error(`[webhook] Falha ao enviar WhatsApp para ${telefone}: ${result.error}`);
    }
    return result;
  } catch (e) {
    console.error(`[webhook] Erro ao enviar WhatsApp para ${telefone}:`, e);
    return { success: false };
  }
}

/**
 * Processa resposta de um prestador no fluxo de despacho de reboque
 */
async function processarRespostaPrestador(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceKey: string,
  telefone: string,
  texto: string,
  msgType: string,
  latitude: number | null,
  longitude: number | null,
) {
  // Normalizar telefone (remover 55 do início se tiver)
  const telNormalizado = telefone.replace(/^55/, "");

  // Buscar prestador pelo telefone
  const { data: prestador } = await supabase
    .from("prestadores_assistencia")
    .select("id, razao_social, nome_fantasia, whatsapp, telefone")
    .eq("status", "ativo")
    .or(`whatsapp.eq.${telNormalizado},telefone.eq.${telNormalizado},whatsapp.eq.${telefone},telefone.eq.${telefone}`)
    .limit(1)
    .maybeSingle();

  if (!prestador) return false; // Não é prestador cadastrado

  console.log(`[webhook] Prestador identificado: ${prestador.razao_social || prestador.nome_fantasia} (${prestador.id})`);

  // Buscar despachos ativos (aguardando) para este prestador via 2-step query
  const { data: despachosAtivos } = await supabase
    .from("despacho_reboque")
    .select("id")
    .eq("status", "aguardando");

  if (!despachosAtivos || despachosAtivos.length === 0) {
    console.log(`[webhook] Nenhum despacho aguardando no momento`);
    return false;
  }

  const despachosIds = despachosAtivos.map((d: any) => d.id);

  // Buscar convite ativo para este prestador em despachos ativos
  const { data: convite } = await supabase
    .from("despacho_reboque_convites")
    .select(`
      *,
      despacho:despacho_reboque(
        id, chamado_id, status, total_aceites,
        chamado:chamados_assistencia(
          id, origem_lat, origem_lng, rastreador_lat, rastreador_lng,
          origem_endereco, origem_logradouro, destino_endereco, destino_logradouro
        )
      )
    `)
    .eq("prestador_id", prestador.id)
    .in("despacho_id", despachosIds)
    .in("etapa_conversacao", ["aguardando_aceite"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!convite) {
    console.log(`[webhook] Nenhum convite ativo para prestador ${prestador.id}`);
    return false;
  }

  const despacho = convite.despacho as any;

  const chamado = despacho.chamado as any;
  const telPrestador = prestador.whatsapp || prestador.telefone || telefone;
  const textoNorm = texto?.trim().toUpperCase() || "";

  // ---- ETAPA ÚNICA: Aguardando aceite (SIM/NÃO) ----
  if (convite.etapa_conversacao === "aguardando_aceite") {
    if (textoNorm === "SIM" || textoNorm === "S") {
      // Aceitar!
      await supabase
        .from("despacho_reboque_convites")
        .update({
          status: "aceito",
          etapa_conversacao: "aceito",
          data_aceite: new Date().toISOString(),
        })
        .eq("id", convite.id);

      // Incrementar total_aceites
      await supabase
        .from("despacho_reboque")
        .update({ total_aceites: (despacho.total_aceites || 0) + 1 })
        .eq("id", despacho.id);

      await enviarWhatsApp(supabaseUrl, serviceKey, telPrestador,
        `✅ *Aceite registrado com sucesso!*

Seu aceite foi enviado ao analista de eventos. Aguarde a confirmação da atribuição. Você será notificado em breve.`
      );

      console.log(`[webhook] Prestador ${prestador.id} aceitou chamado. Valor: R$${convite.valor_calculado || 'N/D'}`);
      return true;
    }

    if (textoNorm === "NAO" || textoNorm === "NÃO" || textoNorm === "N") {
      await supabase
        .from("despacho_reboque_convites")
        .update({ status: "recusado", etapa_conversacao: "recusado", data_recusa: new Date().toISOString() })
        .eq("id", convite.id);

      await enviarWhatsApp(supabaseUrl, serviceKey, telPrestador,
        `❌ Tudo bem! Você recusou este chamado. Obrigado pela resposta.`
      );
      return true;
    }

    // Mensagem não reconhecida
    await enviarWhatsApp(supabaseUrl, serviceKey, telPrestador,
      `⚠️ Responda *SIM* para aceitar ou *NÃO* para recusar o chamado.`
    );
    return true;
  }

  return false;
}

serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // GET - Verificação do webhook pela Meta
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    console.log("[whatsapp-meta-webhook] Verificação:", { mode, token });

    const { data: config } = await supabase
      .from("whatsapp_meta_config")
      .select("verify_token")
      .limit(1)
      .single();

    const expectedToken = config?.verify_token || "sga_pratic_meta_webhook";

    if (mode === "subscribe" && token === expectedToken) {
      console.log("[whatsapp-meta-webhook] ✓ Webhook verificado");
      return new Response(challenge, { status: 200 });
    }

    console.error("[whatsapp-meta-webhook] ✗ Token inválido");
    return new Response("Forbidden", { status: 403 });
  }

  // POST - Eventos da Meta
  if (req.method === "POST") {
    try {
      const body = await req.json();
      console.log("[whatsapp-meta-webhook] Evento recebido:", JSON.stringify(body).substring(0, 500));

      const entries = body.entry || [];

      for (const entry of entries) {
        const changes = entry.changes || [];

        for (const change of changes) {
          const value = change.value;

          // Atualização de status de template
          if (change.field === "message_template_status_update") {
            const templateName = value.message_template_name;
            const newStatus = value.event?.toUpperCase();
            const reason = value.reason;

            console.log(`[whatsapp-meta-webhook] Template '${templateName}' -> ${newStatus}`);

            if (templateName && newStatus) {
              await supabase
                .from("whatsapp_meta_templates")
                .update({
                  status: newStatus,
                  motivo_rejeicao: reason || null,
                  aprovado_em: newStatus === "APPROVED" ? new Date().toISOString() : null,
                  updated_at: new Date().toISOString(),
                })
                .eq("nome", templateName);
            }
            continue;
          }

          // Mensagens recebidas
          if (change.field === "messages") {
            const messages = value.messages || [];
            const contacts = value.contacts || [];
            const statuses = value.statuses || [];

            // Processar mensagens recebidas
            for (const msg of messages) {
              const contact = contacts.find((c: any) => c.wa_id === msg.from);
              const telefone = msg.from;
              const texto =
                msg.type === "text" ? msg.text?.body :
                msg.type === "image" ? "[Imagem]" :
                msg.type === "document" ? "[Documento]" :
                msg.type === "audio" ? "[Áudio]" :
                msg.type === "video" ? "[Vídeo]" :
                msg.type === "location" ? "[Localização]" :
                msg.type === "button" ? msg.button?.text :
                "[Mensagem]";

              // Extrair lat/lng se for mensagem de localização
              let latitude: number | null = null;
              let longitude: number | null = null;
              if (msg.type === "location" && msg.location) {
                latitude = msg.location.latitude;
                longitude = msg.location.longitude;
              }

              console.log(`[whatsapp-meta-webhook] Mensagem de ${telefone}: ${texto?.substring(0, 100)}`);

              // ---- VERIFICAR SE É RESPOSTA DE PRESTADOR (DESPACHO REBOQUE) ----
              const foiProcessado = await processarRespostaPrestador(
                supabase, supabaseUrl, serviceKey,
                telefone, texto || "", msg.type, latitude, longitude
              );

              // Registrar no banco (sempre, mesmo se processado)
              await supabase.from("whatsapp_mensagens").insert({
                telefone,
                tipo: msg.type === "text" ? "text" : msg.type,
                mensagem: texto,
                direcao: "entrada",
                status: "recebida",
                message_id: msg.id,
                nome_contato: contact?.profile?.name || null,
                provedor: "meta_oficial",
              });

              if (foiProcessado) {
                console.log(`[whatsapp-meta-webhook] Mensagem processada como resposta de prestador`);
              }
            }

            // Processar delivery/read statuses
            for (const st of statuses) {
              const statusMap: Record<string, string> = {
                sent: "enviada",
                delivered: "entregue",
                read: "lida",
                failed: "erro",
              };

              const novoStatus = statusMap[st.status] || st.status;

              if (st.id) {
                await supabase
                  .from("whatsapp_mensagens")
                  .update({ status: novoStatus })
                  .eq("message_id", st.id);
              }
            }
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      console.error("[whatsapp-meta-webhook] Erro:", error);
      // Sempre retornar 200 para a Meta não desativar o webhook
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
