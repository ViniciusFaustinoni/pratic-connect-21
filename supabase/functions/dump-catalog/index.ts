import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { table } = await req.json();
  let data: any[] = [];

  if (table === "coberturas_planos") {
    // Fetch in pages
    const all: any[] = [];
    let from = 0; const size = 1000;
    while (true) {
      const { data: chunk, error } = await supabase
        .from("planos_coberturas")
        .select(`
          obrigatoria,
          carencia_dias,
          valor_limite,
          franquia_percentual,
          franquia_valor,
          plano:planos!inner(nome, product_line:product_lines(name, display_order)),
          cobertura:coberturas!inner(nome, codigo, tipo, percentual_cobertura, valor_limite, franquia_percentual, franquia_valor, carencia_dias, carencia_ativa, valor, codigo_sga)
        `)
        .range(from, from + size - 1);
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
      if (!chunk || chunk.length === 0) break;
      all.push(...chunk);
      if (chunk.length < size) break;
      from += size;
    }
    data = all;
  } else if (table === "benefits") {
    const all: any[] = [];
    let from = 0; const size = 1000;
    while (true) {
      const { data: chunk } = await supabase.from("benefits")
        .select("name, slug, category, description, preco_sugerido, carencia_dias, carencia_ativa, codigo_sga, display_order, is_active")
        .order("category").order("display_order").order("name")
        .range(from, from + size - 1);
      if (!chunk || chunk.length === 0) break;
      all.push(...chunk);
      if (chunk.length < size) break;
      from += size;
    }
    data = all;
  } else if (table === "elegibilidade") {
    const all: any[] = [];
    let from = 0; const size = 1000;
    while (true) {
      const { data: chunk, error } = await supabase
        .from("entity_eligibility_rules")
        .select("rule_type, mode, config, is_active, entity_id")
        .eq("entity_type", "plan")
        .range(from, from + size - 1);
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
      if (!chunk || chunk.length === 0) break;
      all.push(...chunk);
      if (chunk.length < size) break;
      from += size;
    }
    // Join with planos
    const planIds = [...new Set(all.map(r => r.entity_id))];
    const planMap = new Map();
    for (let i = 0; i < planIds.length; i += 200) {
      const { data: pls } = await supabase.from("planos")
        .select("id, nome, product_line:product_lines(name, display_order)")
        .in("id", planIds.slice(i, i + 200));
      pls?.forEach(p => planMap.set(p.id, p));
    }
    data = all.map(r => ({ ...r, plano: planMap.get(r.entity_id) }));
  }

  return new Response(JSON.stringify({ data }), {
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
});
