/**
 * Helpers para traduzir erros do Supabase / PostgREST em mensagens
 * acionáveis para o usuário final, sem esconder a causa real.
 *
 * Uso típico:
 *   try { ... } catch (err) {
 *     const msg = descreverErroSupabase(err, { contexto: 'criar cotação' });
 *     toast.error(msg);
 *   }
 */

export interface SupabaseLikeError {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
  name?: string;
}

export interface DescreverErroOpts {
  /** Texto curto descrevendo a operação. Ex.: "criar cotação" */
  contexto?: string;
  /** Mapa opcional para customizar mensagens por código. */
  overrides?: Partial<Record<string, string>>;
}

function extrairColuna(err: SupabaseLikeError): string | null {
  // Postgres costuma escrever: null value in column "valor_fipe" of relation "cotacoes"
  // ou: violates not-null constraint (column "x")
  const fontes = [err.message || '', err.details || ''].join(' ');
  const m = fontes.match(/column\s+"?([a-z0-9_]+)"?/i);
  return m?.[1] ?? null;
}

export function descreverErroSupabase(
  err: unknown,
  opts: DescreverErroOpts = {},
): string {
  const e = (err ?? {}) as SupabaseLikeError;
  const ctx = opts.contexto ? ` (${opts.contexto})` : '';
  const code = e.code;
  const msg = (e.message || '').toLowerCase();

  if (opts.overrides && code && opts.overrides[code]) {
    return opts.overrides[code]!;
  }

  // RLS / permissão negada
  if (code === '42501' || msg.includes('row-level security') || msg.includes('row level security')) {
    return 'Seu usuário não tem permissão para esta operação. Peça ao administrador para liberar o papel adequado (ex.: Vendedor).';
  }

  // NOT NULL violation
  if (code === '23502') {
    const col = extrairColuna(e);
    return col
      ? `Faltam dados obrigatórios${ctx}. Recarregue a página, escolha as opções novamente e tente outra vez. (campo: ${col})`
      : `Faltam dados obrigatórios${ctx}. Recarregue a página e tente novamente.`;
  }

  // Unique violation
  if (code === '23505') {
    return `Conflito de dados duplicados${ctx}. Tente novamente em alguns segundos.`;
  }

  // Foreign key violation
  if (code === '23503') {
    return `Referência inválida${ctx}: um dos itens selecionados não existe mais. Recarregue a página e tente novamente.`;
  }

  // Check constraint
  if (code === '23514') {
    return `Dados inválidos${ctx}: alguma regra de validação do servidor foi violada. ${e.message ?? ''}`.trim();
  }

  // Timeout / abort / rede
  if (e.name === 'AbortError' || msg.includes('aborted') || msg.includes('timeout')) {
    return 'Sem resposta do servidor. Verifique sua conexão e tente novamente.';
  }
  if (msg.includes('failed to fetch') || msg.includes('networkerror')) {
    return 'Falha de conexão. Verifique sua internet e tente novamente.';
  }

  // Fallback: mostra a mensagem real do servidor
  if (e.message) {
    return `Erro${ctx}: ${e.message}`;
  }
  return `Erro${ctx} desconhecido. Tente novamente.`;
}

/** Helpers para classificar erros sem fazer match repetido. */
export function isUniqueViolation(err: unknown, columnHint?: string): boolean {
  const e = (err ?? {}) as SupabaseLikeError;
  if (e.code !== '23505') return false;
  if (!columnHint) return true;
  const fontes = [e.message || '', e.details || ''].join(' ').toLowerCase();
  return fontes.includes(columnHint.toLowerCase());
}

export function isRlsViolation(err: unknown): boolean {
  const e = (err ?? {}) as SupabaseLikeError;
  if (e.code === '42501') return true;
  return (e.message || '').toLowerCase().includes('row-level security');
}
