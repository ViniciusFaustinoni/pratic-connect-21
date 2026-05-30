/**
 * Validação de variáveis dos templates de e-mail de relacionamento.
 *
 * Convenções canônicas:
 *  - Variáveis seguem o formato {{nome_variavel}} (espaços internos toleráveis).
 *  - Nomes podem conter letras (maiúsculas e minúsculas), dígitos e underscore.
 *  - Comparação contra a lista declarada (`variaveis_disponiveis`) é
 *    case-insensitive — o operador pode digitar {{Nome_Cliente}} ou
 *    {{nome_cliente}} e ambos são tratados como a mesma variável.
 */

const VAR_REGEX = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

/** Extrai os nomes de variáveis usadas em `{{var}}`, preservando o case da primeira ocorrência. */
export function extrairVariaveis(texto: string | null | undefined): string[] {
  if (!texto) return [];
  const visto = new Map<string, string>(); // key normalizada -> primeira grafia
  for (const m of texto.matchAll(VAR_REGEX)) {
    const original = m[1];
    const key = original.toLowerCase();
    if (!visto.has(key)) visto.set(key, original);
  }
  return Array.from(visto.values());
}

/** Mesma extração, devolvendo Set normalizado (lowercase) para comparações. */
export function extrairVariaveisSet(texto: string | null | undefined): Set<string> {
  return new Set(extrairVariaveis(texto).map((v) => v.toLowerCase()));
}

export interface VariavelDeclarada {
  /** Pode vir como "{{nome_cliente}}" ou "nome_cliente" — normalizamos. */
  code: string;
  label?: string;
}

export interface ValidacaoTemplateResult {
  /** Usadas no texto mas NÃO declaradas — virão em branco no envio real. */
  desconhecidas: string[];
  /** Declaradas mas nunca referenciadas — apenas informativo. */
  naoUsadas: string[];
  /** União das variáveis usadas no assunto + corpo (grafia original). */
  usadas: string[];
}

function normalizarCode(code: string): string {
  return code.replace(/[{}\s]/g, '').toLowerCase();
}

export function validarTemplate(input: {
  assunto: string;
  corpo: string;
  declaradas: ReadonlyArray<VariavelDeclarada>;
}): ValidacaoTemplateResult {
  const usadasAssunto = extrairVariaveis(input.assunto);
  const usadasCorpo = extrairVariaveis(input.corpo);

  const usadasMap = new Map<string, string>();
  for (const v of [...usadasAssunto, ...usadasCorpo]) {
    const k = v.toLowerCase();
    if (!usadasMap.has(k)) usadasMap.set(k, v);
  }
  const usadasKeys = new Set(usadasMap.keys());

  const declaradasMap = new Map<string, string>();
  for (const d of input.declaradas) {
    const k = normalizarCode(d.code);
    if (!declaradasMap.has(k)) declaradasMap.set(k, d.code);
  }
  const declaradasKeys = new Set(declaradasMap.keys());

  const desconhecidas: string[] = [];
  for (const [k, original] of usadasMap) {
    if (!declaradasKeys.has(k)) desconhecidas.push(original);
  }

  const naoUsadas: string[] = [];
  for (const [k, original] of declaradasMap) {
    if (!usadasKeys.has(k)) naoUsadas.push(original);
  }

  return {
    desconhecidas,
    naoUsadas,
    usadas: Array.from(usadasMap.values()),
  };
}
