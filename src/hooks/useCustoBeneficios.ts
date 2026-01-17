import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type IndicadorSaude = 'superavit' | 'equilibrio' | 'prejuizo' | 'sem_dados';

export interface CustoBeneficio {
  beneficio_id: string;
  codigo: string;
  nome: string;
  categoria: string;
  preco_sugerido: number;
  variacao_por_cota: boolean;
  gasto_total_60d: number;
  qtd_utilizacoes_60d: number;
  total_associados: number;
  total_veiculos: number;
  total_cotas: number;
  custo_real: number;
  margem: number;
  indicador: IndicadorSaude;
  tipo_beneficio: 'benefit' | 'adicional';
}

export interface ResumoSaudeBeneficios {
  total_beneficios: number;
  superavit: number;
  equilibrio: number;
  prejuizo: number;
  sem_dados: number;
}

/**
 * Hook para buscar custo real de todos os benefícios
 */
export function useCustoBeneficios() {
  return useQuery({
    queryKey: ['custo-real-beneficios'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_custo_real_adicionais')
        .select('*')
        .order('categoria')
        .order('nome');
      
      if (error) {
        console.error('[useCustoBeneficios] Erro:', error);
        throw error;
      }
      
      return (data || []) as CustoBeneficio[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}

/**
 * Hook para buscar custo real de um benefício específico
 */
export function useCustoBeneficio(beneficioId: string | undefined, tipo: 'benefit' | 'adicional' = 'benefit') {
  return useQuery({
    queryKey: ['custo-beneficio', beneficioId, tipo],
    queryFn: async () => {
      if (!beneficioId) return null;
      
      const { data, error } = await supabase
        .rpc('fn_calcular_custo_beneficio', { 
          p_beneficio_id: beneficioId,
          p_tipo: tipo 
        });
      
      if (error) {
        console.error('[useCustoBeneficio] Erro:', error);
        throw error;
      }
      
      return data?.[0] || null;
    },
    enabled: !!beneficioId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Hook para buscar resumo de saúde financeira dos benefícios
 */
export function useResumoSaudeBeneficios() {
  return useQuery({
    queryKey: ['resumo-saude-beneficios'],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('fn_resumo_saude_beneficios');
      
      if (error) {
        console.error('[useResumoSaudeBeneficios] Erro:', error);
        throw error;
      }
      
      const resultado = data?.[0] || {
        total_beneficios: 0,
        superavit: 0,
        equilibrio: 0,
        prejuizo: 0,
        sem_dados: 0
      };
      
      return resultado as ResumoSaudeBeneficios;
    },
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Calcula o indicador de saúde com base no preço e custo real
 */
export function calcularIndicadorSaude(preco: number, custoReal: number): IndicadorSaude {
  if (custoReal === 0) return 'sem_dados';
  if (preco < custoReal) return 'prejuizo';
  if (preco > custoReal) return 'superavit';
  return 'equilibrio';
}

/**
 * Calcula a margem (diferença entre preço e custo real)
 */
export function calcularMargem(preco: number, custoReal: number): number {
  return preco - custoReal;
}

/**
 * Retorna a cor do indicador para uso em classes CSS
 */
export function getCorIndicador(indicador: IndicadorSaude): {
  bg: string;
  text: string;
  border: string;
} {
  switch (indicador) {
    case 'superavit':
      return {
        bg: 'bg-green-50 dark:bg-green-950/30',
        text: 'text-green-600 dark:text-green-400',
        border: 'border-green-200 dark:border-green-800'
      };
    case 'equilibrio':
      return {
        bg: 'bg-yellow-50 dark:bg-yellow-950/30',
        text: 'text-yellow-600 dark:text-yellow-400',
        border: 'border-yellow-200 dark:border-yellow-800'
      };
    case 'prejuizo':
      return {
        bg: 'bg-red-50 dark:bg-red-950/30',
        text: 'text-red-600 dark:text-red-400',
        border: 'border-red-200 dark:border-red-800'
      };
    default:
      return {
        bg: 'bg-gray-50 dark:bg-gray-900/30',
        text: 'text-gray-500 dark:text-gray-400',
        border: 'border-gray-200 dark:border-gray-700'
      };
  }
}

/**
 * Retorna o ícone do indicador (emoji)
 */
export function getEmojiIndicador(indicador: IndicadorSaude): string {
  switch (indicador) {
    case 'superavit': return '🟢';
    case 'equilibrio': return '🟡';
    case 'prejuizo': return '🔴';
    default: return '⚪';
  }
}
