// Edge function: troca-titularidade-detalhe-associado
// Retorna associado local + veículos + cobranças bypassando RLS, para que
// vendedores (CLT/externo/agência) que NÃO têm o antigo titular no escopo
// consigam enxergar as placas dentro do dialog de Troca de Titularidade.
// Roda com service_role; exige auth.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing_auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "invalid_auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const associadoId = String(body?.associadoId ?? "").trim();
    if (!associadoId) {
      return new Response(JSON.stringify({ error: "associadoId obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const svc = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const [assocRes, veicRes, cobRes] = await Promise.all([
      svc.from("associados")
        .select("id, nome, cpf, email, telefone, codigo_hinova")
        .eq("id", associadoId)
        .maybeSingle(),
      svc.from("veiculos")
        .select("id, placa, marca, modelo, ano_modelo, ano_fabricacao, status, ativo")
        .eq("associado_id", associadoId)
        .neq("status", "cancelado"),
      svc.from("cobrancas")
        .select("id, veiculo_id, status, valor_final, valor, data_vencimento, data_emissao, linha_digitavel, boleto_url, nosso_numero")
        .eq("associado_id", associadoId)
        .in("status", ["aberto", "vencido", "pendente", "em_aberto"]),
    ]);

    const associado = assocRes.data ?? null;
    const veiculos = (veicRes.data || []).filter((v: any) => v.ativo !== false);
    const cobrancas = cobRes.data || [];

    return new Response(
      JSON.stringify({ associado, veiculos, cobrancas }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[troca-tit-detalhe] erro:", e);
    return new Response(JSON.stringify({ error: e?.message || "erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
