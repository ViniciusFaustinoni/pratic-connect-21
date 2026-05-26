/**
 * Paginação canônica para queries Supabase em catálogos grandes.
 *
 * Motivo: PostgREST aplica teto default de 1000 linhas por resposta.
 * Qualquer `.select('*')` cru em `benefits`, `coberturas`, `planos_coberturas`,
 * `planos_beneficios`, `marcas_modelos`, `entity_eligibility_rules` etc.
 * corta o resultado silenciosamente — itens além da posição 1000 viram invisíveis
 * em modais de "Atribuir"/"Vincular" e listagens client-side.
 *
 * Uso:
 * ```ts
 * const data = await fetchAll<Benefit>((from, to) =>
 *   supabase.from('benefits').select('*').eq('is_active', true).order('name').range(from, to)
 * );
 * ```
 *
 * NUNCA aceitar um builder pronto — o builder Supabase é thenable e só executa
 * uma vez. A função recebe uma FACTORY que devolve um novo builder por página.
 */
export async function fetchAll<T = any>(
  factory: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  options: { pageSize?: number; maxPages?: number; label?: string } = {}
): Promise<T[]> {
  const pageSize = options.pageSize ?? 1000;
  const maxPages = options.maxPages ?? 50; // 50k linhas teto de segurança
  const acc: T[] = [];

  for (let page = 0; page < maxPages; page++) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await factory(from, to);
    if (error) throw error;
    const rows = data ?? [];
    acc.push(...rows);
    if (rows.length < pageSize) return acc;
  }

  // Estouro defensivo — emite alerta mas devolve o que tem
  // (não estoura silenciosamente como o cap default do PostgREST)
  // eslint-disable-next-line no-console
  console.warn(
    `[fetchAll] ${options.label ?? 'query'} excedeu maxPages=${maxPages} (${acc.length} linhas). Aumente maxPages ou refine o filtro.`
  );
  return acc;
}
