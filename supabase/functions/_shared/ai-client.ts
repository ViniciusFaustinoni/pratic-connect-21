/**
 * Cliente unificado de IA. Roteia chamadas para Lovable AI Gateway,
 * OpenAI direto ou Anthropic direto, conforme `ai_model_config` global.
 *
 * Mantém payload compatível com o formato OpenAI Chat Completions
 * (messages, tools, response_format). Para Anthropic, faz adaptação
 * de mensagens/ferramentas e converte a resposta de volta no shape OpenAI
 * para que o código existente continue funcionando.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type AIProvider = "lovable" | "openai" | "anthropic";

export interface AIConfig {
  provider: AIProvider;
  model: string;
}

const DEFAULT_CONFIG: AIConfig = {
  provider: "lovable",
  model: "google/gemini-3-flash-preview",
};

let _cache: { value: AIConfig; ts: number } | null = null;
const CACHE_TTL_MS = 30_000;

const _keyCache: Record<string, { value: string | null; ts: number }> = {};

/**
 * Busca a chave do provedor preferindo a tabela `ai_provider_keys` (configurada
 * pela UI) e caindo para a env var como fallback.
 */
export async function getProviderKey(provider: "openai" | "anthropic"): Promise<string | null> {
  const cached = _keyCache[provider];
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.value;

  let value: string | null = null;
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (url && srk) {
      const sb = createClient(url, srk);
      const { data } = await sb
        .from("ai_provider_keys")
        .select("api_key")
        .eq("provider", provider)
        .maybeSingle();
      if (data?.api_key) value = data.api_key as string;
    }
  } catch (e) {
    console.warn(`[ai-client] falha lendo ai_provider_keys(${provider})`, e);
  }
  if (!value) {
    value = Deno.env.get(provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY") ?? null;
  }
  _keyCache[provider] = { value, ts: Date.now() };
  return value;
}

export async function getActiveAIConfig(): Promise<AIConfig> {
  if (_cache && Date.now() - _cache.ts < CACHE_TTL_MS) return _cache.value;
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return DEFAULT_CONFIG;
    const sb = createClient(url, key);
    const { data } = await sb
      .from("ai_model_config")
      .select("provider, model")
      .limit(1)
      .maybeSingle();
    const value: AIConfig = data
      ? { provider: data.provider as AIProvider, model: data.model }
      : DEFAULT_CONFIG;
    _cache = { value, ts: Date.now() };
    return value;
  } catch (e) {
    console.warn("[ai-client] falha lendo ai_model_config, usando default", e);
    return DEFAULT_CONFIG;
  }
}

export interface CallAIOptions {
  messages: any[];
  tools?: any[];
  tool_choice?: any;
  response_format?: any;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  /** Força provider/model — se omitido, usa config global. */
  override?: Partial<AIConfig>;
  /** Se true e provider escolhido falhar por chave/erro grave, cai no Lovable Gateway. */
  fallbackToLovable?: boolean;
}

export interface CallAIResult {
  ok: boolean;
  status: number;
  /** Resposta no formato OpenAI Chat Completions (choices[0].message...). */
  data?: any;
  /** Resposta crua para streaming. */
  rawResponse?: Response;
  errorMessage?: string;
}

/**
 * Chama IA respeitando configuração global. Para chamadas streaming, retorna
 * `rawResponse` (Response) — caller deve repassar o body.
 */
