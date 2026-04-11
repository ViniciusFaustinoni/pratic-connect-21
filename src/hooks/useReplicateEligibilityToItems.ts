import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ReplicateResult {
  coberturas: number;
  beneficios: number;
}

export function useReplicateEligibilityToItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (planId: string): Promise<ReplicateResult> => {
      // 1. Fetch plan rules
      const { data: planRules, error: rulesError } = await supabase
        .from('entity_eligibility_rules' as any)
        .select('*')
        .eq('entity_type', 'plano')
        .eq('entity_id', planId)
        .eq('is_active', true);

      if (rulesError) throw rulesError;

      // 2. Fetch cobertura_ids
      const { data: coberturas, error: cobError } = await supabase
        .from('planos_coberturas')
        .select('cobertura_id')
        .eq('plano_id', planId);

      if (cobError) throw cobError;

      // 3. Fetch beneficio_ids
      const { data: beneficios, error: benError } = await supabase
        .from('planos_beneficios')
        .select('benefit_id')
        .eq('plano_id', planId);

      if (benError) throw benError;

      const coberturaIds = (coberturas || []).map((c: any) => c.cobertura_id).filter(Boolean);
      const beneficioIds = (beneficios || []).map((b: any) => b.benefit_id).filter(Boolean);
      const allChildIds = [...coberturaIds, ...beneficioIds];

      if (allChildIds.length === 0) {
        return { coberturas: 0, beneficios: 0 };
      }

      // 4. Delete ALL existing rules for child entities
      const { error: deleteError } = await supabase
        .from('entity_eligibility_rules' as any)
        .delete()
        .in('entity_id', allChildIds)
        .in('entity_type', ['cobertura', 'beneficio']);

      if (deleteError) throw deleteError;

      // 5. Insert copies of plan rules for each child
      if (planRules && planRules.length > 0) {
        const newRules: any[] = [];

        for (const rule of planRules as any[]) {
          for (const cobId of coberturaIds) {
            newRules.push({
              entity_type: 'cobertura',
              entity_id: cobId,
              rule_type: rule.rule_type,
              rule_mode: rule.rule_mode,
              rule_config: rule.rule_config,
              is_active: true,
            });
          }
          for (const benId of beneficioIds) {
            newRules.push({
              entity_type: 'beneficio',
              entity_id: benId,
              rule_type: rule.rule_type,
              rule_mode: rule.rule_mode,
              rule_config: rule.rule_config,
              is_active: true,
            });
          }
        }

        if (newRules.length > 0) {
          // Insert in batches of 500
          for (let i = 0; i < newRules.length; i += 500) {
            const batch = newRules.slice(i, i + 500);
            const { error: insertError } = await supabase
              .from('entity_eligibility_rules' as any)
              .insert(batch as any);
            if (insertError) throw insertError;
          }
        }
      }

      return { coberturas: coberturaIds.length, beneficios: beneficioIds.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['entity_eligibility_rules'] });
      queryClient.invalidateQueries({ queryKey: ['linhas_com_planos_clean'] });
      toast.success(`Regras replicadas para ${result.coberturas} coberturas e ${result.beneficios} benefícios`);
    },
    onError: (err: any) => {
      console.error('[replicateEligibility] Error:', err);
      toast.error('Erro ao replicar regras para coberturas/benefícios');
    },
  });
}
