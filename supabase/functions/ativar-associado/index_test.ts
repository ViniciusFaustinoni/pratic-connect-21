// Contract tests for ativar-associado (Fase 6)
// Validam o "shape" do contrato sem depender de dados reais:
// - missing fields => 400
// - invalid JSON => 400
// - associado inexistente => 404
// - método OPTIONS => 200 com CORS
// Esses testes batem na função deployada e NÃO modificam estado de produção
// (usam UUIDs aleatórios que não existem em associados).

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/ativar-associado`;

function randomUuid() {
  return crypto.randomUUID();
}

async function call(body: unknown, opts: { raw?: string; method?: string } = {}) {
  const init: RequestInit = {
    method: opts.method ?? "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON}`,
      apikey: ANON,
    },
    body: opts.raw ?? JSON.stringify(body),
  };
  const res = await fetch(FN_URL, init);
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text };
}

Deno.test("OPTIONS returns CORS headers", async () => {
  const res = await fetch(FN_URL, { method: "OPTIONS" });
  await res.text();
  assertEquals(res.status, 200);
  assert(res.headers.get("access-control-allow-origin") !== null);
});

Deno.test("invalid JSON body returns 400 invalid_json", async () => {
  const { status, json } = await call(null, { raw: "{not-json" });
  assertEquals(status, 400);
  assertEquals(json?.error, "invalid_json");
});

Deno.test("missing associado_id returns 400 missing_required_fields", async () => {
  const { status, json } = await call({ source: "test:fase6" });
  assertEquals(status, 400);
  assertEquals(json?.error, "missing_required_fields");
  assert(Array.isArray(json?.fields));
  assert(json.fields.includes("associado_id"));
});

Deno.test("missing source returns 400 missing_required_fields", async () => {
  const { status, json } = await call({ associado_id: randomUuid() });
  assertEquals(status, 400);
  assertEquals(json?.error, "missing_required_fields");
  assert(json.fields.includes("source"));
});

Deno.test("non-existent associado returns 404 associado_nao_encontrado", async () => {
  const { status, json } = await call({
    associado_id: randomUuid(),
    source: "test:fase6:not-found",
  });
  // Pode ser 404 (caminho normal) ou 409 lock_busy se houver coincidência (improvável)
  assert(status === 404 || status === 409, `unexpected status ${status}: ${JSON.stringify(json)}`);
  if (status === 404) {
    assertEquals(json?.error, "associado_nao_encontrado");
  }
});

Deno.test("response always includes success boolean", async () => {
  const { json } = await call({ source: "test:fase6:shape" });
  assert(typeof json?.success === "boolean", `success missing: ${JSON.stringify(json)}`);
});