export async function callAI(opts: CallAIOptions): Promise<CallAIResult> {
  const cfg: AIConfig = {
    provider: opts.override?.provider ?? (await getActiveAIConfig()).provider,
    model: opts.override?.model ?? (await getActiveAIConfig()).model,
  };

  const blockTypes = summarizeMessageBlocks(opts.messages);
  const t0 = Date.now();
  console.log(`[ai-client][call] ${JSON.stringify({
    provider: cfg.provider,
    model: cfg.model,
    messages: opts.messages?.length ?? 0,
    block_types: blockTypes,
    has_tools: !!(opts.tools && opts.tools.length),
    max_tokens: opts.max_tokens,
    stream: !!opts.stream,
  })}`);

  try {
    let result: CallAIResult;
    if (cfg.provider === "openai") result = await callOpenAI(cfg, opts);
    else if (cfg.provider === "anthropic") result = await callAnthropic(cfg, opts);
    else result = await callLovable(cfg, opts);

    console.log(`[ai-client][resp] ${JSON.stringify({
      provider: cfg.provider,
      model: cfg.model,
      status: result.status,
      ok: result.ok,
      latencyMs: Date.now() - t0,
      errorMessage: result.errorMessage ? String(result.errorMessage).slice(0, 200) : undefined,
    })}`);
    return result;
  } catch (err: any) {
    console.warn(`[ai-client][resp] ${JSON.stringify({
      provider: cfg.provider,
      model: cfg.model,
      status: 0,
      ok: false,
      latencyMs: Date.now() - t0,
      errorMessage: String(err?.message ?? err).slice(0, 200),
    })}`);
    if (opts.fallbackToLovable !== false && cfg.provider !== "lovable") {
      console.warn(`[ai-client][fallback] ${cfg.provider} → lovable (motivo: ${err?.message ?? "throw"})`);
      return await callLovable(DEFAULT_CONFIG, opts);
    }
    return { ok: false, status: 500, errorMessage: err?.message ?? "AI call failed" };
  }
}

/** Resume os tipos de blocos (text/image_url/document) para fins de log. */
function summarizeMessageBlocks(messages: any[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const m of messages ?? []) {
    if (typeof m?.content === "string") {
      counts.text = (counts.text ?? 0) + 1;
      continue;
    }
    if (Array.isArray(m?.content)) {
      for (const part of m.content) {
        const t = part?.type ?? "unknown";
        // Detecta PDF dentro de image_url data-URI
        if (t === "image_url" && typeof part?.image_url?.url === "string") {
          const url = part.image_url.url as string;
          if (url.startsWith("data:application/pdf")) {
            counts.pdf_data = (counts.pdf_data ?? 0) + 1;
            continue;
          }
          if (/\.pdf(\?|$)/i.test(url)) {
            counts.pdf_url = (counts.pdf_url ?? 0) + 1;
            continue;
          }
          counts.image = (counts.image ?? 0) + 1;
          continue;
        }
        counts[t] = (counts[t] ?? 0) + 1;
      }
    }
  }
  return counts;
}

// ─────────────────────────────────────────── Lovable AI Gateway

async function callLovable(cfg: AIConfig, opts: CallAIOptions): Promise<CallAIResult> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

  const body: any = {
    model: cfg.model.startsWith("google/") || cfg.model.startsWith("openai/")
      ? cfg.model
      : `google/${cfg.model}`,
    messages: opts.messages,
  };
  if (opts.tools) body.tools = opts.tools;
  if (opts.tool_choice) body.tool_choice = opts.tool_choice;
  if (opts.response_format) body.response_format = opts.response_format;
  if (typeof opts.temperature === "number") body.temperature = opts.temperature;
  if (typeof opts.max_tokens === "number") body.max_tokens = opts.max_tokens;
  if (opts.stream) body.stream = true;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (opts.stream) {
    return { ok: resp.ok, status: resp.status, rawResponse: resp };
  }

  const text = await resp.text();
  const data = safeJSON(text);
  if (!resp.ok) {
    return { ok: false, status: resp.status, data, errorMessage: data?.error?.message ?? text };
  }
  return { ok: true, status: 200, data };
}

// ─────────────────────────────────────────── OpenAI direto

async function callOpenAI(cfg: AIConfig, opts: CallAIOptions): Promise<CallAIResult> {
  const apiKey = await getProviderKey("openai");
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada");

  const body: any = {
    model: stripPrefix(cfg.model, "openai/"),
    messages: opts.messages,
  };
  if (opts.tools) body.tools = opts.tools;
  if (opts.tool_choice) body.tool_choice = opts.tool_choice;
  if (opts.response_format) body.response_format = opts.response_format;
  if (typeof opts.temperature === "number") body.temperature = opts.temperature;
  if (typeof opts.max_tokens === "number") body.max_tokens = opts.max_tokens;
  if (opts.stream) body.stream = true;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (opts.stream) {
    return { ok: resp.ok, status: resp.status, rawResponse: resp };
  }

  const text = await resp.text();
  const data = safeJSON(text);
  if (!resp.ok) {
    return { ok: false, status: resp.status, data, errorMessage: data?.error?.message ?? text };
  }
  return { ok: true, status: 200, data };
}

