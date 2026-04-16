/**
 * Utilities to derive FIPE ranges from the modern pricing engine
 * (`entity_eligibility_rules` with rule_type='fipe_range').
 *
 * This replaces lookups against the legacy `tabelas_preco_mensalidade`
 * table for *display-only* purposes (the price engine itself already
 * uses these rules).
 */

export interface FipeRangeFaixa {
  de: number;
  ate: number;
  valor: number;
}

export interface FipeFaixaResultado {
  de: number;        // inclusive lower bound
  ate: number;       // exclusive upper bound (as stored in rule)
  intervalo?: number;
  valor?: number;
}

interface EligibilityRuleLite {
  entity_type: string;
  entity_id: string;
  rule_type: string;
  is_active: boolean;
  rule_config: any;
}

interface PlanoCoberturaLite {
  plano_id: string;
  cobertura_id: string;
}

/**
 * Coleta todas as faixas FIPE configuradas para as coberturas de um plano.
 * Como todas as coberturas de uma mesma linha compartilham o mesmo
 * intervalo/min/max, usamos o conjunto da primeira cobertura encontrada.
 */
function obterFaixasDoPlano(
  planoId: string,
  planoCoberturas: PlanoCoberturaLite[],
  allEligibilityRules: EligibilityRuleLite[]
): FipeRangeFaixa[] | null {
  const cobIds = planoCoberturas
    .filter(pc => pc.plano_id === planoId)
    .map(pc => pc.cobertura_id);

  if (cobIds.length === 0) return null;

  for (const cobId of cobIds) {
    const rule = allEligibilityRules.find(
      r =>
        r.entity_type === 'cobertura' &&
        r.entity_id === cobId &&
        r.rule_type === 'fipe_range' &&
        r.is_active
    );
    const faixas = rule?.rule_config?.faixas as FipeRangeFaixa[] | undefined;
    if (faixas && faixas.length > 0) {
      return [...faixas].sort((a, b) => a.de - b.de);
    }
  }

  return null;
}

/**
 * Retorna a faixa FIPE atual onde o valor se enquadra, derivada de
 * `entity_eligibility_rules` (mesma fonte do motor de cálculo).
 */
export function obterFaixaFipeAtual(
  planoId: string | null | undefined,
  planoCoberturas: PlanoCoberturaLite[],
  allEligibilityRules: EligibilityRuleLite[],
  valorFipe: number
): FipeFaixaResultado | null {
  if (!planoId || !valorFipe || valorFipe <= 0) return null;

  const faixas = obterFaixasDoPlano(planoId, planoCoberturas, allEligibilityRules);
  if (!faixas) return null;

  const faixa = faixas.find(f => valorFipe >= f.de && valorFipe < f.ate);
  if (!faixa) return null;

  // intervalo inferido (faixas tem mesmo passo)
  const intervalo = faixas.length >= 2 ? faixas[1].de - faixas[0].de : undefined;

  return { de: faixa.de, ate: faixa.ate, intervalo, valor: faixa.valor };
}

/**
 * Retorna a faixa imediatamente inferior à atual (para fluxo "FIPE menor").
 */
export function obterFaixaFipeAnterior(
  planoId: string | null | undefined,
  planoCoberturas: PlanoCoberturaLite[],
  allEligibilityRules: EligibilityRuleLite[],
  valorFipe: number
): FipeFaixaResultado | null {
  const atual = obterFaixaFipeAtual(planoId, planoCoberturas, allEligibilityRules, valorFipe);
  if (!atual) return null;

  const faixas = obterFaixasDoPlano(planoId, planoCoberturas, allEligibilityRules);
  if (!faixas) return null;

  const inferiores = faixas.filter(f => f.ate <= atual.de);
  if (inferiores.length === 0) return null;
  const anterior = inferiores[inferiores.length - 1];
  return { de: anterior.de, ate: anterior.ate, valor: anterior.valor };
}

/**
 * Soma a contribuição de TODAS as coberturas de um plano em uma dada
 * faixa de valor FIPE — útil para calcular a diferença de mensalidade
 * entre faixa atual e faixa inferior.
 */
export function somarCoberturasPorValorFipe(
  planoId: string,
  planoCoberturas: PlanoCoberturaLite[],
  allEligibilityRules: EligibilityRuleLite[],
  valorFipeAlvo: number
): number {
  const cobIds = planoCoberturas
    .filter(pc => pc.plano_id === planoId)
    .map(pc => pc.cobertura_id);

  let soma = 0;
  for (const cobId of cobIds) {
    const rule = allEligibilityRules.find(
      r =>
        r.entity_type === 'cobertura' &&
        r.entity_id === cobId &&
        r.rule_type === 'fipe_range' &&
        r.is_active
    );
    const faixas = (rule?.rule_config?.faixas as FipeRangeFaixa[] | undefined) || [];
    const faixa = faixas.find(f => valorFipeAlvo >= f.de && valorFipeAlvo < f.ate);
    if (faixa) soma += Number(faixa.valor) || 0;
  }
  return soma;
}
