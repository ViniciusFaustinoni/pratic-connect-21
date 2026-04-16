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
      body: JSON.stringify({ telefone, mensagem, allow_text: true }),
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
 * Inferir intenção da resposta de confirmação via regex (fallback)
 */
function inferirIntencaoConfirmacao(texto: string): string {
  const t = texto.trim().toLowerCase();
  if (/^(sim|s|ok|blz|beleza|pode|confirmo|confirmado|confirmar|vou|irei|estarei|certo|positivo|bora|vamos|claro|com certeza|uhum|aham|sss+|isso|perfeito|tô|to lá|vou sim|pode sim|tudo certo|combinado|fechado|show)$/i.test(t)) return "CONFIRMADO";
  if (/^(não|nao|n|cancelar|cancela|desisto|nope|nop|nada|nenhum|nenhuma)$/i.test(t)) return "CANCELAR";
  if (/reagend|trocar|mudar|outro dia|outro horario|outro horário|remarcar|adiar|postergar/i.test(t)) return "REAGENDAR";
  return "DUVIDA";
}

/**
 * Gera resposta humanizada via Lovable AI Gateway com fallback determinístico
 */
async function gerarRespostaConfirmacaoIA(
  nomeCliente: string,
  dataServico: string | null,
  horaServico: string | null,
  enderecoServico: string | null,
): Promise<string> {
  const fallback = `✅ Perfeito, ${nomeCliente.split(" ")[0]}! Sua presença está *confirmada*${dataServico ? ` para ${dataServico}` : ""}${horaServico ? ` às ${horaServico}` : ""}.\n\nNosso técnico será designado em breve e você receberá os detalhes por aqui. Qualquer dúvida, é só responder. 😊`;

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return fallback;

  try {
    const prompt = `Cliente: ${nomeCliente}\nDia: ${dataServico ?? "—"}\nHora: ${horaServico ?? "—"}\nEndereço: ${enderecoServico ?? "—"}\n\nGere uma mensagem CURTA (até 3 linhas), calorosa e em português do Brasil, agradecendo a confirmação, lembrando o dia e horário, dizendo que o técnico será designado e que ele receberá os detalhes em breve. Use o primeiro nome do cliente. Use 1-2 emojis apropriados. NÃO use markdown pesado, apenas asteriscos para negrito quando útil.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é um atendente cordial da PRATICCAR confirmando agendamentos por WhatsApp." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      console.warn(`[whatsapp-meta-webhook] IA Gateway respondeu ${res.status}, usando fallback`);
      return fallback;
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    return content && content.length > 5 ? content : fallback;
  } catch (e) {
    console.error("[whatsapp-meta-webhook] Erro gerando IA:", e);
    return fallback;
  }
}

/**
 * Processa resposta de confirmação de agendamento recebida via Meta API
 */
async function processarRespostaConfirmacaoMeta(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceKey: string,
  confirmacao: any,
  texto: string,
  telefone: string,
) {
  const intencao = inferirIntencaoConfirmacao(texto);
  console.log(`[whatsapp-meta-webhook] Intenção confirmação: "${texto}" -> ${intencao}`);

  const agora = new Date().toISOString();

  if (intencao === "CONFIRMADO") {
    // Atualizar confirmação (schema real)
    const { error: confErr } = await supabase
      .from("confirmacoes_agendamento")
      .update({
        status: "confirmada",
        resposta_cliente: texto,
        resposta_recebida_em: agora,
      })
      .eq("id", confirmacao.id);
    if (confErr) console.error("[whatsapp-meta-webhook] Erro update confirmacao:", confErr);

    // Atualizar serviço (coluna text + nome correto)
    let nomeCliente = "Cliente";
    let dataAg: string | null = null;
    let horaAg: string | null = null;
    let endAg: string | null = null;

    if (confirmacao.servico_id) {
      const { error: servErr } = await supabase
        .from("servicos")
        .update({
          confirmacao_whatsapp: "confirmada",
          confirmado_via_whatsapp_em: agora,
        })
        .eq("id", confirmacao.servico_id);
      if (servErr) console.error("[whatsapp-meta-webhook] Erro update servico:", servErr);

      // Buscar dados para resposta + push
      const { data: servico } = await supabase
        .from("servicos")
        .select("profissional_id, hora_agendada, data_agendada, logradouro, bairro, cidade, associado:associados(nome)")
        .eq("id", confirmacao.servico_id)
        .maybeSingle();

      if (servico) {
        const assoc = (servico as any).associado;
        if (assoc?.nome) nomeCliente = assoc.nome;
        if (servico.data_agendada) {
          const [y, m, d] = String(servico.data_agendada).split("-");
          dataAg = `${d}/${m}/${y}`;
        }
        if (servico.hora_agendada) horaAg = String(servico.hora_agendada).slice(0, 5);
        const partesEnd = [(servico as any).logradouro, (servico as any).bairro, (servico as any).cidade].filter(Boolean);
        endAg = partesEnd.length ? partesEnd.join(", ") : null;

        // Push para vistoriador
        if (servico.profissional_id) {
          try {
            await supabase.functions.invoke("send-push-profissional", {
              body: {
                profissional_id: servico.profissional_id,
                notification: {
                  title: "✅ Cliente Confirmou!",
                  body: `${nomeCliente.split(" ")[0]} confirmou presença para ${horaAg || "hoje"}`,
                  tag: `confirmacao-${confirmacao.servico_id}`,
                  data: { servico_id: confirmacao.servico_id, action: "confirmacao_whatsapp" },
                },
              },
            });
          } catch (pushErr) {
            console.error("[whatsapp-meta-webhook] Erro push:", pushErr);
          }
        }
      }

      // Disparar atribuição automática
      try {
        fetch(`${supabaseUrl}/functions/v1/atribuir-servico-automatico`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ servico_id: confirmacao.servico_id }),
        }).catch(() => {});
      } catch (_) { /* fire-and-forget */ }
    }

    const mensagem = await gerarRespostaConfirmacaoIA(nomeCliente, dataAg, horaAg, endAg);
    await enviarWhatsApp(supabaseUrl, serviceKey, telefone, mensagem);
  } else if (intencao === "REAGENDAR") {
    await supabase
      .from("confirmacoes_agendamento")
      .update({
        status: "reagendando",
        resposta_cliente: texto,
        resposta_recebida_em: agora,
      })
      .eq("id", confirmacao.id);

    await enviarWhatsApp(supabaseUrl, serviceKey, telefone,
      `📅 Entendido! Vamos reagendar seu atendimento.\n\nPor favor, entre em contato com nossa central para escolher uma nova data e horário. 📞`
    );
  } else if (intencao === "CANCELAR") {
    await supabase
      .from("confirmacoes_agendamento")
      .update({
        status: "cancelada",
        resposta_cliente: texto,
        resposta_recebida_em: agora,
      })
      .eq("id", confirmacao.id);

    await enviarWhatsApp(supabaseUrl, serviceKey, telefone,
      `❌ Agendamento cancelado conforme solicitado.\n\nSe precisar reagendar, entre em contato conosco. Estamos à disposição! 😊`
    );
  } else {
    // DUVIDA - registrar resposta e pedir clarificação
    await supabase
      .from("confirmacoes_agendamento")
      .update({
        resposta_cliente: texto,
        resposta_recebida_em: agora,
      })
      .eq("id", confirmacao.id);

    await enviarWhatsApp(supabaseUrl, serviceKey, telefone,
      `🤔 Não entendi sua resposta sobre o agendamento.\n\nPor favor, responda:\n✅ *SIM* para confirmar\n📅 *REAGENDAR* para trocar a data\n❌ *NÃO* para cancelar`
    );
  }
}

/**
 * Processa mensagem de usuário (associado, lead ou desconhecido) via IA
 */
async function processarMensagemUsuario(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceKey: string,
  telefone: string,
  texto: string,
  tipoMsg: string,
  latitude: number | null,
  longitude: number | null,
  messageId: string,
) {
  // Normalizar telefone para busca (múltiplas variantes)
  const telLimpo = telefone.replace(/\D/g, "");
  const telefonesBusca = [telLimpo];
  if (telLimpo.startsWith("55") && telLimpo.length >= 12) {
    telefonesBusca.push(telLimpo.substring(2));
  }
  if (!telLimpo.startsWith("55")) {
    telefonesBusca.push("55" + telLimpo);
  }

  // ---- 0. VERIFICAR CONFIRMAÇÃO DE AGENDAMENTO PENDENTE ----
  if (tipoMsg === "text" || tipoMsg === "button") {
    try {
      const { data: confirmacao } = await supabase
        .from("confirmacoes_agendamento")
        .select("*")
        .in("telefone", telefonesBusca)
        .in("status", ["enviada", "reagendando", "aguardando_confirmacao_vespera", "aguardando_confirmacao_manha"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (confirmacao) {
        console.log(`[whatsapp-meta-webhook] Confirmação pendente encontrada: ${confirmacao.id} status=${confirmacao.status}`);
        await processarRespostaConfirmacaoMeta(supabase, supabaseUrl, serviceKey, confirmacao, texto, telefone);
        return;
      }
    } catch (confErr) {
      console.error(`[whatsapp-meta-webhook] Erro ao verificar confirmação:`, confErr);
    }
  }

  // ---- 1. BUSCAR ASSOCIADO ATIVO ----
  const { data: associado } = await supabase
    .from("associados")
    .select("id, nome, status")
    .or(`whatsapp.in.(${telefonesBusca.join(",")}),telefone.in.(${telefonesBusca.join(",")})`)
    .eq("status", "ativo")
    .maybeSingle();

  if (associado) {
    console.log(`[whatsapp-meta-webhook] Associado encontrado: ${associado.nome} (${associado.id}), inserindo na fila IA`);

    // Inserir na fila de processamento IA
    try {
      const { error: filaError } = await supabase.from("whatsapp_fila_ia").insert({
        telefone,
        texto,
        tipo_msg: tipoMsg,
        latitude,
        longitude,
        message_id: messageId,
        status: "pendente",
      });

      if (filaError) {
        console.error(`[whatsapp-meta-webhook] Erro ao inserir na fila:`, filaError);
      } else {
        console.log(`[whatsapp-meta-webhook] ✓ Inserido na fila IA para ${telefone}`);
      }

      // Best-effort: disparar processador imediatamente (não depender disso)
      try {
        fetch(`${supabaseUrl}/functions/v1/processar-fila-ia`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ trigger: "immediate" }),
        }).catch(() => {
          // Ignorar erro - o cron vai pegar em até 1 minuto
        });
      } catch (_) { /* ignore */ }
    } catch (err) {
      console.error(`[whatsapp-meta-webhook] Erro ao inserir na fila IA:`, err);
    }
    return;
  }

  // ---- 2. BUSCAR LEAD ----
  const { data: lead } = await supabase
    .from("leads")
    .select("id, nome, vendedor_id")
    .or(`telefone.in.(${telefonesBusca.join(",")})`)
    .maybeSingle();

  if (lead) {
    console.log(`[whatsapp-meta-webhook] Lead encontrado: ${lead.nome}`);
    await supabase.from("leads_historico").insert({
      lead_id: lead.id,
      tipo: "mensagem_whatsapp",
      descricao: texto.substring(0, 500),
      dados_extras: { telefone, provedor: "meta_oficial" },
    });
    await supabase.from("leads").update({
      data_ultimo_contato: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", lead.id);

    // Delegar para agente consultor IA em vez de resposta genérica
    console.log(`[whatsapp-meta-webhook] Delegando lead para agente-consultor-ia: ${telefone}`);
    try {
      await fetch(`${supabaseUrl}/functions/v1/agente-consultor-ia`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ telefone, texto, tipo_msg: tipoMsg, latitude, longitude }),
      });
    } catch (agentErr: any) {
      console.error(`[whatsapp-meta-webhook] Erro delegação agente (lead):`, agentErr);
      const primeiroNome = lead.nome?.split(" ")[0] || "Cliente";
      await enviarWhatsApp(supabaseUrl, serviceKey, telefone,
        `Olá ${primeiroNome}! 😊\n\nRecebemos sua mensagem. Nosso consultor entrará em contato em breve.\n\nAgradecemos o interesse na PRATICCAR! 🚗`
      );
    }
    return;
  }

  // ---- 3. NÚMERO DESCONHECIDO - TENTAR CPF ----
  const cpfLimpo = texto.replace(/\D/g, "");
  if (cpfLimpo.length === 11 && tipoMsg === "text") {
    console.log(`[whatsapp-meta-webhook] Tentando identificar por CPF: ${cpfLimpo}`);
    const { data: associadoPorCpf } = await supabase
      .from("associados")
      .select("id, nome, telefone, whatsapp")
      .eq("cpf", cpfLimpo)
      .eq("status", "ativo")
      .maybeSingle();

    if (associadoPorCpf) {
      const telNorm = (associadoPorCpf.telefone || "").replace(/\D/g, "");
      const waNorm = (associadoPorCpf.whatsapp || "").replace(/\D/g, "");
      const incomingNorm = telefone.replace(/\D/g, "");
      const jaCadastrado =
        incomingNorm === telNorm ||
        incomingNorm === waNorm ||
        incomingNorm === `55${telNorm}` ||
        incomingNorm === `55${waNorm}` ||
        telNorm === `55${incomingNorm}` ||
        waNorm === `55${incomingNorm}`;

      // Só preenche whatsapp se estiver vazio. NUNCA sobrescreve número existente
      // (proteção contra cross-link de cadastro: outro número usando o mesmo CPF).
      if (!waNorm) {
        await supabase.from("associados").update({
          whatsapp: telefone,
          updated_at: new Date().toISOString(),
        }).eq("id", associadoPorCpf.id);
        console.log(`[whatsapp-meta-webhook] WhatsApp vinculado (vazio antes) ao associado ${associadoPorCpf.id}: ${telefone}`);
      } else if (!jaCadastrado) {
        console.warn(`[whatsapp-meta-webhook] BLOQUEADO sobrescrita de whatsapp do associado ${associadoPorCpf.id}. Atual=${waNorm} | Recebido=${incomingNorm}. Cadastro precisa de revisão manual.`);
      }

      const primeiroNome = associadoPorCpf.nome.split(" ")[0];
      await enviarWhatsApp(supabaseUrl, serviceKey, telefone,
        `Encontrei você, *${primeiroNome}*! 🎉\n\nComo posso te ajudar hoje? 😊`
      );
      return;
    }

    // CPF não encontrado — NÃO retornar aqui, delegar para agente
    console.log(`[whatsapp-meta-webhook] CPF ${cpfLimpo} não encontrado, delegando para agente`);
  }

  // ---- 4. DELEGAR PARA AGENTE CONSULTOR IA ----
  console.log(`[whatsapp-meta-webhook] Delegando para agente-consultor-ia: ${telefone}`);
  try {
    await fetch(`${supabaseUrl}/functions/v1/agente-consultor-ia`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ telefone, texto, tipo_msg: tipoMsg, latitude, longitude }),
    });
  } catch (agentErr: any) {
    console.error(`[whatsapp-meta-webhook] Erro delegação agente:`, agentErr);
    await enviarWhatsApp(supabaseUrl, serviceKey, telefone,
      `Olá! 👋 Obrigado pelo contato. Nosso consultor entrará em contato em breve! 😊`
    );
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

/**
 * Processa resposta de diretor no fluxo de aprovação FIPE
 */
async function processarRespostaDiretorFipe(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceKey: string,
  telefone: string,
  texto: string,
): Promise<boolean> {
  const telLimpo = telefone.replace(/\D/g, "");
  const textoNorm = texto.trim().toUpperCase();

  // Verificar se é uma resposta de aprovação/recusa
  const isAprovacao = ["APROVAR", "APROVADO", "SIM", "APROVADA"].includes(textoNorm);
  const isRecusa = ["RECUSAR", "RECUSADO", "NAO", "NÃO", "NEGAR", "NEGADO", "RECUSADA"].includes(textoNorm);

  if (!isAprovacao && !isRecusa) return false;

  // Buscar aprovação pendente para este telefone
  const { data: aprovacao } = await supabase
    .from("aprovacoes_fipe_diretoria")
    .select("id, cotacao_id, diretor_id")
    .eq("telefone", telLimpo)
    .eq("status", "pendente")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!aprovacao) return false;

  const novoStatus = isAprovacao ? "aprovado" : "recusado";

  // Atualizar voto
  await supabase
    .from("aprovacoes_fipe_diretoria")
    .update({ status: novoStatus, respondido_em: new Date().toISOString() })
    .eq("id", aprovacao.id);

  console.log(`[webhook] Diretor ${telefone} votou: ${novoStatus} para cotação ${aprovacao.cotacao_id}`);

  // Contar aprovações totais para esta cotação
  const { count: totalAprovacoes } = await supabase
    .from("aprovacoes_fipe_diretoria")
    .select("id", { count: "exact", head: true })
    .eq("cotacao_id", aprovacao.cotacao_id)
    .eq("status", "aprovado");

  // Buscar mínimo configurado
  const { data: configMin } = await supabase
    .from("configuracoes")
    .select("valor")
    .eq("chave", "dupla_aprovacao_fipe_minimo_votos")
    .maybeSingle();

  const minimoVotos = parseInt(configMin?.valor || "2") || 2;

  if (isAprovacao && (totalAprovacoes || 0) >= minimoVotos) {
    // Aprovado! Liberar cotação
    await supabase
      .from("cotacoes")
      .update({ fipe_diretoria_aprovado: true, fipe_limite_aprovado: true })
      .eq("id", aprovacao.cotacao_id);

    console.log(`[webhook] ✓ Cotação ${aprovacao.cotacao_id} APROVADA com ${totalAprovacoes} votos`);

    await enviarWhatsApp(supabaseUrl, serviceKey, telefone,
      `✅ Seu voto de *APROVAÇÃO* foi registrado!\n\nO veículo atingiu o mínimo de aprovações e foi *liberado* para contratação.`
    );
  } else if (isAprovacao) {
    await enviarWhatsApp(supabaseUrl, serviceKey, telefone,
      `✅ Seu voto de *APROVAÇÃO* foi registrado!\n\nAguardando demais aprovações (${totalAprovacoes}/${minimoVotos}).`
    );
  } else {
    // Contar total de recusas
    const { count: totalRecusas } = await supabase
      .from("aprovacoes_fipe_diretoria")
      .select("id", { count: "exact", head: true })
      .eq("cotacao_id", aprovacao.cotacao_id)
      .eq("status", "recusado");

    const { count: totalDiretores } = await supabase
      .from("aprovacoes_fipe_diretoria")
      .select("id", { count: "exact", head: true })
      .eq("cotacao_id", aprovacao.cotacao_id);

    const pendentes = (totalDiretores || 0) - (totalAprovacoes || 0) - (totalRecusas || 0);

    // Se não há mais como atingir o mínimo, marcar como recusado
    if ((totalAprovacoes || 0) + pendentes < minimoVotos) {
      await supabase
        .from("cotacoes")
        .update({ fipe_diretoria_aprovado: false })
        .eq("id", aprovacao.cotacao_id);

      await enviarWhatsApp(supabaseUrl, serviceKey, telefone,
        `❌ Seu voto de *RECUSA* foi registrado.\n\nO veículo *não foi aprovado* — não é mais possível atingir o mínimo de aprovações.`
      );
    } else {
      await enviarWhatsApp(supabaseUrl, serviceKey, telefone,
        `❌ Seu voto de *RECUSA* foi registrado. Aguardando demais votos.`
      );
    }
  }

  return true;
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
    let totalMessages = 0;
    let totalStatuses = 0;
    let lastError: string | null = null;
    let eventType = "unknown";

    try {
      const body = await req.json();
      console.log("[whatsapp-meta-webhook] POST recebido:", JSON.stringify(body).substring(0, 800));

      // Detectar tipo de evento
      eventType = body.object || "unknown";

      // Normalizar formato 2 (field/value direto) para formato 1 (entry/changes)
      let entries = body.entry || [];
      if (entries.length === 0 && body.field && body.value) {
        console.log("[whatsapp-meta-webhook] Formato 2 detectado (field/value direto) — normalizando");
        entries = [{ changes: [{ field: body.field, value: body.value }] }];
        eventType = "whatsapp_business_account";
      }
      if (entries.length === 0) {
        console.warn("[whatsapp-meta-webhook] Nenhum entry no payload");
      }

      for (const entry of entries) {
        const changes = entry.changes || [];

        for (const change of changes) {
          const value = change.value;
          if (!value) {
            console.warn("[whatsapp-meta-webhook] change sem value:", JSON.stringify(change).substring(0, 200));
            continue;
          }

          const field = change.field;

          // Atualização de status de template
          if (field === "message_template_status_update") {
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

          // Processar mensagens e statuses — aceitar field "messages" OU detectar pela presença de value.messages/value.statuses
          const hasMessages = Array.isArray(value.messages) && value.messages.length > 0;
          const hasStatuses = Array.isArray(value.statuses) && value.statuses.length > 0;

          if (field === "messages" || hasMessages || hasStatuses) {
            const messages = value.messages || [];
            const contacts = value.contacts || [];
            const statuses = value.statuses || [];

            totalMessages += messages.length;
            totalStatuses += statuses.length;

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

              console.log(`[whatsapp-meta-webhook] MSG from=${telefone} type=${msg.type} id=${msg.id} texto="${texto?.substring(0, 80)}"`);

              // ---- VERIFICAR SE É RESPOSTA DE DIRETOR (APROVAÇÃO FIPE) ----
              const foiDiretor = await processarRespostaDiretorFipe(
                supabase, supabaseUrl, serviceKey,
                telefone, texto || ""
              );

              // ---- VERIFICAR SE É RESPOSTA DE PRESTADOR (DESPACHO REBOQUE) ----
              const foiProcessado = foiDiretor || await processarRespostaPrestador(
                supabase, supabaseUrl, serviceKey,
                telefone, texto || "", msg.type, latitude, longitude
              );

              // Normalizar tipo para valores válidos no banco
              const tiposPermitidos = ["text", "image", "document", "audio", "video", "template"];
              const tipoNormalizado = tiposPermitidos.includes(msg.type) ? msg.type : "text";

              // DEDUP: verificar se message_id já foi processado
              if (msg.id) {
                const { data: msgExistente } = await supabase
                  .from("whatsapp_mensagens")
                  .select("id")
                  .eq("message_id", msg.id)
                  .maybeSingle();
                
                if (msgExistente) {
                  console.log(`[whatsapp-meta-webhook] ⚠ Mensagem duplicada ignorada: ${msg.id}`);
                  continue;
                }
              }

              // Registrar no banco (sempre, mesmo se processado)
              const { error: insertError } = await supabase.from("whatsapp_mensagens").insert({
                telefone,
                tipo: tipoNormalizado,
                mensagem: texto,
                direcao: "entrada",
                status: "entregue",
                message_id: msg.id,
                nome_contato: contact?.profile?.name || null,
                provedor: "meta_oficial",
              });

              if (insertError) {
                console.error(`[whatsapp-meta-webhook] ERRO INSERT msg id=${msg.id}:`, JSON.stringify(insertError));
                lastError = `INSERT msg: ${insertError.message || insertError.code}`;
              } else {
                console.log(`[whatsapp-meta-webhook] ✓ Mensagem salva no banco: ${msg.id}`);
              }

              if (foiProcessado) {
                console.log(`[whatsapp-meta-webhook] Processada como resposta de prestador`);
              } else {
                // Delegar para fluxo de IA (associado, lead ou desconhecido)
                console.log(`[whatsapp-meta-webhook] Delegando para IA: telefone=${telefone}`);
                try {
                  await processarMensagemUsuario(
                    supabase, supabaseUrl, serviceKey,
                    telefone, texto || "", msg.type,
                    latitude, longitude, msg.id
                  );
                  console.log(`[whatsapp-meta-webhook] ✓ Delegação IA concluída para ${telefone}`);
                } catch (delegErr: any) {
                  console.error(`[whatsapp-meta-webhook] ERRO delegação IA:`, delegErr);
                  lastError = `Delegação IA: ${delegErr.message}`;
                }
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

      // ---- ATUALIZAR TELEMETRIA ----
      try {
        await supabase
          .from("whatsapp_meta_config")
          .update({
            last_webhook_at: new Date().toISOString(),
            last_webhook_event: eventType,
            last_webhook_messages_count: totalMessages,
            last_webhook_statuses_count: totalStatuses,
            last_webhook_error: lastError,
          })
          .neq("id", "00000000-0000-0000-0000-000000000000");
      } catch (telErr) {
        console.error("[whatsapp-meta-webhook] Erro ao atualizar telemetria:", telErr);
      }

      console.log(`[whatsapp-meta-webhook] ✓ Processado: ${totalMessages} msgs, ${totalStatuses} statuses, erro: ${lastError || "nenhum"}`);

      return new Response(JSON.stringify({ success: true, messages: totalMessages, statuses: totalStatuses }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      console.error("[whatsapp-meta-webhook] ERRO GERAL:", error);

      // Atualizar telemetria com erro
      try {
        await supabase
          .from("whatsapp_meta_config")
          .update({
            last_webhook_at: new Date().toISOString(),
            last_webhook_event: eventType,
            last_webhook_error: error.message || "Erro desconhecido",
          })
          .neq("id", "00000000-0000-0000-0000-000000000000");
      } catch (_) { /* ignore */ }

      // Sempre retornar 200 para a Meta não desativar o webhook
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
