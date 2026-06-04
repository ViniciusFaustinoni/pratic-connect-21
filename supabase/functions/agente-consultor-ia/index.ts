import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { aiGatewayFetch } from "../_shared/ai-client.ts";
import { resolverHabilidade, dentroDoHorario, type IAAudiencia } from "./lib/roteador.ts";
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

// ── Cache por habilidade (slug) — fonte canônica pós-04/06/26 ────────────────
type HabilidadeContentRaw = { faqs: any[]; exemplos: any[] };
const HABILIDADE_CONTENT_CACHE = new Map<string, { at: number; data: HabilidadeContentRaw }>();
type HabilidadeContentCfg = {
  faqText?: string;
  regrasText?: string;
  faqDestaqueText?: string;
  faqMatchedIds?: string[];
  exemplosText?: string;
};

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

// ── Loader canônico por HABILIDADE (slug) — substitui loadMayaEditorialConfig
// Lê APENAS de ia_habilidade_conhecimento + ia_habilidade_exemplos. Nunca toca
// nas tabelas legadas maya_ia_* (deprecadas em 04/06/26). Conteúdo é totalmente
// isolado por habilidade — editar 'relacionamento' não afeta 'vendas' e vice-versa.
async function loadHabilidadeContent(
  supabase: any,
  habilidadeSlug: string,
  mensagemAtual?: string,
): Promise<HabilidadeContentCfg> {
  const hit = HABILIDADE_CONTENT_CACHE.get(habilidadeSlug);
  let raw: HabilidadeContentRaw;
  if (hit && Date.now() - hit.at < MAYA_CFG_TTL_MS) {
    raw = hit.data;
  } else {
    const [{ data: faqs }, { data: exemplos }] = await Promise.all([
      supabase
        .from("ia_habilidade_conhecimento")
        .select("id,categoria,pergunta,resposta,palavras_chave,ordem,tipo")
        .eq("habilidade_slug", habilidadeSlug)
        .eq("ativo", true)
        .order("categoria", { ascending: true })
        .order("ordem", { ascending: true }),
      supabase
        .from("ia_habilidade_exemplos")
        .select("id,titulo,entrada_usuario,resposta_ideal,notas,ordem")
        .eq("habilidade_slug", habilidadeSlug)
        .eq("ativo", true)
        .order("ordem", { ascending: true }),
    ]);
    raw = { faqs: faqs || [], exemplos: exemplos || [] };
    HABILIDADE_CONTENT_CACHE.set(habilidadeSlug, { at: Date.now(), data: raw });
  }

  // Partição por tipo: 'regra' → bloco de REGRAS; resto (incluindo NULL) → CONHECIMENTO/FAQ
  const regras = raw.faqs.filter((f: any) => f.tipo === "regra");
  const conhecimento = raw.faqs.filter((f: any) => f.tipo !== "regra");

  // Bloco de REGRAS (achatado — regra é regra, sem categoria)
  let regrasText = "";
  if (regras.length > 0) {
    const partes: string[] = [];
    for (const it of regras) {
      partes.push(`- *${it.pergunta}*\n  ${it.resposta}`);
    }
    regrasText = partes.join("\n");
  }

  // Bloco completo de CONHECIMENTO/FAQ (por categoria)
  let faqText = "";
  if (conhecimento.length > 0) {
    const porCategoria = new Map<string, any[]>();
    for (const f of conhecimento) {
      const k = f.categoria || "geral";
      if (!porCategoria.has(k)) porCategoria.set(k, []);
      porCategoria.get(k)!.push(f);
    }
    const partes: string[] = [];
    for (const [cat, items] of porCategoria) {
      partes.push(`### ${cat.toUpperCase()}`);
      for (const it of items) {
        const kw = Array.isArray(it.palavras_chave) && it.palavras_chave.length
          ? ` _(palavras-chave: ${it.palavras_chave.join(", ")})_`
          : "";
        partes.push(`- *${it.pergunta}*${kw}\n  ${it.resposta}`);
      }
    }
    faqText = partes.join("\n");
  }

  // Retrieval para destaque (mesma lógica do loader antigo)
  let faqDestaqueText = "";
  let faqMatchedIds: string[] = [];
  if (mensagemAtual && conhecimento.length > 0) {
    const msgNorm = normalizarParaMatch(mensagemAtual);
    const msgTokens = tokenizarParaMatch(mensagemAtual);
    if (msgNorm.length > 0 && (msgTokens.size > 0 || msgNorm.length >= 3)) {
      const pontuadas = conhecimento
        .map((f: any) => ({ f, score: pontuarFaq(msgTokens, msgNorm, f) }))
        .filter((x: any) => x.score >= 3)
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

  // Exemplos de resposta (few-shot)
  let exemplosText = "";
  if (raw.exemplos.length > 0) {
    const partes: string[] = [];
    for (const ex of raw.exemplos) {
      partes.push(`- **${ex.titulo || "exemplo"}**`);
      partes.push(`  Cliente: ${ex.entrada_usuario}`);
      partes.push(`  Resposta ideal: ${ex.resposta_ideal}`);
      if (ex.notas) partes.push(`  Nota: ${ex.notas}`);
    }
    exemplosText = partes.join("\n");
  }

  return {
    faqText: faqText || undefined,
    faqDestaqueText: faqDestaqueText || undefined,
    faqMatchedIds: faqMatchedIds.length ? faqMatchedIds : undefined,
    exemplosText: exemplosText || undefined,
  };
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

  // Variáveis de escopo do handler — visíveis no catch raiz para fallback de garantia-de-resposta
  let telefoneAtual: string | null = null;

  try {
    const { telefone, texto, tipo_msg, latitude, longitude, nome_contato } = await req.json();
    telefoneAtual = telefone;

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


    // ---- 2B-PRE. CONTEXTO DE AGENDAMENTO PENDENTE (48h) ----
    // Se há uma confirmacao_agendamento aberta para este telefone, o contato JÁ está
    // identificado pelo servico→associado e a IA deve focar em confirmar/reagendar
    // em vez de pedir CPF. Ver mem://logic/operations/ia-contexto-agendamento-pendente.
    let contextoAgendamentoPendente: {
      servico_id: string;
      reagendamento_token: string | null;
      data: string | null;
      periodo: string | null;
      hora: string | null;
      endereco: string | null;
      tipo: string | null;
      nome_cliente: string | null;
      enviado_em: string;
      telefone: string;
    } | null = null;
    try {
      const telVariantesPend = [telLimpo];
      if (telLimpo.startsWith("55") && telLimpo.length >= 12) telVariantesPend.push(telLimpo.substring(2));
      if (!telLimpo.startsWith("55") && telLimpo.length >= 10) telVariantesPend.push("55" + telLimpo);
      const limite48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data: confPend } = await supabase
        .from("confirmacoes_agendamento")
        .select("id, servico_id, telefone, created_at, status, servico:servicos(id, tipo, data_agendada, periodo, hora_agendada, logradouro, bairro, cidade, reagendamento_token, associado:associados(nome))")
        .in("telefone", telVariantesPend)
        .in("status", ["enviada", "reagendando", "aguardando_confirmacao_vespera", "aguardando_confirmacao_manha", "aguardando_confirmacao_encaixe"])
        .gte("created_at", limite48h)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const s: any = (confPend as any)?.servico;
      if (confPend && s) {
        const partes = [s.logradouro, s.bairro, s.cidade].filter(Boolean);
        contextoAgendamentoPendente = {
          servico_id: s.id,
          reagendamento_token: s.reagendamento_token || null,
          data: s.data_agendada || null,
          periodo: s.periodo || null,
          hora: s.hora_agendada ? String(s.hora_agendada).slice(0, 5) : null,
          endereco: partes.length ? partes.join(", ") : null,
          tipo: s.tipo || null,
          nome_cliente: s.associado?.nome || null,
          enviado_em: (confPend as any).created_at,
          telefone: (confPend as any).telefone,
        };
        console.log(`[agente-consultor-ia] [contexto_agendamento] pendente servico=${s.id} tipo=${s.tipo}`);
      }
    } catch (e) {
      console.warn("[agente-consultor-ia] Falha contexto agendamento:", (e as any)?.message);
    }


    // ---- 2B. GATE DE SAUDAÇÃO + IDENTIFICAÇÃO (skip diretores) ----
    // Regras canônicas (Relacionamento › Chat):
    //   - Saudação obrigatória bloqueante: primeira msg do dia BRT OU >gate_saudacao_horas sem interagir → mensagem padrão pedindo nome completo OU CPF.
    //   - Validações canônicas únicas: CPF (11 dígitos + DV) OU Nome Completo (≥2 palavras, ≥10 chars, sem dígitos).
    //   - Liberação após captura: mensagem_pos_identificacao da config.
    //   - "Maya nunca deixa vácuo": qualquer texto livre dentro do gate gera resposta (saudação OU continuidade debounced).
    let cpfSgaContexto: { encontrado: boolean; nome?: string; status?: string; cpfMascarado: string } | null = null;
    let sgaAssociadoOverride: { nome: string; status: string } | null = null;

    // Carrega config canônica da habilidade `relacionamento` (textos e gatilho de tempo da saudação).
    // Fallback robusto: se a linha vier incompleta, mantém os valores canônicos in-code.
    const FALLBACK_SAUDACAO_INICIAL = "Olá! Tudo bem? Para iniciarmos o seu atendimento e localizarmos seu cadastro, por gentileza, informe o seu *nome completo* ou o *CPF*. 😁";
    const FALLBACK_MSG_POS_IDENT = "Certo, obrigada pelo retorno! Em que podemos te ajudar hoje? 😊";
    const habCfg = {
      saudacao_inicial: FALLBACK_SAUDACAO_INICIAL,
      mensagem_pos_identificacao: FALLBACK_MSG_POS_IDENT,
      gate_saudacao_horas: 2,
      gate_saudacao_aplicar_identificados: true,
    };
    try {
      const { data: habRow } = await supabase
        .from("ia_habilidades")
        .select("saudacao_inicial, mensagem_pos_identificacao, gate_saudacao_horas, gate_saudacao_aplicar_identificados")
        .eq("slug", "relacionamento")
        .maybeSingle();
      if (habRow) {
        if (habRow.saudacao_inicial && String(habRow.saudacao_inicial).trim()) {
          habCfg.saudacao_inicial = String(habRow.saudacao_inicial).trim();
        }
        if ((habRow as any).mensagem_pos_identificacao && String((habRow as any).mensagem_pos_identificacao).trim()) {
          habCfg.mensagem_pos_identificacao = String((habRow as any).mensagem_pos_identificacao).trim();
        }
        const horas = Number((habRow as any).gate_saudacao_horas);
        if (Number.isFinite(horas) && horas > 0) habCfg.gate_saudacao_horas = horas;
        if (typeof (habRow as any).gate_saudacao_aplicar_identificados === "boolean") {
          habCfg.gate_saudacao_aplicar_identificados = (habRow as any).gate_saudacao_aplicar_identificados;
        }
      }
    } catch (e) {
      console.warn("[agente-consultor-ia] habCfg load falhou — usando fallback:", (e as any)?.message);
    }


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

    // ---- 2B-PRE2. RESET DE IDENTIDADE POR DIVERGÊNCIA ----
    // Detecta sinais de que quem está escrevendo NÃO é o titular cacheado
    // (telefone compartilhado, troca de dono, captura passada errada).
    // Padrões: "não sou X", "meu nome é Y", "esse carro não é meu",
    // "veículo errado", OU CPF de 11 dígitos diferente do cacheado e
    // válido por DV. Quando dispara, zera cache p/ reentrar no gate canônico.
    // Ver plano 2026-06-04 / caso Vinicius/Thais +5521992593830.
    if (!diretorPreDetectado && !contextoAgendamentoPendente && (contato.cpf || (contato as any).nome_confirmado_em)) {
      const textoLow = (texto || "").toString().toLowerCase().trim();
      const padraoNega =
        /(n[ãa]o\s+sou\b|n[ãa]o\s+(é|e)\s+(o|a)?\s*meu\b|aqui\s+(é|e|quem\s+fala\s+(é|e))\s+(o|a)?\s*[a-zà-ÿ]{3,}|meu\s+nome\s+(é|e)\s+[a-zà-ÿ]{3,}|esse\s+carro\s+n[ãa]o\s+(é|e)\s+meu|n[ãa]o\s+(é|e)\s+(esse|meu)\s+(carro|ve[íi]culo)|ve[íi]culo\s+errado|n[ãa]o\s+tenho\s+(esse|este)\s+(carro|ve[íi]culo))/;
      const validateCpfReset = (raw: string): boolean => {
        const c = raw.replace(/\D/g, "");
        if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
        let sum = 0;
        for (let i = 0; i < 9; i++) sum += parseInt(c[i]) * (10 - i);
        let d1 = (sum * 10) % 11; if (d1 === 10) d1 = 0;
        if (d1 !== parseInt(c[9])) return false;
        sum = 0;
        for (let i = 0; i < 10; i++) sum += parseInt(c[i]) * (11 - i);
        let d2 = (sum * 10) % 11; if (d2 === 10) d2 = 0;
        return d2 === parseInt(c[10]);
      };
      let resetDisparado = false;
      let motivoReset = "";
      if (padraoNega.test(textoLow)) { resetDisparado = true; motivoReset = "negacao_identidade"; }
      if (!resetDisparado && contato.cpf) {
        const matchCpf = (texto || "").toString().match(/(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/);
        if (matchCpf) {
          const novo = matchCpf[1].replace(/\D/g, "");
          if (novo !== contato.cpf && validateCpfReset(novo)) {
            resetDisparado = true; motivoReset = "cpf_divergente";
          }
        }
      }
      if (resetDisparado) {
        console.log(`[reset_identidade] telefone=${telLimpo} motivo=${motivoReset} nome_cacheado=${contato.nome || "?"}`);
        await supabase
          .from("agente_ia_contatos")
          .update({
            cpf: null,
            cpf_capturado_em: null,
            nome: null,
            nome_confirmado_em: null,
            sga_associado_id: null,
            sga_associado_status: null,
            sga_associado_encontrado: false,
            ultima_saudacao_em: null,
            ultima_reconfirmacao_em: null,
            liberacao_enviada_em: null,
            cpf_tentativas_invalidas: 0,
          })
          .eq("id", contato.id);
        contato.cpf = null;
        contato.nome = null;
        (contato as any).nome_confirmado_em = null;
        (contato as any).sga_associado_encontrado = false;
        (contato as any).sga_associado_status = null;
      }
    }

    // "Identificado" = já temos CPF (com lookup SGA registrado) OU nome confirmado.
    const jaIdentificado = !!contato.cpf || !!(contato as any).nome_confirmado_em;

    // ---- 2B-PRE3. RECONFIRMAÇÃO LEVE DE IDENTIDADE (anti-telefone-compartilhado) ----
    // Cache de identidade NÃO é eternamente sticky: se passou >2h sem interação
    // OU mudou o dia BRT desde a última captura/reconfirmação, exige uma
    // reconfirmação leve antes de tratar o usuário pelo nome cacheado.
    // Resposta afirmativa ("sim", "isso", "sou eu") libera e atualiza a marca;
    // qualquer outra resposta é processada pelos blocos de gate/LLM normais
    // (que vão tratar como interação genérica). Caso Vinicius/Thais 04/06.
    if (!diretorPreDetectado && !contextoAgendamentoPendente && jaIdentificado) {
      const ultimaInter = contato.ultima_interacao ? new Date(contato.ultima_interacao) : null;
      const horasDesdeUltima = ultimaInter ? (Date.now() - ultimaInter.getTime()) / 3_600_000 : Infinity;
      const ultimaReconf = (contato as any).ultima_reconfirmacao_em
        ? new Date((contato as any).ultima_reconfirmacao_em)
        : null;
      const horasDesdeReconf = ultimaReconf ? (Date.now() - ultimaReconf.getTime()) / 3_600_000 : Infinity;
      const cpfCap = (contato as any).cpf_capturado_em ? new Date((contato as any).cpf_capturado_em) : null;
      const nomeConf = (contato as any).nome_confirmado_em ? new Date((contato as any).nome_confirmado_em) : null;
      const ultimaIdent = [cpfCap, nomeConf, ultimaReconf]
        .filter((d): d is Date => !!d)
        .sort((a, b) => b.getTime() - a.getTime())[0] || null;
      const agoraBRT = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const diaBrtAgora = `${agoraBRT.getFullYear()}-${agoraBRT.getMonth()}-${agoraBRT.getDate()}`;
      const ultimaIdentBRT = ultimaIdent
        ? new Date(ultimaIdent.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }))
        : null;
      const diaBrtIdent = ultimaIdentBRT
        ? `${ultimaIdentBRT.getFullYear()}-${ultimaIdentBRT.getMonth()}-${ultimaIdentBRT.getDate()}`
        : null;

      const identidadeFresca =
        horasDesdeReconf < 2 ||
        horasDesdeUltima < 2 ||
        (!!diaBrtIdent && diaBrtIdent === diaBrtAgora);

      if (!identidadeFresca) {
        const textoLow2 = (texto || "").toString().toLowerCase().trim();
        const afirma = /^(sim|isso|isso\s+mesmo|sou\s+eu|sou|correto|exato|exatamente|s|s\.)\b/.test(textoLow2);

        if (afirma && ultimaReconf && horasDesdeReconf < 24) {
          await supabase
            .from("agente_ia_contatos")
            .update({
              ultima_reconfirmacao_em: new Date().toISOString(),
              nome_confirmado_em: new Date().toISOString(),
            })
            .eq("id", contato.id);
          (contato as any).nome_confirmado_em = new Date().toISOString();
          console.log(`[reconfirmacao_identidade] telefone=${telLimpo} confirmado_pelo_cliente`);
          // segue fluxo normal abaixo
        } else {
          const primeiroNome = (contato.nome || "").trim().split(/\s+/)[0] || "";
          const msg = primeiroNome
            ? `Olá! Tudo bem? Antes de continuar, me confirma rapidinho: estou falando com *${primeiroNome}*? 🙂\n\nSe não for, me envia seu *nome completo* ou *CPF* (11 dígitos) que eu localizo o cadastro certinho.`
            : `Olá! Tudo bem? Para confirmar seu cadastro, me envia seu *nome completo* ou *CPF* (11 dígitos), por favor. 🙂`;
          try {
            await fetch(`${supabaseUrl}/functions/v1/whatsapp-send-text`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
              body: JSON.stringify({ telefone: telLimpo, mensagem: msg, allow_text: true }),
            });
          } catch (e) {
            console.error(`[reconfirmacao_identidade] envio falhou:`, (e as any)?.message);
          }
          await supabase
            .from("agente_ia_contatos")
            .update({ ultima_reconfirmacao_em: new Date().toISOString() })
            .eq("id", contato.id);
          console.log(`[reconfirmacao_identidade] telefone=${telLimpo} cache=${primeiroNome || "(sem nome)"} reconfirmacao_enviada`);
          return new Response(
            JSON.stringify({ success: true, gate: "aguardando_reconfirmacao" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }


    if (!diretorPreDetectado && !jaIdentificado && !contextoAgendamentoPendente) {
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

      // Nome completo canônico: ≥2 palavras alfabéticas (com acentos), cada uma ≥2 chars,
      // total ≥10 chars, sem dígitos. Rejeita "ok", "Sim", "João" (1 palavra), "123 abc".
      const validateNomeCompleto = (raw: string): boolean => {
        const t = (raw || "").trim();
        if (t.length < 10 || t.length > 120) return false;
        if (/\d/.test(t)) return false;
        const nomeRegex = /^[A-Za-zÀ-ÿ'`´^~]{2,}(?:\s+[A-Za-zÀ-ÿ'`´^~]{2,})+$/;
        return nomeRegex.test(t);
      };

      const enviarTexto = async (msg: string) => {
        try {
          await fetch(`${supabaseUrl}/functions/v1/whatsapp-send-text`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
            body: JSON.stringify({ telefone: telLimpo, mensagem: msg, allow_text: true }),
          });
        } catch (e) {
          console.error(`[agente-consultor-ia] Falha ao enviar mensagem de gate identificação:`, (e as any)?.message);
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

      // === CAMINHO 1: CPF VÁLIDO ===
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
            sga_associado_status: encontrado ? String(statusSga || "ativo") : null,
            cpf_tentativas_invalidas: 0,
            liberacao_enviada_em: new Date().toISOString(),
            ...(nomeSga ? { nome: nomeSga, nome_confirmado_em: new Date().toISOString() } : {}),
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
        console.log(`[agente-consultor-ia] [gate_identificacao] CPF capturado (${cpfMascarado}) — SGA encontrado=${encontrado}`);

        // Liberação canônica + return: próxima mensagem do cliente segue o fluxo normal
        await enviarTexto(habCfg.mensagem_pos_identificacao);
        return new Response(
          JSON.stringify({ success: true, gate: "identificado_cpf", sga_encontrado: encontrado }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // === CAMINHO 2: NOME COMPLETO VÁLIDO ===
      if (validateNomeCompleto(textoEntrada)) {
        const nomeFmt = textoEntrada.trim().replace(/\s+/g, " ");
        await supabase
          .from("agente_ia_contatos")
          .update({
            nome: nomeFmt,
            nome_confirmado_em: new Date().toISOString(),
            cpf_tentativas_invalidas: 0,
            liberacao_enviada_em: new Date().toISOString(),
          })
          .eq("id", contato.id);
        contato.nome = nomeFmt;
        (contato as any).nome_confirmado_em = new Date().toISOString();
        console.log(`[agente-consultor-ia] [gate_identificacao] Nome completo capturado: ${nomeFmt}`);

        await enviarTexto(habCfg.mensagem_pos_identificacao);
        return new Response(
          JSON.stringify({ success: true, gate: "identificado_nome" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // === CAMINHO 3: NÃO IDENTIFICADO ===
      // 3A — Tentativa de CPF inválida (números soltos 6–14 dígitos OU formato CPF que não bate DV)
      const pareceTentativaDeCpf =
        !!cpfCandidato ||
        (apenasDigitos.length >= 6 && apenasDigitos.length <= 14);

      if (pareceTentativaDeCpf) {
        const tentativasAtuais = Number((contato as any).cpf_tentativas_invalidas || 0);
        const novasTentativas = tentativasAtuais + 1;
        await supabase
          .from("agente_ia_contatos")
          .update({ cpf_tentativas_invalidas: novasTentativas })
          .eq("id", contato.id);

        if (novasTentativas >= 3) {
          await enviarTexto(
            "Notei que estamos tendo dificuldade com o CPF 🤔\n\n" +
            "Se preferir, posso transferir agora para um atendente humano — é só responder *atendente*.\n" +
            "Ou, se quiser tentar mais uma vez: me envie o *CPF* só com números (11 dígitos) — ou o seu *nome completo*."
          );
        } else {
          await enviarTexto(
            "Recebi os números, mas não formam um CPF válido (precisa ter *11 dígitos*). " +
            "Pode conferir e me enviar de novo? 😉\n\n" +
            "_Se preferir, pode me passar seu *nome completo* — funciona do mesmo jeito.\n" +
            "Ou responda *atendente* para falar com uma pessoa._"
          );
        }
        return new Response(
          JSON.stringify({ success: true, gate: "identificacao_invalida", tentativas: novasTentativas }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 3B — Texto livre: saudação canônica OU continuidade debounced
      //
      // precisaSaudar = primeira interação OU >2h desde a última OU dia BRT diferente.
      const agoraBRT = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const diaBrtAgora = `${agoraBRT.getFullYear()}-${agoraBRT.getMonth()}-${agoraBRT.getDate()}`;
      const ultimaInter = contato.ultima_interacao ? new Date(contato.ultima_interacao) : null;
      const ultimaInterBRT = ultimaInter
        ? new Date(ultimaInter.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }))
        : null;
      const diaBrtUltima = ultimaInterBRT
        ? `${ultimaInterBRT.getFullYear()}-${ultimaInterBRT.getMonth()}-${ultimaInterBRT.getDate()}`
        : null;
      const horasDesdeUltima = ultimaInter ? (Date.now() - ultimaInter.getTime()) / 3_600_000 : Infinity;

      const ultimaSaudacao = (contato as any).ultima_saudacao_em
        ? new Date((contato as any).ultima_saudacao_em)
        : null;
      const horasDesdeSaudacao = ultimaSaudacao ? (Date.now() - ultimaSaudacao.getTime()) / 3_600_000 : Infinity;

      const precisaSaudar =
        !ultimaSaudacao ||
        horasDesdeSaudacao > habCfg.gate_saudacao_horas ||
        horasDesdeUltima > habCfg.gate_saudacao_horas ||
        diaBrtAgora !== diaBrtUltima;

      if (precisaSaudar) {
        await enviarTexto(habCfg.saudacao_inicial);
        await supabase
          .from("agente_ia_contatos")
          .update({
            ultima_saudacao_em: new Date().toISOString(),
            cpf_solicitado_em: new Date().toISOString(),
          })
          .eq("id", contato.id);
        console.log(`[agente-consultor-ia] [gate_identificacao] saudação canônica enviada`);
      } else {
        // Continuidade debounced 2min: não fica em silêncio
        const ultimaContinuidade = (contato as any).ultima_msg_continuidade_em
          ? new Date((contato as any).ultima_msg_continuidade_em)
          : null;
        const podeReenviarContinuidade =
          !ultimaContinuidade || (Date.now() - ultimaContinuidade.getTime()) > 2 * 60_000;

        if (podeReenviarContinuidade) {
          await enviarTexto(
            "Entendi! 🙂 Para eu seguir e te ajudar, preciso primeiro do seu *nome completo* ou *CPF* (11 dígitos) — assim localizo seu cadastro.\n\n" +
            "_Se preferir falar com um atendente humano, é só responder *atendente*._"
          );
          await supabase
            .from("agente_ia_contatos")
            .update({ ultima_msg_continuidade_em: new Date().toISOString() })
            .eq("id", contato.id);
          console.log(`[agente-consultor-ia] [gate_identificacao] continuidade enviada (saudação em debounce)`);
        } else {
          console.log(`[agente-consultor-ia] [gate_identificacao] continuidade também em debounce — flood do cliente`);
        }
      }
      return new Response(
        JSON.stringify({ success: true, gate: "aguardando_identificacao" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- 2C. SUPRESSÃO DE SAUDAÇÃO CERIMONIOSA (associado já identificado dentro da janela) ----
    // Quando o associado já-identificado manda uma saudação pura ("oi", "bom dia", "boa tarde", etc.)
    // dentro da janela canônica (mesmo dia BRT E ≤gate_saudacao_horas desde a última interação),
    // injeta instrução no system prompt para a LLM responder curto e cordial, sem repetir saudação
    // de cerimônia nem a saudação de identificação. Regra de tempo lida da config (habCfg).
    let suprimirSaudacaoCerimonia = false;
    if (
      !diretorPreDetectado &&
      !contextoAgendamentoPendente &&
      jaIdentificado &&
      habCfg.gate_saudacao_aplicar_identificados
    ) {
      const textoIdLow = (texto || "").toString().toLowerCase().trim();
      const ehSaudacaoPura =
        /^(oi|olá|ola|hi|hello|bom\s*dia|boa\s*tarde|boa\s*noite|e\s*a[íi]|opa|tudo\s*bem|tudo\s*bom|td\s*bem|blz|beleza)[\s!?.,😀-🙏❤-➿]*$/i
          .test(textoIdLow);
      if (ehSaudacaoPura) {
        const ultimaInterId = contato.ultima_interacao ? new Date(contato.ultima_interacao) : null;
        const horasDesdeUltimaId = ultimaInterId
          ? (Date.now() - ultimaInterId.getTime()) / 3_600_000
          : Infinity;
        const agoraBRTId = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
        const diaBrtAgoraId = `${agoraBRTId.getFullYear()}-${agoraBRTId.getMonth()}-${agoraBRTId.getDate()}`;
        const ultimaBRTId = ultimaInterId
          ? new Date(ultimaInterId.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }))
          : null;
        const diaBrtUltimaId = ultimaBRTId
          ? `${ultimaBRTId.getFullYear()}-${ultimaBRTId.getMonth()}-${ultimaBRTId.getDate()}`
          : null;
        const dentroJanela =
          horasDesdeUltimaId <= habCfg.gate_saudacao_horas && diaBrtAgoraId === diaBrtUltimaId;
        if (dentroJanela) {
          suprimirSaudacaoCerimonia = true;
          console.log(`[agente-consultor-ia] [gate_identificacao] supressao_saudacao_cerimonia ATIVA (janela ${habCfg.gate_saudacao_horas}h, identificado)`);
        }
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

    // Defaults vindos do legado `agente_ia_config`. Serão SOBRESCRITOS abaixo
    // pela habilidade ativa roteada (fonte canônica — `ia_habilidades`).
    let nomeAgente = config.nome_agente || "Atendimento Pratic";
    let apresentacao = config.apresentacao_inicial || "";
    let instrucoes = config.instrucoes_comportamento || "";

    // Gate fora-horário legado (Vinicius/Lead) REMOVIDO em 04/06/26.
    // A habilidade `vendas` foi desativada; `relacionamento` (Atendimento Pratic)
    // atende lead/associado/diretor 24/7. Gate de horário por habilidade
    // permanece no roteador (lib/roteador.ts → checarHorario), aplicado se
    // alguma habilidade definir `horario_atendimento` no banco.

    // Observabilidade: estado da config + audiência inferida nesta requisição
    console.log(`[maya_config] ${JSON.stringify({
      agente_ativo: config.agente_ativo !== "false",
      nome_agente: nomeAgente,
      has_instrucoes: !!instrucoes,
      has_apresentacao: !!apresentacao,
      diretor_pre_detectado: diretorPreDetectado,
    })}`);



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
      // CACHE: se o contato já tem CPF validado e o SGA achou associado em sessão
      // anterior, trata como associado SEM depender de bater telefone (cobre casos
      // em que o WhatsApp diverge do telefone cadastrado em `associados`).
      if (contato.cpf && (contato as any).sga_associado_encontrado === true && contato.nome) {
        isAssociado = true;
        associadoNome = contato.nome;
        associadoStatus = (contato as any).sga_associado_status || "ativo";
        console.log(`[agente-consultor-ia] Associado por CPF cacheado: ${associadoNome} (status: ${associadoStatus})`);
      }

      // Buscar na tabela associados pelo telefone/whatsapp (fallback / fonte canônica quando casa)
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

      // Só sobrescreve dados de associado se NÃO veio do cache (cache é fonte mais confiável,
      // já validada via CPF no SGA).
      if (associadoMatch && !isAssociado) {
        isAssociado = true;
        associadoNome = associadoMatch.nome || "";
        associadoStatus = associadoMatch.status || "";
        console.log(`[agente-consultor-ia] Associado detectado por telefone: ${associadoNome} (status: ${associadoStatus})`);
      } else if (associadoMatch && isAssociado) {
        console.log(`[agente-consultor-ia] Associado por telefone ${associadoMatch.nome} — preservando dados de cache: ${associadoNome}`);
      }

      // Lookup do número de atendimento (Meta API): roda SEMPRE que isAssociado,
      // independente da origem (cache ou telefone).
      if (isAssociado) {
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
      .select("mensagem, direcao, created_at, message_id")
      .or(telefonesBusca.map(t => `telefone.eq.${t}`).join(","))
      .gte("created_at", limiteHistorico)
      .order("created_at", { ascending: true })
      .limit(40);

    // Dedup por message_id: cada saída da Maya pode ter sido gravada 2x na tabela
    // (linha provedor=meta_oficial + linha provedor=evolution) com o MESMO wamid Meta —
    // o WhatsApp recebeu 1x só, mas o modelo lê em dobro e replica o padrão (texto
    // duplicado dentro da mesma resposta). Mantém a 1ª ocorrência por message_id;
    // linhas sem message_id (entradas antigas / inserts sem wamid) passam sem dedup.
    // Não altera o histórico no banco — só a leitura para o modelo.
    const _vistosMid = new Set<string>();
    const historicoUnico = (historico || []).filter((m: any) => {
      const mid = m?.message_id;
      if (!mid) return true;
      if (_vistosMid.has(mid)) return false;
      _vistosMid.add(mid);
      return true;
    });

    let historicoFormatado = historicoUnico
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
    // Observabilidade canônica: log do branch antes de montar o prompt
    const branchPrompt = isDiretor ? "diretor" : isAssociado ? "associado" : "lead";
    const origemAssociado = isAssociado
      ? (associadoEmCache ? "cache" : (sgaAssociadoOverride ? "sga_override" : "telefone"))
      : "none";
    console.log(`[prompt_branch] ${JSON.stringify({
      branch: branchPrompt,
      origem_associado: origemAssociado,
      associado_nome: associadoNome || null,
      associado_status: associadoStatus || null,
      contato_cpf: contato?.cpf || null,
      contato_sga_associado_encontrado: (contato as any)?.sga_associado_encontrado || false,
      contato_nome: contato?.nome || null,
    })}`);

    // ─── GATE CANÔNICO: habilidades de IA (liga/desliga por habilidade) ────────
    // Se nenhuma habilidade ativa cobrir a audiência atual, responde com
    // mensagem de pausa + abre transbordo. Princípio: nunca deixar vácuo.
    // Ver mem://logic/ia/habilidades-canonicas
    let habilidadeSlugAtiva: string | null = null;
    try {
      const audienciaCanonica: IAAudiencia = (isDiretor ? "diretor" : isAssociado ? "associado" : "lead");
      const roteamento = await resolverHabilidade(supabase, audienciaCanonica);
      console.log(`[habilidade_selecionada] ${JSON.stringify({
        audiencia: audienciaCanonica,
        slug: roteamento.habilidade?.slug || null,
        motivo: roteamento.motivo,
      })}`);

      if (!roteamento.habilidade) {
        const msg = roteamento.mensagem_pausa ||
          'Olá! Nosso atendimento por IA está pausado no momento. Em instantes um humano fala com você. 🙏';
        await supabase.functions.invoke("whatsapp-send-text", {
          body: { telefone: telLimpo, mensagem: msg, allow_text: true },
        });
        // Abre pausa/transbordo silencioso para o time atender
        try {
          await supabase.from("whatsapp_ia_pausas").insert({
            telefone: telLimpo,
            motivo: "habilidade_desligada",
            expira_em: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
          });
        } catch (_e) { /* não-bloqueante */ }
        try {
          await supabase.from("agente_ia_contatos").update({
            ultima_habilidade_atendeu: null,
            ultima_habilidade_atendeu_em: new Date().toISOString(),
          }).eq("telefone", telLimpo);
        } catch (_e) { /* não-bloqueante */ }
        return new Response(JSON.stringify({ ok: true, paused: true, motivo: roteamento.motivo }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fora do horário desta habilidade → resposta canônica + transbordo
      const janela = dentroDoHorario(roteamento.habilidade);
      if (!janela.dentro) {
        const msg = janela.mensagem ||
          'Estamos fora do horário de atendimento. Assim que abrir, retornamos. 🙏';
        await supabase.functions.invoke("whatsapp-send-text", {
          body: { telefone: telLimpo, mensagem: msg, allow_text: true },
        });
        return new Response(JSON.stringify({ ok: true, fora_horario: true, slug: roteamento.habilidade.slug }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Carimba qual habilidade respondeu (auditoria)
      try {
        await supabase.from("agente_ia_contatos").update({
          ultima_habilidade_atendeu: roteamento.habilidade.slug,
          ultima_habilidade_atendeu_em: new Date().toISOString(),
        }).eq("telefone", telLimpo);
      } catch (_e) { /* não-bloqueante */ }

      // ── FONTE CANÔNICA DA PERSONA (habilidade) ───────────────────────────
      // A habilidade roteada é a ÚNICA fonte de persona/saudação/instruções a
      // partir de 04/06/26. Legado agente_ia_config / maya_ia_* foi deprecado
      // (mantido como backup). Editar 'relacionamento' nunca afeta 'vendas'.
      const hab: any = roteamento.habilidade;
      habilidadeSlugAtiva = hab.slug;
      if (hab.nome_agente) {
        nomeAgente = hab.nome_agente;
      }
      // apresentacao_inicial (nova coluna) > saudacao_inicial (legado) > config legacy
      if (hab.apresentacao_inicial && String(hab.apresentacao_inicial).trim()) {
        apresentacao = String(hab.apresentacao_inicial).trim();
      } else if (hab.saudacao_inicial) {
        apresentacao = hab.saudacao_inicial;
      }
      // instrucoes_comportamento (nova coluna) entra como bloco-base; persona/tom/regras seguem por cima
      const personaBlocos: string[] = [];
      if (hab.instrucoes_comportamento && String(hab.instrucoes_comportamento).trim()) {
        personaBlocos.push(String(hab.instrucoes_comportamento).trim());
      }
      if (hab.persona) personaBlocos.push(hab.persona);
      if (hab.tom_voz) personaBlocos.push(`Tom de voz: ${hab.tom_voz}`);
      if (hab.regras_absolutas) personaBlocos.push(`Regras absolutas:\n${hab.regras_absolutas}`);
      if (personaBlocos.length) {
        instrucoes = personaBlocos.join("\n\n");
      }
    } catch (err) {
      console.error("[habilidade_selecionada] erro no gate, seguindo fluxo legado", err);
    }
    // ─── fim gate canônico ────────────────────────────────────────────────────

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

## REGRAS DE IDENTIDADE (LEIA ANTES DE TUDO)
- Telefones são COMPARTILHADOS o tempo todo (família, sócio, novo dono). O nome "${associadoNome}" no cabeçalho é a identidade *cacheada* deste telefone — PODE ESTAR ERRADA hoje.
- PROIBIDO cumprimentar pelo primeiro nome ("Oi, Fulano!") até o cliente confirmar a identidade nesta conversa. Use sempre um cumprimento NEUTRO ("Olá!", "Oi, tudo bem?") na primeira resposta do dia.
- PROIBIDO citar marca, modelo, placa, cor ou qualquer dado de veículo de forma PROATIVA. Você só pode mencionar dados de veículo DEPOIS que o cliente trouxe a placa ou descreveu o carro na mensagem atual, OU após uma tool retornar esses dados nesta rodada.
- Em pedidos de assistência (reboque, guincho, pane, chaveiro, etc.), pergunte "Qual veículo? (marca/modelo/placa)" — não assuma um carro do cache.
- Se o cliente disser "não sou X", "meu nome é Y", "esse carro não é meu" ou enviar outro CPF: NUNCA insista no nome antigo. Reconheça com naturalidade ("Tudo bem, me ajuda a localizar o cadastro certo: qual seu *nome completo* ou *CPF*?") e siga o gate.

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
Se for a primeira mensagem do dia e o associado não trouxer pedido específico, use cumprimento NEUTRO (sem citar o primeiro nome):
"Olá! Tudo bem? Sou ${nomeAgente} da PRATICCAR. Como posso te ajudar hoje?"


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
      // === PROMPT PARA LEADS (suporte/FAQ — IA de vendas DESATIVADA) ===
      // A habilidade `vendas` (Vinicius) foi desligada em 04/06/26. Todo
      // contato sem vínculo SGA agora é atendido pela mesma persona de
      // suporte (Atendimento Pratic), com FAQ + transbordo. Sem oferta
      // de planos, sem coleta de placa, sem cotação automática.
      const nomeContato = (contato as any)?.nome || "";
      systemPrompt = `Você é ${nomeAgente}, assistente virtual da PRATICCAR Proteção Veicular.

## CONTEXTO
Você está conversando com um contato que ainda NÃO está identificado como associado(a) ativo(a) no nosso sistema.${nomeContato ? ` Há um nome no histórico (\"${nomeContato}\"), mas pode estar desatualizado — não trate o contato por esse nome até que ele(a) confirme nesta conversa.` : ""}

## SUA FUNÇÃO
Responder dúvidas operacionais usando a BASE DE CONHECIMENTO (FAQ) e transbordar para a equipe humana sempre que o caso exigir decisão, retorno, ação fora da FAQ — OU sempre que o contato quiser contratar/cotar um plano.

## REGRAS ABSOLUTAS
- A IA de vendas está DESATIVADA. NUNCA ofereça planos, valores, descontos, promoções, "adesão grátis", cotação ou link de cotação. NUNCA peça placa para cotar.
- Se o contato pedir cotação, contratação, plano ou orçamento: diga gentilmente que vai transferir para o Relacionamento humano e CHAME *solicitar_atendente_humano* (motivo='pediu_humano', resumo='quer cotar/contratar um plano') na MESMA rodada.
- NUNCA invente valores, prazos, telefones, links, placas ou dados de contrato.
- **PROIBIDO escrever frases como** "vou solicitar à equipe", "já avisei o time", "vou pedir para te ligarem", "fiz a solicitação" sem ter chamado *solicitar_atendente_humano* nesta mesma rodada.
- Seja cordial, curto e direto.

## QUANDO **NÃO** TRANSBORDAR (resolva pela FAQ)
- **Assistência veicular operacional**: reboque, guincho, pane (mecânica/elétrica/combustível), socorro mútuo, chaveiro, bateria, pneu furado, troca de pneu, carro/moto não pega, sem combustível, chave trancada. Esses pedidos são SEMPRE resolvidos enviando os canais da FAQ de Assistência 24h (0800 + WhatsApp da Assistência). NUNCA chame solicitar_atendente_humano para esses casos.
- Qualquer pergunta coberta pela FAQ: responda direto.

## QUANDO CHAMAR A TOOL solicitar_atendente_humano (lista FECHADA)
Chame APENAS quando o contato:
- Pedir para falar com pessoa, atendente, humano, consultor, gerente, vendedor.
- Pedir cotação, contratação, plano novo, simulação de preço — motivo='pediu_humano', resumo='quer cotar/contratar'.
- Mencionar **sinistro real** (acidente, batida, colisão, capotamento, roubo, furto, incêndio, alagamento, vandalismo) — motivo='sinistro_emergencia', prioridade='alta'. ANTES de chamar a tool, envie na mesma rodada os canais da FAQ de Assistência 24h.
- Reclamar de status, fatura, demora, retorno pendente.
- Repetir a mesma queixa numa 2ª mensagem.
- Qualquer pedido que exija decisão humana, alteração de cadastro, cancelamento, negociação.

Ao chamar a tool, escreva no parâmetro \`resumo\` (1 frase) o que o contato quer.

## SAUDAÇÃO INICIAL
Se for a primeira mensagem do dia OU se o contato ainda não foi cumprimentado, use uma saudação NEUTRA e SEM nome:
"Olá! 👋 Sou ${nomeAgente} da PRATICCAR. Como posso te ajudar hoje?"

## FORMATAÇÃO
- Use formatação WhatsApp: *negrito*, _itálico_.
- NUNCA use Markdown: **duplo**, ## títulos.
- Respostas curtas (no máximo 2 parágrafos).

## DATA E HORA ATUAL
${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;

      tools = [
        {
          type: "function",
          function: {
            name: "solicitar_atendente_humano",
            description: "Transfere o atendimento para a equipe humana de Relacionamento. Use SEMPRE que o contato pedir para falar com pessoa, pedir cotação/contratação de plano, reportar sinistro/emergência, reclamar de algo grave, ou pedir suporte fora do escopo da FAQ. Após chamar, a IA fica pausada e o operador humano assume.",
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
                  description: "Uma frase descrevendo o que o contato quer (ex: 'quer cotar Civic 2020').",
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

    // Supressão de saudação cerimoniosa: conversa em andamento hoje, dentro da janela canônica.
    if (suprimirSaudacaoCerimonia) {
      const primeiroNome = (contato.nome || "").trim().split(/\s+/)[0] || "";
      systemPrompt += `\n\n## CONVERSA EM ANDAMENTO — NÃO RESSAUDE\nO cliente já está em conversa ativa hoje (dentro da janela de ${habCfg.gate_saudacao_horas}h). Ele apenas mandou um cumprimento curto ("oi", "bom dia", etc.). NÃO repita a saudação de identificação ("Olá! Tudo bem? Para iniciarmos..."), NÃO use cerimônia de abertura de turno ("Como posso ajudá-lo hoje?", "Em que podemos te ajudar hoje?"). Responda curto e cordial usando o primeiro nome${primeiroNome ? ` (ex: "Oi, ${primeiroNome}! Como posso ajudar?")` : ""}. Se houver assunto/pedido na mesma mensagem, vá direto ao assunto sem rodeios.`;
    }



    // Contexto de AGENDAMENTO PENDENTE — espelha cobranca/CPF, com tools p/ agir
    if (contextoAgendamentoPendente) {
      const c = contextoAgendamentoPendente;
      const dataFmt = c.data ? (() => { const [y, m, d] = c.data!.split("-"); return `${d}/${m}/${y}`; })() : "—";
      const periodoFmt = c.periodo === "manha" ? "manhã" : c.periodo === "tarde" ? "tarde" : (c.hora || c.periodo || "—");
      const tipoFmt = (c.tipo || "atendimento").replace(/_/g, " ");
      const nomeFmt = c.nome_cliente ? c.nome_cliente.split(" ")[0] : "o cliente";
      systemPrompt += `\n\n## CONTEXTO DE AGENDAMENTO PENDENTE (USE COMO VERDADE)
Foi enviado a este contato em ${new Date(c.enviado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} um pedido de confirmação de ${tipoFmt}:
- Cliente: *${c.nome_cliente || "—"}*
- Data: *${dataFmt}* (${periodoFmt})
- Endereço: ${c.endereco || "—"}
- servico_id: ${c.servico_id}

REGRAS OBRIGATÓRIAS deste contexto:
- NÃO peça CPF. O contato já está identificado pelo agendamento.
- Trate ${nomeFmt} pelo primeiro nome.
- Se a mensagem expressar reagendar / remarcar / mudar / outro dia / outro horário / não posso / impossível / adiar / hoje não / amanhã não → CHAME *enviar_link_reagendamento* (servico_id="${c.servico_id}") na MESMA rodada e responda algo curto e cordial avisando que enviou o link.
- Se confirmar (sim / ok / confirmo / pode vir / estarei / tudo certo) → CHAME *confirmar_agendamento* (servico_id="${c.servico_id}") e agradeça a confirmação.
- Se cancelar → CHAME *solicitar_atendente_humano* (motivo='outros', resumo='cliente quer cancelar agendamento') porque cancelamento exige humano.
- NUNCA prometa que "alguém vai entrar em contato" — chame a tool e diga o que ela faz.
- NUNCA invente data, hora ou endereço diferentes do bloco acima.`;

      // Acrescenta tools de agendamento (idempotente: só se ainda não existirem)
      const haveReagendar = tools.some((t: any) => t?.function?.name === "enviar_link_reagendamento");
      if (!haveReagendar) {
        tools.push({
          type: "function",
          function: {
            name: "enviar_link_reagendamento",
            description: "Envia ao cliente um link (via template WhatsApp Meta 'reagendamento_servico') para escolher uma nova data/horário/endereço do serviço de campo. Use SEMPRE que o cliente pedir para reagendar, remarcar, mudar data, dizer 'não posso hoje', 'outro dia', 'adiar'.",
            parameters: {
              type: "object",
              properties: {
                servico_id: { type: "string", description: "ID do serviço pendente (use o servico_id do CONTEXTO DE AGENDAMENTO PENDENTE)." },
              },
              required: ["servico_id"],
            },
          },
        });
        tools.push({
          type: "function",
          function: {
            name: "confirmar_agendamento",
            description: "Confirma o agendamento pendente do cliente. Use SEMPRE que o cliente responder afirmativamente (sim, ok, confirmo, pode vir, estarei, beleza, blz, positivo, tudo certo). Marca o serviço como confirmado e notifica o profissional.",
            parameters: {
              type: "object",
              properties: {
                servico_id: { type: "string", description: "ID do serviço (use o servico_id do CONTEXTO DE AGENDAMENTO PENDENTE)." },
              },
              required: ["servico_id"],
            },
          },
        });
      }
    }


    // ---- 7.4 INJEÇÃO DE COMPORTAMENTO DA HABILIDADE ATIVA ──────────────────
    // Aplica apresentacao_inicial + instrucoes_comportamento que VIERAM DA
    // HABILIDADE ROTEADA (ia_habilidades). O gate canônico (bloco 6) já
    // sobrescreveu `apresentacao` e `instrucoes` com as colunas próprias da
    // habilidade — aqui só renderizamos no prompt. Conteúdo da habilidade
    // 'vendas' nunca vaza para a 'relacionamento' e vice-versa.
    if (instrucoes.trim() || apresentacao.trim()) {
      const blocosCfg: string[] = [];
      if (instrucoes.trim()) {
        blocosCfg.push(`### INSTRUÇÕES DE COMPORTAMENTO\n${instrucoes.trim()}`);
      }
      if (apresentacao.trim()) {
        blocosCfg.push(`### APRESENTAÇÃO INICIAL (use como base na primeira mensagem)\n"${apresentacao.trim()}"`);
      }
      const tituloHab = habilidadeSlugAtiva ? ` — habilidade "${habilidadeSlugAtiva}"` : "";
      systemPrompt += `\n\n## CONFIGURAÇÃO DA HABILIDADE${tituloHab}\n${blocosCfg.join("\n\n")}`;
    }



    // ---- 7.5 BASE DE CONHECIMENTO + EXEMPLOS DA HABILIDADE ATIVA ───────────
    // Fonte canônica única pós-04/06/26: ia_habilidade_conhecimento +
    // ia_habilidade_exemplos, filtrados por slug da habilidade roteada.
    // Tabelas legadas maya_ia_* não são mais lidas em runtime (backup apenas).
    if (habilidadeSlugAtiva) {
      try {
        const habCfg = await loadHabilidadeContent(supabase, habilidadeSlugAtiva, texto || "");
        if (habCfg.faqDestaqueText) {
          systemPrompt += `\n\n## FAQ EM DESTAQUE PARA ESTA MENSAGEM (LEIA PRIMEIRO)\nA mensagem do cliente casou com a(s) entrada(s) abaixo da base de conhecimento desta habilidade. Use o conteúdo delas como resposta — não invente, não desvie, não transborde se a FAQ já cobre o pedido.\n\n${habCfg.faqDestaqueText}`;
          console.log(`[agente-consultor-ia] FAQ em destaque (${habCfg.faqMatchedIds?.length || 0}) [hab=${habilidadeSlugAtiva}]: ${(habCfg.faqMatchedIds || []).join(",")}`);
        }
        if (habCfg.faqText) {
          systemPrompt += `\n\n## BASE DE CONHECIMENTO DA HABILIDADE (FAQ)\nResponda usando estas informações sempre que a pergunta do cliente casar com algum item. Não invente o que não estiver aqui. Itens da categoria *direcionamento* são respostas prontas para assuntos fora do escopo desta habilidade — use-os no lugar de transbordar ou de executar.\n\n${habCfg.faqText}`;
        }
        if (habCfg.exemplosText) {
          systemPrompt += `\n\n## EXEMPLOS DE RESPOSTA (mesma habilidade)\nUse como referência de tom e formato.\n\n${habCfg.exemplosText}`;
        }
      } catch (e) {
        console.error(`[agente-consultor-ia] Falha ao carregar conteúdo da habilidade '${habilidadeSlugAtiva}':`, (e as any)?.message);
      }
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
            } else if (fnName === "enviar_link_reagendamento") {
              toolResult = await executarEnviarLinkReagendamento(
                supabaseUrl,
                serviceKey,
                { servico_id: String(args?.servico_id || contextoAgendamentoPendente?.servico_id || "") }
              );
            } else if (fnName === "confirmar_agendamento") {
              toolResult = await executarConfirmarAgendamento(
                supabase,
                supabaseUrl,
                serviceKey,
                { servico_id: String(args?.servico_id || contextoAgendamentoPendente?.servico_id || ""), telefone: telLimpo }
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
    // Validador de saída: garante começo, meio e fim — Maya nunca manda string vazia/só whitespace
    const respostaFinal = (resposta || "").toString().trim() ||
      ("Recebi sua mensagem! 🙂 Pode reformular pra eu te ajudar? " +
       "Se preferir falar com um *atendente humano*, é só responder *atendente*.");
    if (respostaFinal !== resposta) {
      console.warn(`[agente-consultor-ia] validador_saida: resposta substituída por fallback (vazia) tel=${telLimpo}`);
    }

    const partes = dividirMensagem(respostaFinal, 1000);

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
    // Maya nunca deixa vácuo: mesmo em erro inesperado, manda uma mensagem ao cliente
    // (com debounce próprio de 2 min por telefone para não floodar caso o erro se repita)
    try {
      if (telefoneAtual) {
        const telLimpoCatch = telefoneAtual.replace(/\D/g, "");
        const { data: ct } = await supabase
          .from("agente_ia_contatos")
          .select("id, ultima_msg_continuidade_em")
          .eq("telefone", telLimpoCatch)
          .maybeSingle();
        const ultima = ct?.ultima_msg_continuidade_em ? new Date(ct.ultima_msg_continuidade_em) : null;
        const podeMandar = !ultima || (Date.now() - ultima.getTime()) > 2 * 60_000;
        if (podeMandar) {
          await fetch(`${supabaseUrl}/functions/v1/whatsapp-send-text`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
            body: JSON.stringify({
              telefone: telefoneAtual,
              mensagem:
                "Tive um probleminha técnico aqui agora 😅\n\n" +
                "Pode me mandar sua mensagem de novo em alguns segundos? " +
                "Se preferir, posso te transferir para um *atendente humano* — é só responder *atendente*.",
              allow_text: true,
            }),
          });
          if (ct?.id) {
            await supabase
              .from("agente_ia_contatos")
              .update({ ultima_msg_continuidade_em: new Date().toISOString() })
              .eq("id", ct.id);
          }
          console.warn(`[agente-consultor-ia] fallback_vacuo_catch_raiz: enviado tel=${telLimpoCatch}`);
        } else {
          console.warn(`[agente-consultor-ia] fallback_vacuo_catch_raiz: debounce ativo tel=${telLimpoCatch}`);
        }
      }
    } catch (fallbackErr) {
      console.error("[agente-consultor-ia] falha ao enviar fallback de catch raiz:", (fallbackErr as any)?.message);
    }
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

// ============================================================
// TOOL: enviar_link_reagendamento
// Invoca a edge `enviar-link-reagendamento` (template Meta).
// ============================================================
async function executarEnviarLinkReagendamento(
  supabaseUrl: string,
  serviceKey: string,
  args: { servico_id: string }
): Promise<any> {
  if (!args.servico_id) return { success: false, error: "servico_id obrigatório" };
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/enviar-link-reagendamento`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ servico_id: args.servico_id, origem: "agente_ia" }),
    });
    const txt = await res.text();
    let body: any = null;
    try { body = txt ? JSON.parse(txt) : null; } catch { body = { raw: txt }; }
    if (!res.ok) {
      console.error(`[agente-consultor-ia] enviar_link_reagendamento HTTP ${res.status}:`, txt?.slice(0, 200));
      return { success: false, error: `Edge respondeu ${res.status}`, body };
    }
    console.log(`[agente-consultor-ia] enviar_link_reagendamento OK servico=${args.servico_id}`);
    return { success: true, message: "Link de reagendamento enviado via WhatsApp.", body };
  } catch (e: any) {
    console.error(`[agente-consultor-ia] Erro enviar_link_reagendamento:`, e?.message);
    return { success: false, error: e?.message || "Erro desconhecido" };
  }
}

// ============================================================
// TOOL: confirmar_agendamento
// Atualiza confirmacoes_agendamento + servicos e notifica profissional.
// ============================================================
async function executarConfirmarAgendamento(
  supabase: any,
  supabaseUrl: string,
  serviceKey: string,
  args: { servico_id: string; telefone: string }
): Promise<any> {
  if (!args.servico_id) return { success: false, error: "servico_id obrigatório" };
  const agora = new Date().toISOString();
  try {
    // Busca a confirmacao pendente
    const { data: conf } = await supabase
      .from("confirmacoes_agendamento")
      .select("id, status")
      .eq("servico_id", args.servico_id)
      .in("status", ["enviada", "reagendando", "aguardando_confirmacao_vespera", "aguardando_confirmacao_manha", "aguardando_confirmacao_encaixe"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (conf?.id) {
      const { error: e1 } = await supabase
        .from("confirmacoes_agendamento")
        .update({ status: "confirmada", resposta_cliente: "[via IA]", resposta_recebida_em: agora })
        .eq("id", conf.id);
      if (e1) console.error("[agente-consultor-ia] erro update confirmacao:", e1);
    }

    const { error: e2 } = await supabase
      .from("servicos")
      .update({ confirmacao_whatsapp: "confirmada", confirmado_via_whatsapp_em: agora })
      .eq("id", args.servico_id);
    if (e2) console.error("[agente-consultor-ia] erro update servico:", e2);

    // Buscar profissional para push (best-effort)
    try {
      const { data: serv } = await supabase
        .from("servicos")
        .select("profissional_id, hora_agendada, associado:associados(nome)")
        .eq("id", args.servico_id)
        .maybeSingle();
      if (serv?.profissional_id) {
        const nomeCliente = serv?.associado?.nome || "Cliente";
        fetch(`${supabaseUrl}/functions/v1/send-push-profissional`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({
            profissional_id: serv.profissional_id,
            notification: {
              title: "✅ Cliente Confirmou!",
              body: `${String(nomeCliente).split(" ")[0]} confirmou via IA`,
              tag: `confirmacao-${args.servico_id}`,
              data: { servico_id: args.servico_id, action: "confirmacao_whatsapp" },
            },
          }),
        }).catch(() => {});
      }
    } catch (_) { /* fire-and-forget */ }

    console.log(`[agente-consultor-ia] confirmar_agendamento OK servico=${args.servico_id}`);
    return { success: true, message: "Agendamento confirmado." };
  } catch (e: any) {
    console.error(`[agente-consultor-ia] Erro confirmar_agendamento:`, e?.message);
    return { success: false, error: e?.message || "Erro desconhecido" };
  }
}

