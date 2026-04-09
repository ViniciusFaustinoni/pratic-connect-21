import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Plus, Save, Trash2, Loader2, Link2, Search } from 'lucide-react';
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
import { EligibilityConfigSection, useEligibilityState, saveEligibilityRules } from '@/components/gestao-comercial/EligibilityConfigSection';
import { CarenciaConfigSection } from './CarenciaConfigSection';
import { toast } from 'sonner';

interface PlanCoberturasListProps {
  planId: string;
  focusItemId?: string;
}

function CoberturaInlineForm({ cobertura, onSaved }: { cobertura: any; onSaved: () => void }) {
  const updateCobertura = useUpdateCobertura();
  const eligibility = useEligibilityState('cobertura', cobertura.id);

  const [form, setForm] = useState({
    icon: cobertura.icon || '',
    nome: cobertura.nome || '',
    codigo: cobertura.codigo || '',
    subtitle: cobertura.subtitle || '',
    descricao: cobertura.descricao || '',
    display_order: cobertura.display_order?.toString() || '0',
    ativo: cobertura.ativo ?? true,
    valor: cobertura.valor?.toString() || '',
    valor_limite: cobertura.valor_limite?.toString() || '',
    percentual_cobertura: cobertura.percentual_cobertura?.toString() || '',
    franquia_percentual: cobertura.franquia_percentual?.toString() || '',
    franquia_valor: cobertura.franquia_valor?.toString() || '',
    carencia_ativa: cobertura.carencia_ativa ?? false,
    carencia_tipo: cobertura.carencia_tipo || '',
    carencia_dias: cobertura.carencia_dias?.toString() || '',
    carencia_multiplicador: cobertura.carencia_multiplicador?.toString() || '',
  });

  const [variaComFipe, setVariaComFipe] = useState(false);

  const handleSave = async () => {
    const payload = {
      id: cobertura.id,
      nome: form.nome,
      codigo: form.codigo || undefined,
      icon: form.icon || null,
      subtitle: form.subtitle || null,
      descricao: form.descricao || null,
      display_order: parseInt(form.display_order) || 0,
      ativo: form.ativo,
      valor: variaComFipe ? null : (form.valor ? parseFloat(form.valor) : null),
      valor_limite: form.valor_limite ? parseFloat(form.valor_limite) : null,
      percentual_cobertura: form.percentual_cobertura ? parseFloat(form.percentual_cobertura) : null,
      franquia_percentual: form.franquia_percentual ? parseFloat(form.franquia_percentual) : null,
      franquia_valor: form.franquia_valor ? parseFloat(form.franquia_valor) : null,
      carencia_ativa: form.carencia_ativa,
      carencia_dias: form.carencia_dias ? parseInt(form.carencia_dias) : null,
      carencia_tipo: form.carencia_ativa ? form.carencia_tipo || null : null,
      carencia_multiplicador: form.carencia_tipo === 'multiplicadora_cota' && form.carencia_multiplicador
        ? parseFloat(form.carencia_multiplicador) : null,
    };

    try {
      await updateCobertura.mutateAsync(payload);
      await saveEligibilityRules('cobertura', cobertura.id, eligibility.state);
      onSaved();
      toast.success('Cobertura salva com sucesso');
    } catch {
      toast.error('Erro ao salvar cobertura');
    }
  };

  return (
    <div className="space-y-4 p-4">
      {/* Ícone + Nome */}
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

      {/* Código + Subtítulo */}
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

      {/* Descrição */}
      <div className="space-y-1">
        <Label className="text-xs">Descrição</Label>
        <Textarea value={form.descricao} onChange={(e) => setForm(p => ({ ...p, descricao: e.target.value }))} rows={2} />
      </div>

      {/* Valores financeiros */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Valor (R$)</Label>
          <Input
            type="number" step="0.01" value={form.valor}
            onChange={(e) => setForm(p => ({ ...p, valor: e.target.value }))}
            placeholder="0,00"
            disabled={variaComFipe}
          />
          {variaComFipe && <p className="text-[10px] text-amber-500">Valor definido pelas faixas FIPE abaixo</p>}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Valor Limite (R$)</Label>
          <Input type="number" step="0.01" value={form.valor_limite} onChange={(e) => setForm(p => ({ ...p, valor_limite: e.target.value }))} placeholder="0,00" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">% Cobertura</Label>
          <Input type="number" step="0.1" value={form.percentual_cobertura} onChange={(e) => setForm(p => ({ ...p, percentual_cobertura: e.target.value }))} placeholder="100" />
        </div>
      </div>

      {/* Franquias */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Franquia (%)</Label>
          <Input type="number" step="0.1" value={form.franquia_percentual} onChange={(e) => setForm(p => ({ ...p, franquia_percentual: e.target.value }))} placeholder="0" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Franquia (R$)</Label>
          <Input type="number" step="0.01" value={form.franquia_valor} onChange={(e) => setForm(p => ({ ...p, franquia_valor: e.target.value }))} placeholder="0,00" />
        </div>
      </div>

      {/* Ordem + Ativo */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Ordem</Label>
          <Input type="number" value={form.display_order} onChange={(e) => setForm(p => ({ ...p, display_order: e.target.value }))} />
        </div>
        <div className="flex items-center gap-2 pt-5">
          <Switch checked={form.ativo} onCheckedChange={(v) => setForm(p => ({ ...p, ativo: v }))} />
          <Label className="text-xs">Ativo</Label>
        </div>
      </div>

      {/* Carência */}
      <CarenciaConfigSection
        config={{
          carencia_ativa: form.carencia_ativa,
          carencia_tipo: form.carencia_tipo,
          carencia_dias: form.carencia_dias,
          carencia_multiplicador: form.carencia_multiplicador,
        }}
        onChange={(c) => setForm(p => ({ ...p, ...c }))}
      />

      {/* Regras de Elegibilidade Completas (FIPE, região, uso, placa, combustível) */}
      <EligibilityConfigSection
        entityType="cobertura"
        entityId={cobertura.id}
        onVariaComFipeChange={setVariaComFipe}
        externalState={eligibility}
      />

      {/* Salvar */}
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={handleSave} disabled={updateCobertura.isPending}>
          {updateCobertura.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
          Salvar Cobertura
        </Button>
      </div>
    </div>
  );
}

export function PlanCoberturasList({ planId, focusItemId }: PlanCoberturasListProps) {
  const queryClient = useQueryClient();
  const deleteCobertura = useDeleteCobertura();
  const createCobertura = useCreateCobertura();
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState({ nome: '', icon: '' });
  const focusRef = useRef<HTMLDivElement>(null);
  const hasFocused = useRef(false);

  const { data: coberturas = [], isLoading } = useQuery({
    queryKey: ['plan-coberturas-inline', planId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos_coberturas')
        .select('*, coberturas:cobertura_id(*)')
        .eq('plano_id', planId)
      if (error) throw error;
      return (data || []).map((pc: any) => pc.coberturas).filter(Boolean).sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0));
    },
    enabled: !!planId,
  });

  useEffect(() => {
    if (focusItemId && coberturas.length > 0 && !hasFocused.current) {
      const match = coberturas.find((c: any) => c.id === focusItemId);
      if (match) {
        setOpenItems(new Set([focusItemId]));
        hasFocused.current = true;
        setTimeout(() => {
          focusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
      }
    }
  }, [focusItemId, coberturas]);

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
      await supabase.from('planos_coberturas').delete().eq('plano_id', planId).eq('cobertura_id', coberturaId);
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
              <div ref={cob.id === focusItemId ? focusRef : undefined} className={cn(
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
