import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
export { formatarMoeda } from '@/utils/format';

export interface PrecoPlano {
  plano_id: string;
  soma_beneficios: number;
  valor_adicional: number;
  mensalidade: number;
  valor_adesao: number;
  qtd_beneficios: number;
  indicador_geral: 'saudavel' | 'atencao';
}

/**
 * Hook para calcular preço de um plano específico
 */
export function usePrecoPlano(planoId: string | undefined) {
  return useQuery({
    queryKey: ['preco-plano', planoId],
    queryFn: async () => {
      if (!planoId) return null;
      
      const { data, error } = await supabase
        .rpc('fn_calcular_preco_plano', { p_plano_id: planoId });
      
      if (error) {
        console.error('[usePrecoPlano] Erro:', error);
        throw error;
      }
      
      return data?.[0] as PrecoPlano || null;
    },
    enabled: !!planoId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Hook para calcular preços de múltiplos planos
 */
export function usePrecosPlanos(planoIds: string[]) {
  return useQuery({
    queryKey: ['precos-planos', planoIds],
    queryFn: async () => {
      if (!planoIds.length) return [];
      
      const results: PrecoPlano[] = [];
      
      for (const planoId of planoIds) {
        const { data, error } = await supabase
          .rpc('fn_calcular_preco_plano', { p_plano_id: planoId });
        
        if (!error && data?.[0]) {
          results.push(data[0] as PrecoPlano);
        }
      }
      
      return results;
    },
    enabled: planoIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });
}
/**
 * Calcula preço do plano manualmente (para uso sem RPC)
 */
export function calcularPrecoPlanoManual(
  somaBeneficios: number,
  valorAdicional: number
): number {
  return somaBeneficios + valorAdicional;
}
