import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Star, AlertTriangle, ChevronDown } from 'lucide-react';
import { CATEGORIAS_VEICULO } from '@/components/cotador/VehicleCategorySelect';
import { useBenefitExclusions } from '@/hooks/useBenefitExclusions';
import type { Benefit } from '@/types/plans';
import type { PlanBenefitInput } from '@/hooks/usePlansAdmin';

// Categorias que podem ter exclusões (excluímos 'nenhuma')
const CATEGORIAS_PARA_EXCLUSAO = CATEGORIAS_VEICULO.filter(
  (cat) => cat.value !== 'nenhuma'
);

interface BenefitsSelectorProps {
  benefits: Benefit[];
  selectedBenefits: PlanBenefitInput[];
  onChange: (benefits: PlanBenefitInput[]) => void;
  onExclusionsChange?: (exclusions: Map<string, string[]>) => void;
}

export function BenefitsSelector({
  benefits,
  selectedBenefits,
  onChange,
  onExclusionsChange,
}: BenefitsSelectorProps) {
  // Fetch all exclusions from database
  const { data: allExclusions, isLoading: loadingExclusions } = useBenefitExclusions();
  
  // Local state for pending exclusion changes
  const [pendingExclusions, setPendingExclusions] = useState<Map<string, string[]>>(new Map());
  const [initialized, setInitialized] = useState(false);

  // Initialize pending exclusions from database data
  useEffect(() => {
    if (allExclusions && !initialized) {
      const exclusionsMap = new Map<string, string[]>();
      allExclusions.forEach((exc) => {
        const current = exclusionsMap.get(exc.benefit_id) || [];
        if (!current.includes(exc.categoria_veiculo)) {
          current.push(exc.categoria_veiculo);
        }
        exclusionsMap.set(exc.benefit_id, current);
      });
      setPendingExclusions(exclusionsMap);
      setInitialized(true);
    }
  }, [allExclusions, initialized]);

  // Notify parent of exclusion changes
  useEffect(() => {
    if (initialized && onExclusionsChange) {
      onExclusionsChange(pendingExclusions);
    }
  }, [pendingExclusions, initialized, onExclusionsChange]);

  const isSelected = (benefitId: string) =>
    selectedBenefits.some((b) => b.benefit_id === benefitId);

  const getSelectedBenefit = (benefitId: string) =>
    selectedBenefits.find((b) => b.benefit_id === benefitId);

  const toggleBenefit = (benefitId: string) => {
    if (isSelected(benefitId)) {
      onChange(selectedBenefits.filter((b) => b.benefit_id !== benefitId));
    } else {
      onChange([
        ...selectedBenefits,
        {
          benefit_id: benefitId,
          custom_text: null,
          custom_value: null,
          additional_info: null,
          is_highlighted: false,
          display_order: selectedBenefits.length,
        },
      ]);
    }
  };

  const updateBenefit = (benefitId: string, updates: Partial<PlanBenefitInput>) => {
    onChange(
      selectedBenefits.map((b) =>
        b.benefit_id === benefitId ? { ...b, ...updates } : b
      )
    );
  };

  // Check if a benefit is excluded for a specific category
  const isExcludedForCategory = (benefitId: string, categoria: string): boolean => {
    const exclusions = pendingExclusions.get(benefitId) || [];
    return exclusions.includes(categoria);
  };

  // Get count of exclusions for a benefit
  const getExclusionCount = (benefitId: string): number => {
    return pendingExclusions.get(benefitId)?.length || 0;
  };

  // Toggle exclusion for a benefit/category pair
  const toggleExclusion = (benefitId: string, categoria: string, checked: boolean) => {
    setPendingExclusions((prev) => {
      const updated = new Map(prev);
      const current = updated.get(benefitId) || [];
      
      if (checked) {
        // Add exclusion
        if (!current.includes(categoria)) {
          updated.set(benefitId, [...current, categoria]);
        }
      } else {
        // Remove exclusion
        updated.set(benefitId, current.filter((c) => c !== categoria));
      }
      
      return updated;
    });
  };

  // Group benefits by category
  const groupedBenefits = benefits.reduce((acc, benefit) => {
    const category = benefit.category || 'Outros';
    if (!acc[category]) acc[category] = [];
    acc[category].push(benefit);
    return acc;
  }, {} as Record<string, Benefit[]>);

  return (
    <ScrollArea className="h-[500px] pr-4">
      <div className="space-y-6">
        {Object.entries(groupedBenefits).map(([category, categoryBenefits]) => (
          <div key={category}>
            <h4 className="text-sm font-semibold text-muted-foreground mb-2">
              {category}
            </h4>
            <div className="space-y-2">
              {categoryBenefits.map((benefit) => {
                const selected = isSelected(benefit.id);
                const selectedData = getSelectedBenefit(benefit.id);
                const exclusionCount = getExclusionCount(benefit.id);

                return (
                  <div
                    key={benefit.id}
                    className={`p-3 border rounded-lg transition-colors ${
                      selected ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() => toggleBenefit(benefit.id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{benefit.icon}</span>
                          <span className="font-medium">{benefit.name}</span>
                          {exclusionCount > 0 && (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
                              {exclusionCount} exclusão(ões)
                            </Badge>
                          )}
                        </div>
                        {benefit.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {benefit.description}
                          </p>
                        )}

                        {selected && (
                          <div className="mt-3 space-y-3 pt-3 border-t">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-xs">Texto customizado</Label>
                                <Input
                                  placeholder="Ex: até 100km"
                                  value={selectedData?.custom_text || ''}
                                  onChange={(e) =>
                                    updateBenefit(benefit.id, {
                                      custom_text: e.target.value || null,
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Valor</Label>
                                <Input
                                  placeholder="Ex: R$ 500"
                                  value={selectedData?.custom_value || ''}
                                  onChange={(e) =>
                                    updateBenefit(benefit.id, {
                                      custom_value: e.target.value || null,
                                    })
                                  }
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs">Informações adicionais</Label>
                              <Textarea
                                placeholder="Detalhes extras..."
                                rows={2}
                                value={selectedData?.additional_info || ''}
                                onChange={(e) =>
                                  updateBenefit(benefit.id, {
                                    additional_info: e.target.value || null,
                                  })
                                }
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={selectedData?.is_highlighted || false}
                                onCheckedChange={(checked) =>
                                  updateBenefit(benefit.id, {
                                    is_highlighted: !!checked,
                                  })
                                }
                              />
                              <Label className="text-sm flex items-center gap-1">
                                <Star className="h-3 w-3 text-yellow-500" />
                                Destaque
                              </Label>
                            </div>

                            {/* Seção de Exclusões por Categoria */}
                            <Collapsible className="mt-2">
                              <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full py-1">
                                <AlertTriangle className="h-3 w-3 text-amber-500" />
                                <span className="flex-1 text-left">Excluir para categorias especiais</span>
                                {exclusionCount > 0 && (
                                  <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                                    {exclusionCount}
                                  </Badge>
                                )}
                                <ChevronDown className="h-3 w-3" />
                              </CollapsibleTrigger>
                              <CollapsibleContent className="pt-2">
                                <div className="grid grid-cols-2 gap-1 p-2 bg-muted/30 rounded-md border">
                                  {CATEGORIAS_PARA_EXCLUSAO.map((cat) => (
                                    <div key={cat.value} className="flex items-center gap-2 py-1">
                                      <Checkbox
                                        id={`${benefit.id}-${cat.value}`}
                                        checked={isExcludedForCategory(benefit.id, cat.value)}
                                        onCheckedChange={(checked) =>
                                          toggleExclusion(benefit.id, cat.value, !!checked)
                                        }
                                        disabled={loadingExclusions}
                                      />
                                      <Label
                                        htmlFor={`${benefit.id}-${cat.value}`}
                                        className="text-xs cursor-pointer"
                                      >
                                        {cat.label}
                                      </Label>
                                    </div>
                                  ))}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Marque as categorias que <strong>NÃO</strong> terão direito a este benefício.
                                </p>
                              </CollapsibleContent>
                            </Collapsible>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {benefits.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            Nenhum benefício cadastrado. Crie benefícios na aba "Benefícios".
          </p>
        )}
      </div>
    </ScrollArea>
  );
}