// ─────────────────────────────────────────── Anthropic direto (adaptador)

async function callAnthropic(cfg: AIConfig, opts: CallAIOptions): Promise<CallAIResult> {
  const apiKey = await getProviderKey("anthropic");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada");

  // Separa system messages
  const sys: string[] = [];
  const userMsgs: any[] = [];
  let hasDocumentBlock = false;
  for (const m of opts.messages) {
    if (m.role === "system") {
      sys.push(typeof m.content === "string" ? m.content : JSON.stringify(m.content));
      continue;
    }
    const converted = toAnthropicMessage(m);
    if (Array.isArray(converted.content) && converted.content.some((b: any) => b?.type === "document")) {
      hasDocumentBlock = true;
    }
    userMsgs.push(converted);
  }

  const body: any = {
    model: stripPrefix(cfg.model, "anthropic/"),
    max_tokens: opts.max_tokens ?? 4096,
    messages: userMsgs,
  };
  if (sys.length) body.system = sys.join("\n\n");
  if (typeof opts.temperature === "number") body.temperature = opts.temperature;
  if (opts.tools && opts.tools.length) body.tools = opts.tools.map(toAnthropicTool);

  const headers: Record<string, string> = {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
  };
  // PDFs precisam do beta header em modelos mais antigos; inofensivo em Sonnet 4.5+
  if (hasDocumentBlock) headers["anthropic-beta"] = "pdfs-2024-09-25";

  // Streaming não é suportado neste adaptador; cai pra non-stream.
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const text = await resp.text();
  const data = safeJSON(text);
  if (!resp.ok) {
    return { ok: false, status: resp.status, data, errorMessage: data?.error?.message ?? text };
  }

  // Converter resposta Anthropic → OpenAI shape
  const openaiShape = anthropicToOpenAI(data);
  return { ok: true, status: 200, data: openaiShape };
}

function toAnthropicMessage(m: any) {
  // m.content pode ser string ou array de partes (text/image_url)
  if (typeof m.content === "string") {
    return { role: m.role === "assistant" ? "assistant" : "user", content: m.content };
  }
  if (Array.isArray(m.content)) {
    const SUPPORTED_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
    const blocks = m.content.map((p: any) => {
      if (p.type === "text") return { type: "text", text: p.text };
      if (p.type === "image_url") {
        const url = p.image_url?.url ?? "";
        if (url.startsWith("data:")) {
          const [meta, b64] = url.split(",");
          const media_type = meta.replace("data:", "").replace(";base64", "").toLowerCase();
          // PDF → bloco "document" (Anthropic suporta PDF nativo)
          if (media_type === "application/pdf") {
            return { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } };
          }
          if (SUPPORTED_IMAGE_MIMES.has(media_type)) {
            return { type: "image", source: { type: "base64", media_type, data: b64 } };
          }
          // MIME não suportado: degrada para texto descritivo em vez de quebrar a request
          return { type: "text", text: `[anexo não suportado: ${media_type}]` };
        }
        // URL http(s)
        const lower = url.toLowerCase();
        if (lower.endsWith(".pdf") || lower.includes(".pdf?")) {
          return { type: "document", source: { type: "url", url } };
        }
        return { type: "image", source: { type: "url", url } };
      }
      return { type: "text", text: JSON.stringify(p) };
    });
    return { role: m.role === "assistant" ? "assistant" : "user", content: blocks };
  }
  return { role: "user", content: String(m.content ?? "") };
}

function toAnthropicTool(t: any) {
  // OpenAI: { type:'function', function:{ name, description, parameters } }
  const fn = t.function ?? t;
  return {
    name: fn.name,
    description: fn.description ?? "",
    input_schema: fn.parameters ?? { type: "object", properties: {} },
  };
}

