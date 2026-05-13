/**
 * Decide whether to BYPASS the three plate-search guard rules
 * (placa duplicada, veículo no SGA, placa em outro associado na base local).
 *
 * Bypass acontece SOMENTE quando o cotador foi aberto via fluxo de
 * Troca de Titularidade (`origemTroca` truthy). Em qualquer outro fluxo
 * — cotação normal, inclusão de veículo, substituição, etc. — as três
 * travas continuam ativas.
 */
export function shouldBypassPlateGuards(origemTroca: unknown): boolean {
  return !!origemTroca;
}
