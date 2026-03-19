/**
 * Calcula as duas opções de dia de vencimento disponíveis
 * com base no dia do mês informado.
 */
export function calcularOpcoesVencimento(diaHoje: number): [number, number] {
  if (diaHoje >= 30 || diaHoje <= 4) return [5, 10];
  if (diaHoje >= 5 && diaHoje <= 9) return [10, 15];
  if (diaHoje >= 10 && diaHoje <= 14) return [15, 20];
  if (diaHoje >= 15 && diaHoje <= 19) return [20, 25];
  if (diaHoje >= 20 && diaHoje <= 24) return [25, 30];
  if (diaHoje >= 25 && diaHoje <= 29) return [30, 5];
  return [5, 10];
}
