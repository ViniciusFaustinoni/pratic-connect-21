import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ============================================
// TIPOS
// ============================================

export interface BenefitExclusion {
  id: string;
  benefit_id: string;
  categoria_veiculo: string;
  created_at: string;
}

// ============================================
// HOOKS DE LEITURA
// ============================================

/**
 * Busca todas as exclusões de benefícios por categoria
 */
export function useBenefitExclusions() {
  return useQuery({
    queryKey: ['benefit_category_exclusions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('benefit_category_exclusions')
        .select('*');
      
      if (error) throw error;
      return data as BenefitExclusion[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

/**
 * Busca exclusões de um benefício específico
 */
export function useBenefitExclusionsByBenefitId(benefitId: string | null) {
  return useQuery({
    queryKey: ['benefit_category_exclusions', benefitId],
    queryFn: async () => {
      if (!benefitId) return [];
      
      const { data, error } = await supabase
        .from('benefit_category_exclusions')
        .select('*')
        .eq('benefit_id', benefitId);
      
      if (error) throw error;
      return data as BenefitExclusion[];
    },
    enabled: !!benefitId,
  });
}

/**
 * Retorna um mapa de benefício -> categorias excluídas
 * Útil para verificação rápida durante cotações
 */
export function useBenefitExclusionsMap() {
  const { data: exclusions } = useBenefitExclusions();
  
  const exclusionsMap = new Map<string, Set<string>>();
  
  if (exclusions) {
    exclusions.forEach((exc) => {
      if (!exclusionsMap.has(exc.benefit_id)) {
        exclusionsMap.set(exc.benefit_id, new Set());
      }
      exclusionsMap.get(exc.benefit_id)!.add(exc.categoria_veiculo);
    });
  }
  
  return exclusionsMap;
}

// ============================================
// HOOKS DE MUTAÇÃO
// ============================================

interface UpdateExclusionsInput {
  benefitId: string;
  categorias: string[];
}

/**
 * Atualiza as exclusões de um benefício (deleta e recria)
 */
export function useUpdateBenefitExclusions() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ benefitId, categorias }: UpdateExclusionsInput) => {
      // Deletar exclusões existentes
      const { error: deleteError } = await supabase
        .from('benefit_category_exclusions')
        .delete()
        .eq('benefit_id', benefitId);
      
      if (deleteError) throw deleteError;
      
      // Inserir novas exclusões
      if (categorias.length > 0) {
        const records = categorias.map((cat) => ({
          benefit_id: benefitId,
          categoria_veiculo: cat,
        }));
        
        const { error: insertError } = await supabase
          .from('benefit_category_exclusions')
          .insert(records);
        
        if (insertError) throw insertError;
      }
      
      return { benefitId, categorias };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['benefit_category_exclusions'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar exclusões: ${error.message}`);
    },
  });
}

// ============================================
// FUNÇÕES UTILITÁRIAS
// ============================================

/**
 * Verifica se um benefício está excluído para uma categoria
 * Versão síncrona que usa um cache pré-carregado
 */
export function isBenefitExcludedForCategory(
  benefitId: string,
  categoria: string | null | undefined,
  exclusionsMap: Map<string, Set<string>>
): boolean {
  if (!categoria || categoria === 'nenhuma' || !benefitId) {
    return false;
  }
  
  const excludedCategories = exclusionsMap.get(benefitId);
  return excludedCategories?.has(categoria) || false;
}

/**
 * Verifica se um benefício (pelo nome) está excluído para uma categoria
 * Útil quando só temos o nome do benefício
 */
export function isBenefitNameExcludedForCategory(
  benefitName: string,
  categoria: string | null | undefined,
  exclusions: BenefitExclusion[],
  benefitsMap: Map<string, string> // name -> id
): boolean {
  if (!categoria || categoria === 'nenhuma' || !benefitName) {
    return false;
  }
  
  const benefitId = benefitsMap.get(benefitName.toLowerCase());
  if (!benefitId) return false;
  
  return exclusions.some(
    (exc) => exc.benefit_id === benefitId && exc.categoria_veiculo === categoria
  );
}
