import { useEffect, useState, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { FieldHint } from './FieldHint';
import { PLAN_FIELD_HINTS } from './planFieldHints';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProductLines, useBenefits, useCoberturas } from '@/hooks/usePlans';
import { useCreatePlan, useUpdatePlan, PlanBenefitInput } from '@/hooks/usePlansAdmin';
import { BenefitsSelector } from './BenefitsSelector';
import { PlanPreview } from './PlanPreview';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PlanWithDetails } from '@/hooks/usePlans';

interface PlanFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: PlanWithDetails | { id: string } | null;
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
  const { data: coberturasCatalogo } = useCoberturas();
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();

  const { data: fullPlanData } = useQuery({
    queryKey: ['plan-form-modal-full', plan?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos')
        .select(`
          *,
          product_lines(*),
          planos_beneficios(*, benefits:benefit_id(*)),
          planos_coberturas(*, coberturas:cobertura_id(*))
        `)
        .eq('id', plan!.id)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!plan?.id && open,
  });

  const isEditing = !!plan;

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    product_line_id: defaultProductLineId || '',
    badge_text: '',
    badge_color: '',
    restriction_alert: '',
    footer_note: '',
    display_order: '0',
    is_active: true,
  });

  const [selectedBenefits, setSelectedBenefits] = useState<PlanBenefitInput[]>([]);
  const [selectedCoberturas, setSelectedCoberturas] = useState<{ cobertura_id: string }[]>([]);

  const formInitializedRef = useRef(false);

  useEffect(() => {
    formInitializedRef.current = false;
  }, [plan?.id, open]);

  useEffect(() => {
    if (formInitializedRef.current) return;
    const p = fullPlanData;
    if (p) {
      formInitializedRef.current = true;
      setFormData({
        name: p.nome || '',
        slug: p.slug || '',
        product_line_id: p.product_line_id || '',
        badge_text: p.badge_text || '',
        badge_color: p.badge_color || '',
        restriction_alert: p.restriction_alert || '',
        footer_note: p.footer_note || '',
        display_order: (p.ordem || 0).toString(),
        is_active: p.ativo ?? true,
      });
      setSelectedBenefits(
        (p.planos_beneficios || []).map((pb: any) => ({
          benefit_id: pb.benefit_id,
          custom_text: pb.custom_text,
          custom_value: pb.custom_value,
          additional_info: pb.additional_info,
          is_highlighted: pb.is_highlighted ?? false,
          display_order: pb.display_order ?? 0,
        }))
      );
      setSelectedCoberturas(
        (p.planos_coberturas || []).map((pc: any) => ({
          cobertura_id: pc.cobertura_id,
        }))
      );
    } else if (!plan) {
      setFormData({
        name: '',
        slug: '',
        product_line_id: defaultProductLineId || '',
        badge_text: '',
        badge_color: '',
        restriction_alert: '',
        footer_note: '',
        display_order: '0',
        is_active: true,
      });
      setSelectedBenefits([]);
      setSelectedCoberturas([]);
    }
  }, [fullPlanData, plan, defaultProductLineId]);

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
      restriction_alert: formData.restriction_alert || null,
      footer_note: formData.footer_note || null,
      display_order: parseInt(formData.display_order) || 0,
      is_active: formData.is_active,
      benefits: selectedBenefits,
      coberturas: selectedCoberturas,
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

  const previewData = {
    ...formData,
    id: plan?.id || 'preview',
    additional_price: null,
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
      <DialogContent className="max-w-6xl max-h-[95vh] h-[95vh] p-0 overflow-hidden">
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
                <div className="space-y-6 pb-6">
                  {/* Nome + Slug */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome *<FieldHint text={PLAN_FIELD_HINTS.name} /></Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleNameChange(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="slug">Slug<FieldHint text={PLAN_FIELD_HINTS.slug} /></Label>
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

                  {/* Linha de Produto */}
                  <div className="space-y-2">
                    <Label htmlFor="product_line_id">Linha de Produto *<FieldHint text={PLAN_FIELD_HINTS.product_line_id} /></Label>
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

                  {/* Badge + Cor */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="badge_text">Badge<FieldHint text={PLAN_FIELD_HINTS.badge_text} /></Label>
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
                      <Label htmlFor="badge_color">Cor do Badge<FieldHint text={PLAN_FIELD_HINTS.badge_color} /></Label>
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

                  {/* Ativo + Ordem */}
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) =>
                          setFormData((prev) => ({ ...prev, is_active: checked }))
                        }
                      />
                      <Label htmlFor="is_active">Ativo<FieldHint text={PLAN_FIELD_HINTS.is_active} /></Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="display_order" className="whitespace-nowrap">Ordem<FieldHint text={PLAN_FIELD_HINTS.display_order} /></Label>
                      <Input
                        id="display_order"
                        type="number"
                        className="w-20"
                        value={formData.display_order}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, display_order: e.target.value }))
                        }
                      />
                    </div>
                  </div>

                  {/* Separator: Coberturas e Benefícios */}
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold text-foreground mb-3">Coberturas e Benefícios</h3>
                    <BenefitsSelector
                      benefits={benefits || []}
                      selectedBenefits={selectedBenefits}
                      onChange={setSelectedBenefits}
                      coberturas={coberturasCatalogo || []}
                      selectedCoberturas={selectedCoberturas}
                      onCoberturasChange={setSelectedCoberturas}
                    />
                  </div>

                  {/* Separator: Observações */}
                  <div className="border-t pt-4 space-y-4">
                    <h3 className="text-sm font-semibold text-foreground">Observações</h3>
                    <div className="space-y-2">
                      <Label htmlFor="restriction_alert">Alerta de Restrição<FieldHint text={PLAN_FIELD_HINTS.restriction_alert} /></Label>
                      <Textarea
                        id="restriction_alert"
                        value={formData.restriction_alert}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, restriction_alert: e.target.value }))
                        }
                        placeholder="Mensagem de alerta exibida no card"
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="footer_note">Nota de Rodapé<FieldHint text={PLAN_FIELD_HINTS.footer_note} /></Label>
                      <Textarea
                        id="footer_note"
                        value={formData.footer_note}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, footer_note: e.target.value }))
                        }
                        placeholder="Texto pequeno no rodapé do card"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
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
                  {(createPlan.isPending || updatePlan.isPending) ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    isEditing ? 'Salvar' : 'Criar Plano'
                  )}
                </Button>
              </div>
            </form>
          </div>

          {/* Preview Side */}
          <div className="w-80 border-l bg-muted/30 p-4 overflow-auto">
            <p className="text-sm font-medium mb-3">Preview</p>
            <PlanPreview
              plan={previewData}
              pendingExclusions={new Map()}
              benefits={benefits}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
