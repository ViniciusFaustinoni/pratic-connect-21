/**
 * Helpers para a Zona de Leitura Mecânica (MRZ) da CNH-e brasileira.
 *
 * A CNH-e SENATRAN imprime no rodapé 3 linhas em fonte OCR-B no padrão
 * ICAO 9303 (TD1, três linhas de 30 caracteres). A primeira linha tem o
 * formato:
 *
 *   I<BRA<numero_registro_9digitos><check><resto>
 *
 * onde <check> é o dígito verificador padrão ICAO 9303 calculado sobre os
 * 9 dígitos do número de registro com pesos cíclicos [7, 3, 1].
 *
 * Esses helpers servem ao tiebreaker de dupla-leitura de OCR: quando dois
 * modelos divergem no número de registro da CNH, vence o que tiver MRZ
 * matematicamente válida (impossível de alucinar por coincidência).
 */

/**
 * Tabela ICAO 9303 para checksum:
 *   '0'..'9' → 0..9
 *   'A'..'Z' → 10..35
 *   '<'      → 0
 * Para os 9 dígitos do registro CNH só dígitos importam, mas mantemos
 * o algoritmo completo para reuso.
 */
function icaoCharValue(ch: string): number {
  const c = ch.toUpperCase();
  if (c >= "0" && c <= "9") return c.charCodeAt(0) - 48;
  if (c >= "A" && c <= "Z") return c.charCodeAt(0) - 55;
  if (c === "<") return 0;
  return -1; // caractere inválido invalida o cálculo
}

/**
 * Calcula o dígito verificador ICAO 9303 sobre uma string.
 * Pesos cíclicos [7, 3, 1]. Soma mod 10. Retorna -1 se houver caractere
 * inválido.
 */
export function icaoCheckDigit(input: string): number {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < input.length; i++) {
    const v = icaoCharValue(input[i]);
    if (v < 0) return -1;
    sum += v * weights[i % 3];
  }
  return sum % 10;
}

/**
 * Tenta extrair a primeira linha da MRZ de uma string arbitrária
 * (texto nativo do PDF, valor de mrz_registro vindo da IA, etc).
 *
 * Aceita variações de whitespace; normaliza para uppercase e remove
 * espaços. Procura por "I<BRA" + 9..11 dígitos + 1 dígito de check
 * (mínimo) seguido por mais conteúdo até o tamanho TD1 (30 chars) ou
 * fim da linha.
 *
 * Retorna a sequência sem espaços, ou string vazia se não achar.
 */
export function extractMrzLine(raw: unknown): string {
  if (raw == null) return "";
  const norm = String(raw).toUpperCase().replace(/\s+/g, "");
  // I<BRA + 9-11 dígitos do registro + 1 check + resto. Aceita até 30 chars.
  const m = norm.match(/I<BRA(\d{9,11})(\d)([A-Z0-9<]{0,17})/);
  if (!m) return "";
  // Reconstrói até 30 chars (TD1)
  const head = `I<BRA${m[1]}${m[2]}${m[3]}`;
  return head.slice(0, 30);
}

/**
 * Valida o checksum da primeira linha da MRZ da CNH-e.
 *
 * Layout esperado:
 *   posições 0..4   = "I<BRA"
 *   posições 5..13  = 9 dígitos do número de registro
 *   posição  14     = dígito verificador ICAO sobre as posições 5..13
 *
 * Retorna true se o dígito 14 bate com o checksum calculado.
 */
export function validateMrzCheckDigit(mrzLine: string): boolean {
  if (!mrzLine || mrzLine.length < 15) return false;
  if (!mrzLine.startsWith("I<BRA")) return false;
  const registro = mrzLine.slice(5, 14);
  const expected = mrzLine[14];
  if (!/^\d{9}$/.test(registro)) return false;
  if (!/^\d$/.test(expected)) return false;
  const calc = icaoCheckDigit(registro);
  if (calc < 0) return false;
  return String(calc) === expected;
}

/**
 * Devolve os 9 dígitos do número de registro CNH a partir de uma MRZ.
 * Não valida checksum; use validateMrzCheckDigit antes se precisar.
 * Retorna string vazia se a MRZ não bater no formato esperado.
 */
export function getRegistroFromMrz(mrzLine: string): string {
  if (!mrzLine || mrzLine.length < 14) return "";
  if (!mrzLine.startsWith("I<BRA")) return "";
  const registro = mrzLine.slice(5, 14);
  return /^\d{9}$/.test(registro) ? registro : "";
}
