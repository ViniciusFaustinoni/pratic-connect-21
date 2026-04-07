import { useState, useMemo, useCallback } from 'react';
import { X, Plus, AlertTriangle, Car } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useMarcasModelos } from '@/hooks/useMarcasModelos';
import {
  useRulesForEntity,
  useSaveRule,
  useDeleteRule,
  type EntityType,
  type EligibilityRule,
} from '@/hooks/useEntityEligibilityRules';
import { toast } from 'sonner';

interface MarcaModeloExclusionEditorProps {
  entityType: EntityType;
  entityId: string;
}

interface MarcaExclusion {
  ruleId: string | null;
  marca: string;
  modelos: string[];
}

export function MarcaModeloExclusionEditor({ entityType, entityId }: MarcaModeloExclusionEditorProps) {
  const { data: marcasModelos, isLoading: loadingMarcas } = useMarcasModelos();
  const { data: rules, isLoading: loadingRules } = useRulesForEntity(entityType, entityId);
  const saveRule = useSaveRule();
  const deleteRule = useDeleteRule();

  const [selectedMarca, setSelectedMarca] = useState('');
  const [selectedModelo, setSelectedModelo] = useState('');
  const [addingModelosFor, setAddingModelosFor] = useState<string | null>(null);

  // Derive current exclusions from saved rules
  const exclusions: MarcaExclusion[] = useMemo(() => {
    if (!rules) return [];
    return rules
      .filter(r => r.rule_type === 'marca_modelo' && r.rule_mode === 'exclude')
      .map(r => ({
        ruleId: r.id,
        marca: r.rule_config.marca || '',
        modelos: r.rule_config.modelos || [],
      }));
  }, [rules]);

  const isActive = exclusions.length > 0;

  // Unique brand list from DB
  const marcaOptions = useMemo(() => {
    if (!marcasModelos) return [];
    const unique = [...new Set(marcasModelos.filter(m => m.ativo).map(m => m.marca))].sort();
    // Filter out already-excluded brands
    const excludedBrands = new Set(exclusions.map(e => e.marca.toUpperCase()));
    return unique
      .filter(m => !excludedBrands.has(m.toUpperCase()))
      .map(m => ({ value: m, label: m }));
  }, [marcasModelos, exclusions]);

  // Models for a given brand
  const getModelosForMarca = useCallback((marca: string) => {
    if (!marcasModelos) return [];
    return marcasModelos
      .filter(m => m.ativo && m.marca.toUpperCase() === marca.toUpperCase() && m.modelo)
      .map(m => ({ value: m.modelo!, label: m.modelo! }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [marcasModelos]);

  const handleAddMarca = useCallback(async () => {
    if (!selectedMarca) return;
    try {
      await saveRule.mutateAsync({
        entity_type: entityType,
        entity_id: entityId,
        rule_type: 'marca_modelo',
        rule_mode: 'exclude',
        rule_config: { marca: selectedMarca, modelos: [] },
      });
      setSelectedMarca('');
    } catch { /* toast handled by hook */ }
  }, [selectedMarca, entityType, entityId, saveRule]);

  const handleRemoveExclusion = useCallback(async (ruleId: string | null) => {
    if (!ruleId) return;
    try {
      await deleteRule.mutateAsync(ruleId);
    } catch { /* toast handled by hook */ }
  }, [deleteRule]);

  const handleAddModelo = useCallback(async (exclusion: MarcaExclusion) => {
    if (!selectedModelo || !exclusion.ruleId) return;
    if (exclusion.modelos.includes(selectedModelo)) {
      toast.info('Modelo já adicionado');
      return;
    }
    const newModelos = [...exclusion.modelos, selectedModelo];
    // Delete old rule and create updated one
    try {
      await deleteRule.mutateAsync(exclusion.ruleId);
      await saveRule.mutateAsync({
        entity_type: entityType,
        entity_id: entityId,
        rule_type: 'marca_modelo',
        rule_mode: 'exclude',
        rule_config: { marca: exclusion.marca, modelos: newModelos },
      });
      setSelectedModelo('');
    } catch { /* toast handled by hook */ }
  }, [selectedModelo, entityType, entityId, saveRule, deleteRule]);

  const handleRemoveModelo = useCallback(async (exclusion: MarcaExclusion, modelo: string) => {
    if (!exclusion.ruleId) return;
    const newModelos = exclusion.modelos.filter(m => m !== modelo);
    try {
      await deleteRule.mutateAsync(exclusion.ruleId);
      await saveRule.mutateAsync({
        entity_type: entityType,
        entity_id: entityId,
        rule_type: 'marca_modelo',
        rule_mode: 'exclude',
        rule_config: { marca: exclusion.marca, modelos: newModelos },
      });
    } catch { /* toast handled by hook */ }
  }, [entityType, entityId, saveRule, deleteRule]);

  const handleClearAll = useCallback(async () => {
    for (const exc of exclusions) {
      if (exc.ruleId) {
        try {
          await deleteRule.mutateAsync(exc.ruleId);
        } catch { /* continue */ }
      }
    }
  }, [exclusions, deleteRule]);

  const isBusy = saveRule.isPending || deleteRule.isPending;

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Car className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Exclusão por Marca / Modelo</Label>
        </div>
        {isActive && (
          <Button variant="ghost" size="sm" onClick={handleClearAll} disabled={isBusy}>
            Limpar todas
          </Button>
        )}
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
          <Label className="text-xs text-muted-foreground mb-1 block">Adicionar marca à exclusão</Label>
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

      {/* List of excluded brands */}
      {exclusions.length > 0 && (
        <div className="space-y-3">
          {exclusions.map((exc) => {
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
                      <Badge variant="destructive" className="text-[10px]">Marca inteira excluída</Badge>
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
                      onClick={() => handleRemoveExclusion(exc.ruleId)}
                      disabled={isBusy}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Modelo badges */}
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

                {/* Add modelo dropdown */}
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

      {exclusions.length === 0 && !loadingRules && (
        <p className="text-xs text-muted-foreground">Nenhuma marca excluída. Todas as marcas e modelos são aceitos.</p>
      )}
    </div>
  );
}
