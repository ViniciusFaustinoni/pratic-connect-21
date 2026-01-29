import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCallback } from 'react';

interface PosicaoRastreador {
  latitude: number;
  longitude: number;
  velocidade: number;
  ignicao: boolean;
  data_posicao: string;
  endereco?: string;
}

interface UseChamadoPosicaoTempoRealResult {
  posicao: PosicaoRastreador | null;
  isLoading: boolean;
  isRefetching: boolean;
  error: Error | null;
  tempoReal: boolean;
  refetch: () => Promise<void>;
}

/**
 * Hook para buscar posição em tempo real do rastreador de um veículo
 * Útil para acompanhamento de chamados de assistência
 */
export function useChamadoPosicaoTempoReal(
  veiculoId: string | undefined,
  { autoRefresh = true, refetchInterval = 30000 } = {}
): UseChamadoPosicaoTempoRealResult {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['chamado-rastreador-posicao', veiculoId],
    queryFn: async () => {
      if (!veiculoId) throw new Error('Veículo não informado');

      // Buscar rastreador do veículo
      const { data: rastreador, error: rastreadorError } = await supabase
        .from('rastreadores')
        .select('id, plataforma, ultima_posicao_lat, ultima_posicao_lng, ultima_velocidade, ultima_ignicao, ultima_comunicacao')
        .eq('veiculo_id', veiculoId)
        .eq('status', 'instalado')
        .maybeSingle();

      if (rastreadorError) throw rastreadorError;

      if (!rastreador) {
        return {
          posicao: null,
          tempoReal: false,
          mensagem: 'Veículo sem rastreador instalado',
        };
      }

      // Tentar buscar posição via API (tempo real)
      try {
        const { data: posicaoResult, error: posicaoError } = await supabase.functions.invoke('posicao-veiculo', {
          body: { veiculo_id: veiculoId },
        });

        if (!posicaoError && posicaoResult?.success && posicaoResult?.posicao) {
          return {
            posicao: {
              latitude: posicaoResult.posicao.latitude,
              longitude: posicaoResult.posicao.longitude,
              velocidade: posicaoResult.posicao.velocidade || 0,
              ignicao: posicaoResult.posicao.ignicao ?? false,
              data_posicao: posicaoResult.posicao.data_posicao || new Date().toISOString(),
              endereco: posicaoResult.posicao.endereco,
            },
            tempoReal: true,
            mensagem: 'Posição em tempo real',
          };
        }
      } catch {
        // Fallback para banco local
      }

      // Fallback: usar última posição do banco
      if (rastreador.ultima_posicao_lat && rastreador.ultima_posicao_lng) {
        return {
          posicao: {
            latitude: rastreador.ultima_posicao_lat,
            longitude: rastreador.ultima_posicao_lng,
            velocidade: rastreador.ultima_velocidade || 0,
            ignicao: rastreador.ultima_ignicao ?? false,
            data_posicao: rastreador.ultima_comunicacao || new Date().toISOString(),
          },
          tempoReal: false,
          mensagem: 'Última posição conhecida',
        };
      }

      return {
        posicao: null,
        tempoReal: false,
        mensagem: 'Sem posição disponível',
      };
    },
    enabled: !!veiculoId,
    refetchInterval: autoRefresh ? refetchInterval : false,
    staleTime: 15000,
  });

  const refetch = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['chamado-rastreador-posicao', veiculoId] });
  }, [queryClient, veiculoId]);

  return {
    posicao: query.data?.posicao ?? null,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    error: query.error as Error | null,
    tempoReal: query.data?.tempoReal ?? false,
    refetch,
  };
}
