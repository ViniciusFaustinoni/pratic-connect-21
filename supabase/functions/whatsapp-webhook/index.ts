import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// System prompt adaptado para WhatsApp (mais conciso)
const WHATSAPP_SYSTEM_PROMPT = `Você é o Assistente Virtual PRATIC via WhatsApp.

## Regras do WhatsApp
- Seja CONCISO (mensagens curtas)
- Use formatação: *negrito*, _itálico_
- NÃO use marcadores especiais como [BOTAO_LOCALIZACAO] ou [UPLOAD_*]
- Para localização, peça o endereço digitado
- Para fotos, oriente enviar depois no app

## Capacidades
1. Consultar boletos pendentes
2. Histórico de pagamentos
3. Status de sinistros
4. Abrir sinistro (coleta dados e registra para aprovação)
5. Solicitar assistência 24h (guincho, chaveiro, etc.)
6. Informações sobre veículos

## Regras
- Use a DATA ATUAL fornecida para datas relativas
- Confirme dados antes de criar solicitações
- Informe que solicitações passam por aprovação
- NUNCA invente informações

## Formato
- Respostas curtas e diretas
- Use emojis com moderação
- Máximo 3-4 parágrafos por mensagem`;

// Tools (mesmo do assistente-chat)
const tools = [
  {
    type: "function",
    function: {
      name: "get_boletos_pendentes",
      description: "Lista boletos pendentes do associado",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_historico_pagamentos",
      description: "Histórico de pagamentos",
      parameters: {
        type: "object",
        properties: { limite: { type: "number" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_sinistros",
      description: "Lista sinistros do associado",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_assistencias",
      description: "Lista chamados de assistência",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_veiculos",
      description: "Lista veículos do associado",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_solicitacao_sinistro",
      description: "Cria solicitação de sinistro para aprovação",
      parameters: {
        type: "object",
        properties: {
          tipo: { type: "string", enum: ["colisao", "roubo_furto", "incendio", "fenomenos_naturais", "danos_terceiros", "outros"] },
          data_ocorrencia: { type: "string" },
          local: { type: "string" },
          descricao: { type: "string" },
        },
        required: ["tipo", "data_ocorrencia", "local", "descricao"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_solicitacao_assistencia",
      description: "Cria solicitação de assistência 24h",
      parameters: {
        type: "object",
        properties: {
          tipo_servico: { type: "string", enum: ["guincho", "chaveiro", "troca_pneu", "pane_seca", "pane_eletrica", "outros"] },
          localizacao: { type: "string" },
          descricao: { type: "string" },
        },
        required: ["tipo_servico", "localizacao", "descricao"],
      },
    },
  },
];

// Executa tools
async function executeTool(supabase: any, associadoId: string, toolName: string, args: any): Promise<string> {
  console.log(`[whatsapp-webhook] Tool: ${toolName}`, args);

  switch (toolName) {
    case "get_boletos_pendentes": {
      const { data } = await supabase
        .from("cobrancas")
        .select("valor, data_vencimento, status")
        .eq("associado_id", associadoId)
        .in("status", ["pendente", "vencido", "em_aberto"])
        .order("data_vencimento");

      if (!data?.length) return JSON.stringify({ message: "Sem boletos pendentes ✅" });

      const total = data.reduce((s: number, b: any) => s + (b.valor || 0), 0);
      return JSON.stringify({
        boletos: data.map((b: any) => ({
          valor: `R$ ${b.valor?.toFixed(2)}`,
          vencimento: new Date(b.data_vencimento).toLocaleDateString("pt-BR"),
          status: b.status,
        })),
        total: `R$ ${total.toFixed(2)}`,
      });
    }

    case "get_historico_pagamentos": {
      const { data } = await supabase
        .from("cobrancas")
        .select("valor, data_pagamento, competencia")
        .eq("associado_id", associadoId)
        .eq("status", "pago")
        .order("data_pagamento", { ascending: false })
        .limit(args.limite || 5);

      if (!data?.length) return JSON.stringify({ message: "Nenhum pagamento encontrado" });

      return JSON.stringify({
        pagamentos: data.map((p: any) => ({
          valor: `R$ ${p.valor?.toFixed(2)}`,
          pago_em: new Date(p.data_pagamento).toLocaleDateString("pt-BR"),
        })),
      });
    }

    case "get_sinistros": {
      const { data } = await supabase
        .from("sinistros")
        .select("protocolo, tipo, status, data_ocorrencia")
        .eq("associado_id", associadoId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (!data?.length) return JSON.stringify({ message: "Nenhum sinistro registrado" });

      return JSON.stringify({
        sinistros: data.map((s: any) => ({
          protocolo: s.protocolo,
          tipo: s.tipo,
          status: s.status,
        })),
      });
    }

    case "get_assistencias": {
      const { data } = await supabase
        .from("chamados_assistencia")
        .select("protocolo, tipo_servico, status")
        .eq("associado_id", associadoId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (!data?.length) return JSON.stringify({ message: "Nenhuma assistência registrada" });

      return JSON.stringify({
        chamados: data.map((c: any) => ({
          protocolo: c.protocolo,
          tipo: c.tipo_servico,
          status: c.status,
        })),
      });
    }

    case "get_veiculos": {
      const { data } = await supabase
        .from("veiculos")
        .select("id, placa, marca, modelo, ano, status")
        .eq("associado_id", associadoId);

      if (!data?.length) return JSON.stringify({ message: "Nenhum veículo encontrado" });

      return JSON.stringify({
        veiculos: data.map((v: any) => ({
          id: v.id,
          placa: v.placa,
          descricao: `${v.marca} ${v.modelo} ${v.ano}`,
          status: v.status,
        })),
      });
    }

    case "criar_solicitacao_sinistro": {
      const { data: veiculos } = await supabase
        .from("veiculos")
        .select("id")
        .eq("associado_id", associadoId)
        .eq("status", "ativo")
        .limit(1);

      const { data, error } = await supabase.from("chat_solicitacoes_ia").insert({
        associado_id: associadoId,
        tipo: "sinistro",
        dados: {
          veiculo_id: veiculos?.[0]?.id,
          tipo: args.tipo,
          data_ocorrencia: args.data_ocorrencia,
          local: args.local,
          descricao: args.descricao,
          origem: "whatsapp",
        },
        status: "pendente",
      }).select("id").single();

      if (error) throw error;

      return JSON.stringify({
        sucesso: true,
        message: "Solicitação de sinistro registrada! Um diretor irá analisar.",
      });
    }

    case "criar_solicitacao_assistencia": {
      const { data: veiculos } = await supabase
        .from("veiculos")
        .select("id")
        .eq("associado_id", associadoId)
        .eq("status", "ativo")
        .limit(1);

      const { data, error } = await supabase.from("chat_solicitacoes_ia").insert({
        associado_id: associadoId,
        tipo: "assistencia",
        dados: {
          veiculo_id: veiculos?.[0]?.id,
          tipo_servico: args.tipo_servico,
          localizacao: args.localizacao,
          descricao: args.descricao,
          origem: "whatsapp",
        },
        status: "pendente",
      }).select("id").single();

      if (error) throw error;

      return JSON.stringify({
        sucesso: true,
        message: "Solicitação de assistência registrada! Um diretor irá aprovar em breve.",
      });
    }

    default:
      return JSON.stringify({ error: "Tool não reconhecida" });
  }
}

// Buscar contexto do associado
async function getAssociadoContext(supabase: any, associadoId: string) {
  const { data: associado } = await supabase
    .from("associados")
    .select("nome, email, telefone, status")
    .eq("id", associadoId)
    .single();

  const { data: veiculos } = await supabase
    .from("veiculos")
    .select("placa, marca, modelo, ano")
    .eq("associado_id", associadoId)
    .limit(3);

  return `
## CONTEXTO DO ASSOCIADO
- Nome: ${associado?.nome || "N/A"}
- Status: ${associado?.status || "N/A"}
- Veículos: ${veiculos?.map((v: any) => `${v.placa} (${v.marca} ${v.modelo})`).join(", ") || "Nenhum"}
- Data atual: ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}
`;
}

// Buscar histórico de conversa
async function getConversationHistory(supabase: any, associadoId: string, telefone: string) {
  const { data } = await supabase
    .from("chat_mensagens_ia")
    .select("role, content")
    .eq("associado_id", associadoId)
    .order("created_at", { ascending: false })
    .limit(10);

  return (data || []).reverse();
}

// Chamar a IA
async function callAI(messages: any[], context: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

  const response = await fetch("https://api.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: WHATSAPP_SYSTEM_PROMPT + "\n\n" + context },
        ...messages,
      ],
      tools,
      tool_choice: "auto",
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`AI Error: ${err}`);
  }

  return response.json();
}

// Enviar mensagem via Evolution API
async function sendWhatsAppMessage(apiUrl: string, instanceName: string, telefone: string, texto: string) {
  const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
  if (!EVOLUTION_API_KEY) throw new Error("EVOLUTION_API_KEY não configurada");

  const response = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: EVOLUTION_API_KEY,
    },
    body: JSON.stringify({
      number: telefone,
      text: texto,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`[whatsapp-webhook] Erro ao enviar: ${err}`);
  }

  return response.ok;
}

// Salvar mensagem no histórico
async function saveMessage(supabase: any, associadoId: string, role: string, content: string) {
  await supabase.from("chat_mensagens_ia").insert({
    associado_id: associadoId,
    role,
    content,
  });
}

// Salvar log de mensagem WhatsApp
async function saveWhatsAppLog(supabase: any, instanciaId: string, telefone: string, mensagem: string, direcao: string) {
  await supabase.from("whatsapp_mensagens").insert({
    instancia_id: instanciaId,
    telefone,
    tipo: "text",
    mensagem,
    direcao,
    status: direcao === "saida" ? "enviada" : "entregue",
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log("[whatsapp-webhook] Payload:", JSON.stringify(payload).substring(0, 500));

    // Ignorar eventos que não são mensagens
    if (payload.event !== "messages.upsert") {
      return new Response(JSON.stringify({ ok: true, ignored: true }), { headers: corsHeaders });
    }

    const data = payload.data;
    if (!data?.key || data.key.fromMe) {
      return new Response(JSON.stringify({ ok: true, ignored: "própria mensagem" }), { headers: corsHeaders });
    }

    // Extrair telefone e texto
    const remoteJid = data.key.remoteJid || "";
    if (remoteJid.includes("@g.us")) {
      // Ignorar grupos
      return new Response(JSON.stringify({ ok: true, ignored: "grupo" }), { headers: corsHeaders });
    }

    const telefone = remoteJid.replace("@s.whatsapp.net", "");
    const mensagemTexto = data.message?.conversation || data.message?.extendedTextMessage?.text || "";

    if (!mensagemTexto.trim()) {
      return new Response(JSON.stringify({ ok: true, ignored: "sem texto" }), { headers: corsHeaders });
    }

    console.log(`[whatsapp-webhook] Mensagem de ${telefone}: ${mensagemTexto.substring(0, 100)}`);

    // Criar cliente Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Buscar instância e verificar se IA está habilitada
    const { data: instancia } = await supabase
      .from("whatsapp_instancias")
      .select("id, api_url, instance_name, ia_habilitada")
      .eq("principal", true)
      .single();

    if (!instancia) {
      console.error("[whatsapp-webhook] Instância não encontrada");
      return new Response(JSON.stringify({ error: "Instância não configurada" }), { headers: corsHeaders });
    }

    if (!instancia.ia_habilitada) {
      console.log("[whatsapp-webhook] IA desabilitada, ignorando");
      return new Response(JSON.stringify({ ok: true, ignored: "IA desabilitada" }), { headers: corsHeaders });
    }

    // Formatar telefone para busca
    const telefonesBusca = [telefone];
    if (telefone.startsWith("55") && telefone.length >= 12) {
      telefonesBusca.push(telefone.substring(2)); // sem DDI
    }
    if (!telefone.startsWith("55")) {
      telefonesBusca.push("55" + telefone); // com DDI
    }

    // Buscar associado pelo telefone
    const { data: associado } = await supabase
      .from("associados")
      .select("id, nome, status")
      .or(`whatsapp.in.(${telefonesBusca.join(",")}),telefone.in.(${telefonesBusca.join(",")})`)
      .eq("status", "ativo")
      .maybeSingle();

    if (!associado) {
      console.log(`[whatsapp-webhook] Associado não encontrado para ${telefone}`);
      await sendWhatsAppMessage(
        instancia.api_url,
        instancia.instance_name,
        telefone,
        "Olá! Este número não está cadastrado como associado PRATIC. Entre em contato com nossa central para mais informações. 📞"
      );
      return new Response(JSON.stringify({ ok: true, notFound: true }), { headers: corsHeaders });
    }

    console.log(`[whatsapp-webhook] Associado encontrado: ${associado.nome} (${associado.id})`);

    // Salvar mensagem recebida
    await saveWhatsAppLog(supabase, instancia.id, telefone, mensagemTexto, "entrada");
    await saveMessage(supabase, associado.id, "user", mensagemTexto);

    // Buscar contexto e histórico
    const context = await getAssociadoContext(supabase, associado.id);
    const history = await getConversationHistory(supabase, associado.id, telefone);

    // Preparar mensagens para IA
    const messages = [
      ...history.map((m: any) => ({ role: m.role, content: m.content })),
      { role: "user", content: mensagemTexto },
    ];

    // Loop de tool calls
    let aiResponse = await callAI(messages, context);
    let assistantMessage = aiResponse.choices?.[0]?.message;
    let iterations = 0;
    const maxIterations = 5;

    while (assistantMessage?.tool_calls && iterations < maxIterations) {
      iterations++;
      const toolResults = [];

      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments || "{}");
        const result = await executeTool(supabase, associado.id, toolName, toolArgs);
        toolResults.push({
          tool_call_id: toolCall.id,
          role: "tool",
          content: result,
        });
      }

      // Continuar conversa com resultados das tools
      aiResponse = await callAI(
        [
          ...messages,
          assistantMessage,
          ...toolResults,
        ],
        context
      );
      assistantMessage = aiResponse.choices?.[0]?.message;
    }

    // Extrair resposta final
    const respostaFinal = assistantMessage?.content || "Desculpe, não consegui processar sua mensagem. Tente novamente.";

    // Salvar e enviar resposta
    await saveMessage(supabase, associado.id, "assistant", respostaFinal);
    await saveWhatsAppLog(supabase, instancia.id, telefone, respostaFinal, "saida");
    await sendWhatsAppMessage(instancia.api_url, instancia.instance_name, telefone, respostaFinal);

    console.log(`[whatsapp-webhook] Resposta enviada para ${telefone}`);

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  } catch (error: any) {
    console.error("[whatsapp-webhook] Erro:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
