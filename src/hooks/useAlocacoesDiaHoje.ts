import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { getHojeBrasilia } from '@/lib/date-utils';

export interface AlocacaoDiaInfo {
  profissional_id: string;
  tipo_alocacao: 'rota' | 'base';
  base_id: string | null;
}

/**
 * Mapa profissional_id -> { tipo_alocacao, base_id } para a data informada (default = hoje BR).
 * Realtime sobre a tabela alocacoes_diarias.
 */
export function useAlocacoesDiaHoje(data?: Date) {
  const queryClient = useQueryClient();
  const dataRef = data || getHojeBrasilia();
  const dataStr = format(dataRef, 'yyyy-MM-dd');

  const query = useQuery({
    queryKey: ['alocacoes-dia', dataStr],
    queryFn: async (): Promise<Record<string, AlocacaoDiaInfo>> => {
      const { data: rows, error } = await supabase
        .from('alocacoes_diarias')
        .select('profissional_id, tipo_alocacao, base_id')
        .eq('data', dataStr);

      if (error) {
        console.error('[useAlocacoesDiaHoje] erro:', error);
        return {};
      }

      const map: Record<string, AlocacaoDiaInfo> = {};
      (rows || []).forEach((r: any) => {
        map[r.profissional_id] = {
          profissional_id: r.profissional_id,
          tipo_alocacao: r.tipo_alocacao,
          base_id: r.base_id,
        };
      });
      return map;
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`alocacoes-dia-${dataStr}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alocacoes_diarias', filter: `data=eq.${dataStr}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['alocacoes-dia', dataStr] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dataStr, queryClient]);

  return query;
}
