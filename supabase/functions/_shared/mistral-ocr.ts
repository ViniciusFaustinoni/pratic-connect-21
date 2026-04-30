/**
 * Cliente para Mistral OCR (https://docs.mistral.ai/capabilities/document/).
 *
 * - `mistral-ocr-latest`  → endpoint /v1/ocr, devolve markdown estruturado
 *   por página (com bbox). Aceita PDF e imagem.
 * - `pixtral-large-latest` → chat com visão, usado para mapear o markdown
 *   resultante para o schema JSON do Pratic (tipo_detectado, dados, etc.).
 *
 * Chave: MISTRAL_API_KEY (env var) ou linha em ai_provider_keys (provider='mistral').
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const MISTRAL_BASE = "https://api.mistral.ai/v1";

let _keyCache: { value: string | null; ts: number } | null = null;
const TTL = 30_000;

export async function getMistralKey(): Promise<string | null> {
  if (_keyCache && Date.now() - _keyCache.ts < TTL) return _keyCache.value;
  let value: string | null = null;
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (url && srk) {
      const sb = createClient(url, srk);
      const { data } = await sb
        .from("ai_provider_keys")
        .select("api_key")
        .eq("provider", "mistral")
        .maybeSingle();
      if (data?.api_key) value = data.api_key as string;
    }
  } catch (e) {
    console.warn("[mistral] erro lendo ai_provider_keys", (e as Error)?.message);
  }
  if (!value) value = Deno.env.get("MISTRAL_API_KEY") ?? null;
  _keyCache = { value, ts: Date.now() };
  return value;
}

export interface MistralOcrPage {
  index: number;
  markdown: string;
  images?: any[];
}

export interface MistralOcrResult {
  pages: MistralOcrPage[];
  /** Markdown concatenado de todas as páginas, separadas por linha em branco. */
  markdown: string;
}

/**
 * Roda OCR via Mistral. `document` pode ser:
 *   - { type: "document_url", document_url: "https://..." }
 *   - { type: "image_url", image_url: "https://..." | data-uri }
 *
 * Para PDFs grandes, prefira URL pública/signed URL em vez de data-uri
 * (evita estourar limite de payload).
 */
export async function runMistralOcr(input: {
  type: "document_url" | "image_url";
  url: string;
  model?: string;
}): Promise<{ ok: boolean; status: number; result?: MistralOcrResult; error?: string }> {
  const key = await getMistralKey();
  if (!key) return { ok: false, status: 401, error: "MISTRAL_API_KEY ausente" };

  const body =
    input.type === "document_url"
      ? { model: input.model ?? "mistral-ocr-latest", document: { type: "document_url", document_url: input.url } }
      : { model: input.model ?? "mistral-ocr-latest", document: { type: "image_url", image_url: input.url } };

  const t0 = Date.now();
  let resp: Response;
  try {
    resp = await fetch(`${MISTRAL_BASE}/ocr`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, status: 0, error: `network: ${(e as Error)?.message ?? e}` };
  }

  const text = await resp.text();
  console.log(`[mistral-ocr] ${JSON.stringify({ status: resp.status, latencyMs: Date.now() - t0, bytes: text.length })}`);

  let data: any = null;
  try { data = JSON.parse(text); } catch { /* ignore */ }

  if (!resp.ok) {
    const friendly =
      resp.status === 401 ? "Chave Mistral inválida" :
      resp.status === 402 ? "Sem créditos no Mistral" :
      resp.status === 429 ? "Mistral rate-limit" :
      data?.error?.message ?? text.slice(0, 300);
    return { ok: false, status: resp.status, error: friendly };
  }

  const pages: MistralOcrPage[] = (data?.pages ?? []).map((p: any, i: number) => ({
    index: p?.index ?? i,
    markdown: p?.markdown ?? "",
    images: p?.images,
  }));
  return {
    ok: true,
    status: 200,
    result: { pages, markdown: pages.map((p) => p.markdown).join("\n\n") },
  };
}

/**
 * Pixtral chat: usado para estruturar o markdown do OCR no schema do Pratic.
 * Mantém o mesmo system prompt JSON e devolve `choices[0].message.content`.
 */
export async function callPixtralChat(opts: {
  messages: any[];
  max_tokens?: number;
  temperature?: number;
  model?: string;
}): Promise<{ ok: boolean; status: number; data?: any; error?: string }> {
  const key = await getMistralKey();
  if (!key) return { ok: false, status: 401, error: "MISTRAL_API_KEY ausente" };

  const body = {
    model: opts.model ?? "pixtral-large-latest",
    messages: opts.messages,
    max_tokens: opts.max_tokens ?? 4096,
    temperature: opts.temperature ?? 0,
  };
  const resp = await fetch(`${MISTRAL_BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { /* ignore */ }
  if (!resp.ok) return { ok: false, status: resp.status, error: data?.error?.message ?? text.slice(0, 300) };
  return { ok: true, status: 200, data };
}
