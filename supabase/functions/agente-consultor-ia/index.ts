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

    // ---- 5. HORÁRIO COMERCIAL DESATIVADO - Agente funciona 24h ----

    // ---- 6. BUSCAR HISTÓRICO DE CONVERSA ----
    const resetTimestamp = contato?.resetado_em || null;
    const foiResetado = contatoExistente && (
      (contato?.status === 'novo' && !contato?.dados_cotacao) ||
      (contato?.resetado_em && !contato?.dados_cotacao)
    );
    const isPrimeiraMensagem = !contatoExistente || foiResetado;

    // Usar o marco de reset como limite inferior do histórico (se existir)
    const limiteHistorico = resetTimestamp 
      ? new Date(resetTimestamp).toISOString()
      : new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const telefonesBusca = telVariantes;

    const { data: historico } = await supabase
      .from("whatsapp_mensagens")
      .select("mensagem, direcao, created_at")
      .or(telefonesBusca.map(t => `telefone.eq.${t}`).join(","))
      .gte("created_at", limiteHistorico)
      .order("created_at", { ascending: true })
      .limit(20);

    let historicoFormatado = (historico || [])
      .filter((m: any) => m.mensagem && m.mensagem.trim())
      .map((m: any) => ({
        role: m.direcao === "entrada" ? "user" : "assistant",
        content: m.mensagem,
      }));

    // Se foi resetado, limpar todo o histórico para começar do zero
    if (foiResetado) {
      historicoFormatado = [];
      console.log(`[agente-consultor-ia] Contato resetado detectado (resetado_em: ${resetTimestamp}), limpando histórico`);
    }

    // ---- 6B. CARREGAR ESTADO DO FLUXO (dados_cotacao) ----
    let dadosCotacao = contato?.dados_cotacao || null;

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
IMPORTANTE: Na apresentação, já mencione que consegue oferecer ADESÃO GRATUITA como condição especial exclusiva deste atendimento.

## LINHAS DE PROTEÇÃO DISPONÍVEIS
${linhasTexto}

## REGRA CRÍTICA SOBRE DADOS DO VEÍCULO
- NUNCA invente ou adivinhe dados do veículo (marca, modelo, ano, valor FIPE)
- SOMENTE use os dados retornados pela ferramenta consultar_placa
- Se a ferramenta retornar erro, peça os dados manualmente ao cliente
- NUNCA "chute" baseado na placa — SEMPRE aguarde o resultado da ferramenta
- Se o resultado da ferramenta disser marca "Toyota" e modelo "Corolla", use EXATAMENTE esses dados
- IGNORAR qualquer "conhecimento prévio" sobre placas — confie APENAS no resultado da ferramenta

## REGRAS ABSOLUTAS SOBRE PREÇOS
- NUNCA informe valores de planos na conversa
- NUNCA liste planos com preços — os detalhes estarão no link da cotação
- NUNCA invente preços ou valores
- NUNCA informe a QUANTIDADE de planos encontrados
- Após calcular, diga apenas: "Vou preparar sua cotação personalizada com as melhores opções!"

## SOBRE O TELEFONE
- Você JÁ TEM o telefone do cliente (é o número pelo qual está conversando)
- NUNCA peça o telefone — use o número da conversa automaticamente

## SOBRE ADESÃO E INSTALAÇÃO
- A adesão é sempre ISENTA (R$ 0,00)
- A instalação do rastreador será escolhida pelo cliente no link da cotação
- NÃO pergunte sobre tipo de instalação (rota/base) na conversa

## ARGUMENTO DE VENDA — ADESÃO GRATUITA
- A adesão gratuita é seu PRINCIPAL argumento de venda
- Mencione a adesão gratuita LOGO NO INÍCIO da conversa, junto com a apresentação
- Enfatize que essa condição especial é exclusiva para quem contratar por este atendimento
- Use frases como: "E tenho uma ótima notícia: consigo liberar a adesão TOTALMENTE GRATUITA pra você! 🎉"
- Reforce o benefício ao longo da conversa quando apropriado (ex: antes de pedir email, ao enviar link)
- Deixe claro que normalmente a adesão é cobrada e que essa é uma condição especial

## FLUXO DE COTAÇÃO (OBRIGATÓRIO)
Siga exatamente esta sequência:
1. Cumprimente e pergunte a PLACA do veículo
2. Use a ferramenta consultar_placa para obter os dados automaticamente
3. Confirme os dados do veículo com o cliente (USE EXATAMENTE os dados retornados pela ferramenta)
4. Pergunte: "O veículo é usado para aplicativo (Uber, 99, etc.)?"
5. Pergunte a REGIÃO (estado/cidade)
6. Use a ferramenta calcular_cotacao (internamente — NÃO mostre valores ao cliente)
7. Diga algo como: "Vou preparar sua cotação personalizada com as melhores opções! E lembrando: a adesão sai GRATUITA pra você! 🎉"
8. Peça o EMAIL e o NOME COMPLETO do cliente (pode ser na mesma mensagem)
9. Quando o cliente responder com email e nome, CHAME a ferramenta salvar_dados_cliente IMEDIATAMENTE
10. Use a ferramenta obter_opcoes_vencimento e ofereça APENAS as duas datas retornadas. NÃO invente datas.
11. Após o cliente escolher a data, CHAME registrar_cotacao IMEDIATAMENTE e envie o link

