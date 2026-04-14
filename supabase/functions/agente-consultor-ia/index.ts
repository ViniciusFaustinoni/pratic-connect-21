import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Edge function: Agente Consultor IA (Vinicius)
 * Fluxo reformulado com tool calling:
 * - Para leads: fluxo de cotação (placa → dados → calcular → registrar)
 * - Para diretores: relatórios do sistema (KPIs, cotações, leads, sinistros)
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

    const nomeAgente = config.nome_agente || "Vinicius";
    const apresentacao = config.apresentacao_inicial || "";
    const instrucoes = config.instrucoes_comportamento || "";
    const msgForaHorario = config.mensagem_fora_horario || "";
    const responderFora = config.responder_fora_horario === "true";

    // ---- 4. DETECTAR DIRETOR ----
    let isDiretor = false;
    let diretorNome = "";
    let diretorUserId = "";

    // Buscar em profiles pelo telefone
    const telVariantes = [telLimpo];
    if (telLimpo.startsWith("55") && telLimpo.length >= 12) {
      telVariantes.push(telLimpo.substring(2));
    }
    if (!telLimpo.startsWith("55")) {
      telVariantes.push("55" + telLimpo);
    }

    const orFilter = telVariantes.flatMap(t => [
      `telefone.eq.${t}`,
      `whatsapp.eq.${t}`,
    ]).join(",");

    const { data: profileMatch } = await supabase
      .from("profiles")
      .select("id, nome, user_id, telefone, whatsapp")
      .or(orFilter)
      .limit(1)
      .maybeSingle();

    if (profileMatch?.user_id) {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", profileMatch.user_id)
        .eq("role", "diretor")
        .maybeSingle();

      if (roleData) {
        isDiretor = true;
        diretorNome = profileMatch.nome || "";
        diretorUserId = profileMatch.user_id;
        console.log(`[agente-consultor-ia] Diretor detectado: ${diretorNome} (${profileMatch.user_id})`);
      }
    }

    // ---- 4B. DETECTAR ASSOCIADO ----
    let isAssociado = false;
    let associadoNome = "";
    let associadoStatus = "";
    let numeroAtendimento = "";

    if (!isDiretor) {
      // Buscar na tabela associados pelo telefone/whatsapp
      const orFilterAssociado = telVariantes.flatMap(t => [
        `telefone.ilike.%${t}%`,
        `whatsapp.ilike.%${t}%`,
      ]).join(",");

      const { data: associadoMatch } = await supabase
        .from("associados")
        .select("nome, status, telefone, whatsapp")
        .or(orFilterAssociado)
        .limit(1)
        .maybeSingle();

      if (associadoMatch) {
        isAssociado = true;
        associadoNome = associadoMatch.nome || "";
        associadoStatus = associadoMatch.status || "";
        console.log(`[agente-consultor-ia] Associado detectado: ${associadoNome} (status: ${associadoStatus})`);

        // Buscar número de atendimento via Meta API (número do suporte)
        try {
          const { data: metaCfg } = await supabase
            .from("whatsapp_meta_config")
            .select("phone_number_id, access_token")
            .eq("ativo", true)
            .maybeSingle();

          if (metaCfg?.phone_number_id && metaCfg?.access_token) {
            try {
              const metaResp = await fetch(
                `https://graph.facebook.com/v21.0/${metaCfg.phone_number_id}?fields=display_phone_number`,
                { headers: { Authorization: `Bearer ${metaCfg.access_token}` } }
              );
              const metaData = await metaResp.json();
              if (metaData?.display_phone_number) {
                const tel = metaData.display_phone_number.replace(/\D/g, "");
                if (tel.length === 13) {
                  numeroAtendimento = `(${tel.substring(2, 4)}) ${tel.substring(4, 9)}-${tel.substring(9)}`;
                } else if (tel.length === 11) {
                  numeroAtendimento = `(${tel.substring(0, 2)}) ${tel.substring(2, 7)}-${tel.substring(7)}`;
                } else {
                  numeroAtendimento = metaData.display_phone_number;
                }
              }
            } catch (e) {
              console.error("[agente-consultor-ia] Erro ao buscar display_phone_number da Meta:", e);
            }
          }
        } catch (e) {
          console.error("[agente-consultor-ia] Erro ao buscar número atendimento:", e);
        }

        if (!numeroAtendimento) {
          numeroAtendimento = "nosso número principal de atendimento";
        }
        console.log(`[agente-consultor-ia] Número de atendimento: ${numeroAtendimento}`);
      }
    }

    // ---- 5. VERIFICAR HORÁRIO COMERCIAL (apenas para leads) ----
    if (!isDiretor && !isAssociado) {
      let horarioConfig: { dias: string[]; inicio: string; fim: string } | null = null;
      try {
        horarioConfig = JSON.parse(config.horario_comercial || "null");
      } catch { /* ignore */ }

      if (horarioConfig) {
        const agora = new Date();
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
          }
          return new Response(
            JSON.stringify({ success: true, fora_horario: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // ---- 6. BUSCAR HISTÓRICO DE CONVERSA ----
    const duasHorasAtras = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const telefonesBusca = telVariantes;

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

    const isPrimeiraMensagem = !contatoExistente || historico?.length === 0;

    // ---- 7. MONTAR SYSTEM PROMPT + TOOLS (condicional) ----
    let systemPrompt: string;
    let tools: any[];

    if (isDiretor) {
      // === PROMPT PARA DIRETORES ===
      systemPrompt = `Você é ${nomeAgente}, assistente executivo da PRATICCAR Proteção Veicular.

## CONTEXTO
Você está conversando com o diretor *${diretorNome}*. Você deve tratá-lo pelo nome.

## SUA FUNÇÃO
Você é o braço direito da diretoria. Seu papel é fornecer relatórios, dados e insights sobre o sistema da PRATICCAR.

## O QUE VOCÊ PODE FAZER
- Gerar relatórios com KPIs do sistema (associados ativos, receita, sinistros, leads)
- Informar cotações pendentes
- Apresentar métricas de vendas e conversão
- Resumos financeiros do mês
- Responder perguntas sobre dados operacionais

## FERRAMENTAS DISPONÍVEIS
Use a ferramenta *gerar_relatorio* para buscar dados reais do sistema. NUNCA invente números.

## TIPOS DE RELATÓRIO
Quando o diretor pedir dados, use a ferramenta com o tipo adequado:
- "geral" — Resumo completo com todos os KPIs
- "cotacoes" — Cotações pendentes e recentes
- "leads" — Leads do mês, origens e conversão
- "financeiro" — Receita, inadimplência, cobranças
- "sinistros" — Sinistros abertos e status
- "associados" — Totais por status

## REGRAS
- NUNCA execute o fluxo de vendas/cotação para diretores
- NUNCA invente dados — sempre use a ferramenta
- Seja direto e profissional
- Use formatação WhatsApp: *negrito*, _itálico_
- NUNCA use Markdown: **duplo**, ## títulos
- Respostas objetivas e com números reais

## SAUDAÇÃO INICIAL
Se for a primeira mensagem, cumprimente: "Olá, ${diretorNome}! 👋 Sou o ${nomeAgente}, seu assistente executivo. Como posso ajudar? Posso gerar relatórios, KPIs ou qualquer dado do sistema."

## DATA E HORA ATUAL
${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;

      tools = [
        {
          type: "function",
          function: {
            name: "gerar_relatorio",
            description: "Busca dados reais do sistema para gerar relatórios. Retorna KPIs, métricas e dados operacionais.",
            parameters: {
              type: "object",
              properties: {
                tipo: {
                  type: "string",
                  enum: ["geral", "cotacoes", "leads", "financeiro", "sinistros", "associados"],
                  description: "Tipo do relatório solicitado",
                },
                periodo_dias: {
                  type: "number",
                  description: "Período em dias para filtrar (padrão: 30 = mês atual)",
                },
              },
              required: ["tipo"],
            },
          },
        },
      ];
    } else if (isAssociado) {
      // === PROMPT PARA ASSOCIADOS ===
      systemPrompt = `Você é ${nomeAgente}, assistente virtual da PRATICCAR Proteção Veicular.

## CONTEXTO
Você está conversando com *${associadoNome}*, que já é associado(a) da PRATICCAR (status: ${associadoStatus}).

## SUA FUNÇÃO
Você deve reconhecer que esta pessoa já é associada e direcioná-la para o atendimento correto.

## REGRAS ABSOLUTAS
- NUNCA tente vender planos ou fazer cotação para associados
- NUNCA ofereça produtos ou promoções
- NUNCA execute ferramentas de cotação
- Seja cordial e prestativo

## O QUE FAZER
1. Cumprimente pelo nome
2. Informe que para atendimento, suporte, sinistros, dúvidas sobre cobranças ou qualquer assunto relacionado à associação, deve entrar em contato pelo número de atendimento principal
3. O número de atendimento é: *${numeroAtendimento}*
4. Pode responder dúvidas gerais simples sobre a PRATICCAR (horário de funcionamento, etc.)

## SAUDAÇÃO INICIAL
Se for a primeira mensagem: "Olá, ${associadoNome}! 👋 Sou o ${nomeAgente} da PRATICCAR. Vi que você já é nosso(a) associado(a)! Para atendimento, suporte ou qualquer dúvida sobre sua proteção, entre em contato pelo nosso número de atendimento: *${numeroAtendimento}*. Nossa equipe terá prazer em ajudá-lo(a)! 😊"

## FORMATAÇÃO
- Use formatação WhatsApp: *negrito*, _itálico_
- NUNCA use Markdown: **duplo**, ## títulos
- Respostas curtas e diretas

## DATA E HORA ATUAL
${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;

      tools = []; // Nenhuma ferramenta para associados

    } else {
      // === PROMPT PARA LEADS (vendas) ===
      // Carregar linhas de produto
      const { data: linhas } = await supabase
        .from("product_lines")
        .select("id, name, slug, description, icon, color, vehicle_type, disponivel_agente, agente_descricao")
        .eq("disponivel_agente", true)
        .eq("is_active", true)
        .order("sort_priority");

      const linhasTexto = linhas?.length
        ? linhas.map((l: any) => {
            const desc = l.agente_descricao || l.description || "";
            return `- *${l.name}*: ${desc}`;
          }).join("\n")
        : "Nenhuma linha de produto disponível no momento.";

      systemPrompt = `Você é ${nomeAgente}, consultor virtual de vendas da PRATICCAR Proteção Veicular.

## SUA PERSONALIDADE
${instrucoes}

## APRESENTAÇÃO INICIAL
Quando for a primeira mensagem do contato, use esta apresentação como base (adapte naturalmente):
"${apresentacao}"

## LINHAS DE PROTEÇÃO DISPONÍVEIS
${linhasTexto}

## REGRA CRÍTICA SOBRE DADOS DO VEÍCULO
- NUNCA invente ou adivinhe dados do veículo (marca, modelo, ano, valor FIPE)
- SOMENTE use os dados retornados pela ferramenta consultar_placa
- Se a ferramenta retornar erro, peça os dados manualmente ao cliente
- NUNCA "chute" baseado na placa — SEMPRE aguarde o resultado da ferramenta
- Se o resultado da ferramenta disser marca "Toyota" e modelo "Corolla", use EXATAMENTE esses dados
- IGNORAR qualquer "conhecimento prévio" sobre placas — confie APENAS no resultado da ferramenta

## REGRA ABSOLUTA SOBRE PREÇOS
- NUNCA informe valor de cobertura individual. Sempre informe o VALOR TOTAL DO PLANO por mês.
- NUNCA invente preços. Se não calculou via ferramenta, diga que precisa dos dados do veículo.
- Os preços variam conforme o veículo, região e uso. Sempre use a ferramenta calcular_cotacao para obter o preço real.

## FLUXO DE COTAÇÃO (OBRIGATÓRIO)
Siga exatamente esta sequência:
1. Cumprimente e pergunte a PLACA do veículo
2. Use a ferramenta consultar_placa para obter os dados automaticamente
3. Confirme os dados do veículo com o cliente (USE EXATAMENTE os dados retornados pela ferramenta)
4. Pergunte: "O veículo é usado para aplicativo (Uber, 99, etc.)?"
5. Pergunte a REGIÃO (estado/cidade)
6. Use a ferramenta calcular_cotacao com todos os dados coletados
7. Apresente os planos disponíveis com seus valores mensais
8. Se o cliente se interessar, pergunte nome completo e ofereça registrar a cotação

## DADOS OBRIGATÓRIOS PARA COTAÇÃO
- Placa do veículo (para busca automática)
- Tipo de uso (particular ou aplicativo)
- Região (estado)

## REGRAS DE COMPORTAMENTO
- Seja cordial e profissional
- Use linguagem simples e direta
- Use emojis com moderação (1-2 por mensagem no máximo)
- Use formatação WhatsApp: *negrito* (um asterisco), _itálico_ (underline)
- NUNCA use Markdown: **duplo asterisco**, ## títulos, [links](url)
- Respostas curtas (máximo 3 parágrafos)
- NUNCA invente dados, preços ou informações

## FORA DO ESCOPO
Se o contato fizer perguntas políticas, irrelevantes ou fora do tema de proteção veicular:
- Redirecione educadamente: "Sou especializado em proteção veicular! Posso te ajudar a encontrar o melhor plano para o seu veículo. 😊"

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

      tools = [
        {
          type: "function",
          function: {
            name: "consultar_placa",
            description: "Consulta os dados de um veículo pela placa. Retorna marca, modelo, ano, combustível e valor FIPE.",
            parameters: {
              type: "object",
              properties: {
                placa: { type: "string", description: "Placa do veículo (formato ABC1D23 ou ABC-1234)" },
              },
              required: ["placa"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "calcular_cotacao",
            description: "Calcula os preços dos planos disponíveis para o veículo. Retorna uma lista de planos com valores mensais.",
            parameters: {
              type: "object",
              properties: {
                valor_fipe: { type: "number", description: "Valor FIPE do veículo em reais" },
                marca: { type: "string", description: "Marca do veículo" },
                modelo: { type: "string", description: "Modelo do veículo" },
                ano: { type: "number", description: "Ano do veículo" },
                combustivel: { type: "string", description: "Tipo de combustível (gasolina, flex, diesel, eletrico)" },
                regiao: { type: "string", description: "Código da região (ex: rj, sp, mg)" },
                uso_app: { type: "boolean", description: "Se o veículo é usado para aplicativo (Uber, 99, etc.)" },
                placa: { type: "string", description: "Placa do veículo" },
              },
              required: ["valor_fipe", "regiao"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "registrar_cotacao",
            description: "Registra a cotação no sistema e gera um link público para o cliente. Também pode enviar por WhatsApp.",
            parameters: {
              type: "object",
              properties: {
                nome_cliente: { type: "string", description: "Nome completo do cliente" },
                telefone_cliente: { type: "string", description: "Telefone do cliente" },
                placa: { type: "string", description: "Placa do veículo" },
                marca: { type: "string", description: "Marca do veículo" },
                modelo: { type: "string", description: "Modelo do veículo" },
                ano: { type: "number", description: "Ano do veículo" },
                combustivel: { type: "string", description: "Combustível do veículo" },
                valor_fipe: { type: "number", description: "Valor FIPE" },
                regiao: { type: "string", description: "Região" },
                planos_calculados: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      nome: { type: "string" },
                      valor_mensal: { type: "number" },
                    },
                  },
                  description: "Lista de planos com valores calculados",
                },
                enviar_whatsapp: { type: "boolean", description: "Se deve enviar a cotação por WhatsApp" },
              },
              required: ["nome_cliente", "telefone_cliente", "valor_fipe"],
            },
          },
        },
      ];
    }

    // ---- 8. CHAMAR LOVABLE AI COM TOOL CALLING ----
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    const messages: any[] = [];
    if (historicoFormatado.length > 0 && !isPrimeiraMensagem) {
      messages.push(...historicoFormatado);
    }

    if (texto) {
      messages.push({ role: "user", content: texto });
    } else if (tipo_msg === "location" && latitude && longitude) {
      messages.push({ role: "user", content: `[Localização compartilhada]: ${latitude}, ${longitude}` });
    } else {
      messages.push({ role: "user", content: "[Mensagem recebida]" });
    }

    // Loop de tool calling (máximo 5 iterações para evitar loops infinitos)
    let resposta = "";
    let currentMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    for (let iteration = 0; iteration < 5; iteration++) {
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: currentMessages,
          tools,
          max_tokens: 2048,
        }),
        signal: AbortSignal.timeout(55000),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error(`[agente-consultor-ia] AI Error ${aiResponse.status}: ${errText.substring(0, 200)}`);

        if (aiResponse.status === 429) {
          return new Response(
            JSON.stringify({ success: false, error: "Rate limit excedido." }),
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
      const choice = aiData.choices?.[0];
      const message = choice?.message;

      if (!message) {
        resposta = "Desculpe, não consegui processar sua mensagem. Tente novamente.";
        break;
      }

      // Se tem tool calls, executar e continuar
      if (message.tool_calls && message.tool_calls.length > 0) {
        currentMessages.push(message);

        for (const toolCall of message.tool_calls) {
          const fnName = toolCall.function.name;
          let args: any = {};
          try { args = JSON.parse(toolCall.function.arguments); } catch { /* ignore */ }

          console.log(`[agente-consultor-ia] Tool call: ${fnName}`, JSON.stringify(args).substring(0, 200));

          let toolResult: any;
          try {
            if (fnName === "consultar_placa") {
              toolResult = await executarConsultaPlaca(supabaseUrl, serviceKey, args.placa);
            } else if (fnName === "calcular_cotacao") {
              toolResult = await executarCalculoCotacao(supabase, args);
            } else if (fnName === "registrar_cotacao") {
              toolResult = await executarRegistroCotacao(supabase, supabaseUrl, serviceKey, args, telLimpo, contato);
            } else if (fnName === "gerar_relatorio") {
              toolResult = await executarGerarRelatorio(supabase, args);
            } else {
              toolResult = { error: `Ferramenta desconhecida: ${fnName}` };
            }
          } catch (err: any) {
            console.error(`[agente-consultor-ia] Tool error ${fnName}:`, err);
            toolResult = { error: err.message || "Erro ao executar ferramenta" };
          }

          // Reforçar dados oficiais para consultar_placa
          let toolContent = JSON.stringify(toolResult);
          if (fnName === "consultar_placa" && toolResult && !toolResult.error) {
            toolContent = `⚠️ DADOS OFICIAIS DA CONSULTA DE PLACA - USE APENAS ESTES DADOS, NÃO INVENTE:\n${toolContent}`;
          }

          currentMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: toolContent,
          });
        }

        continue;
      }

      // Se não tem tool calls, temos a resposta final
      resposta = message.content || "Desculpe, não consegui processar sua mensagem.";
      break;
    }

    console.log(`[agente-consultor-ia] Resposta final (${resposta.length} chars) para ${telLimpo} (diretor=${isDiretor})`);

    // ---- 9. DETECTAR INTENÇÕES ESPECIAIS (apenas leads) ----
    if (!isDiretor) {
      const textoLower = (texto || "").toLowerCase();

      const pedidoHumano = textoLower.match(/falar com (uma |um )?(pessoa|atendente|humano|gente|algu[eé]m)/i) ||
        textoLower.match(/quero (um |uma )?(atendente|pessoa|humano)/i) ||
        textoLower.match(/atendimento humano/i);

      if (pedidoHumano) {
        await supabase
          .from("agente_ia_contatos")
          .update({ status: "atendimento_humano" })
          .eq("id", contato.id);

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
      }

      const pedidoSinistro = textoLower.match(/sinistro|acidente|batid[oa]|colisão|roubaram|furtaram|incêndio|pegou fogo/i);
      if (pedidoSinistro) {
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
    }

    // ---- 10. DIVIDIR E ENVIAR RESPOSTA ----
    const partes = dividirMensagem(resposta, 1000);

    for (let i = 0; i < partes.length; i++) {
      await enviarWhatsApp(supabaseUrl, serviceKey, telefone, partes[i]);
      if (i < partes.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    // ---- 11. ATUALIZAR STATUS DO CONTATO ----
    if (contato.status === "novo" && !isDiretor) {
      await supabase
        .from("agente_ia_contatos")
        .update({ status: "em_conversa" })
        .eq("id", contato.id);
    }

    if (!contato.nome && texto && !isDiretor) {
      const nomeMatch = texto.match(/(?:me chamo|meu nome [eé]|sou o|sou a)\s+([A-ZÀ-ÚÇ][a-zà-úç]+(?:\s+[A-ZÀ-ÚÇ][a-zà-úç]+)*)/i);
      if (nomeMatch) {
        await supabase
          .from("agente_ia_contatos")
          .update({ nome: nomeMatch[1].trim() })
          .eq("id", contato.id);
      }
    }

    console.log(`[agente-consultor-ia] ✓ Resposta enviada para ${telLimpo} (${partes.length} parte(s))`);

    return new Response(
      JSON.stringify({ success: true, partes: partes.length, is_diretor: isDiretor }),
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

// ============================================================
// TOOL: gerar_relatorio (DIRETORES)
// ============================================================
async function executarGerarRelatorio(supabase: any, args: any) {
  const { tipo = "geral", periodo_dias = 30 } = args;
  const dataInicio = new Date(Date.now() - periodo_dias * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  console.log(`[tool:gerar_relatorio] tipo=${tipo} periodo=${periodo_dias}d desde=${dataInicio}`);

  const relatorio: any = { tipo, periodo_dias, data_inicio: dataInicio };

  try {
    if (tipo === "geral" || tipo === "associados") {
      // Totais de associados por status
      const { data: assocAtivos } = await supabase
        .from("associados")
        .select("id", { count: "exact", head: true })
        .eq("status", "ativo");
      const { data: assocPendentes } = await supabase
        .from("associados")
        .select("id", { count: "exact", head: true })
        .eq("status", "pendente");
      const { data: assocCancelados } = await supabase
        .from("associados")
        .select("id", { count: "exact", head: true })
        .eq("status", "cancelado");
      const { data: assocBloqueados } = await supabase
        .from("associados")
        .select("id", { count: "exact", head: true })
        .eq("status", "bloqueado");

      // Novos no período
      const { count: novosNoPeríodo } = await supabase
        .from("associados")
        .select("id", { count: "exact", head: true })
        .gte("created_at", dataInicio);

      relatorio.associados = {
        ativos: assocAtivos,
        pendentes: assocPendentes,
        cancelados: assocCancelados,
        bloqueados: assocBloqueados,
        novos_periodo: novosNoPeríodo || 0,
      };
    }

    if (tipo === "geral" || tipo === "financeiro") {
      // Receita do período (cobranças pagas)
      const { data: cobrancasPagas } = await supabase
        .from("cobrancas")
        .select("valor_pago")
        .eq("status", "pago")
        .gte("data_pagamento", dataInicio);

      const totalReceita = (cobrancasPagas || []).reduce((s: number, c: any) => s + (c.valor_pago || 0), 0);

      // Inadimplentes
      const { count: inadimplentes } = await supabase
        .from("cobrancas")
        .select("id", { count: "exact", head: true })
        .eq("status", "vencido");

      relatorio.financeiro = {
        receita_periodo: totalReceita,
        inadimplentes_total: inadimplentes || 0,
      };
    }

    if (tipo === "geral" || tipo === "cotacoes") {
      const { data: cotPendentes, count: qtdPendentes } = await supabase
        .from("cotacoes_publicas")
        .select("id, veiculo_marca, veiculo_modelo, veiculo_ano, created_at, status", { count: "exact" })
        .eq("status", "aguardando")
        .order("created_at", { ascending: false })
        .limit(10);

      const { count: totalCotacoes } = await supabase
        .from("cotacoes_publicas")
        .select("id", { count: "exact", head: true })
        .gte("created_at", dataInicio);

      relatorio.cotacoes = {
        pendentes: qtdPendentes || 0,
        total_periodo: totalCotacoes || 0,
        ultimas_pendentes: (cotPendentes || []).map((c: any) => ({
          veiculo: `${c.veiculo_marca} ${c.veiculo_modelo} ${c.veiculo_ano}`,
          data: c.created_at,
        })),
      };
    }

    if (tipo === "geral" || tipo === "leads") {
      const { count: totalLeads } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .gte("created_at", dataInicio);

      const { count: leadsConvertidos } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("status", "convertido")
        .gte("created_at", dataInicio);

      const { data: leadsPorOrigem } = await supabase
        .from("leads")
        .select("origem")
        .gte("created_at", dataInicio);

      // Agrupar por origem
      const origemMap: Record<string, number> = {};
      for (const l of leadsPorOrigem || []) {
        const o = l.origem || "desconhecida";
        origemMap[o] = (origemMap[o] || 0) + 1;
      }

      relatorio.leads = {
        total_periodo: totalLeads || 0,
        convertidos: leadsConvertidos || 0,
        taxa_conversao: totalLeads ? Math.round(((leadsConvertidos || 0) / totalLeads) * 100) : 0,
        por_origem: origemMap,
      };
    }

    if (tipo === "geral" || tipo === "sinistros") {
      const { count: sinistrosAbertos } = await supabase
        .from("sinistros")
        .select("id", { count: "exact", head: true })
        .in("status", ["aberto", "em_analise", "aprovado"]);

      const { count: sinistrosPeriodo } = await supabase
        .from("sinistros")
        .select("id", { count: "exact", head: true })
        .gte("created_at", dataInicio);

      const { data: sinistrosValor } = await supabase
        .from("sinistros")
        .select("valor_indenizacao")
        .in("status", ["aprovado", "pago", "encerrado"])
        .gte("data_ocorrencia", dataInicio);

      const totalIndenizado = (sinistrosValor || []).reduce((s: number, si: any) => s + (si.valor_indenizacao || 0), 0);

      relatorio.sinistros = {
        abertos: sinistrosAbertos || 0,
        total_periodo: sinistrosPeriodo || 0,
        valor_indenizado_periodo: totalIndenizado,
      };
    }

    return { success: true, relatorio };
  } catch (err: any) {
    console.error("[tool:gerar_relatorio] Erro:", err);
    return { success: false, error: err.message || "Erro ao gerar relatório" };
  }
}

// ============================================================
// TOOL: consultar_placa
// ============================================================
async function executarConsultaPlaca(supabaseUrl: string, serviceKey: string, placa: string) {
  console.log(`[tool:consultar_placa] Consultando placa: ${placa}`);
  
  const res = await fetch(`${supabaseUrl}/functions/v1/plate-lookup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({ placa }),
  });

  const data = await res.json();

  if (!data.success) {
    return {
      success: false,
      error: data.error || "Não foi possível consultar a placa",
      mensagem: "Não consegui encontrar dados para essa placa. Por favor, informe manualmente: marca, modelo, ano e tipo de combustível do veículo.",
    };
  }

  // plate-lookup retorna: { success, vehicleData: { marca, modelo, ano, combustivel, cor, ... }, fipeData: { valor, codigo, mesReferencia } }
  const vd = data.vehicleData || {};
  const fd = data.fipeData || {};

  // Extrair ano-modelo numérico (ex: "2013/2014" → 2014)
  const anoTexto = vd.ano || data.ano || "";
  const anoMatch = String(anoTexto).match(/(\d{4})$/);
  const anoModelo = anoMatch ? parseInt(anoMatch[1]) : null;

  const normalized = {
    success: true,
    placa: data.extractedPlate || placa,
    marca: vd.marca || data.marca || null,
    modelo: vd.modelo || data.modelo || null,
    ano_modelo: anoModelo,
    ano_texto: anoTexto,
    combustivel: vd.combustivel || data.combustivel || "gasolina",
    valor_fipe: fd.valor || data.valor_fipe || null,
    cor: vd.cor || data.cor || null,
  };

  console.log(`[tool:consultar_placa] Payload bruto resumido: vehicleData=${JSON.stringify(vd).substring(0, 200)}, fipeData=${JSON.stringify(fd).substring(0, 200)}`);
  console.log(`[tool:consultar_placa] Objeto normalizado enviado ao modelo:`, JSON.stringify(normalized));

  return normalized;
}

// ============================================================
// TOOL: calcular_cotacao
// ============================================================
async function executarCalculoCotacao(supabase: any, args: any) {
  const { valor_fipe, marca, modelo, ano, combustivel = "gasolina", regiao = "rj", uso_app = false } = args;

  console.log(`[tool:calcular_cotacao] FIPE=${valor_fipe} regiao=${regiao} app=${uso_app} combustivel=${combustivel}`);

  // Buscar planos ativos com product_lines
  const { data: planos, error: planosErr } = await supabase
    .from("planos")
    .select(`
      id, nome, codigo, descricao, adicional_mensal, valor_adesao, desconto_percentual,
      cobertura_fipe, cota_participacao, cota_minima, cota_desagio, cota_minima_desagio,
      destaque, badge_text, ativo, visivel_gestao, ordem, product_line_id, linha, nivel,
      product_lines:product_line_id (id, slug, name, vehicle_type, disponivel_agente, is_active)
    `)
    .eq("ativo", true)
    .eq("visivel_gestao", true)
    .order("ordem");

  if (planosErr) throw new Error("Erro ao buscar planos: " + planosErr.message);

  // Filtrar apenas planos de linhas disponíveis para o agente
  const planosDisponiveis = (planos || []).filter((p: any) =>
    p.product_lines?.disponivel_agente === true && p.product_lines?.is_active === true
  );

  // Buscar coberturas vinculadas
  const planoIds = planosDisponiveis.map((p: any) => p.id);
  const { data: planosCoberturas } = await supabase
    .from("planos_coberturas")
    .select("plano_id, cobertura_id, coberturas:cobertura_id (nome, valor)")
    .in("plano_id", planoIds);

  // Buscar benefícios vinculados
  const { data: planosBeneficios } = await supabase
    .from("planos_beneficios")
    .select("plano_id, benefit_id, benefits:benefit_id (name, preco_sugerido)")
    .in("plano_id", planoIds);

  // Buscar regras de elegibilidade
  const { data: allRules } = await supabase
    .from("entity_eligibility_rules")
    .select("*")
    .eq("is_active", true);

  // Buscar regiões para resolver ID
  const { data: regioes } = await supabase.from("regioes").select("id, codigo, nome").eq("ativa", true);
  const regiaoSlug = regiao.toLowerCase();
  const regiaoMatch = (regioes || []).find((r: any) =>
    r.codigo?.toLowerCase() === regiaoSlug || r.nome?.toLowerCase().includes(regiaoSlug)
  );

  // Buscar configs de decomposição e adicional app
  const { data: configDecomposicao } = await supabase
    .from("configuracoes")
    .select("chave, valor")
    .in("chave", ["decomposicao_mensalidade", "adicional_app"]);

  let adicionalAppValor = 35.90;
  for (const c of configDecomposicao || []) {
    if (c.chave === "adicional_app") adicionalAppValor = parseFloat(c.valor) || 35.90;
  }

  // Buscar regiões com adicional app
  const { data: regioesAppConfig } = await supabase
    .from("configuracoes")
    .select("valor")
    .eq("chave", "regioes_com_adicional_app")
    .maybeSingle();

  let regioesComAdicional: string[] = [];
  try { regioesComAdicional = JSON.parse(regioesAppConfig?.valor || "[]"); } catch { /* */ }

  // Build vehicle context
  const vehicleCtx = {
    valorFipe: valor_fipe,
    anoVeiculo: ano || new Date().getFullYear(),
    categoriaVeiculo: "passeio",
    regiao: regiao,
    regiaoId: regiaoMatch?.id,
    marca: marca,
    modelo: modelo,
    tipoUso: uso_app ? "aplicativo" : "particular",
    combustivel: combustivel,
  };

  const resultados: any[] = [];

  for (const plano of planosDisponiveis) {
    const productLineId = plano.product_line_id;
    const rules = allRules || [];

    // Check eligibility rules for this plan
    const planoRules = rules.filter((r: any) => r.entity_type === "plano" && r.entity_id === plano.id && r.is_active);
    const linhaRules = productLineId
      ? rules.filter((r: any) => r.entity_type === "linha" && r.entity_id === productLineId && r.is_active)
      : [];

    if (!checkRulesSimple(linhaRules, vehicleCtx) || !checkRulesSimple(planoRules, vehicleCtx)) {
      continue;
    }

    // Calculate price from coverages + benefits
    const coberturasDoPlano = (planosCoberturas || []).filter((pc: any) => pc.plano_id === plano.id);
    const beneficiosDoPlano = (planosBeneficios || []).filter((pb: any) => pb.plano_id === plano.id);

    let somaCoberturas = 0;
    for (const pc of coberturasDoPlano) {
      const cobId = pc.cobertura_id;
      const fipeRule = rules.find((r: any) => r.entity_type === "cobertura" && r.entity_id === cobId && r.rule_type === "fipe_range" && r.is_active);
      if (fipeRule) {
        const faixas = (fipeRule.rule_config as any)?.faixas || [];
        const faixa = faixas.find((f: any) => valor_fipe >= f.de && valor_fipe < f.ate);
        somaCoberturas += faixa ? Number(faixa.valor) : 0;
      } else {
        somaCoberturas += Number((pc as any).coberturas?.valor || 0);
      }
    }

    let somaBeneficios = 0;
    for (const pb of beneficiosDoPlano) {
      const fipeRule = rules.find((r: any) => r.entity_type === "beneficio" && r.entity_id === pb.benefit_id && r.rule_type === "fipe_range" && r.is_active);
      if (fipeRule) {
        const faixas = (fipeRule.rule_config as any)?.faixas || [];
        const faixa = faixas.find((f: any) => valor_fipe >= f.de && valor_fipe < f.ate);
        somaBeneficios += faixa ? Number(faixa.valor) : 0;
      } else {
        somaBeneficios += Number((pb as any).benefits?.preco_sugerido || 0);
      }
    }

    let valorMensal = somaCoberturas + somaBeneficios;
    if (valorMensal === 0) continue;

    // Adicional mensal do plano
    valorMensal += Number(plano.adicional_mensal || 0);

    // Adicional app
    if (uso_app) {
      const regiaoTemAdicional = regioesComAdicional.includes(regiaoSlug);
      if (regiaoTemAdicional) {
        valorMensal += adicionalAppValor;
      }
    }

    // Desconto percentual
    const desconto = Number(plano.desconto_percentual || 0);
    if (desconto > 0) {
      valorMensal *= (1 - desconto / 100);
    }

    valorMensal = Math.round(valorMensal * 100) / 100;
    const valorAdesao = Number(plano.valor_adesao || 0);

    resultados.push({
      plano_id: plano.id,
      nome: plano.nome,
      linha: plano.product_lines?.name || plano.linha,
      valor_mensal: valorMensal,
      valor_adesao: valorAdesao,
      cobertura_fipe: plano.cobertura_fipe || 100,
      destaque: plano.destaque || false,
    });
  }

  // Ordenar por valor mensal
  resultados.sort((a: any, b: any) => a.valor_mensal - b.valor_mensal);

  if (resultados.length === 0) {
    return {
      success: false,
      mensagem: "Não encontramos planos disponíveis para este veículo na região informada. Pode ser que o veículo não se enquadre nos critérios de elegibilidade.",
    };
  }

  return {
    success: true,
    planos: resultados,
    mensagem_formatada: resultados.map((p: any) =>
      `*${p.nome}* (${p.linha})\n💰 R$ ${p.valor_mensal.toFixed(2)}/mês\n🏷️ Adesão: R$ ${p.valor_adesao.toFixed(2)}`
    ).join("\n\n"),
  };
}

// ============================================================
// TOOL: registrar_cotacao
// ============================================================
async function executarRegistroCotacao(supabase: any, supabaseUrl: string, serviceKey: string, args: any, telLimpo: string, contato: any) {
  const { nome_cliente, telefone_cliente, placa, marca, modelo, ano, combustivel, valor_fipe, regiao, planos_calculados, enviar_whatsapp } = args;

  console.log(`[tool:registrar_cotacao] Registrando cotação para ${nome_cliente} - ${placa}`);

  // Criar ou buscar lead
  const telefoneLead = (telefone_cliente || telLimpo).replace(/\D/g, "");
  let leadId: string | null = null;

  const { data: leadExistente } = await supabase
    .from("leads")
    .select("id")
    .eq("telefone", telefoneLead)
    .maybeSingle();

  if (leadExistente) {
    leadId = leadExistente.id;
  } else {
    const { data: novoLead } = await supabase
      .from("leads")
      .insert({
        nome: nome_cliente || "Lead via Agente IA",
        telefone: telefoneLead,
        origem: "agente_ia",
        status: "novo",
      })
      .select("id")
      .single();
    leadId = novoLead?.id;
  }

  if (!leadId) {
    return { success: false, error: "Erro ao criar lead" };
  }

  // Criar cotação pública
  const { data: cotacao, error: cotacaoErr } = await supabase
    .from("cotacoes_publicas")
    .insert({
      lead_id: leadId,
      veiculo_marca: marca,
      veiculo_modelo: modelo,
      veiculo_ano: ano,
      veiculo_placa: placa,
      veiculo_combustivel: combustivel,
      valor_fipe: valor_fipe,
      regiao: regiao || "rj",
      status: "aguardando",
      dados_cotacao: { planos: planos_calculados, origem: "agente_ia" },
    })
    .select("id, token")
    .single();

  if (cotacaoErr) {
    console.error("[tool:registrar_cotacao] Erro:", cotacaoErr);
    return { success: false, error: "Erro ao registrar cotação" };
  }

  // Atualizar contato
  await supabase
    .from("agente_ia_contatos")
    .update({ status: "cotacao_enviada", nome: nome_cliente || contato?.nome })
    .eq("telefone", telLimpo);

  const linkCotacao = `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/cotacao/${cotacao.token}`;

  // Enviar por WhatsApp se solicitado
  if (enviar_whatsapp && planos_calculados?.length > 0) {
    const mensagemCotacao = `Olá ${nome_cliente || ""}! 😊\n\nSegue sua cotação de proteção veicular para o *${marca} ${modelo} ${ano}*:\n\n` +
      planos_calculados.map((p: any) =>
        `✅ *${p.nome}*: R$ ${p.valor_mensal?.toFixed(2)}/mês`
      ).join("\n") +
      `\n\nAcesse o link para mais detalhes:\n${linkCotacao}\n\n_PRATICCAR Proteção Veicular - Proteção 360_ 🛡️`;

    await enviarWhatsApp(supabaseUrl, serviceKey, telefoneLead, mensagemCotacao);
  }

  return {
    success: true,
    cotacao_id: cotacao.id,
    token: cotacao.token,
    link: linkCotacao,
    mensagem: `Cotação registrada com sucesso! Link: ${linkCotacao}`,
  };
}

// ============================================================
// HELPERS
// ============================================================

function checkRulesSimple(rules: any[], ctx: any): boolean {
  for (const rule of rules) {
    if (!rule.is_active) continue;
    const config = rule.rule_config || {};

    switch (rule.rule_type) {
      case "tipo_uso": {
        const tipos = config.tipos_permitidos || [];
        if (tipos.length > 0 && !tipos.includes(ctx.tipoUso)) return false;
        break;
      }
      case "regiao": {
        const regioes = config.regioes_permitidas || [];
        if (regioes.length > 0 && ctx.regiaoId && !regioes.includes(ctx.regiaoId)) return false;
        break;
      }
      case "combustivel": {
        const combustiveis = config.combustiveis_permitidos || [];
        const ctxComb = (ctx.combustivel || "").toLowerCase();
        const normMap: Record<string, string> = {
          "flex": "gasolina",
          "álcool": "gasolina",
          "gasolina/álcool": "gasolina",
          "flex/gasolina": "gasolina",
        };
        const ctxNorm = normMap[ctxComb] || ctxComb;
        if (combustiveis.length > 0 && !combustiveis.includes(ctxNorm)) return false;
        break;
      }
      case "fipe_range": {
        const fipeMin = config.fipe_min || 0;
        const fipeMax = config.fipe_max || Infinity;
        if (ctx.valorFipe < fipeMin || ctx.valorFipe > fipeMax) return false;
        break;
      }
      case "ano_range": {
        const anoMin = config.ano_min || 0;
        const anoMax = config.ano_max || 9999;
        if (ctx.anoVeiculo < anoMin || ctx.anoVeiculo > anoMax) return false;
        break;
      }
      case "marca_modelo": {
        break;
      }
    }
  }
  return true;
}

async function enviarWhatsApp(supabaseUrl: string, serviceKey: string, telefone: string, mensagem: string) {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ telefone, mensagem, allow_text: true, force_provider: "evolution" }),
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
    let corte = restante.lastIndexOf("\n\n", maxLength);
    if (corte < maxLength * 0.3) {
      corte = restante.lastIndexOf("\n", maxLength);
    }
    if (corte < maxLength * 0.3) {
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
