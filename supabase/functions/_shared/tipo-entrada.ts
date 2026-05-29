/**
 * Espelho Deno-compatível de src/lib/cotacoes/tipoEntrada.ts.
 * Mantenha as duas versões sincronizadas.
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
