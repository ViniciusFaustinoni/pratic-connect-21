import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Star, AlertTriangle, ChevronDown, Check, Eye } from 'lucide-react';
import { CATEGORIAS_VEICULO } from '@/components/cotador/VehicleCategorySelect';
import { useBenefitExclusions } from '@/hooks/useBenefitExclusions';
import type { Benefit } from '@/types/plans';
import type { PlanBenefitInput } from '@/hooks/usePlansAdmin';

// Categorias que podem ter exclusões (excluímos 'nenhuma')
const CATEGORIAS_PARA_EXCLUSAO = CATEGORIAS_VEICULO.filter(
  (cat) => cat.value !== 'nenhuma'
);

// Configuração estruturada para valores flexíveis
interface BenefitValueConfig {
  prefix: 'ate' | 'a_partir_de' | 'exato' | '';
  value: string;
  valueType: 'percent' | 'currency' | 'text';
  suffix: string;
}

// Função para formatar valor estruturado
const formatBenefitValue = (config: BenefitValueConfig): string => {
  if (!config.value) return '';
  
  const prefixMap: Record<string, string> = {
    'ate': 'até',
    'a_partir_de': 'a partir de',
    'exato': '',
    '': '',
  };
  
  const prefix = prefixMap[config.prefix] || '';
  
  let formattedValue = config.value;
  if (config.valueType === 'currency') {
    const numValue = Number(config.value.replace(/\D/g, ''));
    if (!isNaN(numValue)) {
      formattedValue = `R$ ${numValue.toLocaleString('pt-BR')}`;
    }
  } else if (config.valueType === 'percent') {
    formattedValue = `${config.value}%`;
  }
  
  const suffix = config.suffix ? ` ${config.suffix}` : '';
  
  return `${prefix}${prefix ? ' ' : ''}${formattedValue}${suffix}`.trim();
};

