import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Benefit, MainCoverage, ProductLine } from '@/types/plans';
import { clearExclusionsCache } from '@/data/restricoesCategorias';

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
  tipo_uso?: 'passeio' | 'aplicativo';
  badge_text?: string | null;
  badge_color?: string | null;
  coverage_type?: string | null;
  min_vehicle_year?: string | null;
  additional_price?: number | null;
  desconto_percentual?: number | null;
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
  linha_slug?: string | null;
  categorias_veiculo?: string | null;
}

// ==================== PLAN MUTATIONS ====================

export function useCreatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PlanInput) => {
      const { benefits, linha_slug, categorias_veiculo, ...planData } = input;

      // Mapear para campos da tabela planos
      const planoData = {
        codigo: planData.slug,
        nome: planData.name,
        slug: planData.slug,
        product_line_id: planData.product_line_id,
        tipo_uso: planData.tipo_uso || 'passeio',
        badge_text: planData.badge_text,
        badge_color: planData.badge_color,
        coverage_type: planData.coverage_type,
        ano_minimo: planData.min_vehicle_year ? parseInt(planData.min_vehicle_year.replace(/\D/g, '')) : null,
        adicional_mensal: planData.additional_price || 0,
        cota_participacao: planData.cota_passeio_percent,
        cota_minima: planData.cota_passeio_min,
        cota_desagio: planData.cota_desagio_percent,
        cota_minima_desagio: planData.cota_desagio_min,
        cota_app_percent: planData.cota_app_percent,
        cota_app_min: planData.cota_app_min,
        restriction_alert: planData.restriction_alert,
        footer_note: planData.footer_note,
        ordem: planData.display_order || 0,
        ativo: planData.is_active ?? true,
        valor_adesao: 0,
        categoria: categorias_veiculo || null,
      };

      // Create plan
      const { data: plan, error: planError } = await supabase
        .from('planos')
        .insert(planoData)
        .select()
        .single();

      if (planError) throw planError;

      // Upsert plano_preco_map if linha_slug provided
      if (linha_slug) {
        // Delete existing and insert new
        await supabase
          .from('plano_preco_map')
          .delete()
          .eq('plano_id', plan.id);
        
        await supabase
          .from('plano_preco_map')
          .insert({ plano_id: plan.id, linha_slug, tipo_uso: planData.tipo_uso || 'particular' });
      }

      // Create planos_beneficios if provided
      if (benefits && benefits.length > 0) {
        const planBenefits = benefits.map((b, index) => ({
          plano_id: plan.id,
          benefit_id: b.benefit_id,
          beneficio: '',
          custom_text: b.custom_text,
          custom_value: b.custom_value,
          additional_info: b.additional_info,
          is_highlighted: b.is_highlighted ?? false,
          display_order: b.display_order ?? index,
          incluso: true,
        }));

        const { error: benefitsError } = await supabase
          .from('planos_beneficios')
          .insert(planBenefits);

        if (benefitsError) throw benefitsError;
      }

      return plan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['planos'] });
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
      const { benefits, linha_slug, categorias_veiculo, ...planData } = input;

      // Mapear para campos da tabela planos
      const planoData = {
        codigo: planData.slug,
        nome: planData.name,
        slug: planData.slug,
        product_line_id: planData.product_line_id,
        tipo_uso: planData.tipo_uso || 'passeio',
        badge_text: planData.badge_text,
        badge_color: planData.badge_color,
        coverage_type: planData.coverage_type,
        ano_minimo: planData.min_vehicle_year ? parseInt(planData.min_vehicle_year.replace(/\D/g, '')) : null,
        adicional_mensal: planData.additional_price || 0,
        cota_participacao: planData.cota_passeio_percent,
        cota_minima: planData.cota_passeio_min,
        cota_desagio: planData.cota_desagio_percent,
        cota_minima_desagio: planData.cota_desagio_min,
        cota_app_percent: planData.cota_app_percent,
        cota_app_min: planData.cota_app_min,
        restriction_alert: planData.restriction_alert,
        footer_note: planData.footer_note,
        ordem: planData.display_order || 0,
        ativo: planData.is_active ?? true,
        categoria: categorias_veiculo || null,
      };

      // Update plan
      const { data: plan, error: planError } = await supabase
        .from('planos')
        .update(planoData)
        .eq('id', id)
        .select()
        .single();

      if (planError) throw planError;

      // Update plano_preco_map if linha_slug provided
      if (linha_slug !== undefined) {
        await supabase
          .from('plano_preco_map')
          .delete()
          .eq('plano_id', id);
        
        if (linha_slug) {
          await supabase
            .from('plano_preco_map')
            .insert({ plano_id: id, linha_slug, tipo_uso: planData.tipo_uso || 'particular' });
        }
      }

      // Update planos_beneficios - delete old and insert new
      if (benefits !== undefined) {
        // Delete existing benefits
        const { error: deleteError } = await supabase
          .from('planos_beneficios')
          .delete()
          .eq('plano_id', id);

        if (deleteError) throw deleteError;

        // Insert new benefits
        if (benefits.length > 0) {
          const planBenefits = benefits.map((b, index) => ({
            plano_id: id,
            benefit_id: b.benefit_id,
            beneficio: '',
            custom_text: b.custom_text,
            custom_value: b.custom_value,
            additional_info: b.additional_info,
            is_highlighted: b.is_highlighted ?? false,
            display_order: b.display_order ?? index,
            incluso: true,
          }));

          const { error: insertError } = await supabase
            .from('planos_beneficios')
            .insert(planBenefits);

          if (insertError) throw insertError;
        }
      }

      return plan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['planos'] });
      toast.success('Plano atualizado!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar plano: ${error.message}`);
    },
  });
}

