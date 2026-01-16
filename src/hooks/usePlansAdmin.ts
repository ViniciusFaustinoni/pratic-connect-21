import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Plan, Benefit, MainCoverage, ProductLine } from '@/types/plans';

// ==================== PLAN TYPES ====================

export interface PlanBenefitInput {
  benefit_id: string;
  custom_text?: string | null;
  custom_value?: string | null;
  additional_info?: string | null;
  is_highlighted?: boolean;
  display_order?: number;
}

export interface PlanInput {
  name: string;
  slug: string;
  product_line_id: string;
  badge_text?: string | null;
  badge_color?: string | null;
  coverage_type?: string | null;
  min_vehicle_year?: string | null;
  additional_price?: number | null;
  cota_passeio_percent?: number | null;
  cota_passeio_min?: number | null;
  cota_desagio_percent?: number | null;
  cota_desagio_min?: number | null;
  cota_app_percent?: number | null;
  cota_app_min?: number | null;
  restriction_alert?: string | null;
  footer_note?: string | null;
  display_order?: number;
  is_active?: boolean;
  benefits?: PlanBenefitInput[];
}

// ==================== PLAN MUTATIONS ====================

export function useCreatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PlanInput) => {
      const { benefits, ...planData } = input;

      // Create plan
      const { data: plan, error: planError } = await supabase
        .from('plans')
        .insert(planData)
        .select()
        .single();

      if (planError) throw planError;

      // Create plan_benefits if provided
      if (benefits && benefits.length > 0) {
        const planBenefits = benefits.map((b, index) => ({
          plan_id: plan.id,
          benefit_id: b.benefit_id,
          custom_text: b.custom_text,
          custom_value: b.custom_value,
          additional_info: b.additional_info,
          is_highlighted: b.is_highlighted ?? false,
          display_order: b.display_order ?? index,
        }));

        const { error: benefitsError } = await supabase
          .from('plan_benefits')
          .insert(planBenefits);

        if (benefitsError) throw benefitsError;
      }

      return plan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      toast.success('Plano criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar plano: ${error.message}`);
    },
  });
}

export function useUpdatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: PlanInput & { id: string }) => {
      const { benefits, ...planData } = input;

      // Update plan
      const { data: plan, error: planError } = await supabase
        .from('plans')
        .update(planData)
        .eq('id', id)
        .select()
        .single();

      if (planError) throw planError;

      // Update plan_benefits - delete old and insert new
      if (benefits !== undefined) {
        // Delete existing benefits
        const { error: deleteError } = await supabase
          .from('plan_benefits')
          .delete()
          .eq('plan_id', id);

        if (deleteError) throw deleteError;

        // Insert new benefits
        if (benefits.length > 0) {
          const planBenefits = benefits.map((b, index) => ({
            plan_id: id,
            benefit_id: b.benefit_id,
            custom_text: b.custom_text,
            custom_value: b.custom_value,
            additional_info: b.additional_info,
            is_highlighted: b.is_highlighted ?? false,
            display_order: b.display_order ?? index,
          }));

          const { error: insertError } = await supabase
            .from('plan_benefits')
            .insert(planBenefits);

          if (insertError) throw insertError;
        }
      }

      return plan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      toast.success('Plano atualizado!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar plano: ${error.message}`);
    },
  });
}

export function useDeletePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Delete plan_benefits first (cascade should handle, but being safe)
      await supabase.from('plan_benefits').delete().eq('plan_id', id);

      const { error } = await supabase.from('plans').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      toast.success('Plano excluído!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir plano: ${error.message}`);
    },
  });
}

