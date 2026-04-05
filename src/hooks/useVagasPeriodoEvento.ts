import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { LIMITE_VAGAS_POR_PERIODO, type Periodo } from '@/data/autovistoriaConfig';

interface VagasDisponiveis {
  manha: number;
  tarde: number;
}

/**
 * Hook para verificar vagas disponíveis por período para vistorias de evento (sinistro).
 * Conta vistorias_evento agendadas (não canceladas) para a data.
 */
export function useVagasPeriodoEvento(data: string | null) {
  return useQuery({
    queryKey: ['vagas-periodo-evento', data],
    queryFn: async (): Promise<VagasDisponiveis> => {
      if (!data) {
        return { manha: LIMITE_VAGAS_POR_PERIODO, tarde: LIMITE_VAGAS_POR_PERIODO };
      }

      const { data: vistorias, error } = await supabase
        .from('vistorias_evento' as any)
        .select('horario_agendado')
        .eq('data_agendada', data)
        .neq('status', 'cancelada');

      if (error) {
        console.error('[useVagasPeriodoEvento] Erro ao buscar vistorias:', error);
        throw error;
      }

      const contagem = { manha: 0, tarde: 0 };
      (vistorias as any[])?.forEach((v: any) => {
        const h = v.horario_agendado;
        if (h === 'manha') contagem.manha++;
        else if (h === 'tarde') contagem.tarde++;
      });

      return {
        manha: Math.max(0, LIMITE_VAGAS_POR_PERIODO - contagem.manha),
        tarde: Math.max(0, LIMITE_VAGAS_POR_PERIODO - contagem.tarde),
      };
    },
    enabled: !!data,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}