// Função para tentar parsear custom_text de volta para config estruturada
const parseCustomTextToConfig = (customText: string | null): BenefitValueConfig | null => {
  if (!customText) return null;
  
  const text = customText.trim();
  
  // Detectar prefixo
  let prefix: BenefitValueConfig['prefix'] = '';
  let remaining = text;
  
  if (text.startsWith('até ')) {
    prefix = 'ate';
    remaining = text.slice(4);
  } else if (text.startsWith('a partir de ')) {
    prefix = 'a_partir_de';
    remaining = text.slice(12);
  }
  
  // Detectar tipo de valor
  let valueType: BenefitValueConfig['valueType'] = 'text';
  let value = '';
  let suffix = '';
  
  // Verificar se é moeda (R$)
  const currencyMatch = remaining.match(/^R\$\s?([\d.,]+)\s*(.*)?$/i);
  if (currencyMatch) {
    valueType = 'currency';
    value = currencyMatch[1].replace(/\./g, '').replace(',', '');
    suffix = currencyMatch[2]?.trim() || '';
  } else {
    // Verificar se é percentual
    const percentMatch = remaining.match(/^([\d.,]+)%\s*(.*)?$/);
    if (percentMatch) {
      valueType = 'percent';
      value = percentMatch[1].replace(',', '.');
      suffix = percentMatch[2]?.trim() || '';
    }
  }
  
  if (value) {
    return { prefix, value, valueType, suffix };
  }
  
  return null;
};

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
  
  // State for structured value editing per benefit
  const [valueConfigs, setValueConfigs] = useState<Map<string, BenefitValueConfig>>(new Map());
  
  // State to track which benefits are using structured mode
  const [structuredMode, setStructuredMode] = useState<Set<string>>(new Set());

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
      // Clean up structured mode state
      setStructuredMode((prev) => {
        const next = new Set(prev);
        next.delete(benefitId);
        return next;
      });
      setValueConfigs((prev) => {
        const next = new Map(prev);
        next.delete(benefitId);
        return next;
      });
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

  // Get or initialize value config for a benefit
  const getValueConfig = (benefitId: string): BenefitValueConfig => {
    const existing = valueConfigs.get(benefitId);
    if (existing) return existing;
    
    // Try to parse from existing custom_text
    const selectedBenefit = getSelectedBenefit(benefitId);
    const parsed = parseCustomTextToConfig(selectedBenefit?.custom_text || null);
    
    return parsed || {
      prefix: '',
      value: '',
      valueType: 'percent',
      suffix: '',
    };
  };

  // Update structured value config and sync to custom_text
  const updateValueConfig = (benefitId: string, updates: Partial<BenefitValueConfig>) => {
    const current = getValueConfig(benefitId);
    const newConfig = { ...current, ...updates };
    
    setValueConfigs((prev) => {
      const next = new Map(prev);
      next.set(benefitId, newConfig);
      return next;
    });
    
    // Generate and update custom_text
    const formattedValue = formatBenefitValue(newConfig);
    if (formattedValue) {
      updateBenefit(benefitId, { custom_text: formattedValue });
    }
  };

  // Toggle structured mode for a benefit
  const toggleStructuredMode = (benefitId: string) => {
    setStructuredMode((prev) => {
      const next = new Set(prev);
      if (next.has(benefitId)) {
        next.delete(benefitId);
      } else {
        next.add(benefitId);
        // Initialize config from existing custom_text if available
        const selectedBenefit = getSelectedBenefit(benefitId);
        const parsed = parseCustomTextToConfig(selectedBenefit?.custom_text || null);
        if (parsed) {
          setValueConfigs((configs) => {
            const nextConfigs = new Map(configs);
            nextConfigs.set(benefitId, parsed);
            return nextConfigs;
          });
        }
      }
      return next;
    });
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
                const isStructured = structuredMode.has(benefit.id);
                const valueConfig = getValueConfig(benefit.id);

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
                            {/* Toggle para modo estruturado */}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => toggleStructuredMode(benefit.id)}
                                className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                                  isStructured 
                                    ? 'bg-primary text-primary-foreground border-primary' 
                                    : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                                }`}
                              >
                                {isStructured ? '✓ Valor estruturado' : 'Usar valor estruturado'}
                              </button>
                              {!isStructured && (
                                <span className="text-xs text-muted-foreground">
                                  Formatos: "até X%", "a partir de R$ Y"
                                </span>
                              )}
                            </div>

                            {isStructured ? (
                              /* Modo Estruturado */
                              <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
                                <Label className="text-xs font-medium">Valor do Benefício (Estruturado)</Label>
                                
                                <div className="grid grid-cols-3 gap-2">
                                  {/* Prefixo */}
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Prefixo</Label>
                                    <Select
                                      value={valueConfig.prefix || 'exato'}
                                      onValueChange={(value) => 
                                        updateValueConfig(benefit.id, { 
                                          prefix: value as BenefitValueConfig['prefix'] 
                                        })
                                      }
                                    >
                                      <SelectTrigger className="h-9">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="exato">Exato</SelectItem>
                                        <SelectItem value="ate">até</SelectItem>
                                        <SelectItem value="a_partir_de">a partir de</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  {/* Valor numérico */}
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Valor</Label>
                                    <Input
                                      type="text"
                                      inputMode="numeric"
                                      placeholder="10"
                                      className="h-9"
                                      value={valueConfig.value}
                                      onChange={(e) => 
                                        updateValueConfig(benefit.id, { 
                                          value: e.target.value.replace(/[^\d.,]/g, '') 
                                        })
                                      }
                                    />
                                  </div>
                                  
                                  {/* Tipo (%/R$) */}
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Tipo</Label>
                                    <Select
                                      value={valueConfig.valueType}
                                      onValueChange={(value) => 
                                        updateValueConfig(benefit.id, { 
                                          valueType: value as BenefitValueConfig['valueType'] 
                                        })
                                      }
                                    >
                                      <SelectTrigger className="h-9">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="percent">%</SelectItem>
                                        <SelectItem value="currency">R$</SelectItem>
                                        <SelectItem value="text">Texto</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                
                                {/* Sufixo opcional */}
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Sufixo (opcional)</Label>
                                  <Input
                                    placeholder="Ex: desconto, cobertura, km"
                                    className="h-9"
                                    value={valueConfig.suffix}
                                    onChange={(e) => 
                                      updateValueConfig(benefit.id, { suffix: e.target.value })
                                    }
                                  />
                                </div>
                                
                                {/* Preview */}
                                {valueConfig.value && (
                                  <div className="flex items-center gap-2 p-2 bg-background rounded-md border border-primary/30">
                                    <Eye className="h-4 w-4 text-primary" />
                                    <span className="text-sm">
                                      <strong>{benefit.name}</strong>
                                      {' '}
                                      <span className="text-primary">
                                        ({formatBenefitValue(valueConfig)})
                                      </span>
                                    </span>
                                    <Check className="h-4 w-4 text-green-500 ml-auto" />
                                  </div>
                                )}
                              </div>
                            ) : (
                              /* Modo Texto Livre (original) */
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
                            )}

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
