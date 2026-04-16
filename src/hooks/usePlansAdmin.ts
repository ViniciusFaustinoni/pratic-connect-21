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
  ano_fabricacao_maximo?: number | null;
  additional_price?: number | null;
  desconto_percentual?: number | null;
  cota_participacao?: number | null;
  restriction_alert?: string | null;
  footer_note?: string | null;
  display_order?: number;
  is_active?: boolean;
  benefits?: PlanBenefitInput[];
  coberturas?: { cobertura_id: string }[];
  categorias_veiculo?: string | null;
  regioes?: string[];
}

// ==================== PLAN MUTATIONS ====================

export function useCreatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PlanInput) => {
      const { benefits, coberturas, categorias_veiculo, regioes, ...planData } = input;

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
        ano_minimo: planData.min_vehicle_year ? parseInt(planData.min_vehicle_year) : null,
        ano_fabricacao_maximo: planData.ano_fabricacao_maximo ?? null,
        adicional_mensal: planData.additional_price || 0,
        desconto_percentual: planData.desconto_percentual ?? 0,
        cota_participacao: planData.cota_participacao ?? null,
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

      // Create planos_coberturas if provided
      if (coberturas && coberturas.length > 0) {
        const { error: cobError } = await supabase
          .from('planos_coberturas')
          .insert(coberturas.map(c => ({
            plano_id: plan.id,
            cobertura_id: c.cobertura_id,
          })));
        if (cobError) throw cobError;
      }

      // Create region links
      if (regioes && regioes.length > 0) {
        const { error: regioesError } = await supabase
          .from('planos_regioes')
          .insert(regioes.map(regiaoId => ({
            plano_id: plan.id,
            regiao_id: regiaoId,
          })));
        if (regioesError) throw regioesError;
      }

      return plan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['planos'] });
      queryClient.invalidateQueries({ queryKey: ['linhas_com_planos_clean'] });
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
      const { benefits, coberturas, categorias_veiculo, regioes, ...planData } = input;

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
        ano_minimo: planData.min_vehicle_year ? parseInt(planData.min_vehicle_year) : null,
        ano_fabricacao_maximo: planData.ano_fabricacao_maximo ?? null,
        adicional_mensal: planData.additional_price || 0,
        desconto_percentual: planData.desconto_percentual ?? 0,
        cota_participacao: planData.cota_participacao ?? null,
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

      // Update planos_coberturas - delete old and insert new
      if (coberturas !== undefined) {
        await supabase.from('planos_coberturas').delete().eq('plano_id', id);
        if (coberturas.length > 0) {
          const { error: cobError } = await supabase
            .from('planos_coberturas')
            .insert(coberturas.map(c => ({
              plano_id: id,
              cobertura_id: c.cobertura_id,
            })));
          if (cobError) throw cobError;
        }
      }

      // Update region links
      if (regioes !== undefined) {
        await supabase.from('planos_regioes').delete().eq('plano_id', id);
        if (regioes.length > 0) {
          const { error: regioesError } = await supabase
            .from('planos_regioes')
            .insert(regioes.map(regiaoId => ({
              plano_id: id,
              regiao_id: regiaoId,
            })));
          if (regioesError) throw regioesError;
        }
      }

      return plan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['planos'] });
      queryClient.invalidateQueries({ queryKey: ['linhas_com_planos_clean'] });
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
      queryClient.invalidateQueries({ queryKey: ['linhas_com_planos_clean'] });
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
      queryClient.invalidateQueries({ queryKey: ['linhas_com_planos_clean'] });
      toast.success('Plano excluído!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir plano: ${error.message}`);
    },
  });
}

interface DuplicatePlanInput {
  id: string;
  desconto?: number;
  sufixo?: string;
  regiao?: string;
  tipoUso?: string;
  combustivel?: string;
}

/**
 * Apply bulk rule overrides to a list of cloned eligibility rules.
 * Returns the final list of rules to insert, with old rules of the overridden
 * types removed and new ones appended.
 */
