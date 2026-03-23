import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Edge function: Agente Consultor IA (Maya)
 * Processa mensagens de números desconhecidos (não-associados, não-leads)
 * usando configurações da tabela agente_ia_config.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { telefone, texto, tipo_msg, latitude, longitude } = await req.json();

    if (!telefone) {
      return new Response(
        JSON.stringify({ success: false, error: "telefone obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const telLimpo = telefone.replace(/\D/g, "");
    console.log(`[agente-consultor-ia] Mensagem de ${telLimpo}: ${texto?.substring(0, 80)}`);

    // ---- 1. BUSCAR/CRIAR CONTATO ----
    let contato: any = null;
    const { data: contatoExistente } = await supabase
      .from("agente_ia_contatos")
      .select("*")
      .eq("telefone", telLimpo)
      .maybeSingle();

    if (contatoExistente) {
      contato = contatoExistente;
      // Atualizar última interação
      await supabase
        .from("agente_ia_contatos")
        .update({ ultima_interacao: new Date().toISOString() })
        .eq("id", contato.id);
    } else {
      const { data: novoContato } = await supabase
        .from("agente_ia_contatos")
        .insert({
          telefone: telLimpo,
          status: "novo",
          ultima_interacao: new Date().toISOString(),
        })
        .select()
        .single();
      contato = novoContato;
      console.log(`[agente-consultor-ia] Novo contato criado: ${telLimpo}`);
    }

    // ---- 2. VERIFICAR ATENDIMENTO HUMANO ----
    if (contato?.status === "atendimento_humano") {
      console.log(`[agente-consultor-ia] Contato em atendimento humano, ignorando: ${telLimpo}`);
      return new Response(
        JSON.stringify({ success: true, ignored: "atendimento_humano" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- 3. CARREGAR CONFIGURAÇÕES ----
    const { data: configRows } = await supabase
      .from("agente_ia_config")
      .select("chave, valor");

    const config: Record<string, string> = {};
    for (const row of configRows || []) {
      config[row.chave] = row.valor;
    }

    const nomeAgente = config.nome_agente || "Maya";
    const apresentacao = config.apresentacao_inicial || "";
    const instrucoes = config.instrucoes_comportamento || "";
    const msgForaHorario = config.mensagem_fora_horario || "";
    const responderFora = config.responder_fora_horario === "true";

    // ---- 4. VERIFICAR HORÁRIO COMERCIAL ----
    let horarioConfig: { dias: string[]; inicio: string; fim: string } | null = null;
    try {
      horarioConfig = JSON.parse(config.horario_comercial || "null");
    } catch { /* ignore */ }

    if (horarioConfig) {
      const agora = new Date();
      // Converter para Brasília (UTC-3)
      const brasiliaOffset = -3 * 60;
      const localOffset = agora.getTimezoneOffset();
      const brasilia = new Date(agora.getTime() + (localOffset - brasiliaOffset) * 60 * 1000);

      const diasSemana = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
      const diaAtual = diasSemana[brasilia.getDay()];
      const horaAtual = brasilia.getHours() * 100 + brasilia.getMinutes();

      const [inicioH, inicioM] = (horarioConfig.inicio || "08:00").split(":").map(Number);
      const [fimH, fimM] = (horarioConfig.fim || "18:00").split(":").map(Number);
      const inicioNum = inicioH * 100 + inicioM;
      const fimNum = fimH * 100 + fimM;

      const dentroHorario = horarioConfig.dias.includes(diaAtual) && horaAtual >= inicioNum && horaAtual < fimNum;

      if (!dentroHorario) {
        if (responderFora && msgForaHorario) {
          await enviarWhatsApp(supabaseUrl, serviceKey, telefone, msgForaHorario);
          console.log(`[agente-consultor-ia] Fora do horário, enviou msg padrão para ${telLimpo}`);
        } else {
          console.log(`[agente-consultor-ia] Fora do horário, sem resposta para ${telLimpo}`);
        }
        return new Response(
          JSON.stringify({ success: true, fora_horario: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ---- 5. CARREGAR PLANOS DISPONÍVEIS ----
    const { data: planos } = await supabase
      .from("planos")
      .select("id, nome, descricao, valor_mensal, valor_adesao, cobertura_total, cobertura_roubo_furto, agente_descricao, disponivel_agente")
      .eq("disponivel_agente", true)
      .eq("ativo", true);

    const planosTexto = planos?.length
      ? planos.map((p: any) => {
          const desc = p.agente_descricao || p.descricao || "";
          return `- *${p.nome}*: ${desc}${p.valor_mensal ? ` | A partir de R$ ${p.valor_mensal.toFixed(2)}/mês` : ""}`;
        }).join("\n")
      : "Nenhum plano disponível no momento.";

    // ---- 6. BUSCAR HISTÓRICO DE CONVERSA ----
    const duasHorasAtras = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const telefonesBusca = [telLimpo];
    if (telLimpo.startsWith("55") && telLimpo.length >= 12) {
      telefonesBusca.push(telLimpo.substring(2));
    }
    if (!telLimpo.startsWith("55")) {
      telefonesBusca.push("55" + telLimpo);
    }

    const { data: historico } = await supabase
      .from("whatsapp_mensagens")
      .select("mensagem, direcao, created_at")
      .or(telefonesBusca.map(t => `telefone.eq.${t}`).join(","))
      .gte("created_at", duasHorasAtras)
      .order("created_at", { ascending: true })
      .limit(20);

    const historicoFormatado = (historico || [])
      .filter((m: any) => m.mensagem && m.mensagem.trim())
      .map((m: any) => ({
        role: m.direcao === "entrada" ? "user" : "assistant",
        content: m.mensagem,
      }));

    // ---- 7. VERIFICAR SE É PRIMEIRA MENSAGEM ----
    const isPrimeiraMensagem = !contatoExistente || historico?.length === 0;

    // ---- 8. DADOS OPCIONAIS DE COTAÇÃO ----
    let dadosOpcionais: { cpf: boolean; uso_veiculo: boolean; cor_veiculo: boolean } = {
      cpf: false,
      uso_veiculo: true,
      cor_veiculo: false,
    };
    try {
      dadosOpcionais = JSON.parse(config.dados_cotacao_opcionais || "{}");
    } catch { /* ignore */ }

    // ---- 9. MONTAR SYSTEM PROMPT DINÂMICO ----
    const systemPrompt = `Você é ${nomeAgente}, consultora virtual de vendas da PRATICCAR Proteção Veicular.

## SUA PERSONALIDADE
${instrucoes}

## APRESENTAÇÃO INICIAL
Quando for a primeira mensagem do contato, use esta apresentação como base (adapte naturalmente):
"${apresentacao}"

## PLANOS DISPONÍVEIS PARA OFERECER
${planosTexto}

## PLANOS INDISPONÍVEIS
NÃO mencione nenhum plano que não esteja listado acima. Se o contato perguntar por um plano que não está na lista, diga que não está disponível no momento.

## FLUXO DE COTAÇÃO
Colete os seguintes dados para fazer uma cotação:
1. Nome completo do interessado
2. Marca, modelo e ano do veículo (os 3 são obrigatórios)
3. CEP ou cidade/estado
${dadosOpcionais.cpf ? "4. CPF do interessado" : ""}
${dadosOpcionais.uso_veiculo ? "- Uso do veículo (particular, comercial, app)" : ""}

### Dados faltando
Se o contato fornecer dados incompletos (ex: marca sem modelo), continue pedindo especificamente o dado que falta. Seja educado e claro.

### Dados inválidos
Se o contato informar um dado claramente inválido (ex: ano 1800 para veículo), peça novamente de forma educada.

${!dadosOpcionais.cpf ? "## IMPORTANTE: NÃO peça CPF ao contato em nenhum momento da conversa." : ""}

## REGRAS DE COMPORTAMENTO
- Seja cordial e profissional
- Use linguagem simples e direta
- Use emojis com moderação (1-2 por mensagem no máximo)
- Use formatação WhatsApp: *negrito* (um asterisco), _itálico_ (underline)
- NUNCA use Markdown: **duplo asterisco**, ## títulos, [links](url)
- Respostas curtas (máximo 3 parágrafos)
- NUNCA invente dados, preços ou informações que não foram fornecidos acima

## FORA DO ESCOPO
Se o contato fizer perguntas políticas, irrelevantes ou fora do tema de proteção veicular:
- Redirecione educadamente: "Sou especializada em proteção veicular! Posso te ajudar a encontrar o melhor plano para o seu veículo. 😊"

## SINISTRO / EMERGÊNCIA
Se o contato relatar sinistro, acidente ou emergência:
- Responda: "Entendo a urgência! Vou transferir você para nossa equipe especializada que poderá te ajudar imediatamente. Aguarde um momento. 🙏"
- NÃO tente resolver sinistros

## SOLICITAR ATENDENTE HUMANO
Se o contato pedir para falar com uma pessoa/atendente:
- Responda: "Claro! Vou transferir para um dos nossos consultores. Aguarde um momento, ele entrará em contato em breve! 😊"

## DATA E HORA ATUAL
${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}

## NOME DO CONTATO
${contato?.nome || "Não informado ainda"}`;

    // ---- 10. CHAMAR LOVABLE AI ----
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    const messages: any[] = [];

    // Incluir histórico
    if (historicoFormatado.length > 0 && !isPrimeiraMensagem) {
      messages.push(...historicoFormatado);
    }

    // Adicionar mensagem atual
    if (texto) {
      messages.push({ role: "user", content: texto });
    } else if (tipo_msg === "location" && latitude && longitude) {
      messages.push({ role: "user", content: `[Localização compartilhada]: ${latitude}, ${longitude}` });
    } else {
      messages.push({ role: "user", content: "[Mensagem recebida]" });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        max_tokens: 2048,
      }),
      signal: AbortSignal.timeout(55000),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error(`[agente-consultor-ia] AI Error ${aiResponse.status}: ${errText.substring(0, 200)}`);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit excedido. Tente novamente em instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "Créditos de IA esgotados." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI Error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let resposta = aiData.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua mensagem. Tente novamente.";

    console.log(`[agente-consultor-ia] Resposta IA (${resposta.length} chars) para ${telLimpo}`);

    // ---- 11. DETECTAR INTENÇÕES ESPECIAIS ----
    const respostaLower = resposta.toLowerCase();
    const textoLower = (texto || "").toLowerCase();

    // Detectar pedido de humano
    const pedidoHumano = textoLower.match(/falar com (uma |um )?(pessoa|atendente|humano|gente|algu[eé]m)/i) ||
      textoLower.match(/quero (um |uma )?(atendente|pessoa|humano)/i) ||
      textoLower.match(/atendimento humano/i);

    if (pedidoHumano) {
      // Marcar contato como atendimento humano
      await supabase
        .from("agente_ia_contatos")
        .update({ status: "atendimento_humano" })
        .eq("id", contato.id);

      // Notificar equipe
      try {
        const { data: diretores } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("role", ["diretor", "vendedor", "supervisor_vendas"]);

        for (const dest of diretores || []) {
          await supabase.from("notificacoes").insert({
            user_id: dest.user_id,
            titulo: "👤 Lead solicitou atendimento humano",
            mensagem: `Telefone: ${telLimpo} | Nome: ${contato?.nome || "Não informado"} | Última mensagem: "${texto?.substring(0, 100)}"`,
            tipo: "alerta",
            categoria: "vendas",
            lida: false,
          });
        }
      } catch (notifErr) {
        console.error("[agente-consultor-ia] Erro notificação:", notifErr);
      }

      console.log(`[agente-consultor-ia] Contato ${telLimpo} transferido para humano`);
    }

    // Detectar sinistro/emergência
    const pedidoSinistro = textoLower.match(/sinistro|acidente|batid[oa]|colisão|roubaram|furtaram|incêndio|pegou fogo/i);
    if (pedidoSinistro) {
      // Marcar contato para atendimento humano também
      await supabase
        .from("agente_ia_contatos")
        .update({ status: "atendimento_humano" })
        .eq("id", contato.id);

      try {
        const { data: analistas } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("role", ["diretor", "analista_sinistros"]);

        for (const dest of analistas || []) {
          await supabase.from("notificacoes").insert({
            user_id: dest.user_id,
            titulo: "🚨 Lead reportou sinistro/emergência",
            mensagem: `Telefone: ${telLimpo} | Mensagem: "${texto?.substring(0, 150)}"`,
            tipo: "alerta",
            categoria: "sinistros",
            lida: false,
          });
        }
      } catch (notifErr) {
        console.error("[agente-consultor-ia] Erro notificação sinistro:", notifErr);
      }
    }

    // ---- 12. DIVIDIR RESPOSTA LONGA (>1000 chars) ----
    const partes = dividirMensagem(resposta, 1000);

    // ---- 13. ENVIAR RESPOSTA(S) ----
    for (let i = 0; i < partes.length; i++) {
      await enviarWhatsApp(supabaseUrl, serviceKey, telefone, partes[i]);
      if (i < partes.length - 1) {
        // Pequeno delay entre partes
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    // ---- 14. ATUALIZAR STATUS DO CONTATO ----
    if (contato.status === "novo") {
      await supabase
        .from("agente_ia_contatos")
        .update({ status: "em_conversa" })
        .eq("id", contato.id);
    }

    // Extrair nome se contato ainda não tem
    if (!contato.nome && texto) {
      const nomeMatch = texto.match(/(?:me chamo|meu nome [eé]|sou o|sou a)\s+([A-ZÀ-ÚÇ][a-zà-úç]+(?:\s+[A-ZÀ-ÚÇ][a-zà-úç]+)*)/i);
      if (nomeMatch) {
        await supabase
          .from("agente_ia_contatos")
          .update({ nome: nomeMatch[1].trim() })
          .eq("id", contato.id);
        console.log(`[agente-consultor-ia] Nome detectado: ${nomeMatch[1]}`);
      }
    }

    console.log(`[agente-consultor-ia] ✓ Resposta enviada para ${telLimpo} (${partes.length} parte(s))`);

    return new Response(
      JSON.stringify({ success: true, partes: partes.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[agente-consultor-ia] ERRO:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ---- HELPERS ----

async function enviarWhatsApp(supabaseUrl: string, serviceKey: string, telefone: string, mensagem: string) {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ telefone, mensagem, allow_text: true }),
    });
    const result = await res.json();
    if (!result.success) {
      console.error(`[agente-consultor-ia] Falha envio: ${result.error}`);
    }
    return result;
  } catch (e) {
    console.error(`[agente-consultor-ia] Erro envio WhatsApp:`, e);
    return { success: false };
  }
}

function dividirMensagem(texto: string, maxLength: number): string[] {
  if (texto.length <= maxLength) return [texto];

  const partes: string[] = [];
  let restante = texto;

  while (restante.length > maxLength) {
    // Tentar quebrar em parágrafo
    let corte = restante.lastIndexOf("\n\n", maxLength);
    if (corte < maxLength * 0.3) {
      // Tentar quebrar em linha
      corte = restante.lastIndexOf("\n", maxLength);
    }
    if (corte < maxLength * 0.3) {
      // Tentar quebrar em espaço
      corte = restante.lastIndexOf(" ", maxLength);
    }
    if (corte < maxLength * 0.3) {
      corte = maxLength;
    }

    partes.push(restante.substring(0, corte).trim());
    restante = restante.substring(corte).trim();
  }

  if (restante) partes.push(restante);
  return partes;
}
