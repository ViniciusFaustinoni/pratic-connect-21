import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, Loader2, Search, Shield, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useProductLines, useBenefits, useCoberturas } from '@/hooks/usePlans';
import { useCreatePlan, useUpdatePlan, PlanBenefitInput } from '@/hooks/usePlansAdmin';
import { supabase } from '@/integrations/supabase/client';
import type { PlanWithDetails } from '@/hooks/usePlans';

interface PlanFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: PlanWithDetails | { id: string } | null;
  defaultProductLineId?: string;
}

interface PlanFormData {
  name: string;
  slug: string;
  product_line_id: string;
  badge_text: string;
  badge_color: string;
  restriction_alert: string;
  footer_note: string;
  display_order: string;
  is_active: boolean;
}

interface SelectionItem {
  id: string;
  label: string;
  description?: string | null;
  icon?: string | null;
  group: string;
  meta?: string | null;
}

const BADGE_COLORS = [
  { value: 'yellow', label: 'Amarelo' },
  { value: 'green', label: 'Verde' },
  { value: 'blue', label: 'Azul' },
  { value: 'purple', label: 'Roxo' },
  { value: 'orange', label: 'Laranja' },
  { value: 'red', label: 'Vermelho' },
] as const;

const NO_BADGE_COLOR = '__sem_cor__';

const LINE_TONES: Record<string, { accent: string; soft: string }> = {
  blue: { accent: '217 91% 60%', soft: '217 91% 60% / 0.12' },
  green: { accent: '142 71% 45%', soft: '142 71% 45% / 0.12' },
  orange: { accent: '24 95% 53%', soft: '24 95% 53% / 0.12' },
  purple: { accent: '271 91% 65%', soft: '271 91% 65% / 0.12' },
  red: { accent: '0 84% 60%', soft: '0 84% 60% / 0.12' },
};

const BADGE_TONES: Record<string, { background: string; border: string; text: string }> = {
  yellow: { background: '45 93% 47% / 0.14', border: '45 93% 47% / 0.32', text: '45 93% 62%' },
  green: { background: '142 71% 45% / 0.14', border: '142 71% 45% / 0.32', text: '142 71% 58%' },
  blue: { background: '217 91% 60% / 0.14', border: '217 91% 60% / 0.32', text: '217 91% 70%' },
  purple: { background: '271 91% 65% / 0.14', border: '271 91% 65% / 0.32', text: '271 91% 76%' },
  orange: { background: '24 95% 53% / 0.14', border: '24 95% 53% / 0.32', text: '24 95% 68%' },
  red: { background: '0 84% 60% / 0.14', border: '0 84% 60% / 0.32', text: '0 84% 72%' },
};

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function createEmptyFormData(defaultProductLineId?: string): PlanFormData {
  return {
    name: '',
    slug: '',
    product_line_id: defaultProductLineId || '',
    badge_text: '',
    badge_color: '',
    restriction_alert: '',
    footer_note: '',
    display_order: '0',
    is_active: true,
  };
}

function mapPlanToState(planData: any, defaultProductLineId?: string) {
  return {
    formData: {
      name: planData?.nome || '',
      slug: planData?.slug || '',
      product_line_id: planData?.product_line_id || defaultProductLineId || '',
      badge_text: planData?.badge_text || '',
      badge_color: planData?.badge_color || '',
      restriction_alert: planData?.restriction_alert || '',
      footer_note: planData?.footer_note || '',
      display_order: (planData?.ordem || 0).toString(),
      is_active: planData?.ativo ?? true,
    } satisfies PlanFormData,
    selectedBenefits: ((planData?.planos_beneficios || []) as any[]).map((pb, index) => ({
      benefit_id: pb.benefit_id,
      custom_text: pb.custom_text,
      custom_value: pb.custom_value,
      additional_info: pb.additional_info,
      is_highlighted: pb.is_highlighted ?? false,
      display_order: pb.display_order ?? index,
    })),
    selectedCoberturas: ((planData?.planos_coberturas || []) as any[]).map((pc) => ({
      cobertura_id: pc.cobertura_id,
    })),
  };
}