function applyBulkRuleOverrides(
  clonedRules: any[],
  entityId: string,
  entityType: string,
  overrides: { regiao?: string; tipoUso?: string; combustivel?: string },
) {
  const typesToReplace: string[] = [];
  const newRules: any[] = [];

  if (overrides.regiao) {
    typesToReplace.push('regiao');
    newRules.push({
      entity_id: entityId,
      entity_type: entityType,
      rule_type: 'regiao',
      rule_mode: 'include',
      rule_config: { values: [overrides.regiao] },
      is_active: true,
    });
  }
  if (overrides.tipoUso) {
    typesToReplace.push('tipo_uso');
    newRules.push({
      entity_id: entityId,
      entity_type: entityType,
      rule_type: 'tipo_uso',
      rule_mode: 'include',
      rule_config: { values: [overrides.tipoUso] },
      is_active: true,
    });
  }
  if (overrides.combustivel) {
    typesToReplace.push('combustivel');
    newRules.push({
      entity_id: entityId,
      entity_type: entityType,
      rule_type: 'combustivel',
      rule_mode: 'include',
      rule_config: { combustiveis: [overrides.combustivel] },
      is_active: true,
    });
  }

  const filtered = typesToReplace.length > 0
    ? clonedRules.filter((r: any) => !typesToReplace.includes(r.rule_type))
    : clonedRules;

  return [...filtered, ...newRules];
}

