import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { getHojeBrasilia } from '@/lib/date-utils';

export type TipoAlocacao = 'rota' | 'base';

interface AlocacaoDiaria {
  id: string;
  profissional_id: string;
  data: string;
  tipo_alocacao: TipoAlocacao;
  definido_por: string | null;
  observacoes: string | null;
}

/**
 * Hook para consultar a alocação diária do profissional logado.
 * Retorna 'rota', 'base' ou null (sem alocação definida = comportamento de rota).
 */
export function useAlocacaoDiaria(profissionalId?: string) {
  const { profile } = useAuth();
  const id = profissionalId || profile?.id;

  const { data, isLoading } = useQuery({
    queryKey: ['alocacao-diaria', id],
    queryFn: async () => {
      if (!id) return null;

      const hoje = format(getHojeBrasilia(), 'yyyy-MM-dd');

      const { data: alocacao, error } = await supabase
        .from('alocacoes_diarias')
        .select('*')
        .eq('profissional_id', id)
        .eq('data', hoje)
        .maybeSingle();

      if (error) {
        console.error('[useAlocacaoDiaria] Erro:', error);
        return null;
      }

      return alocacao as AlocacaoDiaria | null;
    },
    enabled: !!id,
    staleTime: 60000, // 1 minuto
  });

  return {
    alocacao: data,
    tipoAlocacao: (data?.tipo_alocacao as TipoAlocacao) || null,
    isBase: data?.tipo_alocacao === 'base',
    isRota: data?.tipo_alocacao === 'rota' || !data, // sem alocação = rota (default)
    isLoading,
  };
}
