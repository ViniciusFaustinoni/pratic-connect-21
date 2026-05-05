import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';

export interface ServerListResult<T> {
  data: T[];
  count: number;
}

export interface UseServerListOptions<T, F extends Record<string, string> = Record<string, string>> {
  /** chave única para query/cache e prefixo de URL params */
  key: string;
  /** fetcher: recebe { search, page, pageSize, filters } e retorna { data, count } */
  fetcher: (params: {
    search: string;
    page: number;
    pageSize: number;
    filters: F;
  }) => Promise<ServerListResult<T>>;
  /** filtros adicionais (default vazio) */
  defaultFilters?: F;
  /** tamanho de página padrão */
  defaultPageSize?: 25 | 50 | 100;
  /** debounce do search em ms (default 300) */
  debounceMs?: number;
  /** sincroniza com URL (default true) */
  syncUrl?: boolean;
  /** habilita query */
  enabled?: boolean;
}

/**
 * Hook unificado para listas paginadas server-side.
 * Estado (search/page/pageSize/filters) opcionalmente sincronizado com a URL.
 */
export function useServerList<T, F extends Record<string, string> = Record<string, string>>(
  options: UseServerListOptions<T, F>,
) {
  const {
    key,
    fetcher,
    defaultFilters = {} as F,
    defaultPageSize = 50,
    debounceMs = 300,
    syncUrl = true,
    enabled = true,
  } = options;

  const [searchParams, setSearchParams] = useSearchParams();
  const prefix = `${key}_`;

  const initialSearch = syncUrl ? searchParams.get(`${prefix}q`) ?? '' : '';
  const initialPage = syncUrl ? Number(searchParams.get(`${prefix}page`) ?? 1) : 1;
  const initialPageSize = (syncUrl
    ? Number(searchParams.get(`${prefix}size`) ?? defaultPageSize)
    : defaultPageSize) as 25 | 50 | 100;

  const [search, setSearchState] = useState(initialSearch);
  const [page, setPageState] = useState(Math.max(1, initialPage));
  const [pageSize, setPageSizeState] = useState<25 | 50 | 100>(initialPageSize);
  const [filters, setFiltersState] = useState<F>(() => {
    if (!syncUrl) return defaultFilters;
    const fromUrl = { ...defaultFilters } as F;
    Object.keys(defaultFilters).forEach((k) => {
      const v = searchParams.get(`${prefix}f_${k}`);
      if (v != null) (fromUrl as any)[k] = v;
    });
    return fromUrl;
  });

  const debouncedSearch = useDebounce(search, debounceMs);

  // Sincroniza state -> URL
  useEffect(() => {
    if (!syncUrl) return;
    const next = new URLSearchParams(searchParams);
    const set = (k: string, v: string | number, def?: string | number) => {
      if (v === '' || v === undefined || v === null || (def !== undefined && String(v) === String(def))) {
        next.delete(k);
      } else {
        next.set(k, String(v));
      }
    };
    set(`${prefix}q`, debouncedSearch);
    set(`${prefix}page`, page, 1);
    set(`${prefix}size`, pageSize, defaultPageSize);
    Object.entries(filters).forEach(([k, v]) => set(`${prefix}f_${k}`, v, (defaultFilters as any)[k] ?? ''));
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, page, pageSize, filters]);

  // Reset page ao mudar busca/filtros
  useEffect(() => {
    setPageState(1);
  }, [debouncedSearch, JSON.stringify(filters)]); // eslint-disable-line react-hooks/exhaustive-deps

  const query = useQuery({
    queryKey: [key, debouncedSearch, page, pageSize, filters],
    queryFn: () => fetcher({ search: debouncedSearch.trim(), page, pageSize, filters }),
    placeholderData: keepPreviousData,
    enabled,
    staleTime: 30_000,
  });

  const total = query.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const items = query.data?.data ?? [];

  const range = useMemo(() => {
    if (total === 0) return { from: 0, to: 0 };
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);
    return { from, to };
  }, [page, pageSize, total]);

  return {
    items,
    total,
    totalPages,
    range,
    page,
    setPage: (p: number) => setPageState(Math.max(1, Math.min(totalPages, p))),
    pageSize,
    setPageSize: (s: 25 | 50 | 100) => {
      setPageSizeState(s);
      setPageState(1);
    },
    search,
    setSearch: setSearchState,
    debouncedSearch,
    filters,
    setFilters: (next: Partial<F>) => setFiltersState((prev) => ({ ...prev, ...next })),
    clearFilters: () => {
      setFiltersState(defaultFilters);
      setSearchState('');
      setPageState(1);
    },
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}