export function useDuplicatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: string | DuplicatePlanInput) => {
      const { id, desconto = 0, sufixo = '', regiao, tipoUso, combustivel } =
        typeof input === 'string' ? { id: input } as DuplicatePlanInput : input;

      const bulkOverrides = { regiao, tipoUso, combustivel };
      const hasBulkOverrides = !!(regiao || tipoUso || combustivel);

      const applyDiscount = (val: number | null | undefined, pct: number): number | null => {
        if (val == null) return null;
        return Number((val * (100 - pct) / 100).toFixed(2));
      };

      const applyDiscountToFipeRanges = (rules: any[], pct: number) => {
        if (pct <= 0) return rules;
        return rules.map((r: any) => {
          if (r.rule_type !== 'fipe_range') return r;
          const faixas = (r.rule_config?.faixas || []).map((f: any) => ({
            ...f,
            valor: Number((f.valor * (100 - pct) / 100).toFixed(2)),
          }));
          return { ...r, rule_config: { ...r.rule_config, faixas } };
        });
      };

      // Get original plan with benefits and regions
      const { data: original, error: fetchError } = await supabase
        .from('planos')
        .select('*, planos_beneficios(*), planos_regioes(regiao_id)')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Create new plan
      const { id: _, created_at, updated_at, planos_beneficios, planos_regioes, ...planData } = original;
      const newPlan = {
        ...planData,
        nome: sufixo ? `${planData.nome}${sufixo}` : planData.nome,
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

      // Clone plan-level eligibility rules
      const { data: planRules } = await supabase
        .from('entity_eligibility_rules')
        .select('*')
        .eq('entity_type', 'plano')
        .eq('entity_id', id);

      if (planRules && planRules.length > 0) {
        const clonedPlanRules = planRules.map((r: any) => {
          const { id: rId, created_at: rCreated, ...rData } = r;
          return { ...rData, entity_id: createdPlan.id };
        });
        const finalPlanRules = applyBulkRuleOverrides(clonedPlanRules, createdPlan.id, 'plano', bulkOverrides);
        if (finalPlanRules.length > 0) {
          const { error: planRulesErr } = await supabase.from('entity_eligibility_rules').insert(finalPlanRules);
          if (planRulesErr) { console.error('Erro ao inserir regras do plano:', planRulesErr); throw planRulesErr; }
        }
      } else if (hasBulkOverrides) {
        // No original plan rules — create new ones from overrides
        const newPlanRules = applyBulkRuleOverrides([], createdPlan.id, 'plano', bulkOverrides);
        if (newPlanRules.length > 0) {
          const { error: newPlanRulesErr } = await supabase.from('entity_eligibility_rules').insert(newPlanRules);
          if (newPlanRulesErr) { console.error('Erro ao inserir regras do plano:', newPlanRulesErr); throw newPlanRulesErr; }
        }
      }

      // Duplicate benefits — clone each benefit record
      if (planos_beneficios && planos_beneficios.length > 0) {
        for (const pb of planos_beneficios as any[]) {
          if (!pb.benefit_id) continue;

          const { data: origBenefit } = await supabase
            .from('benefits')
            .select('*')
            .eq('id', pb.benefit_id)
            .single();

          if (!origBenefit) continue;

          const { id: bId, created_at: bCreated, ...bData } = origBenefit;
          const uniqueSuffix = `-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const { data: newBenefit, error: bError } = await supabase
            .from('benefits')
            .insert({
              ...bData,
              name: sufixo ? `${bData.name}${sufixo}` : bData.name,
              slug: ((bData.slug as string) || '').slice(0, 80) + uniqueSuffix,
              preco_sugerido: applyDiscount(bData.preco_sugerido, desconto),
            })
            .select()
            .single();

          if (bError || !newBenefit) continue;

          await supabase.from('planos_beneficios').insert({
            plano_id: createdPlan.id,
            benefit_id: newBenefit.id,
            beneficio: pb.beneficio,
            custom_text: pb.custom_text,
            custom_value: pb.custom_value,
            additional_info: pb.additional_info,
            is_highlighted: pb.is_highlighted,
            display_order: pb.display_order,
            incluso: pb.incluso,
          });

          // Clone eligibility rules for this benefit (with overrides)
          const { data: bRules } = await supabase
            .from('entity_eligibility_rules')
            .select('*')
            .eq('entity_type', 'beneficio')
            .eq('entity_id', pb.benefit_id);

          const clonedBRules = (bRules || []).map((r: any) => {
            const { id: rId, created_at: rCreated, ...rData } = r;
            return { ...rData, entity_id: newBenefit.id };
          });
          const discountedBRules = applyDiscountToFipeRanges(clonedBRules, desconto);
          const finalBRules = applyBulkRuleOverrides(discountedBRules, newBenefit.id, 'beneficio', bulkOverrides);
          if (finalBRules.length > 0) {
            const { error: bRulesErr } = await supabase.from('entity_eligibility_rules').insert(finalBRules);
            if (bRulesErr) { console.error('Erro ao inserir regras do benefício:', bRulesErr); throw bRulesErr; }
          }

          // Clone category exclusions
          const { data: bExcl } = await supabase
            .from('benefit_category_exclusions')
            .select('*')
            .eq('benefit_id', pb.benefit_id);

          if (bExcl && bExcl.length > 0) {
            const clonedExcl = bExcl.map((e: any) => ({
              benefit_id: newBenefit.id,
              categoria_veiculo: e.categoria_veiculo,
            }));
            await supabase.from('benefit_category_exclusions').insert(clonedExcl);
          }
        }
      }

      // Duplicate region links
      if (planos_regioes && (planos_regioes as any[]).length > 0) {
        const newRegioes = (planos_regioes as any[]).map((pr: any) => ({
          plano_id: createdPlan.id,
          regiao_id: pr.regiao_id,
        }));
        await supabase.from('planos_regioes').insert(newRegioes);
      }

      // Duplicate coverages — each plan gets its own unique copies
      const { data: originalCoberturas } = await supabase
        .from('planos_coberturas')
        .select('cobertura_id')
        .eq('plano_id', id);

      if (originalCoberturas && originalCoberturas.length > 0) {
        for (const pc of originalCoberturas) {
          const { data: origCob } = await supabase
            .from('coberturas')
            .select('*')
            .eq('id', pc.cobertura_id)
            .single();

          if (!origCob) continue;

          const { id: cobId, created_at: cobCreated, ...cobData } = origCob;
          const uniqueSuffix = `-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const { data: newCob, error: cobError } = await supabase
            .from('coberturas')
            .insert({
              ...cobData,
              nome: sufixo ? `${cobData.nome}${sufixo}` : cobData.nome,
              codigo: (cobData.codigo || '').slice(0, 80) + uniqueSuffix,
              valor: applyDiscount(cobData.valor, desconto),
              valor_limite: applyDiscount(cobData.valor_limite, desconto),
              franquia_valor: applyDiscount(cobData.franquia_valor, desconto),
            })
            .select()
            .single();

          if (cobError || !newCob) continue;

          // Fetch original planos_coberturas data to preserve all fields
          const { data: origPC } = await supabase
            .from('planos_coberturas')
            .select('*')
            .eq('plano_id', id)
            .eq('cobertura_id', pc.cobertura_id)
            .single();

          await supabase.from('planos_coberturas').insert({
            plano_id: createdPlan.id,
            cobertura_id: newCob.id,
            carencia_dias: origPC?.carencia_dias,
            franquia_percentual: origPC?.franquia_percentual,
            franquia_valor: applyDiscount(origPC?.franquia_valor, desconto),
            obrigatoria: origPC?.obrigatoria,
            percentual_cobertura: origPC?.percentual_cobertura,
            valor_limite: applyDiscount(origPC?.valor_limite, desconto),
          });

          // Clone eligibility rules for this coverage (with overrides)
          const { data: rules } = await supabase
            .from('entity_eligibility_rules')
            .select('*')
            .eq('entity_type', 'cobertura')
            .eq('entity_id', pc.cobertura_id);

          const clonedRules = (rules || []).map((r: any) => {
            const { id: rId, created_at: rCreated, ...rData } = r;
            return { ...rData, entity_id: newCob.id };
          });
          const discountedRules = applyDiscountToFipeRanges(clonedRules, desconto);
          const finalRules = applyBulkRuleOverrides(discountedRules, newCob.id, 'cobertura', bulkOverrides);
          if (finalRules.length > 0) {
            const { error: cobRulesErr } = await supabase.from('entity_eligibility_rules').insert(finalRules);
            if (cobRulesErr) { console.error('Erro ao inserir regras da cobertura:', cobRulesErr); throw cobRulesErr; }
          }
        }
      }

      return createdPlan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['planos'] });
      queryClient.invalidateQueries({ queryKey: ['linhas_com_planos_clean'] });
      queryClient.invalidateQueries({ queryKey: ['entity_eligibility_rules'] });
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
  slug?: string;
  icon?: string | null;
  description?: string | null;
  category?: string | null;
  display_order?: number;
  is_active?: boolean;
}

