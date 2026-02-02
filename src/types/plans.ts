import type { Tables } from '@/integrations/supabase/types';

// Re-exportar tipos do hook para uso consistente
export type { 
  PlanWithDetails, 
  PlanoUnificado, 
  PlanBenefitItem 
} from '@/hooks/usePlans';

// Tipos base das tabelas
export type ProductLine = Tables<'product_lines'>;
export type Plan = Tables<'plans'>;
export type Benefit = Tables<'benefits'>;
export type PlanBenefit = Tables<'plan_benefits'>;
export type MainCoverage = Tables<'main_coverages'>;

// Tipo para exclusões de benefícios por categoria
export interface BenefitCategoryExclusion {
  id: string;
  benefit_id: string;
  categoria_veiculo: string;
  created_at: string;
}

// Benefício com suas exclusões carregadas
export interface BenefitWithExclusions extends Benefit {
  excluded_categories?: string[];
}

// Tipos com relacionamentos (deprecated - use PlanWithDetails do hook)
export interface PlanBenefitWithDetails extends PlanBenefit {
  benefits: Benefit;
}

export interface ProductLineWithPlans extends ProductLine {
  plans: Plan[];
}

// Tipo para lista de planos agrupados por linha
export interface PlansGroupedByLine {
  productLine: ProductLine;
  plans: Plan[];
}
