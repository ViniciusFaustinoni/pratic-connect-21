import { useQuery } from '@tanstack/react-query';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { LIMITE_VAGAS_POR_PERIODO, type Periodo } from '@/data/autovistoriaConfig';

interface VagasDisponiveis {
  manha: number;
  tarde: number;
}

/**
 * Hook para verificar vagas disponíveis por período para uma data específica.
 * Conta apenas serviços com local_vistoria = 'cliente' (atendimento no cliente).
 */
export function useVagasPeriodo(data: string | null) {
  return useQuery({
    queryKey: ['vagas-periodo', data],
    queryFn: async (): Promise<VagasDisponiveis> => {
      if (!data) {
        return { manha: LIMITE_VAGAS_POR_PERIODO, tarde: LIMITE_VAGAS_POR_PERIODO };
      }

      // Buscar serviços agendados para a data (excluindo cancelados/recusados)
      const { data: servicos, error } = await publicSupabase
        .from('servicos')
        .select('periodo')
        .eq('data_agendada', data)
        .eq('local_vistoria', 'cliente')
        .not('status', 'in', '("cancelada","recusada")');
      
      if (error) {
        console.error('[useVagasPeriodo] Erro ao buscar serviços:', error);
        throw error;
      }
      
      // Contar agendamentos por período
      const contagem = { manha: 0, tarde: 0 };
      servicos?.forEach(s => {
        if (s.periodo === 'manha') contagem.manha++;
        else if (s.periodo === 'tarde') contagem.tarde++;
      });
      
      // Retornar vagas restantes
      return {
        manha: Math.max(0, LIMITE_VAGAS_POR_PERIODO - contagem.manha),
        tarde: Math.max(0, LIMITE_VAGAS_POR_PERIODO - contagem.tarde),
      };
    },
    enabled: !!data,
    staleTime: 30 * 1000, // 30 segundos
    refetchOnWindowFocus: true,
  });
}

/**
 * Verifica se um período específico tem vagas disponíveis.
 */
export function temVagasDisponiveis(vagas: VagasDisponiveis | undefined, periodo: Periodo): boolean {
  if (!vagas) return true; // Assume disponível enquanto carrega
  return vagas[periodo] > 0;
}