export type BenefitCreateInput = BenefitInput & { slug: string };

export function useCreateBenefit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: BenefitCreateInput) => {
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

// ==================== MAIN COVERAGE MUTATIONS (deprecated) ====================

/** @deprecated Use cobertura mutations instead */
export interface MainCoverageInput {
  name: string;
  subtitle?: string | null;
  icon?: string | null;
  display_order?: number;
  is_active?: boolean;
}

/** @deprecated */
export function useCreateMainCoverage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: MainCoverageInput) => {
      const { data, error } = await supabase.from('main_coverages').insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['main_coverages'] }); toast.success('Cobertura criada!'); },
    onError: (error: Error) => { toast.error(`Erro ao criar cobertura: ${error.message}`); },
  });
}

/** @deprecated */
export function useUpdateMainCoverage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: MainCoverageInput & { id: string }) => {
      const { data, error } = await supabase.from('main_coverages').update(input).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['main_coverages'] }); toast.success('Cobertura atualizada!'); },
    onError: (error: Error) => { toast.error(`Erro ao atualizar cobertura: ${error.message}`); },
  });
}

/** @deprecated */
export function useDeleteMainCoverage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('main_coverages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['main_coverages'] }); toast.success('Cobertura excluída!'); },
    onError: (error: Error) => { toast.error(`Erro ao excluir cobertura: ${error.message}`); },
  });
}

// ==================== COBERTURA MUTATIONS (unified) ====================

export interface CoberturaInput {
  nome: string;
  codigo?: string;
  descricao?: string | null;
  tipo?: string | null;
  icon?: string | null;
  subtitle?: string | null;
  display_order?: number;
  ativo?: boolean;
  valor?: number | null;
  valor_limite?: number | null;
  percentual_cobertura?: number | null;
  franquia_percentual?: number | null;
  franquia_valor?: number | null;
  carencia_ativa?: boolean;
  carencia_dias?: number | null;
  carencia_tipo?: string | null;
  carencia_multiplicador?: number | null;
}

export function useCreateCobertura() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CoberturaInput) => {
      const codigo = input.codigo || input.nome.toUpperCase().replace(/\s+/g, '-').slice(0, 20);
      const { data, error } = await supabase
        .from('coberturas')
        .insert({
          nome: input.nome,
          codigo,
          descricao: input.descricao ?? null,
          tipo: input.tipo ?? null,
          icon: input.icon ?? null,
          subtitle: input.subtitle ?? null,
          display_order: input.display_order ?? 0,
          ativo: input.ativo ?? true,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coberturas'] });
      toast.success('Cobertura criada!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar cobertura: ${error.message}`);
    },
  });
}

export function useUpdateCobertura() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: CoberturaInput & { id: string }) => {
      const { data, error } = await supabase
        .from('coberturas')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coberturas'] });
      toast.success('Cobertura atualizada!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar cobertura: ${error.message}`);
    },
  });
}

export function useDeleteCobertura() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Delete planos_coberturas links first
      await supabase.from('planos_coberturas').delete().eq('cobertura_id', id);
      const { error } = await supabase.from('coberturas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coberturas'] });
      toast.success('Cobertura excluída!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir cobertura: ${error.message}`);
    },
  });
}

// ==================== DUPLICATE COBERTURA ====================

export function useDuplicateCobertura() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // 1. Fetch original cobertura
      const { data: original, error: fetchError } = await supabase
        .from('coberturas')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      const { id: _, created_at, ...cobData } = original;
      const suffix = Math.random().toString(36).slice(2, 8);
      const newCob = {
        ...cobData,
        nome: `${(cobData.nome || '').slice(0, 140)} (cópia)`,
        codigo: `${(cobData.codigo || 'COB').slice(0, 80)}-CP-${suffix}`,
        ativo: false,
      };

      const { data, error } = await supabase
        .from('coberturas')
        .insert(newCob)
        .select()
        .single();

      if (error) throw error;

      // 2. Copy eligibility rules
      const { data: rules } = await supabase
        .from('entity_eligibility_rules')
        .select('*')
        .eq('entity_type', 'cobertura')
        .eq('entity_id', id);

      if (rules && rules.length > 0) {
        const newRules = rules.map(({ id: _rid, created_at: _ca, updated_at: _ua, ...rule }) => ({
          ...rule,
          entity_id: data.id,
        }));
        await supabase.from('entity_eligibility_rules').insert(newRules);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coberturas'] });
      toast.success('Cobertura duplicada! (criada como inativa)');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao duplicar cobertura: ${error.message}`);
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
      queryClient.invalidateQueries({ queryKey: ['linhas_com_planos_clean'] });
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
      queryClient.invalidateQueries({ queryKey: ['linhas_com_planos_clean'] });
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
      queryClient.invalidateQueries({ queryKey: ['linhas_com_planos_clean'] });
      toast.success('Linha de produto excluída!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir linha: ${error.message}`);
    },
  });
}

