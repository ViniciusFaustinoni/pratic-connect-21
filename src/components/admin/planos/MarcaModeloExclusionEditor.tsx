import { useState, useMemo, useCallback } from 'react';
import { AlertTriangle, Car, ShieldCheck, ShieldX, ChevronRight, ChevronDown, Search } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useMarcasModelos } from '@/hooks/useMarcasModelos';
import {
  useRulesForEntity,
  useSaveRule,
  useDeleteRule,
  type EntityType,
} from '@/hooks/useEntityEligibilityRules';

interface MarcaModeloExclusionEditorProps {
  entityType: EntityType;
  entityId: string;
}

type RuleMode = 'exclude' | 'include';

export function MarcaModeloExclusionEditor({ entityType, entityId }: MarcaModeloExclusionEditorProps) {
  const { data: marcasModelos, isLoading: loadingMarcas } = useMarcasModelos();
  const { data: rules, isLoading: loadingRules } = useRulesForEntity(entityType, entityId);
  const saveRule = useSaveRule();
  const deleteRule = useDeleteRule();

  const [search, setSearch] = useState('');
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());

  // Derive mode from existing rules
  const derivedMode: RuleMode = useMemo(() => {
    if (!rules) return 'exclude';
    const mmRules = rules.filter(r => r.rule_type === 'marca_modelo');
    if (mmRules.some(r => r.rule_mode === 'include')) return 'include';
    return 'exclude';
  }, [rules]);

  const [mode, setMode] = useState<RuleMode | null>(null);
  const activeMode: RuleMode = mode ?? derivedMode;

  // Current rules as a map: marca -> { ruleId, modelos[] }
  const rulesMap = useMemo(() => {
    const map = new Map<string, { ruleId: string; modelos: string[] }>();
    if (!rules) return map;
    for (const r of rules) {
      if (r.rule_type === 'marca_modelo' && r.rule_mode === activeMode) {
        const marca = (r.rule_config.marca || '').toUpperCase();
        map.set(marca, { ruleId: r.id, modelos: r.rule_config.modelos || [] });
      }
    }
    return map;
  }, [rules, activeMode]);

  // Build brand -> models catalog from marcasModelos
  const brandCatalog = useMemo(() => {
    if (!marcasModelos) return new Map<string, string[]>();
    const map = new Map<string, string[]>();
    for (const mm of marcasModelos) {
      if (!mm.ativo) continue;
      const brand = mm.marca.toUpperCase();
      if (!map.has(brand)) map.set(brand, []);
      if (mm.modelo) {
        const models = map.get(brand)!;
        if (!models.includes(mm.modelo)) models.push(mm.modelo);
      }
    }
    // Sort models
    for (const [, models] of map) models.sort();
    return map;
  }, [marcasModelos]);

  const sortedBrands = useMemo(() => {
    return [...brandCatalog.keys()].sort();
  }, [brandCatalog]);

  // Filter by search
  const filteredBrands = useMemo(() => {
    if (!search.trim()) return sortedBrands;
    const q = search.trim().toUpperCase();
    return sortedBrands.filter(brand => {
      if (brand.includes(q)) return true;
      const models = brandCatalog.get(brand) || [];
      return models.some(m => m.toUpperCase().includes(q));
    });
  }, [sortedBrands, search, brandCatalog]);

  const isBusy = saveRule.isPending || deleteRule.isPending;

  const toggleExpand = (brand: string) => {
    setExpandedBrands(prev => {
      const next = new Set(prev);
      if (next.has(brand)) next.delete(brand);
      else next.add(brand);
      return next;
    });
  };

  const handleToggleBrand = useCallback(async (brand: string) => {
    const existing = rulesMap.get(brand);
    if (existing) {
      // Remove rule
      try { await deleteRule.mutateAsync(existing.ruleId); } catch { /* handled */ }
    } else {
      // Add brand rule (all models)
      try {
        await saveRule.mutateAsync({
          entity_type: entityType,
          entity_id: entityId,
          rule_type: 'marca_modelo',
          rule_mode: activeMode,
          rule_config: { marca: brand, modelos: [] },
        });
      } catch { /* handled */ }
    }
  }, [rulesMap, deleteRule, saveRule, entityType, entityId, activeMode]);

  const handleToggleModel = useCallback(async (brand: string, model: string) => {
    const existing = rulesMap.get(brand);
    if (existing) {
      const hasModel = existing.modelos.includes(model);
      let newModelos: string[];
      if (hasModel) {
        newModelos = existing.modelos.filter(m => m !== model);
        // If no models left and it was a model-specific rule, remove the rule entirely
        if (newModelos.length === 0 && existing.modelos.length > 0) {
          try { await deleteRule.mutateAsync(existing.ruleId); } catch { /* handled */ }
          return;
        }
      } else {
        // If brand was added with empty modelos (all models), switch to specific
        newModelos = [...existing.modelos, model];
      }
      try {
        await deleteRule.mutateAsync(existing.ruleId);
        await saveRule.mutateAsync({
          entity_type: entityType,
          entity_id: entityId,
          rule_type: 'marca_modelo',
          rule_mode: activeMode,
          rule_config: { marca: brand, modelos: newModelos },
        });
      } catch { /* handled */ }
    } else {
      // Brand not in rules yet, add with this specific model
      try {
        await saveRule.mutateAsync({
          entity_type: entityType,
          entity_id: entityId,
          rule_type: 'marca_modelo',
          rule_mode: activeMode,
          rule_config: { marca: brand, modelos: [model] },
        });
      } catch { /* handled */ }
    }
  }, [rulesMap, deleteRule, saveRule, entityType, entityId, activeMode]);

  const handleModeChange = useCallback(async (newMode: string) => {
    if (!newMode || newMode === activeMode) return;
    if (rules) {
      const oppositeRules = rules.filter(r => r.rule_type === 'marca_modelo' && r.rule_mode !== newMode);
      if (oppositeRules.length > 0) {
        const confirmed = window.confirm(
          `Ao trocar o modo, as ${oppositeRules.length} regra(s) existentes serão removidas. Deseja continuar?`
        );
        if (!confirmed) return;
        for (const r of oppositeRules) {
          try { await deleteRule.mutateAsync(r.id); } catch { /* continue */ }
        }
      }
    }
    setMode(newMode as RuleMode);
  }, [activeMode, rules, deleteRule]);

  const handleClearAll = useCallback(async () => {
    for (const [, entry] of rulesMap) {
      try { await deleteRule.mutateAsync(entry.ruleId); } catch { /* continue */ }
    }
  }, [rulesMap, deleteRule]);

  const isBlacklist = activeMode === 'exclude';
  const totalBrands = rulesMap.size;
  const totalModels = [...rulesMap.values()].reduce((sum, e) => sum + e.modelos.length, 0);

  const labels = {
    title: isBlacklist ? 'Exclusão por Marca / Modelo' : 'Inclusão por Marca / Modelo',
    empty: isBlacklist
      ? 'Nenhuma marca excluída. Todas as marcas e modelos são aceitos.'
      : 'Nenhuma marca configurada — todos os veículos serão bloqueados.',
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Car className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium">{labels.title}</Label>
        </div>
        {totalBrands > 0 && (
          <Button variant="ghost" size="sm" onClick={handleClearAll} disabled={isBusy}>
            Limpar todas
          </Button>
        )}
      </div>

      {/* Mode selector */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Tipo de regra</Label>
        <ToggleGroup type="single" value={activeMode} onValueChange={handleModeChange} className="justify-start">
          <ToggleGroupItem value="exclude" className="gap-1.5 text-xs px-3 h-8 data-[state=on]:bg-destructive/10 data-[state=on]:text-destructive data-[state=on]:border-destructive/30">
            <ShieldX className="h-3.5 w-3.5" />
            Blacklist (Exclusiva)
          </ToggleGroupItem>
          <ToggleGroupItem value="include" className="gap-1.5 text-xs px-3 h-8 data-[state=on]:bg-emerald-500/10 data-[state=on]:text-emerald-700 data-[state=on]:border-emerald-500/30 dark:data-[state=on]:text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            Whitelist (Inclusiva)
          </ToggleGroupItem>
        </ToggleGroup>
        <p className="text-[11px] text-muted-foreground">
          {isBlacklist
            ? 'Aceitar todos EXCETO as marcas/modelos listados abaixo'
            : 'Aceitar APENAS as marcas/modelos listados abaixo'}
        </p>
      </div>

      {entityType === 'plano' && (
        <div className="flex items-start gap-2 rounded-md bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>Se configurado aqui, <strong>sobrescreve</strong> a regra da Linha.</span>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Filtrar marcas e modelos..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-8 h-9 text-sm"
        />
      </div>

      {/* Collapsible brand list */}
      {(loadingMarcas || loadingRules) ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : (
        <ScrollArea className="max-h-64 overflow-auto rounded-md border">
          <div className="p-1">
            {filteredBrands.map(brand => {
              const models = brandCatalog.get(brand) || [];
              const isExpanded = expandedBrands.has(brand);
              const rule = rulesMap.get(brand);
              const isBrandChecked = !!rule;
              const isAllModels = isBrandChecked && rule.modelos.length === 0;

              // Filter models by search
              const q = search.trim().toUpperCase();
              const filteredModels = q
                ? models.filter(m => m.toUpperCase().includes(q) || brand.includes(q))
                : models;

              return (
                <div key={brand}>
                  <div className="flex items-center gap-1 py-1 px-1 hover:bg-muted/50 rounded-sm">
                    <button
                      type="button"
                      className="p-0.5 text-muted-foreground hover:text-foreground"
                      onClick={() => toggleExpand(brand)}
                    >
                      {isExpanded
                        ? <ChevronDown className="h-3.5 w-3.5" />
                        : <ChevronRight className="h-3.5 w-3.5" />
                      }
                    </button>
                    <Checkbox
                      checked={isBrandChecked}
                      onCheckedChange={() => handleToggleBrand(brand)}
                      disabled={isBusy}
                      className="h-3.5 w-3.5"
                    />
                    <span
                      className="text-xs font-medium cursor-pointer select-none flex-1"
                      onClick={() => toggleExpand(brand)}
                    >
                      {brand}
                    </span>
                    {isBrandChecked && isAllModels && (
                      <span className="text-[10px] text-muted-foreground mr-1">todos</span>
                    )}
                    {isBrandChecked && !isAllModels && rule.modelos.length > 0 && (
                      <span className="text-[10px] text-muted-foreground mr-1">
                        {rule.modelos.length} modelo(s)
                      </span>
                    )}
                  </div>
                  {isExpanded && filteredModels.length > 0 && (
                    <div className="ml-7 space-y-0.5 pb-1">
                      {filteredModels.map(model => {
                        const isModelChecked = isBrandChecked && (isAllModels || rule.modelos.includes(model));
                        return (
                          <div key={model} className="flex items-center gap-1.5 py-0.5 px-1 hover:bg-muted/30 rounded-sm">
                            <Checkbox
                              checked={isModelChecked}
                              onCheckedChange={() => handleToggleModel(brand, model)}
                              disabled={isBusy}
                              className="h-3 w-3"
                            />
                            <span className="text-xs text-muted-foreground">{model}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {filteredBrands.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">Nenhuma marca encontrada</p>
            )}
          </div>
        </ScrollArea>
      )}

      {/* Summary */}
      {totalBrands > 0 && (
        <p className="text-xs text-muted-foreground">
          {totalBrands} marca(s) selecionada(s)
          {totalModels > 0 && `, ${totalModels} modelo(s) específico(s)`}
        </p>
      )}
      {totalBrands === 0 && !loadingRules && (
        <p className="text-xs text-muted-foreground">{labels.empty}</p>
      )}
    </div>
  );
}
