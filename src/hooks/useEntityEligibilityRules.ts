import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type EntityType = 'linha' | 'plano' | 'cobertura' | 'beneficio';
export type RuleType = 'fipe_range' | 'fipe_eligibility' | 'ano_range' | 'categoria_veiculo' | 'regiao' | 'marca_modelo' | 'tipo_uso' | 'combustivel' | 'tipo_placa';
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
      const PAGE_SIZE = 1000;
      let allData: EligibilityRule[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('entity_eligibility_rules' as any)
          .select('*')
          .eq('is_active', true)
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        const page = (data || []) as unknown as EligibilityRule[];
        allData = allData.concat(page);
        if (page.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return allData;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useSaveRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateRulePayload) => {
      // Check if a rule of the same type already exists for this entity
      const { data: existing } = await supabase
        .from('entity_eligibility_rules' as any)
        .select('id')
        .eq('entity_id', payload.entity_id)
        .eq('entity_type', payload.entity_type)
        .eq('rule_type', payload.rule_type)
        .eq('is_active', true)
        .maybeSingle();

      if ((existing as any)?.id) {
        // Update existing rule
        const { data, error } = await supabase
          .from('entity_eligibility_rules' as any)
          .update({ rule_config: payload.rule_config, rule_mode: payload.rule_mode } as any)
          .eq('id', (existing as any).id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }

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

export interface ModelEligibilityResult {
  status: 'aceito' | 'limitado' | 'negado';
  coberturaFipe: number;
}

/**
 * Finds the eligibility status for a specific vehicle against a marca_modelo rule
 * that uses the new modelos array format (with per-item status).
 * Returns null if no matching entry is found.
 */
export function findModelEligibility(
  rule: Pick<EligibilityRule, 'rule_config'>,
  ctx: VehicleContext
): ModelEligibilityResult | null {
  const modelos = (rule.rule_config as any)?.modelos || [];
  if (!Array.isArray(modelos) || modelos.length === 0) return null;

  for (const entry of modelos) {
    if (typeof entry !== 'object' || !entry.status) continue;

    const ctxMarca = (ctx.marca || '').toUpperCase();
    const entryMarca = (entry.marca || '').toUpperCase();
    const marcaOk = !entryMarca || ctxMarca.includes(entryMarca) || entryMarca.includes(ctxMarca);

    const ctxModelo = (ctx.modelo || '').toUpperCase();
    const entryModelo = (entry.modelo || '').toUpperCase();
    const modeloWildcard = ['TODOS', 'QUALQUER', 'ALL', ''].includes(entryModelo);
    const modeloOk = modeloWildcard || ctxModelo.includes(entryModelo) || entryModelo.includes(ctxModelo);
    if (!marcaOk || !modeloOk) continue;

    // Check year range if defined
    if (entry.ano_min != null && ctx.anoVeiculo < entry.ano_min) continue;
    if (entry.ano_max != null && ctx.anoVeiculo > entry.ano_max) continue;

    // Check combustivel if not 'qualquer'
    if (entry.combustivel && entry.combustivel !== 'qualquer') {
      if ((ctx.combustivel || '').toLowerCase() !== entry.combustivel.toLowerCase()) continue;
    }

    return {
      status: entry.status as 'aceito' | 'limitado' | 'negado',
      coberturaFipe: entry.cobertura_fipe ?? 100,
    };
  }

  return null;
}

export interface VehicleContext {
  valorFipe: number;
  anoVeiculo: number;
  categoriaVeiculo?: string;
  regiao?: string;
  regiaoId?: string; // UUID da região para comparação com rules
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
    case 'fipe_eligibility': {
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
    case 'regiao': {
      const regioes: string[] = cfg.regioes || cfg.values || [];
      if (regioes.length === 0) return true;
      // Compare against regiaoId (UUID) first, then fallback to slug
      const matchById = !!ctx.regiaoId && regioes.some(r => r === ctx.regiaoId);
      const matchBySlug = !!ctx.regiao && regioes.some(r => r.toLowerCase() === ctx.regiao!.toLowerCase());
      const match = matchById || matchBySlug;
      return isInclude ? match : !match;
    }
    case 'marca_modelo': {
      // New format: rule_config.modelos is array of objects with .status
      const modelosArr = cfg.modelos || [];
      if (modelosArr.length > 0 && typeof modelosArr[0] === 'object' && 'status' in modelosArr[0]) {
        const match = findModelEligibility({ rule_config: cfg } as any, ctx);
        if (!match) {
          // No matching entry found — whitelist: block, blacklist: allow
          return !isInclude;
        }
        // If negado → block
        if (match.status === 'negado') return false;
        // aceito or limitado → allow
        return true;
      }
      // Legacy format: modelos as string array or single marca/modelo
      const marcaMatch = !cfg.marca || (ctx.marca || '').toUpperCase().includes(cfg.marca.toUpperCase());
      const legacyModelos: string[] = modelosArr;
      let modeloMatch: boolean;
      if (legacyModelos.length > 0) {
        modeloMatch = legacyModelos.some((m: string) => (ctx.modelo || '').toUpperCase().includes(m.toUpperCase()));
      } else {
        modeloMatch = !cfg.modelo || (ctx.modelo || '').toUpperCase().includes(cfg.modelo.toUpperCase());
      }
      const versaoMatch = !cfg.versao || (ctx.versao || '').toUpperCase().includes(cfg.versao.toUpperCase());
      const match2 = marcaMatch && (legacyModelos.length > 0 ? modeloMatch : (modeloMatch && versaoMatch));
      return isInclude ? match2 : !match2;
    }
    case 'tipo_uso': {
      const tipos: string[] = cfg.tipos || cfg.values || [];
      if (tipos.length === 0) return true;
      const match = !!ctx.tipoUso && tipos.some(t => t.toLowerCase() === ctx.tipoUso!.toLowerCase());
      return isInclude ? match : !match;
    }
    case 'combustivel': {
      const combs: string[] = cfg.combustiveis || cfg.values || [];
      if (combs.length === 0) return true;
      const match = !!ctx.combustivel && combs.some(c => c.toLowerCase() === ctx.combustivel!.toLowerCase());
      return isInclude ? match : !match;
    }
    case 'tipo_placa': {
      const placas: string[] = cfg.tipos || cfg.values || cfg.categorias || [];
      if (placas.length === 0) return true;
      // If no special plate type set (normal vehicle), include rules should pass
      // (the list defines which special plates ARE accepted, not requires one)
      if (!ctx.tipoPlaca) return isInclude ? false : true;
      const match = placas.some(p => p.toLowerCase() === ctx.tipoPlaca!.toLowerCase());
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
