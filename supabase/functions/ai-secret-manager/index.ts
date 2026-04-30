import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "missing auth" }, 401);

    // Cliente com JWT do usuário para identificar quem é
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) return json({ error: "unauthenticated" }, 401);

    // Cliente service role para leitura de roles e gravação na tabela
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const allowed =
      roles?.some((r: any) => r.role === "diretor" || r.role === "desenvolvedor") ?? false;

    const body = await req.json().catch(() => ({}));
    const action = body.action as "status" | "set" | "remove";

    if (action === "status") {
      const { data, error } = await admin.rpc("ai_provider_keys_status");
      if (error) return json({ error: error.message }, 500);
      const map: Record<string, boolean> = { openai: false, anthropic: false };
      (data ?? []).forEach((row: any) => (map[row.provider] = !!row.configured));
      return json({ status: map });
    }

    if (!allowed) return json({ error: "forbidden" }, 403);

    if (action === "set") {
      const provider = body.provider;
      const value = (body.value ?? "").toString().trim();
      if (!["openai", "anthropic"].includes(provider))
        return json({ error: "provider inválido" }, 400);
      if (!value) return json({ error: "chave vazia" }, 400);

      const { error } = await admin
        .from("ai_provider_keys")
        .upsert(
          { provider, api_key: value, updated_by: user.id, updated_at: new Date().toISOString() },
          { onConflict: "provider" },
        );
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "remove") {
      const provider = body.provider;
      if (!["openai", "anthropic"].includes(provider))
        return json({ error: "provider inválido" }, 400);
      const { error } = await admin
        .from("ai_provider_keys")
        .delete()
        .eq("provider", provider);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: "ação desconhecida" }, 400);
  } catch (e: any) {
    console.error("ai-secret-manager erro:", e);
    return json({ error: e?.message ?? "erro interno" }, 500);
  }
});
