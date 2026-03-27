import { useState, useEffect, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useRegioes } from '@/hooks/useRegioes';
import { useConfiguracaoJson, useCombustiveis } from '@/hooks/useConteudosSistema';
import { useRulesForEntity, useSaveRule, useDeleteRule, type EntityType, type EligibilityRule } from '@/hooks/useEntityEligibilityRules';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatarMoeda } from '@/utils/format';

interface EligibilityConfigSectionProps {
  entityType: EntityType;
  entityId: string | undefined;
  onVariaComFipeChange?: (varia: boolean) => void;
}

export interface FipeRangeFaixa {
  de: number;
  ate: number;
  valor: number;
}

export interface EligibilityState {
  variaComFipe: boolean;
  fipeMin: string;
  fipeMax: string;
  fipeIntervalo: string;
  fipeValoresFaixa: Record<number, string>;
  selRegioes: Set<string>;
  selUso: Set<string>;
  selPlaca: Set<string>;
  selCombustivel: Set<string>;
}

export function useEligibilityState(entityType: EntityType, entityId: string | undefined) {
  const { data: existingRules = [] } = useRulesForEntity(entityType, entityId);

  const emptyState: EligibilityState = {
    variaComFipe: false, fipeMin: '', fipeMax: '', fipeIntervalo: '', fipeValoresFaixa: {},
    selRegioes: new Set(), selUso: new Set(), selPlaca: new Set(), selCombustivel: new Set(),
  };

  const [state, setState] = useState<EligibilityState>(emptyState);

  useEffect(() => {
    if (!entityId || existingRules.length === 0) {
      setState(emptyState);
      return;
    }

    const newState: EligibilityState = { ...emptyState, selRegioes: new Set(), selUso: new Set(), selPlaca: new Set(), selCombustivel: new Set() };

    for (const rule of existingRules) {
      const cfg = rule.rule_config as any;
      switch (rule.rule_type) {
        case 'fipe_range':
          newState.variaComFipe = true;
          if (cfg.min) newState.fipeMin = String(cfg.min);
          if (cfg.max && cfg.max < 99999999) newState.fipeMax = String(cfg.max);
          if (cfg.intervalo) newState.fipeIntervalo = String(cfg.intervalo);
          if (Array.isArray(cfg.faixas)) {
            const valMap: Record<number, string> = {};
            cfg.faixas.forEach((f: any, i: number) => {
              if (f.valor != null) valMap[i] = String(f.valor);
            });
            newState.fipeValoresFaixa = valMap;
          }
          break;
        case 'regiao':
          newState.selRegioes = new Set(cfg.values || []);
          break;
        case 'tipo_uso':
          newState.selUso = new Set(cfg.values || []);
          break;
        case 'combustivel':
          newState.selCombustivel = new Set(cfg.values || []);
          break;
        // tipo_placa stored as a custom rule_type or reuse existing
        default:
          if (rule.rule_type === ('tipo_placa' as any)) {
            newState.selPlaca = new Set(cfg.values || []);
          }
          break;
      }
    }

    setState(newState);
  }, [entityId, existingRules]);

  return { state, setState };
}

export async function saveEligibilityRules(entityType: EntityType, entityId: string, state: EligibilityState) {
  // Delete all existing rules for this entity
  await supabase.from('entity_eligibility_rules' as any).delete().eq('entity_type', entityType).eq('entity_id', entityId);

  const rules: any[] = [];

  if (state.variaComFipe && (state.fipeMin || state.fipeMax)) {
    const min = parseFloat(state.fipeMin) || 0;
    const max = parseFloat(state.fipeMax) || 99999999;
    const intervalo = parseFloat(state.fipeIntervalo) || 0;
    const ruleConfig: any = { min, max };

    if (intervalo > 0 && max > min) {
      ruleConfig.intervalo = intervalo;
      const numFaixas = Math.floor((max - min) / intervalo);
      const faixas: FipeRangeFaixa[] = [];
      for (let i = 0; i < Math.min(numFaixas, 50); i++) {
        const de = min + i * intervalo;
        const ate = de + intervalo;
        faixas.push({ de, ate, valor: parseFloat(state.fipeValoresFaixa[i] || '0') || 0 });
      }
      ruleConfig.faixas = faixas;
    }

    rules.push({
      entity_type: entityType, entity_id: entityId,
      rule_type: 'fipe_range', rule_mode: 'include',
      rule_config: ruleConfig,
    });
  }

  if (state.selRegioes.size > 0) {
    rules.push({
      entity_type: entityType, entity_id: entityId,
      rule_type: 'regiao', rule_mode: 'include',
      rule_config: { values: Array.from(state.selRegioes) },
    });
  }

  if (state.selUso.size > 0) {
    rules.push({
      entity_type: entityType, entity_id: entityId,
      rule_type: 'tipo_uso', rule_mode: 'include',
      rule_config: { values: Array.from(state.selUso) },
    });
  }

  if (state.selPlaca.size > 0) {
    rules.push({
      entity_type: entityType, entity_id: entityId,
      rule_type: 'tipo_placa' as any, rule_mode: 'include',
      rule_config: { values: Array.from(state.selPlaca) },
    });
  }

  if (state.selCombustivel.size > 0) {
    rules.push({
      entity_type: entityType, entity_id: entityId,
      rule_type: 'combustivel', rule_mode: 'include',
      rule_config: { values: Array.from(state.selCombustivel) },
    });
  }

  if (rules.length > 0) {
    const { error } = await supabase.from('entity_eligibility_rules' as any).insert(rules);
    if (error) throw error;
  }
}

