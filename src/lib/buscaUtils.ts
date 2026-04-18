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

  return { raw, digits, cpfFormatado, telefoneFormatado, placa };
}

/**
 * Escapa vírgulas/parênteses que quebrariam um filtro PostgREST .or().
 */
export function escapeOrValue(v: string): string {
  return v.replace(/[,()]/g, '');
}
