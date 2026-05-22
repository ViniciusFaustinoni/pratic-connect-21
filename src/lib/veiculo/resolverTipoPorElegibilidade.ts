/**
 * Resolver canônico de tipo de veículo (carro|moto) DERIVADO da elegibilidade
 * de linhas de produto — não recomputa heurística.
 *
 * Regra: para cada plano ativo, roda as regras de elegibilidade IGNORANDO a
 * regra `categoria_veiculo` (a única regra circular). Os planos que passarem
 * viram candidatos. O `product_lines.vehicle_type` de cada plano discrimina
 * o tipo. Decisão final:
 *
 *   - Só candidatos `motorcycle`  → tipo='moto'
 *   - Só candidatos `car`         → tipo='carro'
 *   - Misto                       → bloqueio='ambiguo' (pedir confirmação)
 *   - Nenhum                      → bloqueio='nenhuma_linha'
 *
 * A Diretoria mantém `product_lines.vehicle_type` em Gestão Comercial —
 * mudanças refletem automaticamente sem deploy.
 */

import {
  checkAllRules,
  type EligibilityRule,
  type VehicleContext,
} from '@/hooks/useEntityEligibilityRules';

export type TipoVeiculoResolvido = 'carro' | 'moto';
export type MotivoTipoVeiculo =
  | 'unanime_moto'
  | 'unanime_carro'
  | 'operador_resolveu'
  | 'legado_heuristica';

export type BloqueioTipoVeiculo =
  | { tipo: 'ambiguo'; candidatosMoto: string[]; candidatosCarro: string[] }
  | { tipo: 'nenhuma_linha' };

export interface PlanoParaResolver {
  id: string;
  nome?: string;
  product_line_id?: string | null;
  product_lines?: { slug?: string; vehicle_type?: 'motorcycle' | 'car' | null } | null;
}

export interface ResolverResult {
  tipo: TipoVeiculoResolvido | null;
  motivo: MotivoTipoVeiculo | null;
  bloqueio: BloqueioTipoVeiculo | null;
  candidatosMoto: string[];
  candidatosCarro: string[];
}

/**
 * Aplica regras do plano + da linha do plano ao contexto, EXCETO categoria_veiculo.
 * Devolve true se o plano poderia ser elegível para esse veículo se o tipo
 * fosse compatível.
 */
function planoPassaSemCategoriaVeiculo(
  plano: PlanoParaResolver,
  allRules: EligibilityRule[],
  ctx: VehicleContext,
): boolean {
  const productLineId = plano.product_line_id;

  // Regras do plano (exceto categoria_veiculo e marca_modelo + ano_range que
  // já têm tratamento dedicado em usePlanosCotacao; aqui mantemos só o que
  // discrimina sem depender do tipo).
  const planoRules = allRules.filter(
    r => r.entity_type === 'plano'
      && r.entity_id === plano.id
      && r.is_active
      && r.rule_type !== 'categoria_veiculo',
  );

  if (planoRules.length > 0 && !checkAllRules(planoRules, ctx)) return false;

  // Regras da linha (exceto categoria_veiculo)
  if (productLineId) {
    const planoHasMarcaModelo = planoRules.some(r => r.rule_type === 'marca_modelo');
    const planoHasAnoRange = planoRules.some(r => r.rule_type === 'ano_range');

    let linhaRules = allRules.filter(
      r => r.entity_type === 'linha'
        && r.entity_id === productLineId
        && r.is_active
        && r.rule_type !== 'categoria_veiculo',
    );
    if (planoHasMarcaModelo) linhaRules = linhaRules.filter(r => r.rule_type !== 'marca_modelo');
    if (planoHasAnoRange) linhaRules = linhaRules.filter(r => r.rule_type !== 'ano_range');

    if (linhaRules.length > 0 && !checkAllRules(linhaRules, ctx)) return false;
  }

  return true;
}

/**
 * Resolve o tipo de veículo a partir do conjunto de planos elegíveis.
 * Não precisa do tipo de entrada — é exatamente isso que tira a circularidade.
 */
export function resolverTipoPorElegibilidade(
  planos: PlanoParaResolver[],
  allRules: EligibilityRule[],
  ctx: VehicleContext,
): ResolverResult {
  const candidatosMoto: string[] = [];
  const candidatosCarro: string[] = [];

  for (const plano of planos) {
    const vt = plano.product_lines?.vehicle_type;
    if (vt !== 'motorcycle' && vt !== 'car') continue; // linha sem tipo → ignora
    if (!planoPassaSemCategoriaVeiculo(plano, allRules, ctx)) continue;
    const nome = plano.nome || plano.id;
    if (vt === 'motorcycle') candidatosMoto.push(nome);
    else candidatosCarro.push(nome);
  }

  if (candidatosMoto.length === 0 && candidatosCarro.length === 0) {
    return {
      tipo: null,
      motivo: null,
      bloqueio: { tipo: 'nenhuma_linha' },
      candidatosMoto,
      candidatosCarro,
    };
  }

  if (candidatosMoto.length > 0 && candidatosCarro.length === 0) {
    return { tipo: 'moto', motivo: 'unanime_moto', bloqueio: null, candidatosMoto, candidatosCarro };
  }

  if (candidatosCarro.length > 0 && candidatosMoto.length === 0) {
    return { tipo: 'carro', motivo: 'unanime_carro', bloqueio: null, candidatosMoto, candidatosCarro };
  }

  // Misto: precisa confirmação do operador
  return {
    tipo: null,
    motivo: null,
    bloqueio: { tipo: 'ambiguo', candidatosMoto, candidatosCarro },
    candidatosMoto,
    candidatosCarro,
  };
}
