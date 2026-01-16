import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Star } from 'lucide-react';
import type { Benefit } from '@/types/plans';
import type { PlanBenefitInput } from '@/hooks/usePlansAdmin';

interface BenefitsSelectorProps {
  benefits: Benefit[];
  selectedBenefits: PlanBenefitInput[];
  onChange: (benefits: PlanBenefitInput[]) => void;
}

export function BenefitsSelector({
  benefits,
  selectedBenefits,
  onChange,
}: BenefitsSelectorProps) {
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

  // Group benefits by category
  const groupedBenefits = benefits.reduce((acc, benefit) => {
    const category = benefit.category || 'Outros';
    if (!acc[category]) acc[category] = [];
    acc[category].push(benefit);
    return acc;
  }, {} as Record<string, Benefit[]>);

  return (
    <ScrollArea className="h-[400px] pr-4">
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
