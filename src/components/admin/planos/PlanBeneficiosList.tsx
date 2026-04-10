import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Plus, Save, Trash2, Loader2, Sparkles, Link2, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useCreateBenefit, useUpdateBenefit, useDeleteBenefit } from '@/hooks/usePlansAdmin';
import { EligibilityRulesEditor } from './EligibilityRulesEditor';
import { CarenciaConfigSection } from './CarenciaConfigSection';
import { toast } from 'sonner';

const CATEGORIES = [
  { value: 'assistencia', label: 'Assistência' },
  { value: 'cobertura', label: 'Cobertura' },
  { value: 'protecao', label: 'Proteção' },
  { value: 'servico', label: 'Serviço' },
  { value: 'beneficio', label: 'Benefício' },
  { value: 'outros', label: 'Outros' },
];

interface PlanBeneficiosListProps {
  planId: string;
  focusItemId?: string;
}

function BeneficioInlineForm({ benefit, onSaved }: { benefit: any; onSaved: () => void }) {
  const updateBenefit = useUpdateBenefit();
  const formatCurrency = (v: number | null | undefined) => {
    if (v == null) return '—';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  };

  const [form, setForm] = useState({
    name: benefit.name || '',
    slug: benefit.slug || '',
    icon: benefit.icon || '',
    description: benefit.description || '',
    category: benefit.category || '',
    display_order: benefit.display_order?.toString() || '0',
    carencia_ativa: benefit.carencia_ativa ?? false,
    carencia_tipo: benefit.carencia_tipo || '',
    carencia_dias: benefit.carencia_dias?.toString() || '',
    carencia_multiplicador: benefit.carencia_multiplicador?.toString() || '',
    is_active: benefit.is_active ?? true,
  });

  const handleSave = async () => {
    const payload = {
      id: benefit.id,
      name: form.name,
      slug: form.slug,
      icon: form.icon || null,
      description: form.description || null,
      category: form.category || null,
      display_order: parseInt(form.display_order) || 0,
      carencia_dias: form.carencia_dias ? parseInt(form.carencia_dias) : null,
      carencia_ativa: form.carencia_ativa,
      carencia_tipo: form.carencia_ativa ? form.carencia_tipo || null : null,
      carencia_multiplicador: form.carencia_tipo === 'multiplicadora_cota' && form.carencia_multiplicador
        ? parseFloat(form.carencia_multiplicador) : null,
      is_active: form.is_active,
    };

    try {
      await updateBenefit.mutateAsync(payload);
      onSaved();
    } catch {}
  };

  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-[60px_1fr] gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Ícone</Label>
          <Input value={form.icon} onChange={(e) => setForm(p => ({ ...p, icon: e.target.value }))} placeholder="🚗" className="text-center text-xl h-10" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Nome</Label>
          <Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Slug</Label>
          <Input value={form.slug} onChange={(e) => setForm(p => ({ ...p, slug: e.target.value }))} className="font-mono text-xs" disabled />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Categoria</Label>
          <Select value={form.category} onValueChange={(v) => setForm(p => ({ ...p, category: v }))}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Descrição</Label>
        <Textarea value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} rows={2} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Preço Sugerido (R$)</Label>
          <div className="rounded-md bg-muted px-3 py-2 text-sm">{formatCurrency(benefit.preco_sugerido)}</div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Ordem</Label>
          <Input type="number" value={form.display_order} onChange={(e) => setForm(p => ({ ...p, display_order: e.target.value }))} />
        </div>
        <div className="flex items-center gap-2 pt-5">
          <Switch checked={form.is_active} onCheckedChange={(v) => setForm(p => ({ ...p, is_active: v }))} />
          <Label className="text-xs">Ativo</Label>
        </div>
      </div>

      <CarenciaConfigSection
        config={{
          carencia_ativa: form.carencia_ativa,
          carencia_tipo: form.carencia_tipo,
          carencia_dias: form.carencia_dias,
          carencia_multiplicador: form.carencia_multiplicador,
        }}
        onChange={(c) => setForm(p => ({ ...p, ...c }))}
      />

      <div className="border-t pt-3">
        <EligibilityRulesEditor entityType="beneficio" entityId={benefit.id} />
      </div>

      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={handleSave} disabled={updateBenefit.isPending}>
          {updateBenefit.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
          Salvar Benefício
        </Button>
      </div>
    </div>
  );
}