// ==================== DUPLICATE PRODUCT LINE ====================

interface DuplicateLineInput {
  id: string;
  nome?: string;
  desconto?: number;
  sufixo?: string;
  regiao?: string;
  tipoUso?: string;
  tipoVeiculo?: string;
  combustivel?: string;
}

export function useDuplicateProductLine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: DuplicateLineInput) => {
      const { id, nome, desconto = 0, sufixo = '', regiao, tipoUso, tipoVeiculo, combustivel } = input;
      const bulkOverrides = { regiao, tipoUso, combustivel };
      const hasBulkOverrides = !!(regiao || tipoUso || combustivel);

      const applyDiscount = (val: number | null | undefined, pct: number): number | null => {
        if (val == null) return null;
        return Number((val * (100 - pct) / 100).toFixed(2));
      };

      const applyDiscountToFipeRanges = (rules: any[], pct: number) => {
        if (pct <= 0) return rules;
        return rules.map((r: any) => {
          if (r.rule_type !== 'fipe_range') return r;
          const faixas = (r.rule_config?.faixas || []).map((f: any) => ({
            ...f,
            valor: Number((f.valor * (100 - pct) / 100).toFixed(2)),
          }));
          return { ...r, rule_config: { ...r.rule_config, faixas } };
        });
      };

      const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      // 1. Fetch & clone line
      const { data: original, error: fetchError } = await supabase
        .from('product_lines').select('*').eq('id', id).single();
      if (fetchError) throw fetchError;

      const { id: _, created_at, ...lineData } = original;
      const { data: createdLine, error: lineError } = await supabase
        .from('product_lines')
        .insert({
          ...lineData,
          name: nome || (sufixo ? `${lineData.name}${sufixo}` : `${lineData.name} (cópia)`),
          slug: `${lineData.slug.slice(0, 30)}-${Date.now().toString(36)}`,
          is_active: false,
          vehicle_type: tipoVeiculo || lineData.vehicle_type,
        })
        .select().single();
      if (lineError) throw lineError;

      // 2. Fetch ALL plans at once
      const { data: plans } = await supabase
        .from('planos')
        .select('*, planos_beneficios(*), planos_regioes(regiao_id)')
        .eq('product_line_id', id);

      if (!plans || plans.length === 0) return createdLine;

      const planIds = plans.map((p: any) => p.id);

      // 3. Fetch planos_coberturas + plan rules in parallel (no ID dependency)
      const [coberturas_res, plan_rules_res] = await Promise.all([
        supabase.from('planos_coberturas').select('*').in('plano_id', planIds),
        supabase.from('entity_eligibility_rules').select('*').eq('entity_type', 'plano').in('entity_id', planIds),
      ]);

      const allPlanoCoberturas = coberturas_res.data || [];
      const allPlanRules = plan_rules_res.data || [];

      // Collect all unique benefit_ids and cobertura_ids
      const allBenefitIds = new Set<string>();
      const allCoberturaIds = new Set<string>();
      for (const plan of plans) {
        for (const pb of (plan.planos_beneficios || []) as any[]) {
          if (pb.benefit_id) allBenefitIds.add(pb.benefit_id);
        }
      }
      for (const pc of allPlanoCoberturas) {
        if (pc.cobertura_id) allCoberturaIds.add(pc.cobertura_id);
      }

      const benefitIdsArr = Array.from(allBenefitIds);
      const coberturaIdsArr = Array.from(allCoberturaIds);

      // Helper: fetch paginated rules in chunks of 500 to avoid Supabase 1000-row limit
      const fetchRulesChunked = async (entityType: string, ids: string[]) => {
        if (ids.length === 0) return [] as any[];
        const CHUNK = 150; // Was 500; each entity has ~5 rules, so 150 × 5 = 750 rows, safely under 1000 limit
        const promises: Promise<any>[] = [];
        for (let i = 0; i < ids.length; i += CHUNK) {
          const chunk = ids.slice(i, i + CHUNK);
          promises.push(
            Promise.resolve(
              supabase.from('entity_eligibility_rules').select('*')
                .eq('entity_type', entityType).in('entity_id', chunk)
            ).then(r => r.data || [])
          );
        }
        const results = await Promise.all(promises);
        return results.flat();
      };

      const fetchExclusionsChunked = async (ids: string[]) => {
        if (ids.length === 0) return [] as any[];
        const CHUNK = 150; // Was 500; safely under 1000 row limit
        const promises: Promise<any>[] = [];
        for (let i = 0; i < ids.length; i += CHUNK) {
          const chunk = ids.slice(i, i + CHUNK);
          promises.push(
            Promise.resolve(
              supabase.from('benefit_category_exclusions').select('*')
                .in('benefit_id', chunk)
            ).then(r => r.data || [])
          );
        }
        const results = await Promise.all(promises);
        return results.flat();
      };

      // 3b. Now fetch benefit/cobertura rules + exclusions FILTERED by collected IDs
      const [benefitRulesAll, cobRulesAll, exclAll, benefits_res, coberturas_data_res] = await Promise.all([
        fetchRulesChunked('beneficio', benefitIdsArr),
        fetchRulesChunked('cobertura', coberturaIdsArr),
        fetchExclusionsChunked(benefitIdsArr),
        benefitIdsArr.length > 0 ? supabase.from('benefits').select('*').in('id', benefitIdsArr) : { data: [] },
        coberturaIdsArr.length > 0 ? supabase.from('coberturas').select('*').in('id', coberturaIdsArr) : { data: [] },
      ]);

      const benefitsMap = new Map((benefits_res.data || []).map((b: any) => [b.id, b]));
      const coberturasMap = new Map((coberturas_data_res.data || []).map((c: any) => [c.id, c]));

      // Index rules by entity_id for fast lookup
      const benefitRulesMap = new Map<string, any[]>();
      for (const r of benefitRulesAll) {
        const arr = benefitRulesMap.get(r.entity_id) || [];
        arr.push(r);
        benefitRulesMap.set(r.entity_id, arr);
      }
      const cobRulesMap = new Map<string, any[]>();
      for (const r of cobRulesAll) {
        const arr = cobRulesMap.get(r.entity_id) || [];
        arr.push(r);
        cobRulesMap.set(r.entity_id, arr);
      }
      const exclMap = new Map<string, any[]>();
      for (const e of exclAll) {
        const arr = exclMap.get(e.benefit_id) || [];
        arr.push(e);
        exclMap.set(e.benefit_id, arr);
      }
      const planRulesMap = new Map<string, any[]>();
      for (const r of allPlanRules) {
        const arr = planRulesMap.get(r.entity_id) || [];
        arr.push(r);
        planRulesMap.set(r.entity_id, arr);
      }

      // 4. Create ALL new plans in batch
      const newPlansData = plans.map((origPlan: any) => {
        const { id: pId, created_at: pCreated, updated_at: pUpdated, planos_beneficios, planos_regioes, ...planData } = origPlan;
        return {
          ...planData,
          nome: sufixo ? `${planData.nome}${sufixo}` : planData.nome,
          codigo: `${(planData.codigo || '').slice(0, 70)}-c-${uid()}`,
          slug: `${(planData.slug || planData.codigo || '').slice(0, 70)}-c-${uid()}`,
          product_line_id: createdLine.id,
          ativo: true,
          categoria: tipoVeiculo === 'motorcycle' ? 'moto' : tipoVeiculo === 'car' ? 'carro' : planData.categoria,
        };
      });

      const { data: createdPlans, error: batchPlanErr } = await supabase
        .from('planos').insert(newPlansData).select();
      if (batchPlanErr) throw batchPlanErr;

      // Map old plan IDs to new plan IDs (by index since insert preserves order)
      const planIdMap = new Map<string, string>();
      plans.forEach((orig: any, i: number) => {
        planIdMap.set(orig.id, createdPlans![i].id);
      });

      // 5. Batch-insert plan eligibility rules
      const allNewPlanRules: any[] = [];
      for (const origPlan of plans) {
        const newPlanId = planIdMap.get(origPlan.id)!;
        const rules = planRulesMap.get(origPlan.id) || [];
        const cloned = rules.map((r: any) => {
          const { id: rId, created_at: rCreated, ...rData } = r;
          return { ...rData, entity_id: newPlanId };
        });
        const final = applyBulkRuleOverrides(cloned, newPlanId, 'plano', bulkOverrides);
        allNewPlanRules.push(...final);
        if (cloned.length === 0 && hasBulkOverrides) {
          allNewPlanRules.push(...applyBulkRuleOverrides([], newPlanId, 'plano', bulkOverrides));
        }
      }
      if (allNewPlanRules.length > 0) {
        await supabase.from('entity_eligibility_rules').insert(allNewPlanRules);
      }

      // 6. Batch-insert planos_regioes
      const allNewRegioes: any[] = [];
      for (const origPlan of plans) {
        const newPlanId = planIdMap.get(origPlan.id)!;
        for (const pr of (origPlan.planos_regioes || []) as any[]) {
          allNewRegioes.push({ plano_id: newPlanId, regiao_id: pr.regiao_id });
        }
      }
      if (allNewRegioes.length > 0) {
        await supabase.from('planos_regioes').insert(allNewRegioes);
      }

      // 7. Batch-clone ALL benefits (insert in one call)
      const benefitsToInsert: any[] = [];
      const benefitOriginMap: { origBenefitId: string; origPlanId: string; pb: any; insertIndex: number }[] = [];

      for (const origPlan of plans) {
        for (const pb of (origPlan.planos_beneficios || []) as any[]) {
          if (!pb.benefit_id) continue;
          const origBenefit = benefitsMap.get(pb.benefit_id);
          if (!origBenefit) continue;

          const { id: bId, created_at: bCreated, ...bData } = origBenefit;
          benefitsToInsert.push({
            ...bData,
            name: sufixo ? `${bData.name}${sufixo}` : bData.name,
            slug: ((bData.slug as string) || '').slice(0, 80) + `-${uid()}`,
            preco_sugerido: applyDiscount(bData.preco_sugerido, desconto),
          });
          benefitOriginMap.push({
            origBenefitId: pb.benefit_id,
            origPlanId: origPlan.id,
            pb,
            insertIndex: benefitsToInsert.length - 1,
          });
        }
      }

      let createdBenefits: any[] = [];
      if (benefitsToInsert.length > 0) {
        const { data, error } = await supabase.from('benefits').insert(benefitsToInsert).select();
        if (error) throw error;
        createdBenefits = data || [];
      }

      // Batch-insert planos_beneficios
      const allNewPB: any[] = [];
      const allNewBenefitRules: any[] = [];
      const allNewBenefitExcl: any[] = [];

      for (const mapping of benefitOriginMap) {
        const newBenefit = createdBenefits[mapping.insertIndex];
        if (!newBenefit) continue;
        const newPlanId = planIdMap.get(mapping.origPlanId)!;
        const { pb } = mapping;

        allNewPB.push({
          plano_id: newPlanId,
          benefit_id: newBenefit.id,
          beneficio: pb.beneficio,
          custom_text: pb.custom_text,
          custom_value: pb.custom_value,
          additional_info: pb.additional_info,
          is_highlighted: pb.is_highlighted,
          display_order: pb.display_order,
          incluso: pb.incluso,
        });

        // Rules
        const bRules = benefitRulesMap.get(mapping.origBenefitId) || [];
        const cloned = bRules.map((r: any) => {
          const { id: rId, created_at: rCreated, ...rData } = r;
          return { ...rData, entity_id: newBenefit.id };
        });
        const discounted = applyDiscountToFipeRanges(cloned, desconto);
        const final = applyBulkRuleOverrides(discounted, newBenefit.id, 'beneficio', bulkOverrides);
        allNewBenefitRules.push(...final);

        // Exclusions
        const excl = exclMap.get(mapping.origBenefitId) || [];
        for (const e of excl) {
          allNewBenefitExcl.push({ benefit_id: newBenefit.id, categoria_veiculo: e.categoria_veiculo });
        }
      }

      const [pbRes, brRes, exRes] = await Promise.all([
        allNewPB.length > 0 ? supabase.from('planos_beneficios').insert(allNewPB) : Promise.resolve(null),
        allNewBenefitRules.length > 0 ? supabase.from('entity_eligibility_rules').insert(allNewBenefitRules) : Promise.resolve(null),
        allNewBenefitExcl.length > 0 ? supabase.from('benefit_category_exclusions').insert(allNewBenefitExcl) : Promise.resolve(null),
      ]);
      if (pbRes?.error) throw pbRes.error;
      if (brRes?.error) throw brRes.error;
      if (exRes?.error) throw exRes.error;

      // 8. Batch-clone ALL coverages
      const cobsToInsert: any[] = [];
      const cobOriginMap: { origCobId: string; origPlanId: string; insertIndex: number }[] = [];

      for (const pc of allPlanoCoberturas) {
        const origCob = coberturasMap.get(pc.cobertura_id);
        if (!origCob) continue;

        const { id: cobId, created_at: cobCreated, ...cobData } = origCob;
        cobsToInsert.push({
          ...cobData,
          nome: (sufixo ? `${cobData.nome}${sufixo}` : cobData.nome).slice(0, 100),
          codigo: (cobData.codigo || '').slice(0, 80) + `-${uid()}`,
          valor: applyDiscount(cobData.valor, desconto),
          valor_limite: applyDiscount(cobData.valor_limite, desconto),
          franquia_valor: applyDiscount(cobData.franquia_valor, desconto),
        });
        cobOriginMap.push({
          origCobId: pc.cobertura_id,
          origPlanId: pc.plano_id,
          insertIndex: cobsToInsert.length - 1,
        });
      }

      let createdCobs: any[] = [];
      if (cobsToInsert.length > 0) {
        const { data, error } = await supabase.from('coberturas').insert(cobsToInsert).select();
        if (error) throw error;
        createdCobs = data || [];
      }

      // Batch-insert planos_coberturas + rules
      const allNewPC: any[] = [];
      const allNewCobRules: any[] = [];

      for (const mapping of cobOriginMap) {
        const newCob = createdCobs[mapping.insertIndex];
        if (!newCob) continue;
        const newPlanId = planIdMap.get(mapping.origPlanId)!;

        // Find original planos_coberturas record for extra fields
        const origPC = allPlanoCoberturas.find(
          (pc: any) => pc.plano_id === mapping.origPlanId && pc.cobertura_id === mapping.origCobId
        );

        allNewPC.push({
          plano_id: newPlanId,
          cobertura_id: newCob.id,
          carencia_dias: origPC?.carencia_dias,
          franquia_percentual: origPC?.franquia_percentual,
          franquia_valor: applyDiscount(origPC?.franquia_valor, desconto),
          obrigatoria: origPC?.obrigatoria,
          percentual_cobertura: origPC?.percentual_cobertura,
          valor_limite: applyDiscount(origPC?.valor_limite, desconto),
        });

        // Rules
        const cRules = cobRulesMap.get(mapping.origCobId) || [];
        const cloned = cRules.map((r: any) => {
          const { id: rId, created_at: rCreated, ...rData } = r;
          return { ...rData, entity_id: newCob.id };
        });
        const discounted = applyDiscountToFipeRanges(cloned, desconto);
        const final = applyBulkRuleOverrides(discounted, newCob.id, 'cobertura', bulkOverrides);
        allNewCobRules.push(...final);
      }

      const [pcRes, crRes] = await Promise.all([
        allNewPC.length > 0 ? supabase.from('planos_coberturas').insert(allNewPC) : Promise.resolve(null),
        allNewCobRules.length > 0 ? supabase.from('entity_eligibility_rules').insert(allNewCobRules) : Promise.resolve(null),
      ]);
      if (pcRes?.error) throw pcRes.error;
      if (crRes?.error) throw crRes.error;

      return createdLine;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product_lines'] });
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['planos'] });
      queryClient.invalidateQueries({ queryKey: ['linhas_com_planos_clean'] });
      queryClient.invalidateQueries({ queryKey: ['entity_eligibility_rules'] });
      toast.success('Linha duplicada com todos os planos!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao duplicar linha: ${error.message}`);
    },
  });
}

