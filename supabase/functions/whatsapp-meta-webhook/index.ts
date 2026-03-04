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
  const telNormalizado = telefone.replace(/^55/, "");

  // Buscar prestador pelo telefone
  const { data: prestador } = await supabase
    .from("prestadores_assistencia")
    .select("id, razao_social, nome_fantasia, whatsapp, telefone")
    .eq("status", "ativo")
    .or(`whatsapp.eq.${telNormalizado},telefone.eq.${telNormalizado},whatsapp.eq.${telefone},telefone.eq.${telefone}`)
    .limit(1)
    .maybeSingle();

  if (!prestador) return false;

  console.log(`[webhook] Prestador identificado: ${prestador.razao_social || prestador.nome_fantasia} (${prestador.id})`);

  // Buscar despachos ativos
  const { data: despachosAtivos } = await supabase
    .from("despacho_reboque")
    .select("id")
    .eq("status", "aguardando");

  if (!despachosAtivos || despachosAtivos.length === 0) return false;

  const despachosIds = despachosAtivos.map((d: any) => d.id);

  // Buscar convite em qualquer etapa ativa
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
    .in("etapa_conversacao", [
      "aguardando_interesse",
      "aguardando_localizacao",
      "aguardando_confirmacao_valor",
      "aguardando_eta",
    ])
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
  const etapa = convite.etapa_conversacao;

  // ---- ETAPA 1: Aguardando interesse (SIM/NÃO) ----
  if (etapa === "aguardando_interesse") {
    if (textoNorm === "SIM" || textoNorm === "S") {
      await supabase
        .from("despacho_reboque_convites")
        .update({ etapa_conversacao: "aguardando_localizacao" })
        .eq("id", convite.id);

      await enviarWhatsApp(supabaseUrl, serviceKey, telPrestador,
        `📍 Ótimo! Para calcularmos o valor, precisamos saber sua localização atual.

Envie sua *localização em tempo real* pelo WhatsApp ou digite seu *endereço completo* (rua, número, cidade).`
      );
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

    await enviarWhatsApp(supabaseUrl, serviceKey, telPrestador,
      `⚠️ Responda *SIM* para demonstrar interesse ou *NÃO* para recusar.`
    );
    return true;
  }

  // ---- ETAPA 2: Aguardando localização ----
  if (etapa === "aguardando_localizacao") {
    let prestLat: number | null = null;
    let prestLng: number | null = null;

    // Se mandou localização GPS
    if (msgType === "location" && latitude && longitude) {
      prestLat = latitude;
      prestLng = longitude;
    } else if (texto && texto.length > 5) {
      // Geocodificar endereço texto
      try {
        const geoRes = await fetch(`${supabaseUrl}/functions/v1/geocode-endereco`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ endereco: texto }),
        });
        const geoData = await geoRes.json();
        if (geoData.success) {
          prestLat = geoData.latitude;
          prestLng = geoData.longitude;
        }
      } catch (e) {
        console.error("[webhook] Erro geocode:", e);
      }
    }

    if (!prestLat || !prestLng) {
      await enviarWhatsApp(supabaseUrl, serviceKey, telPrestador,
        `⚠️ Não consegui identificar sua localização. Por favor, envie sua *localização pelo WhatsApp* (📎 > Localização) ou digite um endereço completo.`
      );
      return true;
    }

    // Calcular distância até a origem do chamado
    const origemLat = chamado.rastreador_lat || chamado.origem_lat;
    const origemLng = chamado.rastreador_lng || chamado.origem_lng;

    if (!origemLat || !origemLng) {
      await enviarWhatsApp(supabaseUrl, serviceKey, telPrestador,
        `⚠️ Erro interno: localização da origem indisponível. O analista entrará em contato.`
      );
      return true;
    }

    const distanciaKm = Math.round(haversineKm(prestLat, prestLng, origemLat, origemLng) * 10) / 10;

    // Buscar valores do prestador
    const { data: valores } = await supabase
      .from("prestadores_assistencia_valores")
      .select("valor_saida, valor_km")
      .eq("prestador_id", prestador.id)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();

    const valorFixo = valores?.valor_saida || convite.valor_saida || 0;
    const valorKm = valores?.valor_km || convite.valor_km || 0;
    const valorCalculado = Math.round((valorFixo + distanciaKm * valorKm) * 100) / 100;

    // Salvar dados no convite
    await supabase
      .from("despacho_reboque_convites")
      .update({
        latitude_prestador: prestLat,
        longitude_prestador: prestLng,
        distancia_km: distanciaKm,
        valor_calculado: valorCalculado,
        valor_saida: valorFixo,
        valor_km: valorKm,
        etapa_conversacao: "aguardando_confirmacao_valor",
      })
      .eq("id", convite.id);

    const valorFormatado = formatCurrency(valorCalculado);
    await enviarWhatsApp(supabaseUrl, serviceKey, telPrestador,
      `📊 *Cálculo do serviço:*

📏 Distância até o local: *${distanciaKm} km*
💰 Valor fixo de saída: *${formatCurrency(valorFixo)}*
💰 Valor por km: *${formatCurrency(valorKm)}*

🏷️ *Valor sugerido: ${valorFormatado}*

Aceita realizar o serviço por este valor? Responda *SIM* ou *NÃO*.`
    );
    return true;
  }

  // ---- ETAPA 3: Confirmação do valor ----
  if (etapa === "aguardando_confirmacao_valor") {
    if (textoNorm === "SIM" || textoNorm === "S") {
      await supabase
        .from("despacho_reboque_convites")
        .update({ etapa_conversacao: "aguardando_eta" })
        .eq("id", convite.id);

      await enviarWhatsApp(supabaseUrl, serviceKey, telPrestador,
        `⏱️ Perfeito! Em quantos *minutos* você consegue chegar ao local do associado?

Responda apenas o número (ex: 20, 30, 45).`
      );
      return true;
    }

    if (textoNorm === "NAO" || textoNorm === "NÃO" || textoNorm === "N") {
      await supabase
        .from("despacho_reboque_convites")
        .update({ status: "recusado", etapa_conversacao: "recusado", data_recusa: new Date().toISOString() })
        .eq("id", convite.id);
      await enviarWhatsApp(supabaseUrl, serviceKey, telPrestador,
        `❌ Entendido, você recusou o valor. Obrigado pela resposta!`
      );
      return true;
    }

    await enviarWhatsApp(supabaseUrl, serviceKey, telPrestador,
      `⚠️ Responda *SIM* para aceitar o valor ou *NÃO* para recusar.`
    );
    return true;
  }

  // ---- ETAPA 4: Tempo de chegada (ETA) ----
  if (etapa === "aguardando_eta") {
    // Extrair número de minutos da resposta
    const numMatch = texto?.match(/(\d+)/);
    if (!numMatch) {
      await enviarWhatsApp(supabaseUrl, serviceKey, telPrestador,
        `⚠️ Por favor, informe apenas o número de *minutos* (ex: 20, 30, 45).`
      );
      return true;
    }

    const minutos = parseInt(numMatch[1], 10);
    if (minutos <= 0 || minutos > 300) {
      await enviarWhatsApp(supabaseUrl, serviceKey, telPrestador,
        `⚠️ Informe um tempo válido entre 1 e 300 minutos.`
      );
      return true;
    }

    // Finalizar: salvar ETA e marcar como aceito
    await supabase
      .from("despacho_reboque_convites")
      .update({
        tempo_chegada_minutos: minutos,
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

📊 Valor: *${formatCurrency(convite.valor_calculado)}*
⏱️ Previsão de chegada: *~${minutos} min*

Seu aceite foi enviado ao analista de eventos. Aguarde a confirmação da atribuição. Você será notificado em breve.`
    );

    console.log(`[webhook] Prestador ${prestador.id} aceitou. Valor: R$${convite.valor_calculado}, ETA: ${minutos}min`);
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
