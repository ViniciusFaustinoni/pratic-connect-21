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
/**
 * Verifica se uma data é dia útil (segunda a sexta)
 */
export function isDiaUtil(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5; // 1=seg, 5=sex
}

export function useAlocacaoDiaria(profissionalId?: string) {
  const { profile } = useAuth();
  const id = profissionalId || profile?.id;

  const hoje = getHojeBrasilia();
  const diaUtil = isDiaUtil(hoje);

  const { data, isLoading } = useQuery({
    queryKey: ['alocacao-diaria', id],
    queryFn: async () => {
      if (!id) return null;

      // Dia útil: todos disponíveis (rota), sem consultar banco
      if (diaUtil) return null;

      const hojeStr = format(hoje, 'yyyy-MM-dd');

      const { data: alocacao, error } = await supabase
        .from('alocacoes_diarias')
        .select('*')
        .eq('profissional_id', id)
        .eq('data', hojeStr)
        .maybeSingle();

      if (error) {
        console.error('[useAlocacaoDiaria] Erro:', error);
        return null;
      }

      return alocacao as AlocacaoDiaria | null;
    },
    enabled: !!id,
    staleTime: 60000,
  });

  return {
    alocacao: diaUtil ? null : data,
    tipoAlocacao: diaUtil ? null : (data?.tipo_alocacao as TipoAlocacao) || null,
    isBase: diaUtil ? false : data?.tipo_alocacao === 'base',
    isRota: diaUtil ? true : data?.tipo_alocacao === 'rota' || !data,
    isDiaUtil: diaUtil,
    isLoading: diaUtil ? false : isLoading,
  };
}