// ==================== DUPLICATE BENEFIT ====================

export function useDuplicateBenefit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // 1. Fetch original benefit
      const { data: original, error: fetchError } = await supabase
        .from('benefits')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      const { id: _, created_at, ...benefitData } = original;
      const suffix = Math.random().toString(36).slice(2, 8);
      const newBenefit = {
        ...benefitData,
        name: `${(benefitData.name || '').slice(0, 140)} (cópia)`,
        slug: `${(benefitData.slug || 'ben').slice(0, 80)}-cp-${suffix}`,
        is_active: original.is_active ?? true,
      };

      const { data, error } = await supabase
        .from('benefits')
        .insert(newBenefit)
        .select()
        .single();

      if (error) throw error;

      // 2. Copy eligibility rules
      const { data: rules } = await supabase
        .from('entity_eligibility_rules')
        .select('*')
        .eq('entity_type', 'beneficio')
        .eq('entity_id', id);

      if (rules && rules.length > 0) {
        const newRules = rules.map(({ id: _rid, created_at: _ca, updated_at: _ua, ...rule }) => ({
          ...rule,
          entity_id: data.id,
        }));
        await supabase.from('entity_eligibility_rules').insert(newRules);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['benefits'] });
      toast.success('Benefício duplicado! (criado como inativo)');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao duplicar benefício: ${error.message}`);
    },
  });
}