export function PlanBeneficiosList({ planId, focusItemId }: PlanBeneficiosListProps) {
  const queryClient = useQueryClient();
  const deleteBenefit = useDeleteBenefit();
  const createBenefit = useCreateBenefit();
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState({ name: '', icon: '' });
  const focusRef = useRef<HTMLDivElement>(null);
  const hasFocused = useRef(false);

  // Assign existing states
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignSelected, setAssignSelected] = useState<Set<string>>(new Set());
  const [assignSearch, setAssignSearch] = useState('');
  const [assigning, setAssigning] = useState(false);

  const { data: benefits = [], isLoading } = useQuery({
    queryKey: ['plan-benefits-inline', planId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos_beneficios')
        .select('*, benefits:benefit_id(*)')
        .eq('plano_id', planId)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data || []).map((pb: any) => pb.benefits).filter(Boolean);
    },
    enabled: !!planId,
  });

  // Query all available benefits for assignment dialog
  const { data: beneficiosDisponiveis = [], isLoading: loadingDisponiveis } = useQuery({
    queryKey: ['beneficios-disponiveis-all', planId],
    queryFn: async () => {
      // Get all active benefits
      const { data: allBenefits, error: bErr } = await supabase
        .from('benefits')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (bErr) throw bErr;

      // Get all existing bindings with plan names
      const { data: allBindings, error: vErr } = await supabase
        .from('planos_beneficios')
        .select('benefit_id, planos:plano_id(nome)');
      if (vErr) throw vErr;

      // Build a map: benefit_id -> binding info
      const vinculoMap = new Map<string, any>();
      (allBindings || []).forEach((v: any) => {
        vinculoMap.set(v.benefit_id, v);
      });

      // Exclude benefits already assigned to ANY plan
      const assignedIds = new Set(Array.from(vinculoMap.keys()));
      return (allBenefits || [])
        .filter((b: any) => !assignedIds.has(b.id));
    },
    enabled: assignOpen,
  });

  const filteredDisponiveis = beneficiosDisponiveis.filter((b: any) =>
    b.name.toLowerCase().includes(assignSearch.toLowerCase())
  );

  const handleAssign = async () => {
    if (assignSelected.size === 0) return;
    setAssigning(true);
    try {
      const selectedIds = Array.from(assignSelected);

      // Insert new bindings
      const inserts = selectedIds.map((benefitId) => ({
        plano_id: planId,
        benefit_id: benefitId,
        beneficio: beneficiosDisponiveis.find((b: any) => b.id === benefitId)?.name || '',
      }));
      const { error } = await supabase.from('planos_beneficios').insert(inserts);
      if (error) throw error;

      toast.success(`${assignSelected.size} benefício(s) vinculado(s) com sucesso`);
      setAssignOpen(false);
      setAssignSelected(new Set());
      setAssignSearch('');
      invalidate();
    } catch {
      toast.error('Erro ao vincular benefícios');
    } finally {
      setAssigning(false);
    }
  };

  const toggleAssignItem = (id: string) => {
    setAssignSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  useEffect(() => {
    if (focusItemId && benefits.length > 0 && !hasFocused.current) {
      const match = benefits.find((b: any) => b.id === focusItemId);
      if (match) {
        setOpenItems(new Set([focusItemId]));
        hasFocused.current = true;
        setTimeout(() => {
          focusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
      }
    }
  }, [focusItemId, benefits]);

  const toggleItem = (id: string) => {
    setOpenItems(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDelete = async (benefitId: string) => {
    if (!confirm('Excluir este benefício do plano? Esta ação é irreversível.')) return;
    try {
      await supabase.from('planos_beneficios').delete().eq('plano_id', planId).eq('benefit_id', benefitId);
      await deleteBenefit.mutateAsync(benefitId);
      queryClient.invalidateQueries({ queryKey: ['plan-benefits-inline', planId] });
    } catch {
      toast.error('Erro ao excluir benefício');
    }
  };

  const generateSlug = (name: string) => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const handleCreate = async () => {
    if (!newForm.name.trim()) return;
    try {
      const result = await createBenefit.mutateAsync({
        name: newForm.name,
        slug: generateSlug(newForm.name),
        icon: newForm.icon || null,
        is_active: true,
        display_order: benefits.length,
      });
      if (result?.id) {
        await supabase.from('planos_beneficios').insert([{
          plano_id: planId,
          benefit_id: result.id,
          beneficio: result.name || '',
          display_order: benefits.length,
        }]);
      }
      setNewForm({ name: '', icon: '' });
      setCreating(false);
      queryClient.invalidateQueries({ queryKey: ['plan-benefits-inline', planId] });
    } catch {
      toast.error('Erro ao criar benefício');
    }
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['plan-benefits-inline', planId] });
    queryClient.invalidateQueries({ queryKey: ['plan-form-modal-full', planId] });
    queryClient.invalidateQueries({ queryKey: ['beneficios-disponiveis-all', planId] });
  };

  return (
    <section className="space-y-3 rounded-3xl border border-border/60 bg-card/60 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Benefícios</h3>
          <Badge variant="secondary" className="text-[11px]">{benefits.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => { setAssignOpen(true); setAssignSelected(new Set()); setAssignSearch(''); }}>
            <Link2 className="mr-1 h-3 w-3" /> Atribuir Existente
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setCreating(true)}>
            <Plus className="mr-1 h-3 w-3" /> Novo Benefício
          </Button>
        </div>
      </div>

      {/* Dialog de atribuição de benefícios existentes */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md max-h-[80vh]" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Atribuir Benefícios Existentes</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar benefício..."
                value={assignSearch}
                onChange={(e) => setAssignSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="max-h-[40vh] overflow-y-auto space-y-1 border rounded-lg p-2">
              {loadingDisponiveis ? (
                <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
                </div>
              ) : filteredDisponiveis.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum benefício disponível para atribuição.
                </div>
              ) : (
                filteredDisponiveis.map((ben: any) => (
                  <label
                    key={ben.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
                  >
                    <Checkbox
                      checked={assignSelected.has(ben.id)}
                      onCheckedChange={() => toggleAssignItem(ben.id)}
                    />
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {ben.icon && <span className="text-base">{ben.icon}</span>}
                      <span className="text-sm truncate">{ben.name}</span>
                    </div>
                    {ben.vinculadoAo && (
                      <Badge variant="outline" className="text-[10px] shrink-0 bg-muted text-muted-foreground">
                        {(ben.vinculadoAo as any).planos?.nome || 'Outro plano'}
                      </Badge>
                    )}
                  </label>
                ))
              )}
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">
                {assignSelected.size} selecionado(s)
              </span>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => setAssignOpen(false)}>
                  Cancelar
                </Button>
                <Button type="button" size="sm" onClick={handleAssign} disabled={assignSelected.size === 0 || assigning}>
                  {assigning ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Link2 className="mr-1 h-3 w-3" />}
                  Vincular Selecionados
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {creating && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 space-y-3">
          <div className="grid grid-cols-[60px_1fr] gap-2">
            <Input value={newForm.icon} onChange={(e) => setNewForm(p => ({ ...p, icon: e.target.value }))} placeholder="🚗" className="text-center text-xl" />
            <Input value={newForm.name} onChange={(e) => setNewForm(p => ({ ...p, name: e.target.value }))} placeholder="Nome do benefício" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button type="button" size="sm" onClick={handleCreate} disabled={createBenefit.isPending}>
              {createBenefit.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              Criar e Vincular
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : benefits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 px-6 py-8 text-center text-sm text-muted-foreground">
          Nenhum benefício vinculado a este plano.
        </div>
      ) : (
        <div className="space-y-2">
          {benefits.map((ben: any) => (
            <Collapsible key={ben.id} open={openItems.has(ben.id)} onOpenChange={() => toggleItem(ben.id)}>
              <div ref={ben.id === focusItemId ? focusRef : undefined} className={cn(
                'rounded-2xl border transition-all',
                openItems.has(ben.id) ? 'border-primary/40 bg-primary/5' : 'border-border/60 bg-card/60'
              )}>
                <CollapsibleTrigger asChild>
                  <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-left">
                    <div className="flex items-center gap-2 min-w-0">
                      {ben.icon && <span className="text-base">{ben.icon}</span>}
                      <span className="text-sm font-medium truncate">{ben.name}</span>
                      {ben.category && <Badge variant="outline" className="text-[10px]">{ben.category}</Badge>}
                      {!ben.is_active && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); handleDelete(ben.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', openItems.has(ben.id) && 'rotate-180')} />
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t border-border/40">
                    <BeneficioInlineForm benefit={ben} onSaved={invalidate} />
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </div>
      )}
    </section>
  );
}
