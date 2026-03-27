import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type EntityType = 'linha' | 'plano' | 'cobertura' | 'beneficio';
export type RuleType = 'fipe_range' | 'ano_range' | 'categoria_veiculo' | 'categoria_especial' | 'regiao' | 'marca_modelo' | 'tipo_uso' | 'combustivel' | 'tipo_placa';
export type RuleMode = 'include' | 'exclude';

export interface EligibilityRule {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  rule_type: RuleType;
  rule_mode: RuleMode;
  rule_config: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateRulePayload {
  entity_type: EntityType;
  entity_id: string;
  rule_type: RuleType;
  rule_mode: RuleMode;
  rule_config: Record<string, any>;
  is_active?: boolean;
}

export function useRulesForEntity(entityType: EntityType, entityId: string | undefined) {
  return useQuery({
    queryKey: ['entity_eligibility_rules', entityType, entityId],
    queryFn: async () => {
      if (!entityId) return [];
      const { data, error } = await supabase
        .from('entity_eligibility_rules' as any)
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as EligibilityRule[];
    },
    enabled: !!entityId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useAllEligibilityRules() {
  return useQuery({
    queryKey: ['entity_eligibility_rules', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entity_eligibility_rules' as any)
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      return (data || []) as unknown as EligibilityRule[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useSaveRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateRulePayload) => {
      const { data, error } = await supabase
        .from('entity_eligibility_rules' as any)
        .insert(payload as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['entity_eligibility_rules', vars.entity_type, vars.entity_id] });
      queryClient.invalidateQueries({ queryKey: ['entity_eligibility_rules', 'all'] });
      toast.success('Regra adicionada');
    },
    onError: () => toast.error('Erro ao salvar regra'),
  });
}

export function useUpdateRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<CreateRulePayload>) => {
      const { error } = await supabase
        .from('entity_eligibility_rules' as any)
        .update(payload as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entity_eligibility_rules'] });
      toast.success('Regra atualizada');
    },
    onError: () => toast.error('Erro ao atualizar regra'),
  });
}

export function useDeleteRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('entity_eligibility_rules' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entity_eligibility_rules'] });
      toast.success('Regra removida');
    },
    onError: () => toast.error('Erro ao remover regra'),
  });
}

// ============================================
// Motor de verificação de regras para cotação
// ============================================

export interface VehicleContext {
  valorFipe: number;
  anoVeiculo: number;
  categoriaVeiculo?: string;
  categoriaEspecial?: string;
  regiao?: string;
  marca?: string;
  modelo?: string;
  versao?: string;
  tipoUso?: string;
  combustivel?: string;
  tipoPlaca?: string;
}

export function checkRuleAgainstVehicle(rule: EligibilityRule, ctx: VehicleContext): boolean {
  const cfg = rule.rule_config;
  const isInclude = rule.rule_mode === 'include';

  switch (rule.rule_type) {
    case 'fipe_range': {
      const inRange = ctx.valorFipe >= (cfg.min || 0) && ctx.valorFipe <= (cfg.max || Infinity);
      return isInclude ? inRange : !inRange;
    }
    case 'ano_range': {
      const inRange = ctx.anoVeiculo >= (cfg.min || 0) && ctx.anoVeiculo <= (cfg.max || 9999);
      return isInclude ? inRange : !inRange;
    }
    case 'categoria_veiculo': {
      const cats: string[] = cfg.categorias || cfg.values || [];
      if (cats.length === 0) return true;
      const match = !!ctx.categoriaVeiculo && cats.some(c => c.toLowerCase() === ctx.categoriaVeiculo!.toLowerCase());
      return isInclude ? match : !match;
    }
    case 'categoria_especial': {
      const cats: string[] = cfg.categorias || cfg.values || [];
      if (cats.length === 0) return true;
      const match = !!ctx.categoriaEspecial && cats.includes(ctx.categoriaEspecial.toLowerCase());
      return isInclude ? match : !match;
    }
    case 'regiao': {
      const regioes: string[] = cfg.regioes || [];
      if (regioes.length === 0) return true;
      const match = !!ctx.regiao && regioes.some(r => r.toLowerCase() === ctx.regiao!.toLowerCase());
      return isInclude ? match : !match;
    }
    case 'marca_modelo': {
      const marcaMatch = !cfg.marca || (ctx.marca || '').toUpperCase().includes(cfg.marca.toUpperCase());
      const modeloMatch = !cfg.modelo || (ctx.modelo || '').toUpperCase().includes(cfg.modelo.toUpperCase());
      const versaoMatch = !cfg.versao || (ctx.versao || '').toUpperCase().includes(cfg.versao.toUpperCase());
      const match = marcaMatch && modeloMatch && versaoMatch;
      return isInclude ? match : !match;
    }
    case 'tipo_uso': {
      const tipos: string[] = cfg.tipos || [];
      if (tipos.length === 0) return true;
      const match = !!ctx.tipoUso && tipos.includes(ctx.tipoUso.toLowerCase());
      return isInclude ? match : !match;
    }
    case 'combustivel': {
      const combs: string[] = cfg.combustiveis || cfg.values || [];
      if (combs.length === 0) return true;
      const match = !!ctx.combustivel && combs.some(c => c.toLowerCase() === ctx.combustivel!.toLowerCase());
      return isInclude ? match : !match;
    }
    case 'tipo_placa': {
      const placas: string[] = cfg.tipos || cfg.values || [];
      if (placas.length === 0) return true;
      const match = !!ctx.tipoPlaca && placas.some(p => p.toLowerCase() === ctx.tipoPlaca!.toLowerCase());
      return isInclude ? match : !match;
    }
    default:
      return true;
  }
}

export function checkAllRules(rules: EligibilityRule[], ctx: VehicleContext): boolean {
  const activeRules = rules.filter(r => r.is_active);
  if (activeRules.length === 0) return true;
  return activeRules.every(r => checkRuleAgainstVehicle(r, ctx));
}
