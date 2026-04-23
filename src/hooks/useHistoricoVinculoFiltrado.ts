import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface HistoricoVinculoItem {
  id: string;
  rastreador_id: string;
  veiculo_id_anterior: string | null;
  veiculo_id_novo: string | null;
  placa_anterior: string | null;
  placa_nova: string | null;
  status_anterior: string | null;
  status_novo: string | null;
  alterado_por_nome: string | null;
  origem: string | null;
  contexto: Record<string, unknown> | null;
  created_at: string;
}

interface UseHistoricoVinculoFiltradoArgs {
  rastreadorId?: string | null;
  veiculoId?: string | null;
  placa?: string;
  dataInicio?: Date | null;
  dataFim?: Date | null;
}

interface Cursor {
  created_at: string;
  id: string;
}

const PAGE_SIZE = 25;

export function useHistoricoVinculoFiltrado({
  rastreadorId,
  veiculoId,
  placa,
  dataInicio,
  dataFim,
}: UseHistoricoVinculoFiltradoArgs) {
  const placaTrim = (placa || '').trim().toUpperCase();
  const dataInicioISO = dataInicio ? new Date(new Date(dataInicio).setHours(0, 0, 0, 0)).toISOString() : null;
  const dataFimISO = dataFim ? new Date(new Date(dataFim).setHours(23, 59, 59, 999)).toISOString() : null;

  const query = useInfiniteQuery({
    queryKey: [
      'historico-vinculo-filtrado',
      { rastreadorId: rastreadorId || null, veiculoId: veiculoId || null, placa: placaTrim, dataInicioISO, dataFimISO },
    ],
    enabled: !!(rastreadorId || veiculoId),
    initialPageParam: null as Cursor | null,
    getNextPageParam: (lastPage: { items: HistoricoVinculoItem[]; nextCursor: Cursor | null }) =>
      lastPage.nextCursor,
    queryFn: async ({ pageParam }): Promise<{ items: HistoricoVinculoItem[]; nextCursor: Cursor | null }> => {
      let q = supabase
        .from('rastreadores_vinculo_historico' as never)
        .select('*')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(PAGE_SIZE + 1);

      if (rastreadorId) {
        q = q.eq('rastreador_id', rastreadorId);
      }
      if (veiculoId) {
        q = q.or(`veiculo_id_anterior.eq.${veiculoId},veiculo_id_novo.eq.${veiculoId}`);
      }
      if (placaTrim) {
        q = q.or(`placa_anterior.ilike.%${placaTrim}%,placa_nova.ilike.%${placaTrim}%`);
      }
      if (dataInicioISO) {
        q = q.gte('created_at', dataInicioISO);
      }
      if (dataFimISO) {
        q = q.lte('created_at', dataFimISO);
      }

      // Keyset cursor composto (created_at, id) — evita pular registros com timestamps idênticos.
      if (pageParam) {
        q = q.or(
          `created_at.lt.${pageParam.created_at},and(created_at.eq.${pageParam.created_at},id.lt.${pageParam.id})`,
        );
      }

      const { data, error } = await q;
      if (error) throw error;

      const rows = (data || []) as unknown as HistoricoVinculoItem[];
      const hasMore = rows.length > PAGE_SIZE;
      const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
      const last = items[items.length - 1];
      const nextCursor: Cursor | null = hasMore && last ? { created_at: last.created_at, id: last.id } : null;

      return { items, nextCursor };
    },
  });

  const items = useMemo(
    () => (query.data?.pages ?? []).flatMap((p) => p.items),
    [query.data],
  );

  return {
    items,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: !!query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
  };
}
