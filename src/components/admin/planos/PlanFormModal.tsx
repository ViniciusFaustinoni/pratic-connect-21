import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProductLines } from '@/hooks/usePlans';
import { useBenefits } from '@/hooks/usePlans';
import { useCreatePlan, useUpdatePlan, PlanBenefitInput } from '@/hooks/usePlansAdmin';
import { BenefitsSelector } from './BenefitsSelector';
import { PlanPreview } from './PlanPreview';
import type { PlanWithDetails } from '@/types/plans';

interface PlanFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: PlanWithDetails | null;
  defaultProductLineId?: string;
}

const BADGE_COLORS = [
  { value: 'yellow', label: 'Amarelo' },
  { value: 'green', label: 'Verde' },
  { value: 'blue', label: 'Azul' },
  { value: 'purple', label: 'Roxo' },
  { value: 'orange', label: 'Laranja' },
  { value: 'red', label: 'Vermelho' },
];

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function PlanFormModal({
  open,
  onOpenChange,
  plan,
  defaultProductLineId,
}: PlanFormModalProps) {
  const { data: productLines } = useProductLines();
  const { data: benefits } = useBenefits();
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();

  const isEditing = !!plan;

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    product_line_id: defaultProductLineId || '',
    badge_text: '',
    badge_color: '',
    coverage_type: '',
    min_vehicle_year: '',
    additional_price: '',
    cota_passeio_percent: '',
    cota_passeio_min: '',
    cota_desagio_percent: '',
    cota_desagio_min: '',
    cota_app_percent: '',
    cota_app_min: '',
    restriction_alert: '',
    footer_note: '',
    display_order: '0',
    is_active: true,
  });

  const [selectedBenefits, setSelectedBenefits] = useState<PlanBenefitInput[]>([]);

  // Reset form when plan changes
  useEffect(() => {
    if (plan) {
      setFormData({
        name: plan.name || '',
        slug: plan.slug || '',
        product_line_id: plan.product_line_id || '',
        badge_text: plan.badge_text || '',
        badge_color: plan.badge_color || '',
        coverage_type: plan.coverage_type || '',
        min_vehicle_year: plan.min_vehicle_year || '',
        additional_price: plan.additional_price?.toString() || '',
        cota_passeio_percent: plan.cota_passeio_percent?.toString() || '',
        cota_passeio_min: plan.cota_passeio_min?.toString() || '',
        cota_desagio_percent: plan.cota_desagio_percent?.toString() || '',
        cota_desagio_min: plan.cota_desagio_min?.toString() || '',
        cota_app_percent: plan.cota_app_percent?.toString() || '',
        cota_app_min: plan.cota_app_min?.toString() || '',
        restriction_alert: plan.restriction_alert || '',
        footer_note: plan.footer_note || '',
        display_order: plan.display_order?.toString() || '0',
        is_active: plan.is_active ?? true,
      });
      setSelectedBenefits(
        plan.plan_benefits?.map((pb) => ({
          benefit_id: pb.benefit_id,
          custom_text: pb.custom_text,
          custom_value: pb.custom_value,
          additional_info: pb.additional_info,
          is_highlighted: pb.is_highlighted ?? false,
          display_order: pb.display_order ?? 0,
        })) || []
      );
    } else {
      setFormData({
        name: '',
        slug: '',
        product_line_id: defaultProductLineId || '',
        badge_text: '',
        badge_color: '',
        coverage_type: '',
        min_vehicle_year: '',
        additional_price: '',
        cota_passeio_percent: '',
        cota_passeio_min: '',
        cota_desagio_percent: '',
        cota_desagio_min: '',
        cota_app_percent: '',
        cota_app_min: '',
        restriction_alert: '',
        footer_note: '',
        display_order: '0',
        is_active: true,
      });
      setSelectedBenefits([]);
    }
  }, [plan, defaultProductLineId]);

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: isEditing ? prev.slug : generateSlug(name),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      name: formData.name,
      slug: formData.slug,
      product_line_id: formData.product_line_id,
      badge_text: formData.badge_text || null,
      badge_color: formData.badge_color || null,
      coverage_type: formData.coverage_type || null,
      min_vehicle_year: formData.min_vehicle_year || null,
      additional_price: formData.additional_price
        ? parseFloat(formData.additional_price)
        : null,
      cota_passeio_percent: formData.cota_passeio_percent
        ? parseFloat(formData.cota_passeio_percent)
        : null,
      cota_passeio_min: formData.cota_passeio_min
        ? parseFloat(formData.cota_passeio_min)
        : null,
      cota_desagio_percent: formData.cota_desagio_percent
        ? parseFloat(formData.cota_desagio_percent)
        : null,
      cota_desagio_min: formData.cota_desagio_min
        ? parseFloat(formData.cota_desagio_min)
        : null,
      cota_app_percent: formData.cota_app_percent
        ? parseFloat(formData.cota_app_percent)
        : null,
      cota_app_min: formData.cota_app_min
        ? parseFloat(formData.cota_app_min)
        : null,
      restriction_alert: formData.restriction_alert || null,
      footer_note: formData.footer_note || null,
      display_order: parseInt(formData.display_order) || 0,
      is_active: formData.is_active,
      benefits: selectedBenefits,
    };

    try {
      if (isEditing && plan) {
        await updatePlan.mutateAsync({ id: plan.id, ...payload });
      } else {
        await createPlan.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch (error) {
      // Error is handled by mutation
    }
  };

  // Build preview data
  const previewData = {
    ...formData,
    id: plan?.id || 'preview',
    additional_price: formData.additional_price
      ? parseFloat(formData.additional_price)
      : null,
    cota_passeio_percent: formData.cota_passeio_percent
      ? parseFloat(formData.cota_passeio_percent)
      : null,
    cota_passeio_min: formData.cota_passeio_min
      ? parseFloat(formData.cota_passeio_min)
      : null,
    cota_desagio_percent: formData.cota_desagio_percent
      ? parseFloat(formData.cota_desagio_percent)
      : null,
    cota_desagio_min: formData.cota_desagio_min
      ? parseFloat(formData.cota_desagio_min)
      : null,
    cota_app_percent: formData.cota_app_percent
      ? parseFloat(formData.cota_app_percent)
      : null,
    cota_app_min: formData.cota_app_min
      ? parseFloat(formData.cota_app_min)
      : null,
    display_order: parseInt(formData.display_order) || 0,
    product_lines: productLines?.find((l) => l.id === formData.product_line_id) || null,
    plan_benefits: selectedBenefits.map((sb, index) => ({
      id: `preview-${index}`,
      plan_id: 'preview',
      benefit_id: sb.benefit_id,
      custom_text: sb.custom_text,
      custom_value: sb.custom_value,
      additional_info: sb.additional_info,
      is_highlighted: sb.is_highlighted,
      display_order: sb.display_order,
      created_at: null,
      benefits: benefits?.find((b) => b.id === sb.benefit_id) || null,
    })),
  } as any;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>
            {isEditing ? 'Editar Plano' : 'Novo Plano'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex h-full overflow-hidden">
          {/* Form Side */}
          <div className="flex-1 overflow-hidden">
            <form onSubmit={handleSubmit} className="h-full flex flex-col">
              <ScrollArea className="flex-1 px-6">
                <Tabs defaultValue="basico" className="pb-6">
                  <TabsList className="mb-4">
                    <TabsTrigger value="basico">Básico</TabsTrigger>
                    <TabsTrigger value="cotas">Cotas</TabsTrigger>
                    <TabsTrigger value="beneficios">Benefícios</TabsTrigger>
                    <TabsTrigger value="outros">Outros</TabsTrigger>
                  </TabsList>

                  <TabsContent value="basico" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nome *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => handleNameChange(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="slug">Slug</Label>
                        <Input
                          id="slug"
                          value={formData.slug}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, slug: e.target.value }))
                          }
                          disabled={isEditing}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="product_line_id">Linha de Produto *</Label>
                      <Select
                        value={formData.product_line_id}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, product_line_id: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {productLines?.map((line) => (
                            <SelectItem key={line.id} value={line.id}>
                              {line.icon} {line.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="badge_text">Badge</Label>
                        <Input
                          id="badge_text"
                          value={formData.badge_text}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, badge_text: e.target.value }))
                          }
                          placeholder="Ex: Mais Vendido"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="badge_color">Cor do Badge</Label>
                        <Select
                          value={formData.badge_color}
                          onValueChange={(value) =>
                            setFormData((prev) => ({ ...prev, badge_color: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {BADGE_COLORS.map((color) => (
                              <SelectItem key={color.value} value={color.value}>
                                {color.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="coverage_type">Tipo de Cobertura</Label>
                        <Input
                          id="coverage_type"
                          value={formData.coverage_type}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, coverage_type: e.target.value }))
                          }
                          placeholder="Ex: 100% FIPE"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="min_vehicle_year">Ano Mínimo</Label>
                        <Input
                          id="min_vehicle_year"
                          value={formData.min_vehicle_year}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              min_vehicle_year: e.target.value,
                            }))
                          }
                          placeholder="Ex: 2015+"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="is_active"
                          checked={formData.is_active}
                          onCheckedChange={(checked) =>
                            setFormData((prev) => ({ ...prev, is_active: checked }))
                          }
                        />
                        <Label htmlFor="is_active">Ativo</Label>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="cotas" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="additional_price">Preço Adicional (R$)</Label>
                      <Input
                        id="additional_price"
                        type="number"
                        step="0.01"
                        value={formData.additional_price}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            additional_price: e.target.value,
                          }))
                        }
                        placeholder="0.00"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Cota Passeio (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={formData.cota_passeio_percent}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              cota_passeio_percent: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Mínimo (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.cota_passeio_min}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              cota_passeio_min: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Cota Deságio (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={formData.cota_desagio_percent}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              cota_desagio_percent: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Mínimo (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.cota_desagio_min}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              cota_desagio_min: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Cota APP (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={formData.cota_app_percent}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              cota_app_percent: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Mínimo (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.cota_app_min}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              cota_app_min: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="beneficios">
                    <BenefitsSelector
                      benefits={benefits || []}
                      selectedBenefits={selectedBenefits}
                      onChange={setSelectedBenefits}
                    />
                  </TabsContent>

                  <TabsContent value="outros" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="restriction_alert">Alerta de Restrição</Label>
                      <Textarea
                        id="restriction_alert"
                        value={formData.restriction_alert}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            restriction_alert: e.target.value,
                          }))
                        }
                        placeholder="Mensagem de alerta exibida no card"
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="footer_note">Nota de Rodapé</Label>
                      <Textarea
                        id="footer_note"
                        value={formData.footer_note}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            footer_note: e.target.value,
                          }))
                        }
                        placeholder="Texto pequeno no rodapé do card"
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="display_order">Ordem de Exibição</Label>
                      <Input
                        id="display_order"
                        type="number"
                        value={formData.display_order}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            display_order: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </ScrollArea>

              <div className="p-6 border-t flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createPlan.isPending || updatePlan.isPending}
                >
                  {isEditing ? 'Salvar' : 'Criar Plano'}
                </Button>
              </div>
            </form>
          </div>

          {/* Preview Side */}
          <div className="w-80 border-l bg-muted/30 p-4 overflow-auto">
            <p className="text-sm font-medium mb-3">Preview</p>
            <PlanPreview plan={previewData} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
