import { useQuery } from '@tanstack/react-query';
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

const LIMIT = 200;

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

  return useQuery({
    queryKey: [
      'historico-vinculo-filtrado',
      { rastreadorId: rastreadorId || null, veiculoId: veiculoId || null, placa: placaTrim, dataInicioISO, dataFimISO },
    ],
    enabled: !!(rastreadorId || veiculoId),
    queryFn: async (): Promise<{ items: HistoricoVinculoItem[]; truncated: boolean }> => {
      let q = supabase
        .from('rastreadores_vinculo_historico' as never)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(LIMIT);

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

      const { data, error } = await q;
      if (error) throw error;
      const items = (data || []) as unknown as HistoricoVinculoItem[];
      return { items, truncated: items.length >= LIMIT };
    },
  });
}
