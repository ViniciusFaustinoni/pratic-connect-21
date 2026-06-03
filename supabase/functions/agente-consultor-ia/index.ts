import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { aiGatewayFetch } from "../_shared/ai-client.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Cache de configuração editorial da Maya (60s) — evita 1 query/mensagem.
 * Tabelas: maya_ia_comportamento (por audiência), maya_ia_faq (base de conhecimento).
 * Editável pelo time de Relacionamento em /relacionamento/maya-ia.
 */
type MayaEditorialCfg = {
  nome_agente?: string;
  persona?: string;
  regras_absolutas?: string;
  tom_voz?: string;
  saudacao_inicial?: string;
  faqText?: string;        // bloco completo (todas as FAQs da audiência)
  faqDestaqueText?: string; // bloco com FAQs que casaram com a mensagem atual
  faqMatchedIds?: string[]; // ids destacados (telemetria)
};
type MayaRawCfg = { comp: any; faqs: any[] };
const MAYA_RAW_CACHE = new Map<string, { at: number; data: MayaRawCfg }>();
const MAYA_CFG_TTL_MS = 60_000;

const PT_STOPWORDS = new Set([
  "a","o","as","os","de","da","do","das","dos","e","ou","um","uma","uns","umas","para","por","pra","pro","com","sem",
  "que","se","na","no","nas","nos","em","ao","aos","à","às","mais","menos","muito","muita","pouco","pouca","ja","já",
  "ser","ter","estar","sao","são","foi","era","sera","será","ter","estou","estamos","estao","estão","vai","vou","vamos",
  "voce","você","vcs","voces","vocês","eu","tu","ele","ela","nos","nós","eles","elas","meu","minha","seu","sua","teu","tua",
  "isso","isto","aquilo","esse","essa","este","esta","aquele","aquela","aqui","ali","la","lá","quando","onde","como","porque",
  "qual","quais","quem","entao","então","ainda","tambem","também","todos","todas","cada","outro","outra","outros","outras",
  "bom","boa","oi","ola","olá","obrigado","obrigada","obg","sim","nao","não","tem","ter","ja","já","preciso","quero","queria",
]);

function normalizarParaMatch(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizarParaMatch(s: string): Set<string> {
  const norm = normalizarParaMatch(s);
  const tokens = new Set<string>();
  for (const t of norm.split(" ")) {
    if (t.length >= 3 && !PT_STOPWORDS.has(t)) tokens.add(t);
  }
  return tokens;
}

function pontuarFaq(mensagemTokens: Set<string>, mensagemNorm: string, faq: any): number {
  let score = 0;
  // 1) Match exato de palavras-chave configuradas (peso alto)
  const palavrasChave: string[] = Array.isArray(faq.palavras_chave) ? faq.palavras_chave : [];
  for (const kw of palavrasChave) {
    const kwNorm = normalizarParaMatch(String(kw));
    if (!kwNorm) continue;
    if (mensagemNorm.includes(kwNorm)) score += 5;
  }
  // 2) Overlap de tokens com pergunta/resposta (peso menor)
  const faqTokens = tokenizarParaMatch(`${faq.pergunta || ""} ${faq.resposta || ""}`);
  for (const t of mensagemTokens) {
    if (faqTokens.has(t)) score += 1;
  }
  return score;
}

async function loadMayaEditorialConfig(
  supabase: any,
  audiencia: string,
  mensagemAtual?: string,
): Promise<MayaEditorialCfg | null> {
  const hit = MAYA_RAW_CACHE.get(audiencia);
  let raw: MayaRawCfg;
  if (hit && Date.now() - hit.at < MAYA_CFG_TTL_MS) {
    raw = hit.data;
  } else {
    const [{ data: comp }, { data: faqs }] = await Promise.all([
      supabase.from("maya_ia_comportamento").select("*").eq("audiencia", audiencia).maybeSingle(),
      supabase.from("maya_ia_faq").select("id,categoria,pergunta,resposta,palavras_chave,audiencias,ordem").eq("ativo", true).order("ordem", { ascending: true }),
    ]);
    raw = { comp: comp || null, faqs: (faqs || []) };
    MAYA_RAW_CACHE.set(audiencia, { at: Date.now(), data: raw });
  }

  const faqsFiltrados = (raw.faqs || []).filter((f: any) => Array.isArray(f.audiencias) && f.audiencias.includes(audiencia));

  // Bloco completo (mesmo formato anterior)
  let faqText = "";
  if (faqsFiltrados.length > 0) {
    const porCategoria = new Map<string, any[]>();
    for (const f of faqsFiltrados) {
      const k = f.categoria || "geral";
      if (!porCategoria.has(k)) porCategoria.set(k, []);
      porCategoria.get(k)!.push(f);
    }
    const partes: string[] = [];
    for (const [cat, items] of porCategoria) {
      partes.push(`### ${cat.toUpperCase()}`);
      for (const it of items) {
        const kw = Array.isArray(it.palavras_chave) && it.palavras_chave.length ? ` _(palavras-chave: ${it.palavras_chave.join(", ")})_` : "";
        partes.push(`- *${it.pergunta}*${kw}\n  ${it.resposta}`);
      }
    }
    faqText = partes.join("\n");
  }

  // Retrieval: FAQs em destaque para a mensagem atual
  let faqDestaqueText = "";
  let faqMatchedIds: string[] = [];
  if (mensagemAtual && faqsFiltrados.length > 0) {
    const msgNorm = normalizarParaMatch(mensagemAtual);
    const msgTokens = tokenizarParaMatch(mensagemAtual);
    if (msgNorm.length > 0 && (msgTokens.size > 0 || msgNorm.length >= 3)) {
      const pontuadas = faqsFiltrados
        .map((f: any) => ({ f, score: pontuarFaq(msgTokens, msgNorm, f) }))
        .filter((x: any) => x.score >= 3) // limiar mínimo p/ evitar ruído
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 3);
      if (pontuadas.length > 0) {
        faqMatchedIds = pontuadas.map((x: any) => x.f.id).filter(Boolean);
        const partes: string[] = [];
        for (const { f } of pontuadas) {
          partes.push(`- *${f.pergunta}*\n  ${f.resposta}`);
        }
        faqDestaqueText = partes.join("\n");
      }
    }
  }

  const data: MayaEditorialCfg | null = (raw.comp || faqText)
    ? {
        nome_agente: raw.comp?.nome_agente || undefined,
        persona: raw.comp?.persona || undefined,
        regras_absolutas: raw.comp?.regras_absolutas || undefined,
        tom_voz: raw.comp?.tom_voz || undefined,
        saudacao_inicial: raw.comp?.saudacao_inicial || undefined,
        faqText: faqText || undefined,
        faqDestaqueText: faqDestaqueText || undefined,
        faqMatchedIds: faqMatchedIds.length ? faqMatchedIds : undefined,
      }
    : null;
  return data;
}

