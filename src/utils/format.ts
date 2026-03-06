/**
 * Utilitários de formatação — fonte única de verdade.
 */

/**
 * Formata um valor numérico como moeda brasileira (BRL).
 */
export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
}