function toggleInSet(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  next.has(value) ? next.delete(value) : next.add(value);
  return next;
}

export function EligibilityConfigSection({ entityType, entityId, onVariaComFipeChange }: EligibilityConfigSectionProps) {
  const { data: regioes = [] } = useRegioes();
  const { data: tiposUso = [] } = useConfiguracaoJson<any[]>('tipos_uso', []);
  const { data: tiposPlaca = [] } = useConfiguracaoJson<any[]>('tipos_placa', []);
  const { data: combustiveis = [] } = useCombustiveis();

  const { state, setState } = useEligibilityState(entityType, entityId);

  const update = (patch: Partial<EligibilityState>) => setState(prev => ({ ...prev, ...patch }));

  // Notify parent of variaComFipe state on load
  useEffect(() => {
    onVariaComFipeChange?.(state.variaComFipe);
  }, [state.variaComFipe, onVariaComFipeChange]);

  const faixas = useMemo(() => {
    if (!state.variaComFipe) return [];
    const min = parseFloat(state.fipeMin) || 0;
    const max = parseFloat(state.fipeMax) || 0;
    const intervalo = parseFloat(state.fipeIntervalo) || 0;
    if (intervalo <= 0 || max <= min) return [];
    const num = Math.floor((max - min) / intervalo);
    if (num > 50) return 'too_many' as const;
    const result: { de: number; ate: number; index: number }[] = [];
    for (let i = 0; i < num; i++) {
      result.push({ de: min + i * intervalo, ate: min + (i + 1) * intervalo, index: i });
    }
    return result;
  }, [state.variaComFipe, state.fipeMin, state.fipeMax, state.fipeIntervalo]);

  return (
    <div className="space-y-4 border-t pt-4">
      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Configurações de Elegibilidade</h4>
      <p className="text-[10px] text-muted-foreground">Campos opcionais — se não preenchido, aparece para todos os veículos.</p>

      {/* Varia com FIPE */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Switch
            checked={state.variaComFipe}
            onCheckedChange={(checked) => { update({ variaComFipe: checked, fipeIntervalo: '', fipeValoresFaixa: {} }); onVariaComFipeChange?.(checked); }}
          />
          <Label className="text-xs">Varia com FIPE?</Label>
        </div>
        {state.variaComFipe && (
          <>
            <div className="flex gap-2 ml-6">
              <Input
                type="number" placeholder="Mínimo (R$)" value={state.fipeMin}
                onChange={e => update({ fipeMin: e.target.value })} className="flex-1"
              />
              <span className="self-center text-muted-foreground text-xs">até</span>
              <Input
                type="number" placeholder="Máximo (R$)" value={state.fipeMax}
                onChange={e => update({ fipeMax: e.target.value })} className="flex-1"
              />
            </div>
            <div className="ml-6">
              <Label className="text-xs">Intervalo FIPE (R$)</Label>
              <Input
                type="number" placeholder="Ex: 5000" value={state.fipeIntervalo}
                onChange={e => update({ fipeIntervalo: e.target.value })}
                className="mt-1 max-w-[200px]"
              />
            </div>
            {faixas === 'too_many' && (
              <p className="ml-6 text-xs text-destructive">Intervalo muito pequeno — máximo 50 faixas.</p>
            )}
            {Array.isArray(faixas) && faixas.length > 0 && (
              <div className="ml-6 space-y-1.5">
                <Label className="text-xs text-muted-foreground">{faixas.length} faixa(s) de preço:</Label>
                <div className="grid gap-1.5">
                  {faixas.map(f => (
                    <div key={f.index} className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap min-w-[180px]">
                        {formatarMoeda(f.de)} – {formatarMoeda(f.ate)}
                      </span>
                      <Input
                        type="number" step="0.01" placeholder="Valor (R$)"
                        value={state.fipeValoresFaixa[f.index] || ''}
                        onChange={e => update({ fipeValoresFaixa: { ...state.fipeValoresFaixa, [f.index]: e.target.value } })}
                        className="max-w-[140px] h-8 text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Região */}
      {regioes.length > 0 && (
        <div>
          <Label className="text-xs">Região</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {regioes.filter(r => r.ativa).map(r => (
              <Badge
                key={r.id}
                variant={state.selRegioes.has(r.id) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => update({ selRegioes: toggleInSet(state.selRegioes, r.id) })}
              >{r.nome}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Tipo de Uso */}
      {tiposUso.length > 0 && (
        <div>
          <Label className="text-xs">Tipo de Uso</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {tiposUso.map((t: any) => (
              <Badge
                key={t.value}
                variant={state.selUso.has(t.value) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => update({ selUso: toggleInSet(state.selUso, t.value) })}
              >{t.label}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Tipo de Placa */}
      {tiposPlaca.length > 0 && (
        <div>
          <Label className="text-xs">Tipo de Placa</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {tiposPlaca.map((t: any) => (
              <Badge
                key={t.value}
                variant={state.selPlaca.has(t.value) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => update({ selPlaca: toggleInSet(state.selPlaca, t.value) })}
              >{t.label}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Combustível */}
      {combustiveis.length > 0 && (
        <div>
          <Label className="text-xs">Combustível</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {combustiveis.map(c => (
              <Badge
                key={c.value}
                variant={state.selCombustivel.has(c.value) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => update({ selCombustivel: toggleInSet(state.selCombustivel, c.value) })}
              >{c.label}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Check if entity has any rules configured
export function hasEligibilityRules(state: EligibilityState): boolean {
  return state.variaComFipe || state.selRegioes.size > 0 || state.selUso.size > 0 || state.selPlaca.size > 0 || state.selCombustivel.size > 0;
}