// Helper compartilhado: gera notificação interna quando a Maya recebe mensagem
// estando pausada/em atendimento humano. Dedup por janela de 1h em criado_por=null.
async function notificarRelacionamentoMensagemPausada(
  supabase: any,
  telefone: string,
  nomeContato: string | null,
  motivo: "atendimento_humano" | "pausa_ativa",
  textoMensagem?: string,
) {
  try {
    const dedupeKey = `maya_pausada:${motivo}:${telefone}`;
    const desde = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: existente } = await supabase
      .from("notificacoes_sistema")
      .select("id")
      .eq("destino", "role")
      .eq("destino_role", "relacionamento")
      .eq("tipo", "maya_mensagem_pausada")
      .eq("link", dedupeKey)
      .gte("created_at", desde)
      .limit(1)
      .maybeSingle();
    if (existente) return;

    const titulo = motivo === "atendimento_humano"
      ? "Maya recebeu mensagem em conversa pausada"
      : "Maya recebeu mensagem em conversa pausada (transbordo ativo)";
    const trecho = (textoMensagem || "").trim().slice(0, 140);
    const corpo = `Contato ${nomeContato || telefone} mandou nova mensagem, mas a Maya está em pausa. Abra o chat e responda ou conclua o atendimento.${trecho ? `\n\n"${trecho}"` : ""}`;

    await supabase.from("notificacoes_sistema").insert({
      titulo,
      mensagem: corpo,
      tipo: "maya_mensagem_pausada",
      destino: "role",
      destino_role: "relacionamento",
      link: dedupeKey,
      ativo: true,
      expira_em: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    });
  } catch (e) {
    console.warn("[agente-consultor-ia] Falha ao notificar Relacionamento sobre mensagem pausada:", (e as any)?.message);
  }
}

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
    const { telefone, texto, tipo_msg, latitude, longitude, nome_contato } = await req.json();

    if (!telefone) {
      return new Response(
        JSON.stringify({ success: false, error: "telefone obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const telLimpo = telefone.replace(/\D/g, "");
    console.log(`[agente-consultor-ia] Mensagem de ${telLimpo}: ${texto?.substring(0, 80)}`);

    // ---- 0. LOCK ANTI-DUPLICIDADE ----
    // Impede que duas invocações concorrentes (webhook real + processar-fila-ia,
    // ou dois ciclos de cron) processem a MESMA mensagem e gerem 2 respostas.
    // Janela de 30s — se a mesma mensagem chegar em janelas separadas, ambas passam.
    try {
      const textoNorm = String(texto || "").trim().toLowerCase().slice(0, 500);
      const bucket = Math.floor(Date.now() / 30_000);
      const hashInput = `${textoNorm}|${bucket}`;
      // SHA-256 nativo do Deno
      const encoder = new TextEncoder();
      const hashBuf = await crypto.subtle.digest("SHA-256", encoder.encode(hashInput));
      const mensagemHash = Array.from(new Uint8Array(hashBuf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const { error: lockErr } = await supabase
        .from("agente_ia_locks")
        .insert({
          telefone: telLimpo,
          mensagem_hash: mensagemHash,
          origem: "agente-consultor-ia",
        });

      if (lockErr) {
        // 23505 = duplicate primary key → outra invocação já está processando
        const isDuplicate = String(lockErr.code || "") === "23505"
          || String(lockErr.message || "").toLowerCase().includes("duplicate");
        if (isDuplicate) {
          console.log(`[agente-consultor-ia] LOCK COLIDIU — ignorando duplicata (tel=${telLimpo}, hash=${mensagemHash.slice(0, 12)}…)`);
          return new Response(
            JSON.stringify({ success: true, ignored: "duplicate_inflight" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        // Erro real (RLS, conexão) — não bloqueia o fluxo, só loga
        console.warn(`[agente-consultor-ia] Lock falhou (seguindo sem dedupe):`, lockErr.message);
      }
    } catch (e: any) {
      console.warn(`[agente-consultor-ia] Lock catch (seguindo):`, e?.message);
    }


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

    // ---- 1B. RESOLVER NOME DO CONTATO (fallback p/ não tratar como "cliente") ----
    if (contato && !contato.nome) {
      let nomeResolvido: string | null = null;

      // 1) pushName / nome do Chatwoot vindo do caller
      if (nome_contato && typeof nome_contato === "string") {
        const limpo = nome_contato.trim();
        if (limpo && limpo.toLowerCase() !== "contato whatsapp" && limpo.toLowerCase() !== "desconhecido") {
          nomeResolvido = limpo;
        }
      }

      // 2) lead existente
      if (!nomeResolvido) {
        const { data: leadMatch } = await supabase
          .from("leads")
          .select("nome")
          .eq("telefone", telLimpo)
          .not("nome", "is", null)
          .limit(1)
          .maybeSingle();
        if (leadMatch?.nome) nomeResolvido = leadMatch.nome;
      }

      // 3) última mensagem de entrada com nome_contato (caminho Chatwoot → fila)
      if (!nomeResolvido) {
        const { data: msgMatch } = await supabase
          .from("whatsapp_mensagens")
          .select("nome_contato")
          .eq("telefone", telLimpo)
          .eq("direcao", "entrada")
          .not("nome_contato", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (msgMatch?.nome_contato) {
          const limpo = msgMatch.nome_contato.trim();
          if (limpo && limpo.toLowerCase() !== "contato whatsapp" && limpo.toLowerCase() !== "desconhecido") {
            nomeResolvido = limpo;
          }
        }
      }

      if (nomeResolvido) {
        await supabase
          .from("agente_ia_contatos")
          .update({ nome: nomeResolvido })
          .eq("id", contato.id);
        contato.nome = nomeResolvido;
        console.log(`[agente-consultor-ia] Nome do contato resolvido: ${nomeResolvido} (tel: ${telLimpo})`);
      }
    }

    // ---- 2. VERIFICAR ATENDIMENTO HUMANO / PAUSA ATIVA ----
    // Em vez de silenciar invisivelmente, sinalizamos ao Relacionamento
    // (notificação interna dedupada) que a Maya recebeu mensagem enquanto
    // a conversa estava sob humano. O cliente continua sem auto-resposta,
    // mas o operador passa a saber que precisa olhar o chat.
    if (contato?.status === "atendimento_humano") {
      console.log(`[agente-consultor-ia] Contato em atendimento humano, ignorando (com notificação interna): ${telLimpo}`);
      await notificarRelacionamentoMensagemPausada(supabase, telLimpo, contato?.nome || null, "atendimento_humano", texto);
      return new Response(
        JSON.stringify({ success: true, ignored: "atendimento_humano", notificou_relacionamento: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Pausa ativa em whatsapp_ia_pausas (transbordo humano por 12h, etc.)
    try {
      const telVariantesPausa = [telLimpo];
      if (telLimpo.startsWith("55") && telLimpo.length >= 12) telVariantesPausa.push(telLimpo.substring(2));
      if (!telLimpo.startsWith("55") && telLimpo.length >= 10) telVariantesPausa.push("55" + telLimpo);
      const { data: pausaAtiva } = await supabase
        .from("whatsapp_ia_pausas")
        .select("id, motivo, pausada_ate, encerrada_em")
        .in("telefone", telVariantesPausa)
        .is("encerrada_em", null)
        .gt("pausada_ate", new Date().toISOString())
        .order("pausada_ate", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (pausaAtiva?.id) {
        console.log(`[agente-consultor-ia] Pausa ativa (motivo=${pausaAtiva.motivo}, até=${pausaAtiva.pausada_ate}) — ignorando com notificação: ${telLimpo}`);
        await notificarRelacionamentoMensagemPausada(supabase, telLimpo, contato?.nome || null, "pausa_ativa", texto);
        return new Response(
          JSON.stringify({ success: true, ignored: "pausa_ativa", motivo_pausa: pausaAtiva.motivo, notificou_relacionamento: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (e) {
      console.warn("[agente-consultor-ia] Falha ao checar pausa ativa (seguindo):", (e as any)?.message);
    }


    // ---- 2B. GATE DE CPF (skip diretores) ----
    // A IA não conversa/vende nada até o usuário informar um CPF válido.
    // Após captura, consulta SGA e injeta o contexto no prompt via cpfSgaContexto.
    let cpfSgaContexto: { encontrado: boolean; nome?: string; status?: string; cpfMascarado: string } | null = null;
    let sgaAssociadoOverride: { nome: string; status: string } | null = null;

    // Pré-detecta diretor por telefone (mesma lógica do bloco 4, antecipada aqui)
    let diretorPreDetectado = false;
    {
      const telVariantesPre = [telLimpo];
      if (telLimpo.startsWith("55") && telLimpo.length >= 12) telVariantesPre.push(telLimpo.substring(2));
      if (!telLimpo.startsWith("55")) telVariantesPre.push("55" + telLimpo);
      const orFilterPre = telVariantesPre.flatMap(t => [`telefone.eq.${t}`, `whatsapp.eq.${t}`]).join(",");
      const { data: profilePre } = await supabase
        .from("profiles")
        .select("user_id")
        .or(orFilterPre)
        .limit(1)
        .maybeSingle();
      if (profilePre?.user_id) {
        const { data: roleRow } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", profilePre.user_id)
          .eq("role", "diretor")
          .maybeSingle();
        diretorPreDetectado = !!roleRow;
      }
    }

    if (!diretorPreDetectado && !contato.cpf) {
      const validateCpf = (raw: string): boolean => {
        const c = raw.replace(/\D/g, "");
        if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
        let sum = 0;
        for (let i = 0; i < 9; i++) sum += parseInt(c[i]) * (10 - i);
        let d1 = (sum * 10) % 11;
        if (d1 === 10) d1 = 0;
        if (d1 !== parseInt(c[9])) return false;
        sum = 0;
        for (let i = 0; i < 10; i++) sum += parseInt(c[i]) * (11 - i);
        let d2 = (sum * 10) % 11;
        if (d2 === 10) d2 = 0;
        return d2 === parseInt(c[10]);
      };

      const enviarTexto = async (msg: string) => {
        try {
          await fetch(`${supabaseUrl}/functions/v1/whatsapp-send-text`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
            body: JSON.stringify({ telefone: telLimpo, mensagem: msg, allow_text: true }),
          });
        } catch (e) {
          console.error(`[agente-consultor-ia] Falha ao enviar mensagem de gate CPF:`, (e as any)?.message);
        }
      };

      // Extrai possível CPF da mensagem (aceita pontuação)
      const textoEntrada = (texto || "").toString();
      const apenasDigitos = textoEntrada.replace(/\D/g, "");
      const matchFormatado = textoEntrada.match(/(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/);
      let cpfCandidato: string | null = null;
      if (matchFormatado) cpfCandidato = matchFormatado[1];
      else if (apenasDigitos.length === 11) cpfCandidato = apenasDigitos;
      else if (apenasDigitos.length > 11 && apenasDigitos.length <= 14) {
        cpfCandidato = apenasDigitos.slice(-11);
      }

      if (cpfCandidato && validateCpf(cpfCandidato)) {
        const cpfLimpo = cpfCandidato.replace(/\D/g, "");
        const cpfMascarado = `${cpfLimpo.slice(0, 3)}.***.***-${cpfLimpo.slice(9)}`;

        // Consulta SGA (não-bloqueante: se falhar, segue como "não encontrado")
        let sgaResp: any = null;
        try {
          const r = await fetch(`${supabaseUrl}/functions/v1/sga-buscar-associado-completo`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
            body: JSON.stringify({ cpf: cpfLimpo }),
            signal: AbortSignal.timeout(20000),
          });
          if (r.ok) sgaResp = await r.json();
          else console.warn(`[agente-consultor-ia] SGA lookup HTTP ${r.status}`);
        } catch (e) {
          console.warn(`[agente-consultor-ia] SGA lookup falhou:`, (e as any)?.message);
        }

        const encontrado = !!sgaResp?.encontrado && !!sgaResp?.associado;
        const nomeSga = sgaResp?.associado?.nome || null;
        const statusSga = sgaResp?.associado?.situacao || sgaResp?.associado?.status || "";

        await supabase
          .from("agente_ia_contatos")
          .update({
            cpf: cpfLimpo,
            cpf_capturado_em: new Date().toISOString(),
            sga_associado_encontrado: encontrado,
            cpf_tentativas_invalidas: 0,
            ...(nomeSga ? { nome: nomeSga } : {}),
          })
          .eq("id", contato.id);

        contato.cpf = cpfLimpo;
        if (nomeSga) contato.nome = nomeSga;

        cpfSgaContexto = {
          encontrado,
          nome: nomeSga || undefined,
          status: statusSga || undefined,
          cpfMascarado,
        };
        if (encontrado && nomeSga) {
          sgaAssociadoOverride = { nome: nomeSga, status: String(statusSga || "") };
        }
        console.log(`[agente-consultor-ia] CPF capturado (${cpfMascarado}) — SGA encontrado=${encontrado}`);
        // Segue o fluxo normal abaixo; prompts vão receber o contexto.
      } else {
        // === GARANTIA-DE-RESPOSTA (Maya nunca deixa vácuo) ===
        // Caso A: cliente mandou número que parece CPF mas não validou (ex.: 10/12 dígitos, dígitos verificadores errados)
        // Caso B: cliente mandou só dígitos curtos (6–10) — também trata como tentativa de CPF
        // Caso C: cliente mandou texto livre sem nenhum dígito relevante
        const pareceTentativaDeCpf =
          !!cpfCandidato ||
          (apenasDigitos.length >= 6 && apenasDigitos.length <= 14);

        const tentativasAtuais = Number((contato as any).cpf_tentativas_invalidas || 0);

        if (pareceTentativaDeCpf) {
          const novasTentativas = tentativasAtuais + 1;
          await supabase
            .from("agente_ia_contatos")
            .update({ cpf_tentativas_invalidas: novasTentativas })
            .eq("id", contato.id);

          if (novasTentativas >= 3) {
            // Escalada: oferta explícita de transbordo humano
            await enviarTexto(
              "Notei que estamos tendo dificuldade com o CPF 🤔\n\n" +
              "Se preferir, posso transferir agora para um atendente humano — é só responder *atendente*.\n" +
              "Ou, se quiser tentar mais uma vez: me envie o CPF *só com números* (11 dígitos)."
            );
          } else {
            await enviarTexto(
              "Recebi os números, mas não formam um CPF válido (precisa ter *11 dígitos*). " +
              "Pode conferir e me enviar de novo? 😉\n\n" +
              "_Se preferir falar com um atendente humano, é só responder *atendente*._"
            );
          }
          return new Response(
            JSON.stringify({ success: true, gate: "cpf_invalido", tentativas: novasTentativas }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Caso C — texto livre sem indício de CPF: NUNCA fica em silêncio
        const ultimaSolicitacao = contato.cpf_solicitado_em ? new Date(contato.cpf_solicitado_em) : null;
        const podeReenviarSaudacao =
          !ultimaSolicitacao || (Date.now() - ultimaSolicitacao.getTime()) > 10 * 60_000;

        if (podeReenviarSaudacao) {
          await enviarTexto(
            "Olá! Tudo bem? Para iniciarmos o seu atendimento e localizarmos seu cadastro, por gentileza, informe o seu CPF (só números, 11 dígitos). 😁"
          );
          await supabase
            .from("agente_ia_contatos")
            .update({ cpf_solicitado_em: new Date().toISOString() })
            .eq("id", contato.id);
        } else {
          // Saudação debounced — mas NÃO ficamos em silêncio: mandamos mensagem de continuidade
          // (com debounce próprio de 2 min para não floodar caso o cliente mande várias mensagens seguidas)
          const ultimaContinuidade = (contato as any).ultima_msg_continuidade_em
            ? new Date((contato as any).ultima_msg_continuidade_em)
            : null;
          const podeReenviarContinuidade =
            !ultimaContinuidade || (Date.now() - ultimaContinuidade.getTime()) > 2 * 60_000;

          if (podeReenviarContinuidade) {
            await enviarTexto(
              "Entendi! 🙂 Para eu seguir e te ajudar, primeiro preciso do seu *CPF* (só números, 11 dígitos) — assim localizo seu cadastro.\n\n" +
              "_Se preferir falar com um atendente humano, é só responder *atendente*._"
            );
            await supabase
              .from("agente_ia_contatos")
              .update({ ultima_msg_continuidade_em: new Date().toISOString() })
              .eq("id", contato.id);
            console.log(`[agente-consultor-ia] Gate CPF: enviei mensagem de continuidade (debounce saudação ativo)`);
          } else {
            console.log(`[agente-consultor-ia] Gate CPF: continuidade também em debounce (2min) — cliente em flood`);
          }
        }
        return new Response(
          JSON.stringify({ success: true, gate: "aguardando_cpf" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }


    // ---- 3. CARREGAR CONFIGURAÇÕES ----
    const { data: configRows } = await supabase
      .from("agente_ia_config")
      .select("chave, valor");

    const config: Record<string, string> = {};
    for (const row of configRows || []) {
      config[row.chave] = row.valor;
    }

    // ---- KILL SWITCH GLOBAL ----
    // Se o agente estiver desativado via Configurações > Agente Consultor IA,
    // não responde nada (mensagem fica registrada, humano pode assumir manualmente).
    if (config.agente_ativo === "false") {
      console.log(`[agente-consultor-ia] Agente DESATIVADO globalmente. Ignorando mensagem de ${telLimpo}`);
      return new Response(
        JSON.stringify({ success: true, ignored: "agente_desativado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

      // Override: se SGA bateu o CPF (telefone pode estar fora do cadastro),
      // ainda assim trata como associado.
      if (!isAssociado && sgaAssociadoOverride) {
        isAssociado = true;
        associadoNome = sgaAssociadoOverride.nome;
        associadoStatus = sgaAssociadoOverride.status;
        console.log(`[agente-consultor-ia] Associado via SGA (CPF): ${associadoNome}`);
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

    // ---- 6C. CONTEXTO DE COBRANÇA RECENTE (últimas 48h via template CSV Meta) ----
    let cobrancaContextoTxt = "";
    try {
      const limite48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data: cobrMsgs } = await supabase
        .from("whatsapp_mensagens")
        .select("created_at, template_variaveis, mensagem")
        .or(telefonesBusca.map((t) => `telefone.eq.${t}`).join(","))
        .eq("referencia_tipo", "cobranca_csv")
        .gte("created_at", limite48h)
        .order("created_at", { ascending: false })
        .limit(1);
      const ultima = (cobrMsgs || [])[0];
      if (ultima) {
        const tv: any = ultima.template_variaveis || {};
        const matricula = tv.matricula || null;
        const boletosTV: any[] = Array.isArray(tv.boletos) ? tv.boletos : [];
        let linhasBoletos = boletosTV
          .map((b: any) => `- Placa ${b.placa || "?"} | venc ${b.vencimento || "?"} | R$ ${b.valor ?? "?"} | linha digitável ${String(b.linha_digitavel || "").replace(/\D/g, "")}`)
          .join("\n");
        const dataEnvio = new Date(ultima.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
        cobrancaContextoTxt = `\n\n## CONTEXTO DE COBRANÇA RECENTE\nUm template de cobrança foi enviado a este contato em ${dataEnvio} (matrícula ${matricula || "?"}). O conteúdo enviado já consta no histórico.\n${linhasBoletos ? `Boletos referenciados:\n${linhasBoletos}\n` : ""}Use estes dados como verdade ao responder dúvidas sobre valores, datas, placas e linhas digitáveis. Não invente boletos. Se o associado disser que pagou, peça comprovante e oriente o atendimento humano.`;
        console.log(`[agente-consultor-ia] Contexto de cobrança recente injetado (matrícula ${matricula})`);
      }
    } catch (e) {
      console.error("[agente-consultor-ia] Falha ao montar contexto de cobrança:", (e as any)?.message);
    }


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
Resolver dúvidas operacionais simples sozinho(a) e transbordar para a equipe humana sempre que o pedido envolver retorno, decisão, reclamação ou prazo.

## REGRAS ABSOLUTAS
- NUNCA tente vender planos ou fazer cotação para associados.
- NUNCA ofereça produtos ou promoções.
- NUNCA execute ferramentas de cotação.
- NUNCA invente valores, datas, placas, linhas digitáveis ou códigos de barras. Esses dados só podem vir da tool *consultar_boletos_associado*.
- **PROIBIDO escrever frases como** "vou solicitar à equipe", "vou reforçar com o Relacionamento", "já abri um chamado", "já avisei o time", "vou pedir prioridade", "fiz a solicitação", "vou pedir para te ligarem". Se você não chamou a tool *solicitar_atendente_humano* nesta mesma rodada, ESSAS FRASES SÃO MENTIRA — não use.
- Seja cordial, curto e direto.

## QUANDO CHAMAR A TOOL consultar_boletos_associado (OBRIGATÓRIO)
Chame SEMPRE que o associado pedir:
- "boleto", "meu boleto", "segunda via", "2ª via", "2via", "linha digitável", "código de barras", "PIX da fatura".
- "quanto eu devo", "qual o valor", "minha fatura", "minha mensalidade", "vencimento".
- Qualquer pergunta sobre status de pagamento (em aberto, vencido, em dia).

A tool não precisa de parâmetros — o sistema usa o CPF do contato.

Após a tool responder:
- Se \`encontrados > 0\`, formate cada boleto (linha em branco entre eles):
  *Boleto* — R$ {valor}
  Vencimento: {dd/mm/aaaa} ({status})
  Placa: {placa}
  Linha digitável: \`{linha_digitavel}\`
- Se \`encontrados = 0\` e sem erro: "Você está em dia, *${associadoNome}*! Não encontrei boletos em aberto. 👍"
- Se \`erro_transitorio: true\`: chame *solicitar_atendente_humano* (motivo='duvida_complexa', resumo='SGA fora — cliente pediu boleto').
- Se o cliente disser que pagou um boleto que aparece em aberto, ou questionar valor/data: chame *solicitar_atendente_humano* (motivo='reclamacao').

## REGRA DE ORDEM (LEIA ANTES DE QUALQUER COISA)
1. PRIMEIRO procure a resposta na BASE DE CONHECIMENTO (FAQ) abaixo. Se a FAQ cobre o pedido, responda direto com a FAQ — NÃO chame solicitar_atendente_humano.
2. SÓ chame solicitar_atendente_humano quando a FAQ não cobrir E o caso bater EXATAMENTE numa das hipóteses listadas abaixo.

## QUANDO **NÃO** TRANSBORDAR (resolva sozinha pela FAQ — é a regra padrão)
- **Assistência veicular operacional**: reboque, guincho, pane (mecânica/elétrica/combustível), socorro mútuo, chaveiro, bateria, pneu furado, troca de pneu, carro/moto não pega, sem combustível, chave trancada. Esses pedidos são SEMPRE resolvidos enviando os canais da FAQ de Assistência 24h (0800 + WhatsApp da Assistência). NUNCA chame solicitar_atendente_humano para esses casos. NUNCA classifique reboque/guincho/pane como motivo='sinistro_emergencia' — não é sinistro, é assistência operacional.
- Só transborde se o cliente, DEPOIS de receber os canais da Assistência 24h, escrever de novo dizendo explicitamente que quer falar com pessoa do Relacionamento (não com a Assistência).
- Qualquer pergunta coberta pela FAQ: responda direto.

## QUANDO CHAMAR A TOOL solicitar_atendente_humano (lista FECHADA)
Chame APENAS quando o associado:
- Pedir retorno, ligação, posicionamento ou disser "ainda sem retorno", "ninguém me ligou", "preciso de um retorno", "quero falar com alguém do Relacionamento".
- Pedir explicitamente para falar com pessoa, atendente, humano, consultor, gerente.
- Reclamar de status "em análise", demora, fatura travada, plano que não ativa.
- Mencionar **sinistro real** — e sinistro real é EXCLUSIVAMENTE: acidente, batida, colisão, capotamento, roubo, furto, incêndio, alagamento, vandalismo. Use motivo='sinistro_emergencia', prioridade='alta'. ANTES de chamar a tool, envie na mesma rodada os canais da FAQ de Assistência 24h (0800 + WhatsApp) — o cliente precisa do número AGORA. **Reboque/guincho/pane NÃO é sinistro real** — vai pela regra de assistência operacional acima.
- Repetir a mesma queixa numa segunda mensagem (não importa se você já respondeu antes), EXCETO quando a 2ª mensagem é só repetir um pedido de assistência operacional que você já respondeu com os canais — nesse caso reenvie os canais e pergunte se precisa de algo mais; ainda não transborda.
- Qualquer pedido que exija decisão humana, alteração de cadastro, cancelamento, negociação.

Ao chamar a tool, escreva no parâmetro \`resumo\` (1 frase) o que o associado quer.

## O QUE VOCÊ PODE RESPONDER SOZINHO
- Boletos/2ª via — depois de chamar *consultar_boletos_associado*.
- Horário de funcionamento da central.
- Número de telefone da central: *${numeroAtendimento}*.
- Explicar em alto nível o que é a PRATICCAR.
- Tudo que estiver na BASE DE CONHECIMENTO (FAQ) injetada abaixo (assistência 24h, canais, dúvidas frequentes).

Se a pergunta passar disso E não estiver na FAQ, chame *solicitar_atendente_humano*.

## SAUDAÇÃO INICIAL
Se for a primeira mensagem do dia e o associado não trouxer pedido específico:
"Olá, ${associadoNome}! 👋 Sou ${nomeAgente} da PRATICCAR. Como posso te ajudar hoje?"

## FORMATAÇÃO
- Use formatação WhatsApp: *negrito*, _itálico_.
- NUNCA use Markdown: **duplo**, ## títulos.
- Respostas curtas (no máximo 2 parágrafos, exceto listagem de boletos).

## DATA E HORA ATUAL
${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;

      tools = [
        {
          type: "function",
          function: {
            name: "consultar_boletos_associado",
            description: "Consulta no SGA (Hinova) os boletos do associado pelo CPF do contato. Use SEMPRE que o associado pedir boleto, 2ª via, linha digitável, valor a pagar, vencimento, ou status de pagamento. Retorna até 5 boletos (abertos primeiro). Nunca invente dados — use APENAS o que esta tool devolver.",
            parameters: {
              type: "object",
              properties: {},
            },
          },
        },
        {
          type: "function",
          function: {
            name: "solicitar_atendente_humano",
            description: "Transfere o atendimento para a equipe humana de Relacionamento. Use SEMPRE que o associado pedir retorno, reclamar de demora, reportar sinistro/emergência, pedir para falar com pessoa, ou repetir a mesma queixa. Após chamar, a IA fica pausada e o operador humano assume.",
            parameters: {
              type: "object",
              properties: {
                motivo: {
                  type: "string",
                  enum: [
                    "aguardando_retorno",
                    "reclamacao",
                    "pediu_humano",
                    "sinistro_emergencia",
                    "duvida_complexa",
                    "outros",
                  ],
                  description: "Categoria do transbordo.",
                },
                resumo: {
                  type: "string",
                  description: "Uma frase descrevendo o que o associado quer (ex: 'pede retorno sobre análise do Prisma KRH3I99').",
                },
                prioridade: {
                  type: "string",
                  enum: ["normal", "alta"],
                  description: "Use 'alta' para sinistros, emergências ou clientes em reclamação aguda.",
                },
              },
              required: ["motivo", "resumo"],
            },
          },
        },
      ];



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

## REGRA DE ORDEM (LEIA ANTES DE QUALQUER COISA)
1. Se houver um bloco *FAQ EM DESTAQUE PARA ESTA MENSAGEM* mais abaixo, ele responde a pergunta atual do contato — use o conteúdo dele direto, mesmo que o contato ainda não tenha feito saudação nem informado dados de cotação.
2. Se a *BASE DE CONHECIMENTO (FAQ)* cobrir o pedido, responda pela FAQ antes de seguir o fluxo de vendas.
3. Só siga o FLUXO DE COTAÇÃO quando a mensagem for de fato sobre contratar/cotar — não force o fluxo se o contato perguntou outra coisa (ex.: assistência 24h, reboque, dúvida operacional).

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

## REGRA ABSOLUTA SOBRE VENCIMENTO
NUNCA mencione ou sugira datas de vencimento por conta própria.
Você SÓ pode oferecer datas de vencimento APÓS chamar obter_opcoes_vencimento e receber o resultado.
Se o cliente perguntar sobre vencimento antes da hora, diga que vai verificar as opções disponíveis.
NÃO invente "dia 10", "dia 15", "dia 20" ou qualquer data. SEMPRE use a ferramenta primeiro.

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
Se o contato relatar sinistro, acidente, batida, colisão, roubo, furto, incêndio ou qualquer emergência:
- CHAME *solicitar_atendente_humano* com motivo='sinistro_emergencia' e prioridade='alta'.
- NÃO tente resolver sinistros, não dê instruções.

## SOLICITAR ATENDENTE HUMANO
Se o contato pedir para falar com pessoa/atendente/humano/consultor, reclamar de demora, repetir queixa, ou se a dúvida fugir do escopo de cotação:
- CHAME *solicitar_atendente_humano* com motivo apropriado (pediu_humano, reclamacao, duvida_complexa).
- **PROIBIDO escrever** "vou solicitar", "vou reforçar", "já abri chamado", "já avisei o time", "vou pedir para te ligarem" se você NÃO chamou a tool nesta rodada. Essas frases sem a tool são consideradas mentira.


## DATA E HORA ATUAL
${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}

## NOME DO CONTATO
${contato?.nome || "Não informado ainda"}
${contato?.nome ? `IMPORTANTE: Trate o contato pelo PRIMEIRO NOME ("${String(contato.nome).split(/\s+/)[0]}") em todas as saudações e respostas. NUNCA use "cliente" como vocativo se você já tem o nome.` : `Você ainda não sabe o nome do contato. Em vez de "cliente", use saudações neutras (ex.: "Olá! 👋") até descobrir o nome.`}`;

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
          "aguardando_vencimento": `PRÓXIMO PASSO: Peça APENAS o EMAIL e NOME COMPLETO do cliente. NÃO mencione vencimento, NÃO invente datas, NÃO pergunte sobre vencimento nesta etapa. Após receber nome e email, CHAME salvar_dados_cliente IMEDIATAMENTE e AGUARDE a próxima mensagem.`,
          "dados_cliente_coletados": `PRÓXIMO PASSO: CHAME obter_opcoes_vencimento AGORA. Depois, ofereça APENAS as 2 opções retornadas ao cliente. NÃO invente datas. NÃO chame registrar_cotacao ainda — espere o cliente escolher.`,
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
        {
          type: "function",
          function: {
            name: "solicitar_atendente_humano",
            description: "Transfere o atendimento para a equipe humana de Relacionamento. Use SEMPRE que o lead pedir para falar com pessoa, reportar sinistro/emergência, reclamar de algo grave, ou pedir suporte fora do fluxo de cotação. Após chamar, a IA fica pausada e o operador humano assume.",
            parameters: {
              type: "object",
              properties: {
                motivo: {
                  type: "string",
                  enum: [
                    "pediu_humano",
                    "sinistro_emergencia",
                    "reclamacao",
                    "duvida_complexa",
                    "outros",
                  ],
                  description: "Categoria do transbordo.",
                },
                resumo: {
                  type: "string",
                  description: "Uma frase descrevendo o que o lead quer.",
                },
                prioridade: {
                  type: "string",
                  enum: ["normal", "alta"],
                  description: "Use 'alta' para sinistros, emergências ou reclamações graves.",
                },
              },
              required: ["motivo", "resumo"],
            },
          },
        },
      ];

    }

    // Anexa contexto de cobrança recente (se houver) ao final do system prompt
    if (cobrancaContextoTxt) {
      systemPrompt += cobrancaContextoTxt;
    }

    // Contexto do gate de CPF — só injeta na MESMA mensagem em que o CPF foi capturado
    if (cpfSgaContexto) {
      const ctx = cpfSgaContexto.encontrado
        ? `O cliente acabou de informar o CPF ${cpfSgaContexto.cpfMascarado}. Identificamos no SGA como associado(a): *${cpfSgaContexto.nome}*${cpfSgaContexto.status ? ` (situação: ${cpfSgaContexto.status})` : ""}. Confirme o nome com ele(a) na resposta e siga o atendimento.`
        : `O cliente acabou de informar o CPF ${cpfSgaContexto.cpfMascarado}, mas NÃO encontramos cadastro no SGA. Informe isso de forma cordial e siga como lead em cotação.`;
      systemPrompt += `\n\n## CONTEXTO DE IDENTIFICAÇÃO (NÃO REPETIR)\n${ctx}\nNÃO peça o CPF de novo. NÃO repita a saudação inicial de identificação.`;
    }


    // ---- 7.5 OVERRIDE EDITORIAL (Relacionamento) — tabelas maya_ia_comportamento + maya_ia_faq
    // Permite editar persona/regras/tom/saudação e base de conhecimento sem deploy.
    // Agora com retrieval por palavras-chave: a FAQ que mais casa com a mensagem
    // atual entra em um bloco "EM DESTAQUE" no topo, antes do bloco completo.
    try {
      const audienciaAtual = isDiretor ? "diretor" : isAssociado ? "associado" : "lead";
      const mayaCfg = await loadMayaEditorialConfig(supabase, audienciaAtual, texto || "");
      if (mayaCfg) {
        const blocos: string[] = [];
        if (mayaCfg.persona) blocos.push(`### PERSONA\n${mayaCfg.persona}`);
        if (mayaCfg.regras_absolutas) blocos.push(`### REGRAS ABSOLUTAS\n${mayaCfg.regras_absolutas}`);
        if (mayaCfg.tom_voz) blocos.push(`### TOM DE VOZ\n${mayaCfg.tom_voz}`);
        if (mayaCfg.saudacao_inicial) blocos.push(`### SAUDAÇÃO INICIAL\n${mayaCfg.saudacao_inicial}`);
        if (blocos.length > 0) {
          systemPrompt += `\n\n## CONFIGURAÇÃO EDITORIAL (Relacionamento) — PREVALECE SOBRE QUALQUER REGRA ACIMA EM CONFLITO\n${blocos.join("\n\n")}`;
        }
        if (mayaCfg.faqDestaqueText) {
          systemPrompt += `\n\n## FAQ EM DESTAQUE PARA ESTA MENSAGEM (LEIA PRIMEIRO)\nA mensagem do cliente casou com a(s) entrada(s) abaixo da base de conhecimento. Use o conteúdo delas como resposta — não invente, não desvie, não transborde se a FAQ já cobre o pedido.\n\n${mayaCfg.faqDestaqueText}`;
          console.log(`[agente-consultor-ia] FAQ em destaque (${mayaCfg.faqMatchedIds?.length || 0}): ${(mayaCfg.faqMatchedIds || []).join(",")}`);
        }
        if (mayaCfg.faqText) {
          systemPrompt += `\n\n## BASE DE CONHECIMENTO (FAQ)\nResponda usando estas informações sempre que a pergunta do cliente casar com algum item. Não invente o que não estiver aqui.\n\n${mayaCfg.faqText}`;
        }
      }
    } catch (e) {
      console.error("[agente-consultor-ia] Falha ao carregar config editorial Maya:", (e as any)?.message);
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
      const aiResponse = await aiGatewayFetch({
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
        // Maya nunca deixa vácuo — fallback canônico (começo, meio, fim)
        resposta = "Tive um probleminha técnico aqui agora 😅\n\n" +
          "Pode me mandar sua mensagem de novo em alguns segundos? " +
          "Se preferir, posso te transferir para um *atendente humano* — é só responder *atendente*.";
        console.warn(`[agente-consultor-ia] fallback_vacuo: motivo=llm_sem_message tel=${telLimpo}`);
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
              // Guardrail: só permite registrar_cotacao se estiver na etapa correta
              const etapaAtual = dadosCotacao?.etapa;
              if (etapaAtual !== "aguardando_vencimento_resposta" && etapaAtual !== "dados_cliente_coletados") {
                console.log(`[agente-consultor-ia] BLOQUEADO: registrar_cotacao chamado na etapa "${etapaAtual}" — rejeitando`);
                toolResult = { 
                  success: false, 
                  error: "ERRO: Não é possível registrar cotação agora. Siga o fluxo: primeiro salvar_dados_cliente, depois obter_opcoes_vencimento, aguarde a resposta do cliente escolhendo o dia de vencimento, e SÓ ENTÃO chame registrar_cotacao." 
                };
              } else {
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
                // ALWAYS use planos from state — never trust what the AI passes
                mergedArgs.planos_calculados = dadosCotacao.planos_calculados || [];
                console.log(`[agente-consultor-ia] Planos SEMPRE do estado: ${mergedArgs.planos_calculados.length} planos`);
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
              } // end guardrail else
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
            } else if (fnName === "solicitar_atendente_humano") {
              toolResult = await executarSolicitarAtendenteHumano(
                supabase,
                telLimpo,
                {
                  motivo: args?.motivo || "outros",
                  resumo: String(args?.resumo || "").slice(0, 500),
                  prioridade: args?.prioridade === "alta" ? "alta" : "normal",
                  contato_nome: contato?.nome || associadoNome || null,
                  associado_id: null,
                }
              );
            } else if (fnName === "consultar_boletos_associado") {
              toolResult = await executarConsultarBoletosAssociado(
                supabase,
                supabaseUrl,
                serviceKey,
                { cpf: contato?.cpf || null }
              );
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
          if (fnName === "consultar_boletos_associado") {
            toolContent = `⚠️ BOLETOS OFICIAIS DO SGA - USE APENAS ESTES VALORES/DATAS/LINHAS, NÃO INVENTE. Se encontrados=0 e sem erro, diga que está em dia. Se erro_transitorio=true, chame solicitar_atendente_humano.\n${toolContent}`;
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
      const contentRaw = (message.content || "").toString().trim();
      if (!contentRaw) {
        resposta = "Recebi sua mensagem! 🙂 Pode reformular pra eu te entender melhor? " +
          "Se preferir, posso te transferir para um *atendente humano* — é só responder *atendente*.";
        console.warn(`[agente-consultor-ia] fallback_vacuo: motivo=llm_content_vazio tel=${telLimpo}`);
      } else {
        resposta = contentRaw;
      }
      break;
    }

    console.log(`[agente-consultor-ia] Resposta final (${resposta.length} chars) para ${telLimpo} (diretor=${isDiretor})`);

    // ---- 9. (REMOVIDO) Os regex legados de pedidoHumano/pedidoSinistro foram substituídos
    //              pela tool solicitar_atendente_humano (chamada pelo próprio modelo). Veja
    //              executarSolicitarAtendenteHumano() e o prompt do branch isAssociado/lead.



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
      // Jornada legada `cotacoes_publicas` removida (rota /q/:token desativada).
      // Métricas de cotações ativas ficam zeradas até serem recableadas para `cotacoes` canônica.
      relatorio.cotacoes = {
        pendentes: 0,
        total_periodo: 0,
        ultimas_pendentes: [] as Array<{ veiculo: string; data: string }>,
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
      // Sem force_provider: usa o provedor ativo (Meta quando Evolution está down).
      // Hardcode de "evolution" quebra a Maya em janelas em que a instância Evolution cai.
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

// ============================================================================
// TOOL: solicitar_atendente_humano
// Pausa a IA por 12 h (motivo='transbordo_humano'), grava resumo na pausa,
// abre notificações para o time de Relacionamento e devolve uma resposta fixa
// ao cliente. O operador encerra pelo botão "Concluir atendimento" do chat.
// ============================================================================
async function executarSolicitarAtendenteHumano(
  supabase: any,
  telefone: string,
  payload: {
    motivo: string;
    resumo: string;
    prioridade: "normal" | "alta";
    contato_nome: string | null;
    associado_id: string | null;
  }
) {
  const telLimpo = (telefone || "").replace(/\D/g, "");
  const motivoTransbordo = "transbordo_humano"; // canônico — UI já reconhece
  const pausadaAte = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  const agora = new Date().toISOString();

  const resumoFinal = [
    payload.resumo || "Atendente humano solicitado pela Maya IA.",
    `(categoria: ${payload.motivo}, prioridade: ${payload.prioridade})`,
  ].join(" ");

  const { error: pausaErr } = await supabase
    .from("whatsapp_ia_pausas")
    .upsert(
      {
        telefone: telLimpo,
        pausada_ate: pausadaAte,
        motivo: motivoTransbordo,
        resumo: resumoFinal,
        atendente_id: null,
        updated_at: agora,
      },
      { onConflict: "telefone" }
    );

  if (pausaErr) {
    console.error("[transbordo] Falha ao registrar pausa:", pausaErr);
    return { success: false, error: "Não consegui transferir agora." };
  }

  // Notifica destinos do Relacionamento (proxy: coordenador_monitoramento + diretor)
  try {
    const { data: dest } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["coordenador_monitoramento", "diretor"]);

    const titulo = payload.prioridade === "alta"
      ? "🚨 Transbordo URGENTE — IA pediu atendente humano"
      : "👤 Transbordo — IA pediu atendente humano";

    const mensagem = [
      `Tel: ${telLimpo}`,
      payload.contato_nome ? `Nome: ${payload.contato_nome}` : null,
      `Motivo: ${payload.motivo}`,
      `Resumo: ${payload.resumo}`,
    ].filter(Boolean).join(" | ");

    for (const d of dest || []) {
      await supabase.from("notificacoes").insert({
        user_id: d.user_id,
        titulo,
        mensagem,
        tipo: "alerta",
        categoria: "relacionamento",
        lida: false,
      });
    }

    await supabase.from("notificacoes_sistema").insert({
      titulo,
      mensagem,
      tipo: "transbordo_ia",
      destino: "role",
      destino_role: "coordenador_monitoramento",
      link: `/eventos/chat-ia?telefone=${encodeURIComponent(telLimpo)}`,
      ativo: true,
    });
  } catch (notifErr) {
    console.error("[transbordo] Falha ao notificar Relacionamento (não-bloqueante):", notifErr);
  }

  console.log(`[transbordo] ✓ Aberto p/ ${telLimpo} motivo=${payload.motivo} prioridade=${payload.prioridade}`);

  const primeiroNome = payload.contato_nome ? String(payload.contato_nome).split(/\s+/)[0] : "";
  return {
    success: true,
    instrucao:
      "TRANSBORDO ABERTO. Sua próxima e ÚNICA mensagem deve ser EXATAMENTE: \"Já chamei a equipe de Relacionamento aqui" +
      (primeiroNome ? `, ${primeiroNome}` : "") +
      ". Eles vão te responder por este mesmo WhatsApp assim que pegarem o seu atendimento. Pode aguardar. 🙏\". NÃO escreva mais nada além disso. NÃO peça nenhum dado a mais. NÃO prometa nada além do que está nessa frase.",
    pausada_ate: pausadaAte,
    motivo: motivoTransbordo,
  };
}

// ============================================================
// TOOL: consultar_boletos_associado
// Chama a edge sga-listar-boletos-associado com o CPF do contato e
// devolve um JSON enxuto (até 5 boletos, abertos primeiro).
// ============================================================
async function executarConsultarBoletosAssociado(
  _supabase: any,
  supabaseUrl: string,
  serviceKey: string,
  args: { cpf: string | null }
) {
  const cpf = (args?.cpf || "").replace(/\D/g, "");
  if (cpf.length !== 11) {
    return {
      success: false,
      error: "CPF do contato indisponível — peça o CPF antes.",
      encontrados: 0,
      boletos: [],
    };
  }

  let resp: Response;
  try {
    resp = await fetch(`${supabaseUrl}/functions/v1/sga-listar-boletos-associado`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      body: JSON.stringify({ cpf }),
      signal: AbortSignal.timeout(30000),
    });
  } catch (e: any) {
    console.error("[tool:consultar_boletos] fetch falhou:", e?.message);
    return { success: false, erro_transitorio: true, motivo: "rede", encontrados: 0, boletos: [] };
  }

  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    console.error(`[tool:consultar_boletos] HTTP ${resp.status}: ${t.substring(0, 200)}`);
    return { success: false, erro_transitorio: true, motivo: `http_${resp.status}`, encontrados: 0, boletos: [] };
  }

  const data: any = await resp.json().catch(() => ({}));

  if (data?.erro_transitorio) {
    return {
      success: false,
      erro_transitorio: true,
      motivo: data?.motivo || "sga_indisponivel",
      encontrados: 0,
      boletos: [],
    };
  }

  const todos: any[] = Array.isArray(data?.boletos) ? data.boletos : [];

  const fmtData = (d: any) => {
    if (!d) return null;
    try {
      const dt = new Date(String(d));
      if (isNaN(dt.getTime())) return String(d);
      return dt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    } catch { return String(d); }
  };
  const fmtValor = (v: any) => {
    const n = Number(v);
    if (!isFinite(n)) return String(v ?? "");
    return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const normalizados = todos.map((b: any) => {
    const venc = b.dataVencimento || b.data_vencimento || b.vencimento || null;
    const valor = b.valor ?? b.valor_total ?? b.valorBoleto ?? null;
    const situacao = String(b.situacao || b.status || b.statusBoleto || "").toLowerCase();
    const aberto = !situacao || ["em aberto", "aberto", "vencido", "pendente", "a vencer"].some(s => situacao.includes(s));
    return {
      vencimento: fmtData(venc),
      _vencISO: venc,
      valor: fmtValor(valor),
      status: situacao || "em aberto",
      aberto,
      placa: b.placa || b.veiculo_placa || null,
      linha_digitavel: b.linhaDigitavel || b.linha_digitavel || b.codigoBarras || null,
    };
  });

  normalizados.sort((a: any, b: any) => {
    if (a.aberto !== b.aberto) return a.aberto ? -1 : 1;
    const da = a._vencISO ? new Date(a._vencISO).getTime() : 0;
    const db = b._vencISO ? new Date(b._vencISO).getTime() : 0;
    return db - da;
  });

  const top = normalizados.slice(0, 5).map(({ _vencISO, aberto, ...rest }) => rest);

  return {
    success: true,
    encontrados: normalizados.length,
    boletos: top,
  };
}