function anthropicToOpenAI(resp: any) {
  const blocks: any[] = resp?.content ?? [];
  let text = "";
  const tool_calls: any[] = [];
  for (const b of blocks) {
    if (b.type === "text") text += b.text;
    if (b.type === "tool_use") {
      tool_calls.push({
        id: b.id,
        type: "function",
        function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
      });
    }
  }
  const message: any = { role: "assistant", content: text || null };
  if (tool_calls.length) message.tool_calls = tool_calls;
  return {
    id: resp?.id,
    model: resp?.model,
    choices: [{ index: 0, message, finish_reason: resp?.stop_reason ?? "stop" }],
    usage: resp?.usage,
  };
}

// ─────────────────────────────────────────── helpers

function safeJSON(s: string) {
  try { return JSON.parse(s); } catch { return null; }
}

function stripPrefix(s: string, p: string) {
  return s.startsWith(p) ? s.slice(p.length) : s;
}

// ─────────────────────────────────────────────────────────────────────────────
// Drop-in replacement para chamadas legadas que faziam:
//   fetch("https://ai.gateway.lovable.dev/v1/chat/completions", { method, headers, body })
// Uso:
//   const resp = await aiGatewayFetch({ method, headers, body });
// `body` deve ser uma string JSON (igual ao código antigo). Streaming suportado.
// Retorna sempre um `Response` no shape OpenAI Chat Completions (compatível
// com o que `ai.gateway.lovable.dev` devolvia), permitindo trocar 1 linha em
// cada edge function existente.
// ─────────────────────────────────────────────────────────────────────────────
export async function aiGatewayFetch(init: {
  method?: string;
  headers?: Record<string, string>;
  body: string | Uint8Array;
}): Promise<Response> {
  let parsed: any;
  try {
    parsed = typeof init.body === "string"
      ? JSON.parse(init.body)
      : JSON.parse(new TextDecoder().decode(init.body));
  } catch {
    return new Response(JSON.stringify({ error: { message: "invalid body" } }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const cfg = await getActiveAIConfig();
  const stream = !!parsed.stream;

  // Streaming Anthropic não é suportado pelo adaptador → cai pra Lovable.
  const effectiveProvider: AIProvider =
    (stream && cfg.provider === "anthropic") ? "lovable" : cfg.provider;

  const opts: CallAIOptions = {
    messages: parsed.messages,
    tools: parsed.tools,
    tool_choice: parsed.tool_choice,
    response_format: parsed.response_format,
    temperature: parsed.temperature,
    max_tokens: parsed.max_tokens ?? parsed.max_completion_tokens,
    stream,
    override: {
      provider: effectiveProvider,
      // Se config global é Lovable, respeita o modelo pedido pela função;
      // caso contrário usa o modelo configurado globalmente.
      model: (effectiveProvider === "lovable" && cfg.provider === "lovable" && parsed.model)
        ? parsed.model
        : cfg.model,
    },
  };

  let result = await callAI(opts);

  if (stream && result.rawResponse) return result.rawResponse;

  // Fallback automático: se provider escolhido não-Lovable retornou erro recuperável,
  // tenta Lovable Gateway antes de devolver erro pro caller.
  if (!result.ok && effectiveProvider !== "lovable") {
    const recoverable = !result.status || result.status >= 500 || result.status === 400 || result.status === 401 || result.status === 402 || result.status === 429;
    if (recoverable) {
      console.warn(`[ai-client] provider=${effectiveProvider} status=${result.status} msg="${result.errorMessage}" → tentando fallback Lovable`);
      const fbResult = await callAI({ ...opts, override: { provider: "lovable", model: DEFAULT_CONFIG.model } });
      if (fbResult.ok) result = fbResult;
      else console.warn(`[ai-client] fallback Lovable também falhou: status=${fbResult.status} msg="${fbResult.errorMessage}"`);
    }
  }

  if (!result.ok) {
    return new Response(
      JSON.stringify(result.data ?? { error: { message: result.errorMessage } }),
      { status: result.status || 500, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify(result.data), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
}
