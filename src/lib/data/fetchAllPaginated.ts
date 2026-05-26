/**
 * Helper para varrer tabelas Supabase/PostgREST inteiras sem cair no cap silencioso
 * de 1000 linhas. Recebe uma função `buildQuery(from, to)` que monta a query base
 * (já com `.select()`, filtros e order) e aplica `.range(from, to)`.
 *
 * Uso:
 *   const rows = await fetchAllPaginated<MyRow>((from, to) =>
 *     supabase.from('planos_beneficios').select('benefit_id, plano_id').range(from, to)
 *   );
 */
export async function fetchAllPaginated<T = any>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  // Guard duro: 50 páginas (= 50k linhas com pageSize=1000). Se ultrapassar, algo está errado.
  for (let page = 0; page < 50; page++) {
    const to = from + pageSize - 1;
    const { data, error } = await buildQuery(from, to);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < pageSize) return all;
    from += pageSize;
  }
  if (import.meta.env.DEV) {
    console.warn('[fetchAllPaginated] atingiu o limite de 50 páginas — verifique o filtro da query.');
  }
  return all;
}
