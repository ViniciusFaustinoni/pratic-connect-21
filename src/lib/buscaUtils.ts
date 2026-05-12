/**
 * Normaliza um termo de busca para múltiplos formatos
 * (dígitos puros, CPF formatado, telefone formatado, placa).
 *
 * Permite que a busca encontre registros independente de como o
 * usuário digitou (com/sem máscara) e de como o dado está armazenado.
 */
export interface BuscaNormalizada {
  raw: string;
  digits: string;
  cpfFormatado: string | null;
  telefoneFormatado: string | null;
  placa: string | null;
  /**
   * Placa "forte" — termo claramente identificável como placa
   * (alfanumérico com letras E dígitos, 6–8 chars). Quando presente,
   * a busca deve restringir-se a placa+nome e ignorar fallbacks
   * por dígitos em CPF/telefone para evitar falsos positivos.
   */
  placaForte: string | null;
  /** Chassi (VIN) — 4–17 chars alfanuméricos. Superset que cobre placa parcial/completa. */
  chassi: string | null;
  /** Chassi "forte" — >8 chars alfanuméricos com letras e dígitos. Claramente chassi. */
  chassiForte: string | null;
}

export function normalizarBusca(termo: string): BuscaNormalizada {
  const raw = (termo || '').trim();
  const digits = raw.replace(/\D/g, '');

  let cpfFormatado: string | null = null;
  if (digits.length === 11) {
    cpfFormatado = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }

  let telefoneFormatado: string | null = null;
  if (digits.length === 11) {
    telefoneFormatado = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  } else if (digits.length === 10) {
    telefoneFormatado = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  // Placa: 4 a 8 chars alfanuméricos uppercase (cobre Mercosul e antiga)
  const placaCandidata = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const placa = placaCandidata.length >= 4 && placaCandidata.length <= 8 ? placaCandidata : null;

  // Placa "forte": precisa ter PELO MENOS 1 letra E 1 dígito, e não pode ser
  // um CPF/telefone completo (11 dígitos). Usado para evitar que dígitos da placa
  // poluam buscas por CPF/telefone parciais.
  const temLetra = /[A-Z]/.test(placaCandidata);
  const temDigito = /[0-9]/.test(placaCandidata);
  const placaForte =
    placa && temLetra && temDigito && placaCandidata.length >= 6 && placaCandidata.length <= 8
      ? placaCandidata
      : null;

  // Chassi (VIN): 4–17 alfanuméricos. Superset de placa.
  const chassi = placaCandidata.length >= 4 && placaCandidata.length <= 17 ? placaCandidata : null;
  const chassiForte =
    chassi && temLetra && temDigito && placaCandidata.length > 8 && placaCandidata.length <= 17
      ? placaCandidata
      : null;

  return { raw, digits, cpfFormatado, telefoneFormatado, placa, placaForte, chassi, chassiForte };
}

/**
 * Escapa vírgulas/parênteses que quebrariam um filtro PostgREST .or().
 */
export function escapeOrValue(v: string): string {
  return v.replace(/[,()]/g, '');
}