## REGRA CRÍTICA — GERAR COTAÇÃO (NUNCA IGNORE)
Quando você JÁ tem: placa, veículo, região, uso_app, email, nome e dia de vencimento,
CHAME registrar_cotacao IMEDIATAMENTE. NÃO faça mais perguntas. NÃO repita dados já coletados.
Se os dados já estão no ESTADO ATUAL DO FLUXO, USE-OS. Não peça novamente.

## APÓS ENVIO DO LINK
- Após enviar o link da cotação, aguarde e envie um resumo contendo:
  - Veículo (marca, modelo, ano)
  - Região
  - Quantidade de planos disponíveis
  - Informação de que a adesão é isenta
- Finalize com: "Estou à disposição para qualquer dúvida! 😊"

## DADOS OBRIGATÓRIOS PARA COTAÇÃO
- Placa do veículo (para busca automática)
- Tipo de uso (particular ou aplicativo)
- Região (estado)
- Dia de vencimento (obtido via ferramenta)
- Email do cliente
- Nome completo do cliente

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

      // ---- INJETAR ESTADO DO FLUXO NO PROMPT ----
      if (dadosCotacao && dadosCotacao.etapa) {
        let estadoTexto = `\n\n## ESTADO ATUAL DO FLUXO — MUITO IMPORTANTE\nVocê JÁ está no meio de uma cotação com este cliente. NÃO reinicie a conversa. NÃO cumprimente novamente. Continue de onde parou.\n\nDados coletados até agora:\n`;
        
        if (dadosCotacao.placa) estadoTexto += `- Placa: ${dadosCotacao.placa}\n`;
        if (dadosCotacao.marca) estadoTexto += `- Veículo: ${dadosCotacao.marca} ${dadosCotacao.modelo || ""} ${dadosCotacao.ano || ""} ${dadosCotacao.combustivel || ""}\n`;
        if (dadosCotacao.valor_fipe) estadoTexto += `- Valor FIPE: R$ ${Number(dadosCotacao.valor_fipe).toLocaleString("pt-BR")}\n`;
        if (dadosCotacao.regiao) estadoTexto += `- Região: ${dadosCotacao.regiao}\n`;
        if (dadosCotacao.uso_app !== undefined) estadoTexto += `- Uso aplicativo: ${dadosCotacao.uso_app ? "Sim" : "Não"}\n`;
        if (dadosCotacao.planos_calculados) estadoTexto += `- Planos calculados: ${dadosCotacao.planos_calculados.length} opções (JÁ CALCULADOS, não precisa calcular novamente)\n`;
        if (dadosCotacao.opcoes_vencimento) estadoTexto += `- Opções de vencimento disponíveis: dia ${dadosCotacao.opcoes_vencimento[0]} ou dia ${dadosCotacao.opcoes_vencimento[1]} (APENAS ESTAS DUAS)\n`;
        if (dadosCotacao.dia_vencimento) estadoTexto += `- Dia vencimento escolhido: ${dadosCotacao.dia_vencimento}\n`;
        if (dadosCotacao.email) estadoTexto += `- Email: ${dadosCotacao.email}\n`;
        if (dadosCotacao.nome) estadoTexto += `- Nome: ${dadosCotacao.nome}\n`;
        
        estadoTexto += `\nETAPA ATUAL: *${dadosCotacao.etapa}*\n`;
        
        // Instruções específicas por etapa
        const etapaInstrucoes: Record<string, string> = {
          "aguardando_confirmacao": "PRÓXIMO PASSO: Confirme os dados do veículo com o cliente e depois pergunte se usa para aplicativo.",
          "aguardando_regiao": "PRÓXIMO PASSO: Pergunte a região (estado) do cliente.",
          "aguardando_vencimento": `PRÓXIMO PASSO: Peça o EMAIL e NOME COMPLETO do cliente. Após receber, CHAME salvar_dados_cliente.`,
          "dados_cliente_coletados": `PRÓXIMO PASSO: Pergunte a data de vencimento usando obter_opcoes_vencimento. Ofereça APENAS as 2 opções retornadas.`,
          "aguardando_vencimento_resposta": `PRÓXIMO PASSO: O cliente deve escolher entre dia ${dadosCotacao.opcoes_vencimento?.[0] || "?"} ou dia ${dadosCotacao.opcoes_vencimento?.[1] || "?"}. Após escolher, CHAME registrar_cotacao IMEDIATAMENTE com TODOS os dados do estado.`,
          "cotacao_enviada": "A cotação JÁ foi enviada. Esteja disponível para dúvidas.",
        };
        
        estadoTexto += etapaInstrucoes[dadosCotacao.etapa] || "";
        systemPrompt += estadoTexto;
        
        console.log(`[agente-consultor-ia] Estado do fluxo injetado: etapa=${dadosCotacao.etapa}`);
      }

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
            description: "Calcula os planos disponíveis para o veículo. Retorna a QUANTIDADE de planos elegíveis. NÃO mostre valores ao cliente.",
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
              required: ["valor_fipe", "regiao", "ano"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "obter_opcoes_vencimento",
            description: "Retorna as opções de dia de vencimento disponíveis para o cliente escolher. Chame ANTES de registrar a cotação.",
            parameters: {
              type: "object",
              properties: {},
              required: [],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "registrar_cotacao",
            description: "Registra a cotação no sistema e gera um link público para o cliente acessar os planos e valores.",
            parameters: {
              type: "object",
              properties: {
                nome_cliente: { type: "string", description: "Nome completo do cliente" },
                email_cliente: { type: "string", description: "Email do cliente para receber a cotação" },
                placa: { type: "string", description: "Placa do veículo" },
                marca: { type: "string", description: "Marca do veículo" },
                modelo: { type: "string", description: "Modelo do veículo" },
                ano: { type: "number", description: "Ano do veículo" },
                combustivel: { type: "string", description: "Combustível do veículo" },
                valor_fipe: { type: "number", description: "Valor FIPE" },
                regiao: { type: "string", description: "Região" },
                dia_vencimento: { type: "number", description: "Dia do mês para vencimento das mensalidades" },
                planos_calculados: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      plano_id: { type: "string" },
                      nome: { type: "string" },
                      valor_mensal: { type: "number" },
                    },
                  },
                  description: "Lista de planos com valores calculados (uso interno)",
                },
              },
              required: ["nome_cliente", "email_cliente", "valor_fipe", "dia_vencimento"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "salvar_dados_cliente",
            description: "Salva o nome e email do cliente no sistema. CHAME IMEDIATAMENTE após o cliente informar email e nome. NÃO prossiga sem chamar esta ferramenta.",
            parameters: {
              type: "object",
              properties: {
                nome_cliente: { type: "string", description: "Nome completo do cliente" },
                email_cliente: { type: "string", description: "Email do cliente" },
              },
              required: ["nome_cliente", "email_cliente"],
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
    if (historicoFormatado.length > 0) {
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
              if (toolResult.success) {
                const novoEstado = {
                  ...(dadosCotacao || {}),
                  etapa: "aguardando_confirmacao",
                  placa: toolResult.placa,
                  marca: toolResult.marca,
                  modelo: toolResult.modelo,
                  ano: toolResult.ano_modelo,
                  combustivel: toolResult.combustivel,
                  valor_fipe: toolResult.valor_fipe,
                };
                await supabase.from("agente_ia_contatos").update({ dados_cotacao: novoEstado }).eq("id", contato.id);
                dadosCotacao = novoEstado;
                console.log(`[agente-consultor-ia] Estado salvo+sync: aguardando_confirmacao`);
              }
            } else if (fnName === "calcular_cotacao") {
              // Correção 2: Merge ano do estado se a IA não passou
              if (!args.ano && dadosCotacao?.ano) args.ano = dadosCotacao.ano;
              toolResult = await executarCalculoCotacao(supabase, args);
              // Correção 3: Só avança se encontrou planos
              if (toolResult.success && toolResult.planos?.length > 0) {
                const novoEstado = {
                  ...(dadosCotacao || {}),
                  etapa: "aguardando_vencimento",
                  regiao: args.regiao,
                  uso_app: args.uso_app || false,
                  planos_calculados: toolResult.planos,
                };
                await supabase.from("agente_ia_contatos").update({ dados_cotacao: novoEstado }).eq("id", contato.id);
                dadosCotacao = novoEstado;
                console.log(`[agente-consultor-ia] Estado salvo+sync: aguardando_vencimento (${toolResult.planos.length} planos)`);
              } else {
                console.log(`[agente-consultor-ia] Nenhum plano encontrado — NÃO avançando etapa`);
              }
            } else if (fnName === "registrar_cotacao") {
              // Merge args da IA com dadosCotacao persistido para não perder dados
              const mergedArgs = { ...args };
              if (dadosCotacao) {
                if (!mergedArgs.placa && dadosCotacao.placa) mergedArgs.placa = dadosCotacao.placa;
                if (!mergedArgs.marca && dadosCotacao.marca) mergedArgs.marca = dadosCotacao.marca;
                if (!mergedArgs.modelo && dadosCotacao.modelo) mergedArgs.modelo = dadosCotacao.modelo;
                if (!mergedArgs.ano && dadosCotacao.ano) mergedArgs.ano = dadosCotacao.ano;
                if (!mergedArgs.combustivel && dadosCotacao.combustivel) mergedArgs.combustivel = dadosCotacao.combustivel;
                if (!mergedArgs.valor_fipe && dadosCotacao.valor_fipe) mergedArgs.valor_fipe = dadosCotacao.valor_fipe;
                if (!mergedArgs.regiao && dadosCotacao.regiao) mergedArgs.regiao = dadosCotacao.regiao;
                if (!mergedArgs.nome_cliente && dadosCotacao.nome) mergedArgs.nome_cliente = dadosCotacao.nome;
                if (!mergedArgs.email_cliente && dadosCotacao.email) mergedArgs.email_cliente = dadosCotacao.email;
                // CRITICAL FIX: empty array [] is truthy in JS, so check length too
                if ((!mergedArgs.planos_calculados || mergedArgs.planos_calculados.length === 0) && dadosCotacao.planos_calculados?.length > 0) {
                  mergedArgs.planos_calculados = dadosCotacao.planos_calculados;
                  console.log(`[agente-consultor-ia] Planos restaurados do estado: ${dadosCotacao.planos_calculados.length} planos`);
                }
              }
              toolResult = await executarRegistroCotacao(supabase, supabaseUrl, serviceKey, mergedArgs, telLimpo, contato);
              if (toolResult.success) {
                const novoEstado = {
                  ...(dadosCotacao || {}),
                  etapa: "cotacao_enviada",
                  dia_vencimento: mergedArgs.dia_vencimento,
                  email: mergedArgs.email_cliente,
                  nome: mergedArgs.nome_cliente,
                  cotacao_id: toolResult.cotacao_id,
                };
                await supabase.from("agente_ia_contatos").update({ dados_cotacao: novoEstado, status: "cotacao_enviada" }).eq("id", contato.id);
                dadosCotacao = novoEstado;
                console.log(`[agente-consultor-ia] Estado salvo+sync: cotacao_enviada`);
              }
            } else if (fnName === "salvar_dados_cliente") {
              const novoEstado = {
                ...(dadosCotacao || {}),
                etapa: "dados_cliente_coletados",
                email: args.email_cliente,
                nome: args.nome_cliente,
              };
              await supabase.from("agente_ia_contatos").update({ dados_cotacao: novoEstado, nome: args.nome_cliente }).eq("id", contato.id);
              dadosCotacao = novoEstado;
              console.log(`[agente-consultor-ia] Estado salvo: dados_cliente_coletados (nome=${args.nome_cliente}, email=${args.email_cliente})`);
              toolResult = { success: true, instrucao: "Dados do cliente salvos com sucesso. Agora CHAME obter_opcoes_vencimento para oferecer as datas de vencimento disponíveis." };
            } else if (fnName === "obter_opcoes_vencimento") {
              toolResult = executarObterOpcoesVencimento();
              if (toolResult.success) {
                const novoEstado = {
                  ...(dadosCotacao || {}),
                  etapa: "aguardando_vencimento_resposta",
                  opcoes_vencimento: toolResult.opcoes,
                };
                await supabase.from("agente_ia_contatos").update({ dados_cotacao: novoEstado }).eq("id", contato.id);
                dadosCotacao = novoEstado;
                console.log(`[agente-consultor-ia] Estado salvo: aguardando_vencimento_resposta, opcoes=${JSON.stringify(toolResult.opcoes)}`);
              }
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
          if (fnName === "obter_opcoes_vencimento" && toolResult?.success) {
            toolContent = `⚠️ DATAS OFICIAIS DE VENCIMENTO - USE APENAS ESTAS, NÃO INVENTE:\n${toolContent}`;
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
      const { data: cobrancasPagas } = await supabase
        .from("cobrancas")
        .select("valor_pago")
        .eq("status", "pago")
        .gte("data_pagamento", dataInicio);

      const totalReceita = (cobrancasPagas || []).reduce((s: number, c: any) => s + (c.valor_pago || 0), 0);

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

  const vd = data.vehicleData || {};
  const fd = data.fipeData || {};

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
    combustivel: normalizeCombustivel(vd.combustivel || data.combustivel),
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
  const { valor_fipe, marca, modelo, ano, regiao = "rj", uso_app = false } = args;
  const combustivel = normalizeCombustivel(args.combustivel);

  console.log(`[tool:calcular_cotacao] FIPE=${valor_fipe} regiao=${regiao} app=${uso_app} combustivel=${combustivel} (raw=${args.combustivel})`);

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

  const planosDisponiveis = (planos || []).filter((p: any) =>
    p.product_lines?.disponivel_agente === true && p.product_lines?.is_active === true
  );

  const planoIds = planosDisponiveis.map((p: any) => p.id);
  const { data: planosCoberturas } = await supabase
    .from("planos_coberturas")
    .select("plano_id, cobertura_id, coberturas:cobertura_id (nome, valor)")
    .in("plano_id", planoIds);

  const { data: planosBeneficios } = await supabase
    .from("planos_beneficios")
    .select("plano_id, benefit_id, benefits:benefit_id (name, preco_sugerido)")
    .in("plano_id", planoIds);

  // Paginated fetch to handle 7000+ rules (Supabase default limit = 1000)
  let allRules: any[] = [];
  {
    const PAGE_SIZE = 1000;
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const { data: page, error: pageErr } = await supabase
        .from("entity_eligibility_rules")
        .select("*")
        .eq("is_active", true)
        .range(offset, offset + PAGE_SIZE - 1);
      if (pageErr || !page || page.length === 0) {
        hasMore = false;
      } else {
        allRules = allRules.concat(page);
        offset += PAGE_SIZE;
        if (page.length < PAGE_SIZE) hasMore = false;
      }
    }
    console.log(`[tool:calcular_cotacao] Total regras de elegibilidade carregadas: ${allRules.length}`);
  }

  const { data: regioes } = await supabase.from("regioes").select("id, codigo, nome").eq("ativa", true);
  const regiaoSlug = regiao.toLowerCase();
  const regiaoMatch = (regioes || []).find((r: any) =>
    r.codigo?.toLowerCase() === regiaoSlug || r.nome?.toLowerCase().includes(regiaoSlug)
  );

  const { data: configDecomposicao } = await supabase
    .from("configuracoes")
    .select("chave, valor")
    .in("chave", ["decomposicao_mensalidade", "adicional_app"]);

  let adicionalAppValor = 35.90;
  for (const c of configDecomposicao || []) {
    if (c.chave === "adicional_app") adicionalAppValor = parseFloat(c.valor) || 35.90;
  }

  const { data: regioesAppConfig } = await supabase
    .from("configuracoes")
    .select("valor")
    .eq("chave", "regioes_com_adicional_app")
    .maybeSingle();

  let regioesComAdicional: string[] = [];
  try { regioesComAdicional = JSON.parse(regioesAppConfig?.valor || "[]"); } catch { /* */ }

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
    tipoPlaca: undefined as string | undefined, // normal vehicles have no special plate
  };

  const resultados: any[] = [];

  for (const plano of planosDisponiveis) {
    const productLineId = plano.product_line_id;
    const rules = allRules || [];

    const planoRules = rules.filter((r: any) => r.entity_type === "plano" && r.entity_id === plano.id && r.is_active);
    const linhaRules = productLineId
      ? rules.filter((r: any) => r.entity_type === "linha" && r.entity_id === productLineId && r.is_active)
      : [];

    // Correção 1: Alinhar com frontend — separar marca_modelo e ano_range da avaliação da linha
    const planoHasMarcaModelo = planoRules.some((r: any) => r.rule_type === 'marca_modelo');
    const planoHasAnoRange = planoRules.some((r: any) => r.rule_type === 'ano_range');

    // Filtrar regras que serão avaliadas separadamente
    let linhaRulesFiltered = linhaRules.filter((r: any) => {
      if (r.rule_type === 'marca_modelo') return false; // sempre avaliar separadamente
      if (r.rule_type === 'ano_range' && planoHasAnoRange) return false; // sobrescrito pelo plano
      return true;
    });

    // Avaliar regras genéricas da linha (sem marca_modelo)
    if (!checkAllRulesServer(linhaRulesFiltered, vehicleCtx)) {
      continue;
    }

    // Avaliar marca_modelo da linha separadamente (se não sobrescrita pelo plano)
    if (!planoHasMarcaModelo) {
      const linhaMarcaModeloRule = linhaRules.find((r: any) => r.rule_type === 'marca_modelo');
      if (linhaMarcaModeloRule) {
        const match = findModelEligibilityServer(linhaMarcaModeloRule.rule_config, vehicleCtx);
        // null = modelo não listado = aceito (passa pela regra geral de ano)
        // Só bloqueia se explicitamente negado
        if (match && match.status === 'negado') continue;
      }
    }

    // Avaliar regras do plano normalmente
    if (!checkAllRulesServer(planoRules, vehicleCtx)) {
      continue;
    }

    const coberturasDoPlano = (planosCoberturas || []).filter((pc: any) => pc.plano_id === plano.id);
    const beneficiosDoPlano = (planosBeneficios || []).filter((pb: any) => pb.plano_id === plano.id);

    // Determine which rule_types the plan overrides (plan-level rules take precedence over component rules of same type)
    const planoRuleTypes = new Set(planoRules.map((r: any) => r.rule_type));

    // Filter ineligible coverages individually
    const coberturasElegiveis = coberturasDoPlano.filter((pc: any) => {
      const cobId = pc.cobertura_id;
      const cobRules = rules.filter((r: any) => r.entity_type === "cobertura" && r.entity_id === cobId && r.is_active);
      // Remove rules whose type is already overridden by the plan
      const filteredCobRules = cobRules.filter((r: any) => !planoRuleTypes.has(r.rule_type));
      return checkAllRulesServer(filteredCobRules, vehicleCtx);
    });

    // Filter ineligible benefits individually
    const beneficiosElegiveis = beneficiosDoPlano.filter((pb: any) => {
      const benId = pb.benefit_id;
      const benRules = rules.filter((r: any) => r.entity_type === "beneficio" && r.entity_id === benId && r.is_active);
      const filteredBenRules = benRules.filter((r: any) => !planoRuleTypes.has(r.rule_type));
      return checkAllRulesServer(filteredBenRules, vehicleCtx);
    });

    // If all coverages were removed, skip plan
    if (coberturasElegiveis.length === 0 && coberturasDoPlano.length > 0) {
      continue;
    }

    let somaCoberturas = 0;
    for (const pc of coberturasElegiveis) {
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
    for (const pb of beneficiosElegiveis) {
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

    valorMensal += Number(plano.adicional_mensal || 0);
    valorMensal += 5.50;

    if (uso_app) {
      const regiaoTemAdicional = regioesComAdicional.includes(regiaoSlug);
      if (regiaoTemAdicional) {
        valorMensal += adicionalAppValor;
      }
    }

    const desconto = Number(plano.desconto_percentual || 0);
    if (desconto > 0) {
      valorMensal *= (1 - desconto / 100);
    }

    valorMensal = Math.round(valorMensal * 100) / 100;

    // Build names from eligible items only
    const coberturasNomes = coberturasElegiveis
      .map((pc: any) => pc.coberturas?.nome)
      .filter(Boolean);
    const beneficiosNomes = beneficiosElegiveis
      .map((pb: any) => pb.benefits?.name)
      .filter(Boolean);

    resultados.push({
      plano_id: plano.id,
      nome: plano.nome,
      codigo: plano.codigo || null,
      linha: plano.product_lines?.name || plano.linha,
      nivel: plano.nivel || null,
      valor_mensal: valorMensal,
      valor_adesao: 0,
      cobertura_fipe: plano.cobertura_fipe || 100,
      destaque: plano.destaque || false,
      coberturas: [...coberturasNomes, ...beneficiosNomes],
    });
  }

  resultados.sort((a: any, b: any) => a.valor_mensal - b.valor_mensal);

  if (resultados.length === 0) {
    return {
      success: false,
      mensagem: "Não encontramos planos disponíveis para este veículo na região informada. Pode ser que o veículo não se enquadre nos critérios de elegibilidade.",
    };
  }

  return {
    success: true,
    quantidade_planos: resultados.length,
    planos: resultados,
    instrucao: "IMPORTANTE: NÃO mostre valores ao cliente. Prossiga pedindo dia de vencimento, email e nome.",
  };
}

// ============================================================
// TOOL: obter_opcoes_vencimento
// ============================================================
function executarObterOpcoesVencimento() {
  const diaHoje = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getDate();
  let opcoes: [number, number];
  if (diaHoje >= 30 || diaHoje <= 4) opcoes = [5, 10];
  else if (diaHoje <= 9) opcoes = [10, 15];
  else if (diaHoje <= 14) opcoes = [15, 20];
  else if (diaHoje <= 19) opcoes = [20, 25];
  else if (diaHoje <= 24) opcoes = [25, 30];
  else opcoes = [30, 5];
  console.log(`[tool:obter_opcoes_vencimento] diaHoje=${diaHoje} opcoes=${opcoes}`);
  return {
    success: true,
    opcoes,
    mensagem: `Dia ${opcoes[0]} ou dia ${opcoes[1]}`,
    instrucao: `Ofereça APENAS estas duas opções ao cliente: dia ${opcoes[0]} ou dia ${opcoes[1]}. NÃO ofereça nenhuma outra data. NÃO invente outras opções.`,
  };
}

// ============================================================
// TOOL: registrar_cotacao
// ============================================================
async function executarRegistroCotacao(supabase: any, supabaseUrl: string, serviceKey: string, args: any, telLimpo: string, contato: any) {
  const { nome_cliente, email_cliente, placa, marca, modelo, ano, combustivel, valor_fipe, regiao, dia_vencimento, planos_calculados } = args;

  console.log(`[tool:registrar_cotacao] Registrando cotação para ${nome_cliente} - ${placa} - email=${email_cliente} venc=${dia_vencimento}`);

  // Validar dados críticos
  if (!valor_fipe) {
    return { success: false, error: "valor_fipe é obrigatório para registrar cotação. Consulte a placa primeiro." };
  }
  if (!dia_vencimento) {
    return { success: false, error: "dia_vencimento é obrigatório. Use obter_opcoes_vencimento primeiro." };
  }

  const telefoneLead = telLimpo;
  let leadId: string | null = null;

  // Buscar ou criar lead com schema correto
  const { data: leadExistente } = await supabase
    .from("leads")
    .select("id")
    .eq("telefone", telefoneLead)
    .maybeSingle();

  if (leadExistente) {
    leadId = leadExistente.id;
    await supabase.from("leads").update({
      email: email_cliente || undefined,
      nome: nome_cliente || undefined,
      veiculo_marca: marca || undefined,
      veiculo_modelo: modelo || undefined,
      veiculo_ano: ano || undefined,
      veiculo_placa: placa || undefined,
      veiculo_fipe: valor_fipe || undefined,
      etapa: "cotacao_enviada",
    }).eq("id", leadId);
  } else {
    const { data: novoLead } = await supabase
      .from("leads")
      .insert({
        nome: nome_cliente || "Lead via Agente IA",
        telefone: telefoneLead,
        email: email_cliente || null,
        origem: "whatsapp",
        etapa: "cotacao_enviada",
        ativo: true,
        veiculo_marca: marca || null,
        veiculo_modelo: modelo || null,
        veiculo_ano: ano || null,
        veiculo_placa: placa || null,
        veiculo_fipe: valor_fipe || null,
      })
      .select("id")
      .single();
    leadId = novoLead?.id;
  }

  if (!leadId) {
    return { success: false, error: "Erro ao criar lead" };
  }

  // Gerar numero e token_publico para a cotação
  const now = new Date();
  const ts = now.toISOString().replace(/[-T:.Z]/g, "").substring(0, 17);
  const rand = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
  const numero = `COT-${ts}-${rand}`;
  
  const tokenParts: string[] = [];
  for (let i = 0; i < 64; i++) {
    tokenParts.push(Math.floor(Math.random() * 16).toString(16));
  }
  const tokenPublico = tokenParts.join("");

  // Calcular valor_total_mensal do primeiro plano e mapear para formato do frontend
  const primeiroPlano = planos_calculados?.[0];
  const valorMensal = primeiroPlano?.valor_mensal || 0;
  const planoIdPrincipal = primeiroPlano?.plano_id || null;

  // Mapear planos para o formato esperado pelo frontend (planos_comparacao)
  const planosComparacao = (planos_calculados || []).map((p: any) => ({
    id: p.plano_id,
    nome: p.nome,
    codigo: p.codigo || null,
    valorMensal: p.valor_mensal,
    valorAdesao: 0,
    coberturas: p.coberturas || [],
    destaque: p.destaque || false,
    nivel: p.nivel || null,
  }));

  const { data: cotacao, error: cotacaoErr } = await supabase
    .from("cotacoes")
    .insert({
      numero,
      token_publico: tokenPublico,
      lead_id: leadId,
      plano_id: planoIdPrincipal,
      veiculo_marca: marca || null,
      veiculo_modelo: modelo || null,
      veiculo_ano: ano || null,
      veiculo_placa: placa || null,
      veiculo_combustivel: combustivel || null,
      valor_fipe: valor_fipe,
      regiao: regiao || "rj",
      uso_aplicativo: args.uso_app || false,
      valor_cota: valorMensal,
      taxa_administrativa: 0,
      valor_rastreamento: 0,
      valor_adesao: 0,
      valor_adicional: 5.50,
      valor_total_mensal: valorMensal,
      dia_vencimento: dia_vencimento,
      nome_solicitante: nome_cliente || null,
      email_solicitante: email_cliente || null,
      telefone1_solicitante: telefoneLead,
      status: "enviada",
      dados_extras: {
        planos_comparacao: planosComparacao,
        origem: "agente_ia",
        adesao_isenta: true,
        valor_adicional: 5.50,
        dia_vencimento: dia_vencimento,
      },
    })
    .select("id, token_publico")
    .single();

  if (cotacaoErr) {
    console.error("[tool:registrar_cotacao] Erro:", cotacaoErr);
    return { success: false, error: "Erro ao registrar cotação: " + cotacaoErr.message };
  }

  // Atualizar lead com cotacao_id
  await supabase.from("leads").update({ cotacao_id: cotacao.id }).eq("id", leadId);

  // Gerar link público
  const linkCotacao = `https://app.praticcar.org/cotacao/${cotacao.token_publico}`;

  const mensagemLink = `Olá ${nome_cliente || ""}! 😊\n\nSua cotação personalizada de proteção veicular está pronta!\n\n🔗 Acesse aqui: ${linkCotacao}\n\n_PRATICCAR Proteção Veicular - Proteção 360_ 🛡️`;
  await enviarWhatsApp(supabaseUrl, serviceKey, telefoneLead, mensagemLink);

  await new Promise(r => setTimeout(r, 10000));

  const qtdPlanos = planos_calculados?.length || 0;
  const mensagemResumo = `📋 *Resumo da sua cotação:*\n\n` +
    `🚗 Veículo: *${marca || ""} ${modelo || ""} ${ano || ""}*\n` +
    `📍 Região: *${regiao || ""}*\n` +
    `📦 ${qtdPlanos} opção(ões) de plano disponíveis\n` +
    `🎉 Adesão: *ISENTA*\n` +
    `📅 Vencimento: dia *${dia_vencimento || ""}*\n\n` +
    `Estou à disposição para qualquer dúvida! 😊`;
  await enviarWhatsApp(supabaseUrl, serviceKey, telefoneLead, mensagemResumo);

  return {
    success: true,
    cotacao_id: cotacao.id,
    token: cotacao.token_publico,
    link: linkCotacao,
    mensagem: `Cotação registrada e enviada com sucesso! Link: ${linkCotacao}`,
    resumo_enviado: true,
  };
}

// ============================================================
// HELPERS
// ============================================================

// ============================================================
// MOTOR DE ELEGIBILIDADE (port completo do frontend)
// Suporta: rule_mode (include/exclude), todas as rule_types
// ============================================================

interface VehicleContextServer {
  valorFipe: number;
  anoVeiculo: number;
  categoriaVeiculo?: string;
  regiao?: string;
  regiaoId?: string;
  marca?: string;
  modelo?: string;
  versao?: string;
  tipoUso?: string;
  combustivel?: string;
  tipoPlaca?: string;
}

/**
 * Normaliza o combustível vindo da FIPE (ex: "Alcool / Gasolina") para o padrão do sistema.
 */
function normalizeCombustivel(raw: string | undefined | null): string {
  if (!raw) return 'gasolina';
  const lower = raw.toLowerCase().trim();
  
  // Compound fuels → flex
  if ((lower.includes('alcool') || lower.includes('etanol') || lower.includes('álcool')) && lower.includes('gasolina')) return 'flex';
  if (lower.includes('flex')) return 'flex';
  
  // Single fuels
  if (lower.includes('diesel')) return 'diesel';
  if (lower.includes('eletric') || lower.includes('elétric')) return 'eletrico';
  if (lower.includes('hibrid') || lower.includes('híbrid')) return 'hibrido';
  if (lower.includes('gnv') || lower.includes('gás')) return 'gnv';
  if (lower.includes('etanol') || lower.includes('alcool') || lower.includes('álcool')) return 'etanol';
  if (lower.includes('gasolina')) return 'gasolina';
  
  return lower;
}

function findModelEligibilityServer(
  ruleConfig: any,
  ctx: VehicleContextServer
): { status: string; coberturaFipe: number } | null {
  const modelos = ruleConfig?.modelos || [];
  if (!Array.isArray(modelos) || modelos.length === 0) return null;

  for (const entry of modelos) {
    if (typeof entry !== 'object' || !entry.status) continue;

    const ctxMarca = (ctx.marca || '').toUpperCase();
    const entryMarca = (entry.marca || '').toUpperCase();
    const marcaOk = !entryMarca || ctxMarca.includes(entryMarca) || entryMarca.includes(ctxMarca);

    const ctxModelo = (ctx.modelo || '').toUpperCase();
    const entryModelo = (entry.modelo || '').toUpperCase();
    const modeloWildcard = ['TODOS', 'QUALQUER', 'ALL', ''].includes(entryModelo);
    const modeloOk = modeloWildcard || ctxModelo.includes(entryModelo) || entryModelo.includes(ctxModelo);
    if (!marcaOk || !modeloOk) continue;

    if (entry.ano_min != null && ctx.anoVeiculo < entry.ano_min) continue;
    if (entry.ano_max != null && ctx.anoVeiculo > entry.ano_max) continue;

    if (entry.combustivel && entry.combustivel !== 'qualquer') {
      if ((ctx.combustivel || '').toLowerCase() !== entry.combustivel.toLowerCase()) continue;
    }

    return {
      status: entry.status,
      coberturaFipe: entry.cobertura_fipe ?? 100,
    };
  }
  return null;
}

function checkRuleAgainstVehicleServer(rule: any, ctx: VehicleContextServer): boolean {
  const cfg = rule.rule_config || {};
  const isInclude = rule.rule_mode === 'include';

  switch (rule.rule_type) {
    case 'fipe_range':
    case 'fipe_eligibility': {
      const inRange = ctx.valorFipe >= (cfg.min || 0) && ctx.valorFipe <= (cfg.max || Infinity);
      return isInclude ? inRange : !inRange;
    }
    case 'ano_range': {
      const inRange = ctx.anoVeiculo >= (cfg.min || 0) && ctx.anoVeiculo <= (cfg.max || 9999);
      return isInclude ? inRange : !inRange;
    }
    case 'categoria_veiculo': {
      const cats: string[] = cfg.categorias || cfg.values || [];
      if (cats.length === 0) return true;
      const match = !!ctx.categoriaVeiculo && cats.some((c: string) => c.toLowerCase() === ctx.categoriaVeiculo!.toLowerCase());
      return isInclude ? match : !match;
    }
    case 'regiao': {
      const regioes: string[] = cfg.regioes || cfg.values || [];
      if (regioes.length === 0) return true;
      const matchById = !!ctx.regiaoId && regioes.some((r: string) => r === ctx.regiaoId);
      const matchBySlug = !!ctx.regiao && regioes.some((r: string) => r.toLowerCase() === ctx.regiao!.toLowerCase());
      const match = matchById || matchBySlug;
      return isInclude ? match : !match;
    }
    case 'marca_modelo': {
      const modelosArr = cfg.modelos || [];
      if (modelosArr.length > 0 && typeof modelosArr[0] === 'object' && 'status' in modelosArr[0]) {
        const match = findModelEligibilityServer(cfg, ctx);
        if (!match) return !isInclude;
        if (match.status === 'negado') return false;
        return true;
      }
      const marcaMatch = !cfg.marca || (ctx.marca || '').toUpperCase().includes(cfg.marca.toUpperCase());
      const legacyModelos: string[] = modelosArr;
      let modeloMatch: boolean;
      if (legacyModelos.length > 0) {
        modeloMatch = legacyModelos.some((m: string) => (ctx.modelo || '').toUpperCase().includes(m.toUpperCase()));
      } else {
        modeloMatch = !cfg.modelo || (ctx.modelo || '').toUpperCase().includes(cfg.modelo.toUpperCase());
      }
      const versaoMatch = !cfg.versao || (ctx.versao || '').toUpperCase().includes(cfg.versao.toUpperCase());
      const match2 = marcaMatch && (legacyModelos.length > 0 ? modeloMatch : (modeloMatch && versaoMatch));
      return isInclude ? match2 : !match2;
    }
    case 'tipo_uso': {
      const tipos: string[] = cfg.tipos || cfg.values || [];
      if (tipos.length === 0) return true;
      const match = !!ctx.tipoUso && tipos.some((t: string) => t.toLowerCase() === ctx.tipoUso!.toLowerCase());
      return isInclude ? match : !match;
    }
    case 'combustivel': {
      const combs: string[] = cfg.combustiveis || cfg.values || [];
      if (combs.length === 0) return true;
      const match = !!ctx.combustivel && combs.some((c: string) => c.toLowerCase() === ctx.combustivel!.toLowerCase());
      return isInclude ? match : !match;
    }
    case 'tipo_placa': {
      const placas: string[] = cfg.tipos || cfg.values || cfg.categorias || [];
      if (placas.length === 0) return true;
      if (!ctx.tipoPlaca) return isInclude ? false : true;
      const match = placas.some((p: string) => p.toLowerCase() === ctx.tipoPlaca!.toLowerCase());
      return isInclude ? match : !match;
    }
    default:
      return true;
  }
}

function checkAllRulesServer(rules: any[], ctx: VehicleContextServer): boolean {
  const activeRules = rules.filter((r: any) => r.is_active);
  if (activeRules.length === 0) return true;
  return activeRules.every((r: any) => checkRuleAgainstVehicleServer(r, ctx));
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
