/**
 * Utilitários de validação de chassi (VIN — ISO 3779).
 * - 17 caracteres
 * - Permite apenas A-Z e 0-9, exceto I, O e Q (proibidos no padrão VIN)
 */

const VIN_CHAR_REGEX = /[^A-HJ-NPR-Z0-9]/g;
const VIN_FULL_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/;

export function normalizeChassi(input: string | null | undefined): string {
  if (!input) return '';
  return input.toUpperCase().replace(VIN_CHAR_REGEX, '').slice(0, 17);
}

export function isValidChassi(input: string | null | undefined): boolean {
  if (!input) return false;
  return VIN_FULL_REGEX.test(input.toUpperCase());
}

export function chassiHelperText(input: string | null | undefined): string | null {
  const v = (input || '').toUpperCase();
  if (!v) return null;
  if (/[IOQ]/.test(v)) return 'Chassi inválido: contém I, O ou Q (proibidos no padrão VIN).';
  if (v.length < 17) return `Chassi incompleto: ${v.length}/17 caracteres.`;
  if (v.length > 17) return 'Chassi inválido: máximo de 17 caracteres.';
  if (!VIN_FULL_REGEX.test(v)) return 'Chassi contém caracteres inválidos.';
  return null;
}

export function chassisDivergem(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return normalizeChassi(a) !== normalizeChassi(b);
}
