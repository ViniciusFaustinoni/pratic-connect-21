import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const FIPE_MINIMO_RASTREADOR_PADRAO = 30000;
const FIPE_MINIMO_RASTREADOR_MOTO_PADRAO = 9000;

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
    staleTime: 1000 * 60 * 10,
  });
}

export function useConfigFipeRastreadorMoto() {
  return useQuery({
    queryKey: ['config-fipe-minimo-rastreador-moto'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'operacional_fipe_minimo_rastreador_moto')
        .single();
      
      if (error) {
        console.warn('[useConfigFipeRastreadorMoto] Erro ao buscar:', error);
        return FIPE_MINIMO_RASTREADOR_MOTO_PADRAO;
      }
      
      return Number(data?.valor) || FIPE_MINIMO_RASTREADOR_MOTO_PADRAO;
    },
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Verifica se o veículo precisa de rastreador baseado no valor FIPE e tipo de veículo
 */
export function precisaRastreador(
  valorFipe: number | null | undefined,
  fipeMinimo: number,
  tipoVeiculo: 'automovel' | 'moto' = 'automovel',
  fipeMinimoMoto?: number
): boolean {
  const limite = tipoVeiculo === 'moto' ? (fipeMinimoMoto ?? FIPE_MINIMO_RASTREADOR_MOTO_PADRAO) : fipeMinimo;
  
  // Se não tem FIPE cadastrado, exige por segurança
  if (valorFipe === null || valorFipe === undefined || valorFipe <= 0) {
    return true;
  }
  // Se FIPE >= mínimo configurado, exige rastreador
  return valorFipe >= limite;
}
