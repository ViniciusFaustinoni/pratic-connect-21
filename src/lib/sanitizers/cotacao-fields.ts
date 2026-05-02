/**
 * Sanitizadores centralizados para campos persistidos em `cotacoes`.
 *
 * Motivação: várias colunas têm limite estrito de tamanho (`varchar(N)`) e o
 * Postgres rejeita o INSERT/UPDATE inteiro com `22001 value too long for
 * type character varying(N)`. Isso quebrava o fluxo público de contratação
 * quando o OCR do CRLV devolvia, por exemplo, Renavam com 12 dígitos.
 *
 * Aplicar SEMPRE estes sanitizers antes de:
 *  - jogar valor extraído por OCR no estado da tela; e
 *  - persistir o payload via supabase.from('cotacoes').update().
 */

/** Remove tudo que não é dígito e corta no tamanho máximo. */
function soDigitos(v: unknown, max: number): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\D/g, '');
  return s ? s.slice(0, max) : null;
}

/**
 * Renavam tem tamanho FIXO de 11 dígitos. Truncar arbitrariamente é
 * perigoso (gera número inválido). Se o valor não der exatamente 11 após
 * limpeza, descartamos para forçar preenchimento manual.
 */
export function sanitizeRenavam(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\D/g, '');
  if (!s) return null;
  if (s.length === 11) return s;
  // Caso comum: OCR leu o código de barras com 1 dígito extra no início ou no fim.
  // Tentamos as duas possibilidades antes de desistir.
  if (s.length === 12) {
    // Preferimos os 11 últimos (Renavam normalmente vem precedido de zero/check).
    return s.slice(-11);
  }
  return null;
}

/**
 * Chassi (VIN): EXATAMENTE 17 caracteres alfanuméricos, sem I/O/Q.
 *
 * O banco tem CHECK constraint `cotacoes_chassi_format` que rejeita qualquer
 * valor diferente de NULL/'' que não case com `^[A-HJ-NPR-Z0-9]{17}$`. Se
 * sanitizarmos para um valor com 16 chars (ex.: chassi digitado errado), o
 * UPDATE inteiro falha com 500 ao finalizar a cotação. Como chassi é sempre
 * manual (ver mem://constraints/operations/chassi-sempre-manual), preferimos
 * descartar valores inválidos e exigir nova digitação.
 */
export function sanitizeChassi(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
  if (!s) return null;
  // Só aceita se tiver exatamente 17 caracteres válidos.
  return s.length === 17 ? s : null;
}

/** Placa Mercosul ou padrão antigo: até 10 chars (coluna varchar(10)). */
export function sanitizePlaca(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s ? s.slice(0, 10) : null;
}

export function sanitizeUf(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).toUpperCase().replace(/[^A-Z]/g, '');
  return s ? s.slice(0, 2) : null;
}

export function sanitizeCep(v: unknown): string | null {
  return soDigitos(v, 8);
}

export function sanitizeTelefone(v: unknown): string | null {
  return soDigitos(v, 30);
}

export function sanitizeCnhCategoria(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).toUpperCase().trim();
  return s ? s.slice(0, 20) : null;
}

/** Trunca string genérica preservando conteúdo. Use só para campos texto livre. */
export function truncarTexto(v: unknown, max: number): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v);
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

/**
 * Recebe um payload parcial de `cotacoes` e devolve uma cópia onde TODOS os
 * campos com limite de tamanho conhecido estão sanitizados. Deixa em paz
 * qualquer chave não mapeada (não remove nada).
 */
export function sanitizarPayloadCotacao<T extends Record<string, any>>(payload: T): T {
  const out: Record<string, any> = { ...payload };

  const apply = (key: string, fn: (v: unknown) => string | null) => {
    if (key in out) {
      const novo = fn(out[key]);
      // Mantemos null em vez de undefined para o Supabase realmente limpar a coluna.
      out[key] = novo;
    }
  };

  apply('veiculo_renavam', sanitizeRenavam);
  apply('veiculo_chassi', sanitizeChassi);
  apply('veiculo_placa', sanitizePlaca);
  apply('cliente_uf', sanitizeUf);
  apply('cliente_cep', sanitizeCep);
  apply('telefone1_solicitante', sanitizeTelefone);
  apply('telefone2_solicitante', sanitizeTelefone);
  apply('cliente_telefone_secundario', sanitizeTelefone);
  apply('cliente_cnh_categoria', sanitizeCnhCategoria);

  // Campos texto-livre com limite — aplicamos truncar simples só para evitar 22001.
  const textosComLimite: Array<[string, number]> = [
    ['cliente_rg', 50],
    ['cliente_rg_orgao', 50],
    ['cliente_cnh', 50],
    ['veiculo_combustivel', 50],
    ['veiculo_cor', 50],
    ['veiculo_procedencia', 50],
    ['veiculo_categoria', 50],
    ['veiculo_tipo_uso', 50],
    ['categoria', 50],
    ['combustivel', 50],
    ['regiao', 30],
    ['cliente_estado_civil', 30],
    ['codigo_fipe', 20],
  ];
  for (const [k, max] of textosComLimite) {
    if (k in out) out[k] = truncarTexto(out[k], max);
  }

  return out as T;
}
