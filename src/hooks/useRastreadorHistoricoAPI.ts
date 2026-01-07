import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface TrajetoPonto {
  latitude: number;
  longitude: number;
  velocidade: number;
  ignicao: boolean;
  data_posicao: string;
  endereco?: string;
}

interface HistoricoResponse {
  success: boolean;
  fonte: 'api' | 'local';
  mensagem?: string;
  trajeto: TrajetoPonto[];
  periodo?: { inicio: string; fim: string };
  total: number;
}

interface UseHistoricoParams {
  rastreadorId: string;
  dataInicio?: Date;
  dataFim?: Date;
  enabled?: boolean;
}

export function useRastreadorHistoricoAPI({ 
  rastreadorId, 
  dataInicio, 
  dataFim,
  enabled = true 
}: UseHistoricoParams) {
  return useQuery({
    queryKey: ['rastreador-historico-api', rastreadorId, dataInicio?.toISOString(), dataFim?.toISOString()],
    queryFn: async (): Promise<HistoricoResponse> => {
      const { data, error } = await supabase.functions.invoke('rastreador-historico', {
        body: { 
          rastreador_id: rastreadorId,
          data_inicio: dataInicio?.toISOString(),
          data_fim: dataFim?.toISOString(),
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data;
    },
    enabled: !!rastreadorId && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

export type { TrajetoPonto, HistoricoResponse };
