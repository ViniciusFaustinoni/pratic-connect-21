import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Plus, Save, Trash2, Loader2 } from 'lucide-react';
import { Shield } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useCreateCobertura, useUpdateCobertura, useDeleteCobertura } from '@/hooks/usePlansAdmin';
import { EligibilityRulesEditor } from './EligibilityRulesEditor';
import { CarenciaConfigSection } from './CarenciaConfigSection';
import { toast } from 'sonner';

interface PlanCoberturasListProps {
  planId: string;
}

function CoberturaInlineForm({ cobertura, onSaved }: { cobertura: any; onSaved: () => void }) {
  const updateCobertura = useUpdateCobertura();
  const [form, setForm] = useState({
    nome: cobertura.nome || '',
    codigo: cobertura.codigo || '',
    descricao: cobertura.descricao || '',
    icon: cobertura.icon || '',
    subtitle: cobertura.subtitle || '',
    display_order: cobertura.display_order?.toString() || '0',
    carencia_ativa: cobertura.carencia_ativa ?? false,
    carencia_tipo: cobertura.carencia_tipo || '',
    carencia_dias: cobertura.carencia_dias?.toString() || '',
    carencia_multiplicador: cobertura.carencia_multiplicador?.toString() || '',
    ativo: cobertura.ativo ?? true,
  });

  const formatCurrency = (v: number | null | undefined) => {
    if (v == null) return '—';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  };
  const formatPercent = (v: number | null | undefined) => {
    if (v == null) return '—';
    return `${v}%`;
  };

  const handleSave = async () => {
    const payload = {
      id: cobertura.id,
      nome: form.nome,
      codigo: form.codigo || undefined,
      descricao: form.descricao || null,
      icon: form.icon || null,
      subtitle: form.subtitle || null,
      display_order: parseInt(form.display_order) || 0,
      carencia_dias: form.carencia_dias ? parseInt(form.carencia_dias) : null,
      carencia_ativa: form.carencia_ativa,
      carencia_tipo: form.carencia_ativa ? form.carencia_tipo || null : null,
      carencia_multiplicador: form.carencia_tipo === 'multiplicadora_cota' && form.carencia_multiplicador
        ? parseFloat(form.carencia_multiplicador) : null,
      ativo: form.ativo,
    };

    try {
      await updateCobertura.mutateAsync(payload);
      onSaved();
    } catch {}
  };

  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-[60px_1fr] gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Ícone</Label>
          <Input value={form.icon} onChange={(e) => setForm(p => ({ ...p, icon: e.target.value }))} placeholder="🛡️" className="text-center text-xl h-10" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Nome</Label>
          <Input value={form.nome} onChange={(e) => setForm(p => ({ ...p, nome: e.target.value }))} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Código</Label>
          <Input value={form.codigo} onChange={(e) => setForm(p => ({ ...p, codigo: e.target.value }))} className="font-mono text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Subtítulo</Label>
          <Input value={form.subtitle} onChange={(e) => setForm(p => ({ ...p, subtitle: e.target.value }))} />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Descrição</Label>
        <Textarea value={form.descricao} onChange={(e) => setForm(p => ({ ...p, descricao: e.target.value }))} rows={2} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
          <div className="rounded-md bg-muted px-3 py-2 text-sm">{formatCurrency(cobertura.valor)}</div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Valor Limite (R$)</Label>
          <div className="rounded-md bg-muted px-3 py-2 text-sm">{formatCurrency(cobertura.valor_limite)}</div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">% Cobertura</Label>
          <div className="rounded-md bg-muted px-3 py-2 text-sm">{formatPercent(cobertura.percentual_cobertura)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Franquia (%)</Label>
          <div className="rounded-md bg-muted px-3 py-2 text-sm">{formatPercent(cobertura.franquia_percentual)}</div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Franquia (R$)</Label>
          <div className="rounded-md bg-muted px-3 py-2 text-sm">{formatCurrency(cobertura.franquia_valor)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Ordem</Label>
          <Input type="number" value={form.display_order} onChange={(e) => setForm(p => ({ ...p, display_order: e.target.value }))} />
        </div>
        <div className="flex items-center gap-2 pt-5">
          <Switch checked={form.ativo} onCheckedChange={(v) => setForm(p => ({ ...p, ativo: v }))} />
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
        <EligibilityRulesEditor entityType="cobertura" entityId={cobertura.id} />
      </div>

      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={handleSave} disabled={updateCobertura.isPending}>
          {updateCobertura.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
          Salvar Cobertura
        </Button>
      </div>
    </div>
  );
}

export function PlanCoberturasList({ planId }: PlanCoberturasListProps) {
  const queryClient = useQueryClient();
  const deleteCobertura = useDeleteCobertura();
  const createCobertura = useCreateCobertura();
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState({ nome: '', icon: '' });

  const { data: coberturas = [], isLoading } = useQuery({
    queryKey: ['plan-coberturas-inline', planId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos_coberturas')
        .select('*, coberturas:cobertura_id(*)')
        .eq('plano_id', planId)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data || []).map((pc: any) => pc.coberturas).filter(Boolean);
    },
    enabled: !!planId,
  });

  const toggleItem = (id: string) => {
    setOpenItems(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDelete = async (coberturaId: string) => {
    if (!confirm('Excluir esta cobertura do plano? Esta ação é irreversível.')) return;
    try {
      // Remove link first
      await supabase.from('planos_coberturas').delete().eq('plano_id', planId).eq('cobertura_id', coberturaId);
      // Delete the coverage itself (it's unique to this plan)
      await deleteCobertura.mutateAsync(coberturaId);
      queryClient.invalidateQueries({ queryKey: ['plan-coberturas-inline', planId] });
    } catch {
      toast.error('Erro ao excluir cobertura');
    }
  };

  const handleCreate = async () => {
    if (!newForm.nome.trim()) return;
    try {
      const result = await createCobertura.mutateAsync({
        nome: newForm.nome,
        icon: newForm.icon || null,
        ativo: true,
        display_order: coberturas.length,
      });
      // Link to plan
      if (result?.id) {
        await supabase.from('planos_coberturas').insert({
          plano_id: planId,
          cobertura_id: result.id,
          display_order: coberturas.length,
        });
      }
      setNewForm({ nome: '', icon: '' });
      setCreating(false);
      queryClient.invalidateQueries({ queryKey: ['plan-coberturas-inline', planId] });
    } catch {
      toast.error('Erro ao criar cobertura');
    }
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['plan-coberturas-inline', planId] });
    queryClient.invalidateQueries({ queryKey: ['plan-form-modal-full', planId] });
  };

  return (
    <section className="space-y-3 rounded-3xl border border-border/60 bg-card/60 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Coberturas</h3>
          <Badge variant="secondary" className="text-[11px]">{coberturas.length}</Badge>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setCreating(true)}>
          <Plus className="mr-1 h-3 w-3" /> Nova Cobertura
        </Button>
      </div>

      {creating && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 space-y-3">
          <div className="grid grid-cols-[60px_1fr] gap-2">
            <Input value={newForm.icon} onChange={(e) => setNewForm(p => ({ ...p, icon: e.target.value }))} placeholder="🛡️" className="text-center text-xl" />
            <Input value={newForm.nome} onChange={(e) => setNewForm(p => ({ ...p, nome: e.target.value }))} placeholder="Nome da cobertura" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button type="button" size="sm" onClick={handleCreate} disabled={createCobertura.isPending}>
              {createCobertura.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              Criar e Vincular
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : coberturas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 px-6 py-8 text-center text-sm text-muted-foreground">
          Nenhuma cobertura vinculada a este plano.
        </div>
      ) : (
        <div className="space-y-2">
          {coberturas.map((cob: any) => (
            <Collapsible key={cob.id} open={openItems.has(cob.id)} onOpenChange={() => toggleItem(cob.id)}>
              <div className={cn(
                'rounded-2xl border transition-all',
                openItems.has(cob.id) ? 'border-primary/40 bg-primary/5' : 'border-border/60 bg-card/60'
              )}>
                <CollapsibleTrigger asChild>
                  <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-left">
                    <div className="flex items-center gap-2 min-w-0">
                      {cob.icon && <span className="text-base">{cob.icon}</span>}
                      <span className="text-sm font-medium truncate">{cob.nome}</span>
                      {!cob.ativo && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); handleDelete(cob.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', openItems.has(cob.id) && 'rotate-180')} />
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t border-border/40">
                    <CoberturaInlineForm cobertura={cob} onSaved={invalidate} />
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