export function useDuplicatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Get original plan with benefits
      const { data: original, error: fetchError } = await supabase
        .from('plans')
        .select('*, plan_benefits(*)')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Create new plan
      const { id: _, created_at, plan_benefits, ...planData } = original;
      const newPlan = {
        ...planData,
        name: `${planData.name} (cópia)`,
        slug: `${planData.slug}-copia-${Date.now()}`,
        is_active: false,
      };

      const { data: createdPlan, error: createError } = await supabase
        .from('plans')
        .insert(newPlan)
        .select()
        .single();

      if (createError) throw createError;

      // Duplicate benefits
      if (plan_benefits && plan_benefits.length > 0) {
        const newBenefits = plan_benefits.map((pb: any) => ({
          plan_id: createdPlan.id,
          benefit_id: pb.benefit_id,
          custom_text: pb.custom_text,
          custom_value: pb.custom_value,
          additional_info: pb.additional_info,
          is_highlighted: pb.is_highlighted,
          display_order: pb.display_order,
        }));

        await supabase.from('plan_benefits').insert(newBenefits);
      }

      return createdPlan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      toast.success('Plano duplicado!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao duplicar plano: ${error.message}`);
    },
  });
}

export function useReorderPlans() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: { id: string; display_order: number }[]) => {
      const updates = items.map(({ id, display_order }) =>
        supabase.from('plans').update({ display_order }).eq('id', id)
      );
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      toast.success('Ordem atualizada!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao reordenar: ${error.message}`);
    },
  });
}

// ==================== BENEFIT MUTATIONS ====================

export interface BenefitInput {
  name: string;
  slug: string;
  icon?: string | null;
  description?: string | null;
  category?: string | null;
  display_order?: number;
  is_active?: boolean;
}

export function useCreateBenefit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: BenefitInput) => {
      const { data, error } = await supabase
        .from('benefits')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['benefits'] });
      toast.success('Benefício criado!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar benefício: ${error.message}`);
    },
  });
}

export function useUpdateBenefit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: BenefitInput & { id: string }) => {
      const { data, error } = await supabase
        .from('benefits')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['benefits'] });
      toast.success('Benefício atualizado!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar benefício: ${error.message}`);
    },
  });
}

export function useDeleteBenefit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('benefits').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['benefits'] });
      toast.success('Benefício excluído!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir benefício: ${error.message}`);
    },
  });
}

// ==================== MAIN COVERAGE MUTATIONS ====================

export interface MainCoverageInput {
  name: string;
  subtitle?: string | null;
  icon?: string | null;
  display_order?: number;
  is_active?: boolean;
}

export function useCreateMainCoverage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: MainCoverageInput) => {
      const { data, error } = await supabase
        .from('main_coverages')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['main_coverages'] });
      toast.success('Cobertura criada!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar cobertura: ${error.message}`);
    },
  });
}

export function useUpdateMainCoverage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: MainCoverageInput & { id: string }) => {
      const { data, error } = await supabase
        .from('main_coverages')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['main_coverages'] });
      toast.success('Cobertura atualizada!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar cobertura: ${error.message}`);
    },
  });
}

export function useDeleteMainCoverage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('main_coverages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['main_coverages'] });
      toast.success('Cobertura excluída!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir cobertura: ${error.message}`);
    },
  });
}

// ==================== PRODUCT LINE MUTATIONS ====================

export interface ProductLineInput {
  name: string;
  slug: string;
  icon?: string | null;
  color?: string | null;
  vehicle_type?: string | null;
  display_order?: number;
  is_active?: boolean;
}

export function useCreateProductLine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ProductLineInput) => {
      const { data, error } = await supabase
        .from('product_lines')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product_lines'] });
      toast.success('Linha de produto criada!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar linha: ${error.message}`);
    },
  });
}

export function useUpdateProductLine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: ProductLineInput & { id: string }) => {
      const { data, error } = await supabase
        .from('product_lines')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product_lines'] });
      toast.success('Linha de produto atualizada!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar linha: ${error.message}`);
    },
  });
}

export function useDeleteProductLine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_lines').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product_lines'] });
      toast.success('Linha de produto excluída!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir linha: ${error.message}`);
    },
  });
}
