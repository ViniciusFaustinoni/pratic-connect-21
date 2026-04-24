// Edge function: comissoes-backfill
// Reprocessa cobranças já pagas para gerar comissões via fn_gerar_comissoes_por_pagamento.
// Apenas diretores podem executar.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface BackfillBody {
  data_inicio?: string; // ISO date
  data_fim?: string; // ISO date
  contrato_id?: string;
  vendedor_id?: string;
  dry_run?: boolean;
  limite?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "Não autenticado" }, 401);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Verifica papel diretor
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "diretor")
      .maybeSingle();

    if (!roleRow) {
      return json({ error: "Apenas diretores podem executar backfill" }, 403);
    }

    const body = (await req.json().catch(() => ({}))) as BackfillBody;
    const dryRun = body.dry_run ?? true;
    const limite = Math.min(Math.max(body.limite ?? 500, 1), 5000);

    // Seleciona cobranças pagas no período
    let query = admin
      .from("cobrancas")
      .select("id, contrato_id, data_pagamento, valor_pago, status")
      .not("contrato_id", "is", null)
      .or(
        "status.in.(pago,paid,recebido,confirmado),data_pagamento.not.is.null"
      )
      .order("data_pagamento", { ascending: false, nullsFirst: false })
      .limit(limite);

    if (body.data_inicio)
      query = query.gte("data_pagamento", body.data_inicio);
    if (body.data_fim) query = query.lte("data_pagamento", body.data_fim);
    if (body.contrato_id) query = query.eq("contrato_id", body.contrato_id);

    const { data: cobrancas, error: cobErr } = await query;
    if (cobErr) {
      console.error("Erro listando cobranças:", cobErr);
      return json({ error: cobErr.message }, 500);
    }

    let totalCobrancas = cobrancas?.length ?? 0;
    let totalComissoesGeradas = 0;
    const erros: Array<{ cobranca_id: string; erro: string }> = [];

    if (!dryRun && cobrancas) {
      for (const c of cobrancas) {
        const { data: gerou, error: rpcErr } = await admin.rpc(
          "fn_gerar_comissoes_por_pagamento",
          { p_cobranca_id: c.id }
        );
        if (rpcErr) {
          erros.push({ cobranca_id: c.id, erro: rpcErr.message });
        } else {
          totalComissoesGeradas += (gerou as number) ?? 0;
        }
      }
    }

    return json({
      ok: true,
      dry_run: dryRun,
      total_cobrancas: totalCobrancas,
      total_comissoes_geradas: totalComissoesGeradas,
      erros,
    });
  } catch (e) {
    console.error("comissoes-backfill error:", e);
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
