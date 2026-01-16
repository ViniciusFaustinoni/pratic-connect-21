import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { 
  ProductLine, 
  Plan, 
  Benefit, 
  MainCoverage,
  PlanWithDetails,
  ProductLineWithPlans
} from '@/types/plans';

/**
 * Hook para buscar todas as linhas de produtos ativas
 */
export function useProductLines() {
  return useQuery({
    queryKey: ['product_lines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_lines')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      
      if (error) throw error;
      return data as ProductLine[];
    },
  });
}

/**
 * Hook para buscar linhas de produtos com seus planos
 */
export function useProductLinesWithPlans() {
  return useQuery({
    queryKey: ['product_lines', 'with_plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_lines')
        .select(`
          *,
          plans (*)
        `)
        .eq('is_active', true)
        .order('display_order');
      
      if (error) throw error;
      return data as ProductLineWithPlans[];
    },
  });
}

/**
 * Hook para buscar planos com seus benefícios
 * @param productLineSlug - Opcional: filtrar por slug da linha de produto
 */
export function usePlans(productLineSlug?: string) {
  return useQuery({
    queryKey: ['plans', productLineSlug],
    queryFn: async () => {
      let query = supabase
        .from('plans')
        .select(`
          *,
          product_lines!inner (*),
          plan_benefits (
            *,
            benefits (*)
          )
        `)
        .eq('is_active', true)
        .order('display_order');
      
      if (productLineSlug) {
        query = query.eq('product_lines.slug', productLineSlug);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Ordenar plan_benefits por display_order
      return (data as PlanWithDetails[]).map(plan => ({
        ...plan,
        plan_benefits: plan.plan_benefits?.sort((a, b) => 
          (a.display_order || 0) - (b.display_order || 0)
        ) || []
      }));
    },
  });
}

/**
 * Hook para buscar um plano específico por ID
 * @param id - ID do plano
 */
export function usePlanById(id: string | undefined) {
  return useQuery({
    queryKey: ['plans', 'detail', id],
    queryFn: async () => {
      if (!id) throw new Error('ID é obrigatório');
      
      const { data, error } = await supabase
        .from('plans')
        .select(`
          *,
          product_lines (*),
          plan_benefits (
            *,
            benefits (*)
          )
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      // Ordenar plan_benefits por display_order
      return {
        ...data,
        plan_benefits: data.plan_benefits?.sort((a: any, b: any) => 
          (a.display_order || 0) - (b.display_order || 0)
        ) || []
      } as PlanWithDetails;
    },
    enabled: !!id,
  });
}

/**
 * Hook para buscar um plano específico por slug
 * @param slug - Slug do plano
 */
export function usePlanBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ['plans', 'by_slug', slug],
    queryFn: async () => {
      if (!slug) throw new Error('Slug é obrigatório');
      
      const { data, error } = await supabase
        .from('plans')
        .select(`
          *,
          product_lines (*),
          plan_benefits (
            *,
            benefits (*)
          )
        `)
        .eq('slug', slug)
        .single();
      
      if (error) throw error;
      
      return {
        ...data,
        plan_benefits: data.plan_benefits?.sort((a: any, b: any) => 
          (a.display_order || 0) - (b.display_order || 0)
        ) || []
      } as PlanWithDetails;
    },
    enabled: !!slug,
  });
}

/**
 * Hook para buscar todos os benefícios disponíveis
 */
export function useBenefits() {
  return useQuery({
    queryKey: ['benefits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('benefits')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      
      if (error) throw error;
      return data as Benefit[];
    },
  });
}

/**
 * Hook para buscar benefícios por categoria
 * @param category - Categoria do benefício
 */
export function useBenefitsByCategory(category: string) {
  return useQuery({
    queryKey: ['benefits', 'category', category],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('benefits')
        .select('*')
        .eq('is_active', true)
        .eq('category', category)
        .order('display_order');
      
      if (error) throw error;
      return data as Benefit[];
    },
    enabled: !!category,
  });
}

/**
 * Hook para buscar as coberturas principais
 */
export function useMainCoverages() {
  return useQuery({
    queryKey: ['main_coverages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('main_coverages')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      
      if (error) throw error;
      return data as MainCoverage[];
    },
  });
}

/**
 * Hook para buscar planos agrupados por linha de produto
 */
export function usePlansGroupedByLine() {
  return useQuery({
    queryKey: ['plans', 'grouped_by_line'],
    queryFn: async () => {
      // Buscar linhas de produto
      const { data: lines, error: linesError } = await supabase
        .from('product_lines')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      
      if (linesError) throw linesError;
      
      // Buscar planos com benefícios
      const { data: plans, error: plansError } = await supabase
        .from('plans')
        .select(`
          *,
          product_lines (*),
          plan_benefits (
            *,
            benefits (*)
          )
        `)
        .eq('is_active', true)
        .order('display_order');
      
      if (plansError) throw plansError;
      
      // Agrupar planos por linha
      return (lines as ProductLine[]).map(line => ({
        productLine: line,
        plans: (plans as PlanWithDetails[])
          .filter(plan => plan.product_line_id === line.id)
          .map(plan => ({
            ...plan,
            plan_benefits: plan.plan_benefits?.sort((a, b) => 
              (a.display_order || 0) - (b.display_order || 0)
            ) || []
          }))
      }));
    },
  });
}
