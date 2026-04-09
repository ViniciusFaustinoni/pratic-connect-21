/**
 * Filtro de elegibilidade unificado para coberturas e benefícios nos Termos (Autentique).
 * 
 * Aplica as regras de entity_eligibility_rules para filtrar itens inelegíveis
 * com base no veículo do contrato (FIPE, região, combustível, tipo de placa).
 */

interface VeiculoParams {
  valor_fipe?: number;
  regiao?: string;
  combustivel?: string;
  tipo_placa?: string; // 'normal', 'vermelha'
  tipo_uso?: string;   // 'particular', 'aplicativo'
}

interface EligibilityRule {
  entity_id: string;
  entity_type: string;
  rule_type: string;
  rule_config: any;
  is_active: boolean;
}

/**
 * Verifica se um item (cobertura ou benefício) é elegível para o veículo.
 * Retorna true se elegível, false se deve ser removido.
 */
function checkItemEligibility(
  itemId: string,
  entityType: 'cobertura' | 'beneficio',
  rules: EligibilityRule[],
  veiculo: VeiculoParams
): boolean {
  const itemRules = rules.filter(
    r => r.entity_id === itemId && r.entity_type === entityType && r.is_active
  );

  // Sem regras = elegível (sem restrições)
  if (itemRules.length === 0) return true;

  for (const rule of itemRules) {
    const config = rule.rule_config || {};

    switch (rule.rule_type) {
      case 'fipe_range':
      case 'fipe_eligibility': {
        if (veiculo.valor_fipe != null) {
          const fipeMin = Number(config.fipe_min || config.valor_min || 0);
          const fipeMax = Number(config.fipe_max || config.valor_max || Infinity);
          if (veiculo.valor_fipe < fipeMin || veiculo.valor_fipe > fipeMax) {
            return false;
          }
        }
        break;
      }

      case 'regiao': {
        if (veiculo.regiao && config.regioes) {
          const regioes: string[] = Array.isArray(config.regioes) ? config.regioes : [config.regioes];
          const regiaoNorm = veiculo.regiao.toLowerCase();
          if (!regioes.some((r: string) => r.toLowerCase() === regiaoNorm)) {
            return false;
          }
        }
        break;
      }

      case 'combustivel': {
        if (veiculo.combustivel && config.combustiveis) {
          const combustiveis: string[] = Array.isArray(config.combustiveis) ? config.combustiveis : [config.combustiveis];
          const combNorm = veiculo.combustivel.toLowerCase();
          if (!combustiveis.some((c: string) => c.toLowerCase() === combNorm || c.toLowerCase() === 'qualquer')) {
            return false;
          }
        }
        break;
      }

      case 'tipo_placa': {
        if (veiculo.tipo_placa && config.tipos_placa) {
          const tipos: string[] = Array.isArray(config.tipos_placa) ? config.tipos_placa : [config.tipos_placa];
          const placaNorm = veiculo.tipo_placa.toLowerCase();
          if (!tipos.some((t: string) => t.toLowerCase() === placaNorm)) {
            return false;
          }
        }
        break;
      }

      case 'tipo_uso': {
        if (veiculo.tipo_uso && config.tipos_uso) {
          const tipos: string[] = Array.isArray(config.tipos_uso) ? config.tipos_uso : [config.tipos_uso];
          const usoNorm = veiculo.tipo_uso.toLowerCase();
          if (!tipos.some((t: string) => t.toLowerCase() === usoNorm)) {
            return false;
          }
        }
        break;
      }
    }
  }

  return true;
}

/**
 * Filtra coberturas e benefícios de um plano com base na elegibilidade do veículo.
 * Busca as regras de entity_eligibility_rules e remove itens inelegíveis.
 */
export async function filterEligibleItems(
  supabase: any,
  coberturas: any[],
  beneficios: any[],
  veiculo: VeiculoParams,
  coberturaIds: string[],
  beneficioIds: string[],
  planoId?: string
): Promise<{ coberturas: any[]; beneficios: any[] }> {
  if (coberturaIds.length === 0 && beneficioIds.length === 0) {
    return { coberturas, beneficios };
  }

  try {
    // Buscar regras do plano para identificar quais rule_types são sobrescritos
    let planoRuleTypes = new Set<string>();
    if (planoId) {
      const { data: planoRules } = await supabase
        .from('entity_eligibility_rules')
        .select('rule_type')
        .eq('entity_id', planoId)
        .eq('entity_type', 'plano')
        .eq('is_active', true);
      if (planoRules && planoRules.length > 0) {
        planoRuleTypes = new Set(planoRules.map((r: any) => r.rule_type));
        console.log(`[eligibility-filter] Regras do plano sobrescrevem tipos: ${[...planoRuleTypes].join(', ')}`);
      }
    }

    // Buscar regras para coberturas e benefícios do plano
    const allEntityIds = [...coberturaIds, ...beneficioIds];
    const { data: rules, error } = await supabase
      .from('entity_eligibility_rules')
      .select('entity_id, entity_type, rule_type, rule_config, is_active')
      .in('entity_id', allEntityIds)
      .in('entity_type', ['cobertura', 'beneficio'])
      .eq('is_active', true);

    if (error) {
      console.warn('[eligibility-filter] Erro ao buscar regras (não-bloqueante):', error.message);
      return { coberturas, beneficios };
    }

    if (!rules || rules.length === 0) {
      return { coberturas, beneficios };
    }

    // Filtrar regras cujo tipo já é coberto pelo plano (sobrescrita)
    const filteredRules = rules.filter((r: EligibilityRule) => !planoRuleTypes.has(r.rule_type));

    console.log(`[eligibility-filter] ${rules.length} regras encontradas, ${rules.length - filteredRules.length} sobrescritas pelo plano`);

    const coberturasElegiveis = coberturas.filter((cob: any) => {
      const cobId = cob.cobertura_id || cob.coberturas?.id;
      if (!cobId) return true;
      return checkItemEligibility(cobId, 'cobertura', filteredRules, veiculo);
    });

    const beneficiosElegiveis = beneficios.filter((ben: any) => {
      const benId = ben.benefit_id || ben.benefits?.id;
      if (!benId) return true;
      return checkItemEligibility(benId, 'beneficio', filteredRules, veiculo);
    });

    const removedCob = coberturas.length - coberturasElegiveis.length;
    const removedBen = beneficios.length - beneficiosElegiveis.length;
    if (removedCob > 0 || removedBen > 0) {
      console.log(`[eligibility-filter] Removidos: ${removedCob} coberturas, ${removedBen} benefícios (inelegíveis para o veículo)`);
    }

    return { coberturas: coberturasElegiveis, beneficios: beneficiosElegiveis };
  } catch (err) {
    console.warn('[eligibility-filter] Erro inesperado (não-bloqueante):', err);
    return { coberturas, beneficios };
  }
}
