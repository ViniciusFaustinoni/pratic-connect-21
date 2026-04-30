/**
 * Regras de vencimento — espelho de src/utils/vencimento.ts
 *
 * Dado o dia do mês em que a venda é fechada, retorna as duas opções
 * de dia de vencimento que devem ser oferecidas ao cliente.
 *
 * Mantém paridade EXATA com o utilitário do front-end.
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

const DIAS_VALIDOS = new Set([5, 10, 15, 20, 25, 30]);

/**
 * Retorna um dia de vencimento sempre válido para a data informada.
 * Usa a primeira opção válida (mais próxima) calculada por
 * calcularOpcoesVencimento.
 *
 * Substitui o antigo fallback hardcoded `|| 10` em contrato-gerar e
 * termo-afiliacao-utils — que gerava vencimentos inválidos quando o
 * consultor não escolhia explicitamente o dia (caso LTG3H67).
 */
export function vencimentoPadraoPorData(data: Date | string | null | undefined): number {
  const d = data ? new Date(data) : new Date();
  const dia = isNaN(d.getTime()) ? new Date().getDate() : d.getDate();
  return calcularOpcoesVencimento(dia)[0];
}

/**
 * Resolve o dia_vencimento final de um contrato/cotação:
 * - se valor explícito existir e for válido → mantém
 * - se inexistente/null/inválido → calcula a partir da data de referência
 *
 * Retorna { dia, usouFallback } para permitir log de auditoria.
 */
export function resolverDiaVencimento(
  diaInformado: number | null | undefined,
  dataReferencia: Date | string | null | undefined,
): { dia: number; usouFallback: boolean } {
  const n = typeof diaInformado === 'string' ? parseInt(diaInformado, 10) : diaInformado;
  if (typeof n === 'number' && Number.isFinite(n) && DIAS_VALIDOS.has(n)) {
    return { dia: n, usouFallback: false };
  }
  return { dia: vencimentoPadraoPorData(dataReferencia), usouFallback: true };
}

export function isDiaVencimentoValido(dia: unknown): boolean {
  const n = typeof dia === 'string' ? parseInt(dia, 10) : (dia as number);
  return typeof n === 'number' && Number.isFinite(n) && DIAS_VALIDOS.has(n);
}
