import type { Tables } from '@/integrations/supabase/types';

// Re-exportar tipos do hook para uso consistente
export type { 
  PlanWithDetails, 
  PlanoUnificado, 
  PlanBenefitItem 
} from '@/hooks/usePlans';

// Tipos base das tabelas UNIFICADAS
export type ProductLine = Tables<'product_lines'>;
export type Plan = Tables<'planos'>; // Atualizado: agora usa tabela unificada
export type Benefit = Tables<'benefits'>;
export type PlanBenefit = Tables<'planos_beneficios'>; // Atualizado: agora usa tabela unificada
export type MainCoverage = Tables<'main_coverages'>;

// Alias para manter compatibilidade
export type Plano = Plan;
export type PlanoBeneficio = PlanBenefit;

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

// Tipo com relacionamentos usando a estrutura unificada
export interface PlanBenefitWithDetails extends PlanBenefit {
  benefits: Benefit;
}

// Tipos para agrupamento por linha de produto
// Importamos PlanWithDetails do hook para consistência
import type { PlanWithDetails } from '@/hooks/usePlans';

export interface ProductLineWithPlans extends ProductLine {
  plans: PlanWithDetails[];
}

export interface PlansGroupedByLine {
  productLine: ProductLine;
  plans: PlanWithDetails[];
}
