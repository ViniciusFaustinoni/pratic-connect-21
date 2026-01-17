import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const VALOR_POR_COTA_PADRAO = 5000;
const FIPE_MINIMO_PADRAO = 20000;
const FIPE_MAXIMO_PADRAO = 180000;

export function useValorPorCota() {
  return useQuery({
    queryKey: ['configuracao-valor-por-cota'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'atuarial_valor_por_cota')
        .single();
      
      if (error) {
        console.warn('[useValorPorCota] Erro ao buscar configuração:', error);
        return VALOR_POR_COTA_PADRAO;
      }
      
      return Number(data?.valor) || VALOR_POR_COTA_PADRAO;
    },
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Hook para buscar limites FIPE (mínimo e máximo aceitos)
 */
export function useLimitesFipe() {
  return useQuery({
    queryKey: ['configuracao-limites-fipe'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', ['atuarial_fipe_minimo', 'atuarial_fipe_maximo']);
      
      if (error) {
        console.warn('[useLimitesFipe] Erro ao buscar configuração:', error);
        return { minimo: FIPE_MINIMO_PADRAO, maximo: FIPE_MAXIMO_PADRAO };
      }
      
      const limites = { minimo: FIPE_MINIMO_PADRAO, maximo: FIPE_MAXIMO_PADRAO };
      
      data?.forEach(config => {
        if (config.chave === 'atuarial_fipe_minimo') {
          limites.minimo = Number(config.valor) || FIPE_MINIMO_PADRAO;
        }
        if (config.chave === 'atuarial_fipe_maximo') {
          limites.maximo = Number(config.valor) || FIPE_MAXIMO_PADRAO;
        }
      });
      
      return limites;
    },
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Valida se um valor FIPE está dentro dos limites aceitos
 */
export function validarFipe(
  valorFipe: number, 
  limites: { minimo: number; maximo: number }
): { valido: boolean; mensagem?: string } {
  if (valorFipe < limites.minimo) {
    return {
      valido: false,
      mensagem: `Valor FIPE abaixo do mínimo aceito (R$ ${limites.minimo.toLocaleString('pt-BR')})`,
    };
  }
  
  if (valorFipe > limites.maximo) {
    return {
      valido: false,
      mensagem: `Valor FIPE acima do máximo aceito (R$ ${limites.maximo.toLocaleString('pt-BR')})`,
    };
  }
  
  return { valido: true };
}

/**
 * Calcula a quantidade de cotas de um veículo com base no valor FIPE
 * @param valorFipe - Valor FIPE do veículo em reais
 * @param valorPorCota - Valor que representa cada cota (ex: R$ 5.000)
 * @returns Número de cotas (arredondado para cima)
 * 
 * @example
 * // Veículo de R$ 50.000 com cota de R$ 5.000 = 10 cotas
 * calcularQuantidadeCotas(50000, 5000) // retorna 10
 * 
 * @example
 * // Veículo de R$ 53.000 com cota de R$ 5.000 = 11 cotas (arredonda para cima)
 * calcularQuantidadeCotas(53000, 5000) // retorna 11
 */
export function calcularQuantidadeCotas(valorFipe: number, valorPorCota: number): number {
  if (!valorPorCota || valorPorCota <= 0) return 0;
  if (!valorFipe || valorFipe <= 0) return 0;
  return Math.ceil(valorFipe / valorPorCota);
}

/**
 * Calcula o valor total representado por uma quantidade de cotas
 * @param quantidadeCotas - Número de cotas
 * @param valorPorCota - Valor que representa cada cota
 * @returns Valor total em reais
 * 
 * @example
 * // 10 cotas com valor de R$ 5.000 cada = R$ 50.000
 * calcularValorEmCotas(10, 5000) // retorna 50000
 */
export function calcularValorEmCotas(quantidadeCotas: number, valorPorCota: number): number {
  if (!quantidadeCotas || quantidadeCotas <= 0) return 0;
  if (!valorPorCota || valorPorCota <= 0) return 0;
  return quantidadeCotas * valorPorCota;
}

/**
 * Valor padrão usado quando a configuração não está disponível
 */
export const VALOR_COTA_DEFAULT = VALOR_POR_COTA_PADRAO;
