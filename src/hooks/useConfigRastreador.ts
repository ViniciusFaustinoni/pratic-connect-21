import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const FIPE_MINIMO_RASTREADOR_PADRAO = 30000;

export function useConfigFipeRastreador() {
  return useQuery({
    queryKey: ['config-fipe-minimo-rastreador'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'operacional_fipe_minimo_rastreador')
        .single();
      
      if (error) {
        console.warn('[useConfigFipeRastreador] Erro ao buscar:', error);
        return FIPE_MINIMO_RASTREADOR_PADRAO;
      }
      
      return Number(data?.valor) || FIPE_MINIMO_RASTREADOR_PADRAO;
    },
    staleTime: 1000 * 60 * 10, // 10 minutos
  });
}

/**
 * Verifica se o veículo precisa de rastreador baseado no valor FIPE
 * @param valorFipe - Valor FIPE do veículo (em reais)
 * @param fipeMinimo - Valor mínimo configurado para exigir rastreador
 * @returns true se precisa de rastreador, false se dispensa
 */
export function precisaRastreador(valorFipe: number | null | undefined, fipeMinimo: number): boolean {
  // Se não tem FIPE cadastrado, exige por segurança
  if (valorFipe === null || valorFipe === undefined || valorFipe <= 0) {
    return true;
  }
  // Se FIPE >= mínimo configurado, exige rastreador
  return valorFipe >= fipeMinimo;
}