export function useTogglePlanStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('planos')
        .update({ ativo: is_active })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return { ...data, is_active: data.ativo };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['planos'] });
      toast.success(`Plano ${data.is_active ? 'ativado' : 'desativado'}`);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao alterar status: ${error.message}`);
    },
  });
}

export function useDeletePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Delete planos_beneficios first
      await supabase.from('planos_beneficios').delete().eq('plano_id', id);

      const { error } = await supabase.from('planos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['planos'] });
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
        .from('planos')
        .select('*, planos_beneficios(*)')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Create new plan
      const { id: _, created_at, updated_at, planos_beneficios, ...planData } = original;
      const newPlan = {
        ...planData,
        nome: `${planData.nome} (cópia)`,
        codigo: `${planData.codigo}-copia-${Date.now()}`,
        slug: `${planData.slug || planData.codigo}-copia-${Date.now()}`,
        ativo: false,
      };

      const { data: createdPlan, error: createError } = await supabase
        .from('planos')
        .insert(newPlan)
        .select()
        .single();

      if (createError) throw createError;

      // Duplicate benefits
      if (planos_beneficios && planos_beneficios.length > 0) {
        const newBenefits = planos_beneficios.map((pb: any) => ({
          plano_id: createdPlan.id,
          benefit_id: pb.benefit_id,
          beneficio: pb.beneficio,
          custom_text: pb.custom_text,
          custom_value: pb.custom_value,
          additional_info: pb.additional_info,
          is_highlighted: pb.is_highlighted,
          display_order: pb.display_order,
          incluso: pb.incluso,
        }));

        await supabase.from('planos_beneficios').insert(newBenefits);
      }

      return createdPlan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['planos'] });
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
        supabase.from('planos').update({ ordem: display_order }).eq('id', id)
      );
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['planos'] });
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
      queryClient.invalidateQueries({ queryKey: ['benefit_category_exclusions'] });
      clearExclusionsCache();
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
      queryClient.invalidateQueries({ queryKey: ['benefit_category_exclusions'] });
      clearExclusionsCache();
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
      // Deletar exclusões primeiro
      await supabase.from('benefit_category_exclusions').delete().eq('benefit_id', id);
      
      const { error } = await supabase.from('benefits').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['benefits'] });
      queryClient.invalidateQueries({ queryKey: ['benefit_category_exclusions'] });
      clearExclusionsCache();
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
