import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // 1. planos ativos
  const { data: planos } = await supabase
    .from('planos')
    .select('id, codigo, nome, ativo, product_line_id, ordem')
    .eq('ativo', true)
    .order('nome');

  // 2. product_lines
  const { data: lines } = await supabase
    .from('product_lines')
    .select('id, name, slug');
  const lineMap = new Map((lines || []).map((l: any) => [l.id, l]));

  // 3. planos_coberturas (paginado)
  let pc: any[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('planos_coberturas')
      .select('plano_id, cobertura_id')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    pc = pc.concat(data || []);
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }

  // 4. coberturas
  let cobs: any[] = [];
  from = 0;
  while (true) {
    const { data } = await supabase
      .from('coberturas')
      .select('id, nome, codigo, tipo, percentual_cobertura, valor_limite, franquia_percentual, franquia_valor, carencia_dias, valor, codigo_sga, display_order')
      .range(from, from + PAGE - 1);
    cobs = cobs.concat(data || []);
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  const cobMap = new Map(cobs.map((c) => [c.id, c]));

  // 5. fipe_range rules para coberturas
  let rules: any[] = [];
  from = 0;
  while (true) {
    const { data } = await supabase
      .from('entity_eligibility_rules')
      .select('entity_id, rule_config')
      .eq('entity_type', 'cobertura')
      .eq('rule_type', 'fipe_range')
      .eq('is_active', true)
      .range(from, from + PAGE - 1);
    rules = rules.concat(data || []);
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  const ruleMap = new Map(rules.map((r) => [r.entity_id, r.rule_config]));

  // 6. benefits (catálogo)
  let benefits: any[] = [];
  from = 0;
  while (true) {
    const { data, error: berr } = await supabase
      .from('benefits')
      .select('id, name, slug, category, description, preco_sugerido, carencia_dias, carencia_ativa, codigo_sga, display_order, is_active')
      .eq('is_active', true)
      .range(from, from + PAGE - 1);
    if (berr) { console.error('benefits err', berr); break; }
    benefits = benefits.concat(data || []);
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }

  // 7. plan_benefits (vínculo plano-benefício)
  let planBenefits: any[] = [];
  from = 0;
  while (true) {
    const { data } = await supabase
      .from('plan_benefits')
      .select('plan_id, benefit_id, is_included, custom_price, custom_carencia_dias')
      .range(from, from + PAGE - 1);
    planBenefits = planBenefits.concat(data || []);
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }

  return new Response(
    JSON.stringify({
      planos,
      lines,
      planos_coberturas: pc,
      coberturas: cobs,
      fipe_rules: Array.from(ruleMap.entries()).map(([id, cfg]) => ({ entity_id: id, rule_config: cfg })),
      benefits,
      plan_benefits: planBenefits,
    }),
    { headers: { ...cors, 'Content-Type': 'application/json' } },
  );
});
