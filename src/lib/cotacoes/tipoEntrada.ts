/**
 * Normalização canônica de `tipo_entrada` (cotacoes/contratos).
 *
 * Canônicos: 'adesao' | 'inclusao' | 'migracao' | 'reativacao'
 *          | 'substituicao_placa' | 'troca_titularidade'
 *
 * Aliases legados normalizados na escrita:
 *  - 'substituicao' → 'substituicao_placa'
 *  - 'nova'         → 'adesao'
 *
 * Use SEMPRE este utilitário antes de gravar `tipo_entrada` em qualquer
 * fluxo (CotacaoFormDialog, ContratoWizard, ReativacaoWizard, modais de
 * substituição etc.). Leitores podem permanecer tolerantes aos aliases
 * como defesa em profundidade.
 *
 * Ver mem://constraints/contracts/tipo-entrada-substituicao-canonical
 */
export type TipoEntradaCanonico =
  | 'adesao'
  | 'inclusao'
  | 'migracao'
  | 'reativacao'
  | 'substituicao_placa'
  | 'troca_titularidade';

export function normalizarTipoEntrada(
  valor: string | null | undefined,
): TipoEntradaCanonico | null {
  if (!valor) return null;
  const v = valor.trim();
  if (!v) return null;
  if (v === 'substituicao') return 'substituicao_placa';
  if (v === 'nova') return 'adesao';
  return v as TipoEntradaCanonico;
}