function SearchableSelectionSection({
  title,
  description,
  icon: Icon,
  searchValue,
  onSearchChange,
  groups,
  selectedIds,
  onToggle,
  emptyMessage,
}: {
  title: string;
  description: string;
  icon: typeof Shield;
  searchValue: string;
  onSearchChange: (value: string) => void;
  groups: Array<[string, SelectionItem[]]>;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  emptyMessage: string;
}) {
  const selectedCount = selectedIds.size;

  return (
    <section className="space-y-4 rounded-3xl border border-border/60 bg-card/60 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <Badge variant="secondary" className="text-[11px]">
              {selectedCount} selecionado{selectedCount === 1 ? '' : 's'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar..."
            className="pl-9"
          />
        </div>
      </div>

      <ScrollArea className="h-[320px] rounded-2xl border border-border/50 bg-background/40">
        <div className="space-y-4 p-3">
          {groups.length > 0 ? (
            groups.map(([groupName, items]) => (
              <div key={groupName} className="space-y-2">
                <div className="sticky top-0 z-10 bg-background/95 px-1 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-sm">
                  {groupName}
                </div>

                <div className="space-y-2">
                  {items.map((item) => {
                    const selected = selectedIds.has(item.id);

                    return (
                      <div
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onToggle(item.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(item.id); } }}
                        className={cn(
                          'flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-all cursor-pointer',
                          selected
                            ? 'border-primary/40 bg-primary/10 shadow-sm'
                            : 'border-border/60 bg-card/60 hover:border-primary/20 hover:bg-accent/40',
                        )}
                      >
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() => onToggle(item.id)}
                          onClick={(event) => event.stopPropagation()}
                          className="mt-0.5"
                        />

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            {item.icon ? <span className="text-base leading-none">{item.icon}</span> : null}
                            <span className="text-sm font-medium text-foreground">{item.label}</span>
                          </div>

                          {item.description ? (
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                          ) : null}

                          {item.meta ? (
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground/80">{item.meta}</p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="flex h-[260px] items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card/40 px-6 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          )}
        </div>
      </ScrollArea>
    </section>
  );
}

export function PlanFormModal({
  open,
  onOpenChange,
  plan,
  defaultProductLineId,
}: PlanFormModalProps) {
  const planId = plan?.id ?? null;
  const isEditing = !!planId;

  const { data: productLines = [], isLoading: loadingProductLines } = useProductLines();
  const { data: benefits = [] } = useBenefits();
  const { data: coberturasCatalogo = [] } = useCoberturas();
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();

  const { data: fullPlanData, isLoading: loadingPlan } = useQuery({
    queryKey: ['plan-form-modal-full', planId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos')
        .select(`
          *,
          product_lines(*),
          planos_beneficios(*, benefits:benefit_id(*)),
          planos_coberturas(*, coberturas:cobertura_id(*))
        `)
        .eq('id', planId!)
        .single();

      if (error) throw error;
      return data as any;
    },
    enabled: open && !!planId,
  });

  const [formData, setFormData] = useState<PlanFormData>(() => createEmptyFormData(defaultProductLineId));
  const [selectedBenefits, setSelectedBenefits] = useState<PlanBenefitInput[]>([]);
  const [selectedCoberturas, setSelectedCoberturas] = useState<{ cobertura_id: string }[]>([]);
  const [benefitsSearch, setBenefitsSearch] = useState('');
  const [coberturasSearch, setCoberturasSearch] = useState('');
  const hydratedStateKeyRef = useRef('');

  const hydrationKey = useMemo(() => {
    if (!open) return '';
    if (!planId) return `new:${defaultProductLineId ?? ''}`;
    if (!fullPlanData) return `loading:${planId}`;
    return `${planId}:${fullPlanData.updated_at ?? fullPlanData.id}`;
  }, [open, planId, fullPlanData?.id, fullPlanData?.updated_at, defaultProductLineId]);

  useEffect(() => {
    if (!open) {
      hydratedStateKeyRef.current = '';
      return;
    }

    if (planId) {
      if (!fullPlanData || hydrationKey.startsWith('loading:')) return;
      if (hydratedStateKeyRef.current === hydrationKey) return;

      const nextState = mapPlanToState(fullPlanData, defaultProductLineId);
      setFormData(nextState.formData);
      setSelectedBenefits(nextState.selectedBenefits);
      setSelectedCoberturas(nextState.selectedCoberturas);
      hydratedStateKeyRef.current = hydrationKey;
      return;
    }

    if (hydratedStateKeyRef.current === hydrationKey) return;

    setFormData(createEmptyFormData(defaultProductLineId));
    setSelectedBenefits([]);
    setSelectedCoberturas([]);
    hydratedStateKeyRef.current = hydrationKey;
  }, [open, planId, hydrationKey, defaultProductLineId, fullPlanData?.id, fullPlanData?.updated_at]);

  const selectedBenefitIds = useMemo(
    () => new Set(selectedBenefits.map((benefit) => benefit.benefit_id)),
    [selectedBenefits],
  );

  const selectedCoberturaIds = useMemo(
    () => new Set(selectedCoberturas.map((cobertura) => cobertura.cobertura_id)),
    [selectedCoberturas],
  );

  const filteredBenefits = useMemo(() => {
    const search = benefitsSearch.trim().toLowerCase();

    return benefits
      .filter((benefit) => {
        if (!search) return true;
        return [benefit.name, benefit.category, benefit.description]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(search));
      })
      .map((benefit) => ({
        id: benefit.id,
        label: benefit.name,
        description: benefit.description,
        icon: benefit.icon,
        group: benefit.category || 'Outros',
      })) as SelectionItem[];
  }, [benefits, benefitsSearch]);

  const filteredCoberturas = useMemo(() => {
    const search = coberturasSearch.trim().toLowerCase();

    return coberturasCatalogo
      .filter((cobertura) => {
        if (!search) return true;
        return [cobertura.nome, cobertura.subtitle, cobertura.tipo, cobertura.codigo]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(search));
      })
      .map((cobertura) => ({
        id: cobertura.id,
        label: cobertura.nome,
        description: cobertura.subtitle,
        icon: cobertura.icon,
        group: cobertura.tipo || 'Coberturas',
        meta: cobertura.codigo || null,
      })) as SelectionItem[];
  }, [coberturasCatalogo, coberturasSearch]);

  const groupedBenefits = useMemo(() => {
    const groups = filteredBenefits.reduce<Record<string, SelectionItem[]>>((accumulator, benefit) => {
      if (!accumulator[benefit.group]) accumulator[benefit.group] = [];
      accumulator[benefit.group].push(benefit);
      return accumulator;
    }, {});

    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredBenefits]);

  const groupedCoberturas = useMemo(() => {
    const groups = filteredCoberturas.reduce<Record<string, SelectionItem[]>>((accumulator, cobertura) => {
      if (!accumulator[cobertura.group]) accumulator[cobertura.group] = [];
      accumulator[cobertura.group].push(cobertura);
      return accumulator;
    }, {});

    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredCoberturas]);

  const productLineOptions = useMemo(() => {
    const currentLine = fullPlanData?.product_lines;

    if (!currentLine?.id) return productLines;
    if (productLines.some((line) => line.id === currentLine.id)) return productLines;

    return [currentLine, ...productLines];
  }, [productLines, fullPlanData?.product_lines]);

  const safeProductLineValue = useMemo(() => {
    if (!formData.product_line_id) return undefined;
    return productLineOptions.some((line) => line.id === formData.product_line_id)
      ? formData.product_line_id
      : undefined;
  }, [formData.product_line_id, productLineOptions]);

  const safeBadgeColorValue = useMemo(() => {
    if (!formData.badge_color) return NO_BADGE_COLOR;
    return BADGE_COLORS.some((color) => color.value === formData.badge_color)
      ? formData.badge_color
      : NO_BADGE_COLOR;
  }, [formData.badge_color]);

  const canRenderEditingForm = !isEditing || (
    !!fullPlanData &&
    hydratedStateKeyRef.current === hydrationKey &&
    !loadingProductLines &&
    (!formData.product_line_id || !!safeProductLineValue)
  );

  const selectedLine = productLineOptions.find((line) => line.id === formData.product_line_id) || null;
  const selectedLineTone = LINE_TONES[selectedLine?.color || 'blue'] || LINE_TONES.blue;
  const selectedBadgeTone = formData.badge_color ? BADGE_TONES[formData.badge_color] : null;

  const selectedBenefitsPreview = useMemo(
    () => benefits.filter((benefit) => selectedBenefitIds.has(benefit.id)).slice(0, 4),
    [benefits, selectedBenefitIds],
  );

  const selectedCoberturasPreview = useMemo(
    () => coberturasCatalogo.filter((cobertura) => selectedCoberturaIds.has(cobertura.id)).slice(0, 4),
    [coberturasCatalogo, selectedCoberturaIds],
  );

  const handleNameChange = (name: string) => {
    setFormData((previous) => ({
      ...previous,
      name,
      slug: isEditing ? previous.slug : generateSlug(name),
    }));
  };

  const toggleBenefit = (benefitId: string) => {
    setSelectedBenefits((previous) => {
      const existing = previous.find((benefit) => benefit.benefit_id === benefitId);
      if (existing) {
        return previous.filter((benefit) => benefit.benefit_id !== benefitId);
      }

      return [
        ...previous,
        {
          benefit_id: benefitId,
          custom_text: null,
          custom_value: null,
          additional_info: null,
          is_highlighted: false,
          display_order: previous.length,
        },
      ];
    });
  };

  const toggleCobertura = (coberturaId: string) => {
    setSelectedCoberturas((previous) => {
      if (previous.some((cobertura) => cobertura.cobertura_id === coberturaId)) {
        return previous.filter((cobertura) => cobertura.cobertura_id !== coberturaId);
      }

      return [...previous, { cobertura_id: coberturaId }];
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const payload = {
      name: formData.name,
      slug: formData.slug,
      product_line_id: formData.product_line_id,
      badge_text: formData.badge_text || null,
      badge_color: formData.badge_color || null,
      restriction_alert: formData.restriction_alert || null,
      footer_note: formData.footer_note || null,
      display_order: parseInt(formData.display_order, 10) || 0,
      is_active: formData.is_active,
      benefits: selectedBenefits,
      coberturas: selectedCoberturas,
    };

    try {
      if (isEditing && planId) {
        await updatePlan.mutateAsync({ id: planId, ...payload });
      } else {
        await createPlan.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch {
      // handled by mutation hooks
    }
  };

  const isPending = createPlan.isPending || updatePlan.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[92vh] max-w-7xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-left">
            <Sparkles className="h-5 w-5 text-primary" />
            {isEditing ? 'Editar Plano' : 'Novo Plano'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid h-[calc(92vh-77px)] min-h-0 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="relative min-h-0 border-b border-border/60 xl:border-b-0 xl:border-r xl:border-r-border/60">
            {isEditing && (!fullPlanData || !canRenderEditingForm) && (
              <div className="absolute inset-0 z-20 flex items-center justify-center gap-3 bg-background/80 text-sm text-muted-foreground backdrop-blur-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando dados do plano...
              </div>
            )}
            {canRenderEditingForm && (
              <form onSubmit={handleSubmit} className="flex h-full min-h-0 flex-col">
                <ScrollArea className="min-h-0 flex-1 px-6">
                  <div className="space-y-6 pb-6 pt-6">
                    <section className="space-y-4 rounded-3xl border border-border/60 bg-card/60 p-4 sm:p-5">
                      <div className="space-y-1">
                        <h3 className="text-sm font-semibold text-foreground">Informações principais</h3>
                        <p className="text-xs text-muted-foreground">Identidade visual e ordenação do plano na gestão comercial.</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="plan-name">Nome</Label>
                        <Input
                          id="plan-name"
                          value={formData.name}
                          onChange={(event) => handleNameChange(event.target.value)}
                          placeholder="Ex: Plano Essencial"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="plan-slug">Slug</Label>
                        <Input
                          id="plan-slug"
                          value={formData.slug}
                          onChange={(event) => setFormData((previous) => ({ ...previous, slug: event.target.value }))}
                          placeholder="plano-essencial"
                          disabled={isEditing}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="plan-product-line">Linha de Produto</Label>
                        <Select
                          value={safeProductLineValue}
                          onValueChange={(value) => setFormData((previous) => ({ ...previous, product_line_id: value }))}
                        >
                          <SelectTrigger id="plan-product-line">
                            <SelectValue placeholder="Selecione uma linha" />
                          </SelectTrigger>
                          <SelectContent>
                            {productLineOptions.map((line) => (
                              <SelectItem key={line.id} value={line.id}>
                                {line.icon ? `${line.icon} ` : ''}{line.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="plan-badge">Badge</Label>
                          <Input
                            id="plan-badge"
                            value={formData.badge_text}
                            onChange={(event) => setFormData((previous) => ({ ...previous, badge_text: event.target.value }))}
                            placeholder="Ex: Mais vendido"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="plan-badge-color">Cor do Badge</Label>
                          <Select
                            value={safeBadgeColorValue}
                            onValueChange={(value) => setFormData((previous) => ({
                              ...previous,
                              badge_color: value === NO_BADGE_COLOR ? '' : value,
                            }))}
                          >
                            <SelectTrigger id="plan-badge-color">
                              <SelectValue placeholder="Selecione uma cor" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NO_BADGE_COLOR}>Sem cor</SelectItem>
                              {BADGE_COLORS.map((color) => (
                                <SelectItem key={color.value} value={color.value}>
                                  {color.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-[auto_220px] md:items-end">
                        <div className="flex min-h-10 items-center justify-between rounded-2xl border border-border/60 bg-background/50 px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">Ativo</p>
                            <p className="text-xs text-muted-foreground">Controla a visibilidade operacional do plano.</p>
                          </div>
                          <Switch
                            checked={formData.is_active}
                            onCheckedChange={(checked) => setFormData((previous) => ({ ...previous, is_active: checked }))}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="plan-order">Ordem de Exibição</Label>
                          <Input
                            id="plan-order"
                            type="number"
                            value={formData.display_order}
                            onChange={(event) => setFormData((previous) => ({ ...previous, display_order: event.target.value }))}
                          />
                        </div>
                      </div>
                    </section>

                    <SearchableSelectionSection
                      title="Coberturas"
                      description="Selecione as coberturas vinculadas ao plano."
                      icon={Shield}
                      searchValue={coberturasSearch}
                      onSearchChange={setCoberturasSearch}
                      groups={groupedCoberturas}
                      selectedIds={selectedCoberturaIds}
                      onToggle={toggleCobertura}
                      emptyMessage="Nenhuma cobertura encontrada para o filtro informado."
                    />

                    <SearchableSelectionSection
                      title="Benefícios"
                      description="Selecione os benefícios vinculados ao plano."
                      icon={Sparkles}
                      searchValue={benefitsSearch}
                      onSearchChange={setBenefitsSearch}
                      groups={groupedBenefits}
                      selectedIds={selectedBenefitIds}
                      onToggle={toggleBenefit}
                      emptyMessage="Nenhum benefício encontrado para o filtro informado."
                    />

                  </div>
                </ScrollArea>

                <div className="flex items-center justify-end gap-2 border-t border-border/60 px-6 py-4">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isPending || !formData.product_line_id}>
                    {isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : isEditing ? 'Salvar Plano' : 'Criar Plano'}
                  </Button>
                </div>
              </form>
            )}
          </div>

          <aside className="hidden min-h-0 bg-muted/20 xl:block">
            <ScrollArea className="h-full px-5 py-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Eye className="h-4 w-4 text-primary" />
                  Preview do card
                </div>

                <div
                  className="overflow-hidden rounded-[28px] border bg-card shadow-sm"
                  style={{
                    borderColor: `hsl(${selectedLineTone.accent} / 0.28)`,
                    backgroundImage: `linear-gradient(180deg, hsl(${selectedLineTone.soft}), transparent 42%)`,
                  }}
                >
                  <div className="h-1.5 w-full" style={{ backgroundColor: `hsl(${selectedLineTone.accent})` }} />

                  <div className="space-y-5 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          <span>{selectedLine?.icon || '📦'}</span>
                          <span>{selectedLine?.name || 'Linha de produto'}</span>
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-lg font-semibold text-foreground">
                            {formData.name || 'Nome do plano'}
                          </h4>
                          <p className="text-xs text-muted-foreground">/{formData.slug || 'slug-do-plano'}</p>
                        </div>
                      </div>

                      <Badge variant={formData.is_active ? 'default' : 'secondary'}>
                        {formData.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>

                    {formData.badge_text ? (
                      <div>
                        <Badge
                          className="border"
                          style={selectedBadgeTone ? {
                            backgroundColor: `hsl(${selectedBadgeTone.background})`,
                            borderColor: `hsl(${selectedBadgeTone.border})`,
                            color: `hsl(${selectedBadgeTone.text})`,
                          } : undefined}
                        >
                          {formData.badge_text}
                        </Badge>
                      </div>
                    ) : null}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Coberturas</p>
                        <p className="mt-1 text-xl font-semibold text-foreground">{selectedCoberturas.length}</p>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Benefícios</p>
                        <p className="mt-1 text-xl font-semibold text-foreground">{selectedBenefits.length}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Coberturas em destaque</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedCoberturasPreview.length > 0 ? (
                            <>
                              {selectedCoberturasPreview.map((cobertura) => (
                                <Badge key={cobertura.id} variant="outline" className="max-w-full truncate">
                                  {cobertura.nome}
                                </Badge>
                              ))}
                              {selectedCoberturas.length > selectedCoberturasPreview.length ? (
                                <Badge variant="secondary">+{selectedCoberturas.length - selectedCoberturasPreview.length}</Badge>
                              ) : null}
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground">Nenhuma cobertura vinculada.</p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Benefícios em destaque</p>
                        <div className="space-y-2">
                          {selectedBenefitsPreview.length > 0 ? (
                            <>
                              {selectedBenefitsPreview.map((benefit) => (
                                <div key={benefit.id} className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-3 py-2 text-sm">
                                  <span className="text-base leading-none">{benefit.icon || '✨'}</span>
                                  <span className="truncate text-foreground">{benefit.name}</span>
                                </div>
                              ))}
                              {selectedBenefits.length > selectedBenefitsPreview.length ? (
                                <p className="text-xs text-muted-foreground">+{selectedBenefits.length - selectedBenefitsPreview.length} benefício(s) adicional(is)</p>
                              ) : null}
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground">Nenhum benefício vinculado.</p>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </ScrollArea>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
