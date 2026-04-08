import { useState, useMemo, useCallback } from 'react';
import { X, Plus, AlertTriangle, Car, ShieldCheck, ShieldX } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useMarcasModelos } from '@/hooks/useMarcasModelos';
import {
  useRulesForEntity,
  useSaveRule,
  useDeleteRule,
  type EntityType,
} from '@/hooks/useEntityEligibilityRules';
import { toast } from 'sonner';

interface MarcaModeloExclusionEditorProps {
  entityType: EntityType;
  entityId: string;
}

interface MarcaEntry {
  ruleId: string | null;
  marca: string;
  modelos: string[];
}

type RuleMode = 'exclude' | 'include';

export function MarcaModeloExclusionEditor({ entityType, entityId }: MarcaModeloExclusionEditorProps) {
  const { data: marcasModelos, isLoading: loadingMarcas } = useMarcasModelos();
  const { data: rules, isLoading: loadingRules } = useRulesForEntity(entityType, entityId);
  const saveRule = useSaveRule();
  const deleteRule = useDeleteRule();

  const [selectedMarca, setSelectedMarca] = useState('');
  const [selectedModelo, setSelectedModelo] = useState('');
  const [addingModelosFor, setAddingModelosFor] = useState<string | null>(null);

  // Derive mode from existing rules
  const derivedMode: RuleMode = useMemo(() => {
    if (!rules) return 'exclude';
    const mmRules = rules.filter(r => r.rule_type === 'marca_modelo');
    if (mmRules.some(r => r.rule_mode === 'include')) return 'include';
    return 'exclude';
  }, [rules]);

  const [mode, setMode] = useState<RuleMode | null>(null);
  const activeMode: RuleMode = mode ?? derivedMode;

  // Sync derived mode when rules load
  const entries: MarcaEntry[] = useMemo(() => {
    if (!rules) return [];
    return rules
      .filter(r => r.rule_type === 'marca_modelo' && r.rule_mode === activeMode)
      .map(r => ({
        ruleId: r.id,
        marca: r.rule_config.marca || '',
        modelos: r.rule_config.modelos || [],
      }));
  }, [rules, activeMode]);

  const isActive = entries.length > 0;

  const marcaOptions = useMemo(() => {
    if (!marcasModelos) return [];
    const unique = [...new Set(marcasModelos.filter(m => m.ativo).map(m => m.marca))].sort();
    const usedBrands = new Set(entries.map(e => e.marca.toUpperCase()));
    return unique
      .filter(m => !usedBrands.has(m.toUpperCase()))
      .map(m => ({ value: m, label: m }));
  }, [marcasModelos, entries]);

  const getModelosForMarca = useCallback((marca: string) => {
    if (!marcasModelos) return [];
    return marcasModelos
      .filter(m => m.ativo && m.marca.toUpperCase() === marca.toUpperCase() && m.modelo)
      .map(m => ({ value: m.modelo!, label: m.modelo! }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [marcasModelos]);

  const handleModeChange = useCallback(async (newMode: string) => {
    if (!newMode || newMode === activeMode) return;
    // If there are existing rules of opposite mode, delete them
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

  const handleAddMarca = useCallback(async () => {
    if (!selectedMarca) return;
    try {
      await saveRule.mutateAsync({
        entity_type: entityType,
        entity_id: entityId,
        rule_type: 'marca_modelo',
        rule_mode: activeMode,
        rule_config: { marca: selectedMarca, modelos: [] },
      });
      setSelectedMarca('');
    } catch { /* toast handled by hook */ }
  }, [selectedMarca, entityType, entityId, saveRule, activeMode]);

  const handleRemoveEntry = useCallback(async (ruleId: string | null) => {
    if (!ruleId) return;
    try { await deleteRule.mutateAsync(ruleId); } catch { /* toast handled by hook */ }
  }, [deleteRule]);

  const handleAddModelo = useCallback(async (entry: MarcaEntry) => {
    if (!selectedModelo || !entry.ruleId) return;
    if (entry.modelos.includes(selectedModelo)) {
      toast.info('Modelo já adicionado');
      return;
    }
    const newModelos = [...entry.modelos, selectedModelo];
    try {
      await deleteRule.mutateAsync(entry.ruleId);
      await saveRule.mutateAsync({
        entity_type: entityType,
        entity_id: entityId,
        rule_type: 'marca_modelo',
        rule_mode: activeMode,
        rule_config: { marca: entry.marca, modelos: newModelos },
      });
      setSelectedModelo('');
    } catch { /* toast handled by hook */ }
  }, [selectedModelo, entityType, entityId, saveRule, deleteRule, activeMode]);

  const handleRemoveModelo = useCallback(async (entry: MarcaEntry, modelo: string) => {
    if (!entry.ruleId) return;
    const newModelos = entry.modelos.filter(m => m !== modelo);
    try {
      await deleteRule.mutateAsync(entry.ruleId);
      await saveRule.mutateAsync({
        entity_type: entityType,
        entity_id: entityId,
        rule_type: 'marca_modelo',
        rule_mode: activeMode,
        rule_config: { marca: entry.marca, modelos: newModelos },
      });
    } catch { /* toast handled by hook */ }
  }, [entityType, entityId, saveRule, deleteRule, activeMode]);

  const handleClearAll = useCallback(async () => {
    for (const exc of entries) {
      if (exc.ruleId) {
        try { await deleteRule.mutateAsync(exc.ruleId); } catch { /* continue */ }
      }
    }
  }, [entries, deleteRule]);

  const isBusy = saveRule.isPending || deleteRule.isPending;

  const isBlacklist = activeMode === 'exclude';
  const labels = {
    title: isBlacklist ? 'Exclusão por Marca / Modelo' : 'Inclusão por Marca / Modelo',
    addLabel: isBlacklist ? 'Adicionar marca à exclusão' : 'Adicionar marca permitida',
    fullBrand: isBlacklist ? 'Marca inteira excluída' : 'Marca inteira permitida',
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
        {isActive && (
          <Button variant="ghost" size="sm" onClick={handleClearAll} disabled={isBusy}>
            Limpar todas
          </Button>
        )}
      </div>

      {/* Mode selector */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Tipo de regra</Label>
        <ToggleGroup
          type="single"
          value={activeMode}
          onValueChange={handleModeChange}
          className="justify-start"
        >
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

      {/* Add brand */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground mb-1 block">{labels.addLabel}</Label>
          <SearchableSelect
            options={marcaOptions}
            value={selectedMarca}
            onValueChange={setSelectedMarca}
            placeholder="Buscar marca..."
            searchPlaceholder="Digite para buscar..."
            loading={loadingMarcas || loadingRules}
            disabled={isBusy}
          />
        </div>
        <Button
          size="sm"
          onClick={handleAddMarca}
          disabled={!selectedMarca || isBusy}
          className="h-9"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Adicionar
        </Button>
      </div>

      {/* List of brands */}
      {entries.length > 0 && (
        <div className="space-y-3">
          {entries.map((exc) => {
            const modelosOptions = getModelosForMarca(exc.marca).filter(
              m => !exc.modelos.includes(m.value)
            );
            const isAddingModelos = addingModelosFor === exc.marca;

            return (
              <div key={exc.ruleId || exc.marca} className="rounded-md border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{exc.marca}</span>
                    {exc.modelos.length === 0 && (
                      <Badge
                        variant={isBlacklist ? 'destructive' : 'default'}
                        className="text-[10px]"
                      >
                        {labels.fullBrand}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setAddingModelosFor(isAddingModelos ? null : exc.marca)}
                      disabled={isBusy}
                    >
                      {isAddingModelos ? 'Fechar' : 'Modelos'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleRemoveEntry(exc.ruleId)}
                      disabled={isBusy}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {exc.modelos.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {exc.modelos.map(modelo => (
                      <Badge key={modelo} variant="secondary" className="text-xs gap-1 pr-1">
                        {modelo}
                        <button
                          className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                          onClick={() => handleRemoveModelo(exc, modelo)}
                          disabled={isBusy}
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                {isAddingModelos && (
                  <div className="flex items-end gap-2 pt-1">
                    <div className="flex-1">
                      <SearchableSelect
                        options={modelosOptions}
                        value={selectedModelo}
                        onValueChange={setSelectedModelo}
                        placeholder="Buscar modelo..."
                        searchPlaceholder="Digite para buscar..."
                        disabled={isBusy}
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleAddModelo(exc)}
                      disabled={!selectedModelo || isBusy}
                      className="h-9"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {entries.length === 0 && !loadingRules && (
        <p className="text-xs text-muted-foreground">{labels.empty}</p>
      )}
    </div>
  );
}
