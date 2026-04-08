import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Loader2, Filter, Copy, Search, ArrowDownAZ, ArrowUpAZ } from 'lucide-react';
import { useCoberturas, useBenefits } from '@/hooks/usePlans';
import { useDuplicateCobertura, useDuplicateBenefit } from '@/hooks/usePlansAdmin';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EligibilityConfigSection, useEligibilityState, saveEligibilityRules, hasEligibilityRules } from './EligibilityConfigSection';
import { useRulesForEntity } from '@/hooks/useEntityEligibilityRules';
import { CarenciaConfigSection } from '@/components/admin/planos/CarenciaConfigSection';
import { AtribuicaoPlanoTab } from './AtribuicaoPlanoTab';


// ── Delete Confirmation Dialog ──

function DeleteConfirmDialog({ open, onClose, onConfirm, itemName, isPending }: {
  open: boolean;
  onClose: () => void;
  onConfirm: (justificativa: string) => void;
  itemName: string;
  isPending: boolean;
}) {
  const [justificativa, setJustificativa] = useState('');

  useEffect(() => {
    if (open) setJustificativa('');
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir permanentemente</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir <strong>"{itemName}"</strong>? Esta ação é irreversível e removerá todos os vínculos com planos existentes.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-2">
          <Label>Justificativa obrigatória</Label>
          <Textarea
            rows={2}
            value={justificativa}
            onChange={e => setJustificativa(e.target.value)}
            placeholder="Motivo da exclusão..."
            className="mt-1"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onConfirm(justificativa)}
            disabled={!justificativa.trim() || isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ── Cobertura Sheet ──

function CoberturaSheet({ open, onClose, item }: { open: boolean; onClose: () => void; item?: any }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('0');
  const [variaComFipe, setVariaComFipe] = useState(false);
  const [carenciaConfig, setCarenciaConfig] = useState({
    carencia_ativa: false,
    carencia_tipo: 'liberacao',
    carencia_dias: '0',
    carencia_multiplicador: '1',
  });

  const { state: eligState, setState: setEligState } = useEligibilityState('cobertura', item?.id);

  useEffect(() => {
    setNome(item?.nome || '');
    setDescricao(item?.descricao || '');
    setValor(item?.valor?.toString() || '0');
    setCarenciaConfig({
      carencia_ativa: item?.carencia_ativa || false,
      carencia_tipo: item?.carencia_tipo || 'liberacao',
      carencia_dias: item?.carencia_dias?.toString() || '0',
      carencia_multiplicador: item?.carencia_multiplicador?.toString() || '1',
    });
  }, [item, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        nome, descricao, valor: parseFloat(valor) || 0,
        carencia_ativa: carenciaConfig.carencia_ativa,
        carencia_tipo: carenciaConfig.carencia_tipo,
        carencia_dias: parseInt(carenciaConfig.carencia_dias) || 0,
        carencia_multiplicador: parseFloat(carenciaConfig.carencia_multiplicador) || 1,
      };
      let entityId = item?.id;
      if (entityId) {
        const { error } = await supabase.from('coberturas').update(payload).eq('id', entityId);
        if (error) throw error;
      } else {
        const slug = nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const codigo = `${slug}-${crypto.randomUUID().slice(0, 8)}`;
        const { data, error } = await supabase.from('coberturas').insert({
          ...payload, codigo, tipo: 'cobertura',
        }).select().single();
        if (error) throw error;
        entityId = data.id;
      }
      // Save eligibility rules
      await saveEligibilityRules('cobertura', entityId, eligState);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coberturas'] });
      qc.invalidateQueries({ queryKey: ['entity_eligibility_rules'] });
      toast.success('Cobertura salva');
      onClose();
    },
    onError: (err: any) => toast.error(err?.message?.includes('duplicate') || err?.code === '23505' ? 'Já existe uma cobertura com esse nome' : 'Erro ao salvar'),
  });

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader><SheetTitle>{item ? 'Editar' : 'Nova'} Cobertura</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-6 pb-8">
          <div><Label>Nome</Label><Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Roubo e Furto" /></div>
          <div><Label>Descrição</Label><Textarea rows={3} value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição da cobertura" /></div>
          {!variaComFipe && (
            <div><Label>Valor (R$)</Label><Input type="number" step="0.01" min="0" value={valor} onChange={e => setValor(e.target.value)} /></div>
          )}

          <CarenciaConfigSection config={carenciaConfig} onChange={setCarenciaConfig} />

          <EligibilityConfigSection entityType="cobertura" entityId={item?.id} onVariaComFipeChange={setVariaComFipe} externalState={{ state: eligState, setState: setEligState }} />

          <div className="flex gap-2 pt-4">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1" onClick={() => mutation.mutate()} disabled={!nome.trim() || mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Beneficio Sheet ──

function BeneficioSheet({ open, onClose, item }: { open: boolean; onClose: () => void; item?: any }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [valor, setValor] = useState('0');
  const [variaComFipe, setVariaComFipe] = useState(false);
  const [carenciaConfig, setCarenciaConfig] = useState({
    carencia_ativa: false,
    carencia_tipo: 'liberacao',
    carencia_dias: '0',
    carencia_multiplicador: '1',
  });

  const { state: eligState, setState: setEligState } = useEligibilityState('beneficio', item?.id);

  useEffect(() => {
    setName(item?.name || '');
    setDescription(item?.description || '');
    setValor(item?.preco_sugerido?.toString() || '0');
    setCarenciaConfig({
      carencia_ativa: item?.carencia_ativa || false,
      carencia_tipo: item?.carencia_tipo || 'liberacao',
      carencia_dias: item?.carencia_dias?.toString() || '0',
      carencia_multiplicador: item?.carencia_multiplicador?.toString() || '1',
    });
  }, [item, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name, description, preco_sugerido: parseFloat(valor) || 0,
        carencia_ativa: carenciaConfig.carencia_ativa,
        carencia_tipo: carenciaConfig.carencia_tipo,
        carencia_dias: parseInt(carenciaConfig.carencia_dias) || 0,
        carencia_multiplicador: parseFloat(carenciaConfig.carencia_multiplicador) || 1,
      };
      let entityId = item?.id;
      if (entityId) {
        const { error } = await supabase.from('benefits').update(payload).eq('id', entityId);
        if (error) throw error;
      } else {
        const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const uniqueSlug = `${slug}-${crypto.randomUUID().slice(0, 8)}`;
        const { data, error } = await supabase.from('benefits').insert({
          ...payload, slug: uniqueSlug, category: 'geral',
        }).select().single();
        if (error) throw error;
        entityId = data.id;
      }
      // Save eligibility rules
      await saveEligibilityRules('beneficio', entityId, eligState);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['benefits'] });
      qc.invalidateQueries({ queryKey: ['entity_eligibility_rules'] });
      toast.success('Benefício salvo');
      onClose();
    },
    onError: (err: any) => toast.error(err?.message?.includes('duplicate') || err?.code === '23505' ? 'Já existe um benefício com esse nome' : 'Erro ao salvar'),
  });

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader><SheetTitle>{item ? 'Editar' : 'Novo'} Benefício</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-6 pb-8">
          <div><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Assistência 24h" /></div>
          <div><Label>Descrição</Label><Textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição do benefício" /></div>
          {!variaComFipe && (
            <div><Label>Valor (R$)</Label><Input type="number" step="0.01" min="0" value={valor} onChange={e => setValor(e.target.value)} /></div>
          )}

          <CarenciaConfigSection config={carenciaConfig} onChange={setCarenciaConfig} />

          <EligibilityConfigSection entityType="beneficio" entityId={item?.id} onVariaComFipeChange={setVariaComFipe} externalState={{ state: eligState, setState: setEligState }} />

          <div className="flex gap-2 pt-4">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1" onClick={() => mutation.mutate()} disabled={!name.trim() || mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Toggle mutations ──

function useToggleCobertura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from('coberturas').update({ ativo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coberturas'] }),
  });
}

function useToggleBenefit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('benefits').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['benefits'] }),
  });
}

// ── Delete mutations ──

function useDeleteCobertura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      await supabase.from('planos_coberturas').delete().eq('cobertura_id', id);
      await supabase.from('entity_eligibility_rules' as any).delete().eq('entity_type', 'cobertura').eq('entity_id', id);
      const { error } = await supabase.from('coberturas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coberturas'] }); toast.success('Cobertura excluída'); },
    onError: () => toast.error('Erro ao excluir. Verifique se não há dependências.'),
  });
}

function useDeleteBenefit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      await supabase.from('planos_beneficios').delete().eq('benefit_id', id);
      await supabase.from('entity_eligibility_rules' as any).delete().eq('entity_type', 'beneficio').eq('entity_id', id);
      const { error } = await supabase.from('benefits').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['benefits'] }); toast.success('Benefício excluído'); },
    onError: () => toast.error('Erro ao excluir. Verifique se não há dependências.'),
  });
}

// ── Rules indicator hook ──

function useHasRules(entityType: 'cobertura' | 'beneficio', entityId: string) {
  const { data: rules = [] } = useRulesForEntity(entityType as any, entityId);
  return rules.length > 0;
}

function RulesIndicator({ entityType, entityId }: { entityType: 'cobertura' | 'beneficio'; entityId: string }) {
  const hasRules = useHasRules(entityType, entityId);
  if (!hasRules) return null;
  return <Filter className="h-3.5 w-3.5 text-primary shrink-0" />;
}

// ── Item List ──

function ItemList({ items, onEdit, onToggle, onDelete, onDuplicate, type }: {
  items: any[];
  onEdit: (item: any) => void;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (item: any) => void;
  onDuplicate: (id: string) => void;
  type: 'cobertura' | 'beneficio';
}) {
  const getActive = (item: any) => type === 'cobertura' ? item.ativo !== false : item.is_active !== false;
  const getValor = (item: any) => type === 'cobertura' ? (item.valor || 0) : (item.preco_sugerido || 0);
  const getNome = (item: any) => type === 'cobertura' ? item.nome : item.name;
  const getDesc = (item: any) => type === 'cobertura' ? item.descricao : item.description;

  if (!items.length) return <p className="text-sm text-muted-foreground py-8 text-center">Nenhum item cadastrado</p>;

  return (
    <div className="space-y-1">
      {items.map(item => (
        <div key={item.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors group">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium truncate">{getNome(item)}</p>
              <RulesIndicator entityType={type} entityId={item.id} />
            </div>
            {getDesc(item) && <p className="text-xs text-muted-foreground truncate">{getDesc(item)}</p>}
          </div>
          <span className="text-sm font-semibold text-primary shrink-0">
            R$ {getValor(item).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
          <Switch
            checked={getActive(item)}
            onCheckedChange={(checked) => onToggle(item.id, checked)}
            className="shrink-0"
          />
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100" onClick={() => onEdit(item)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100" onClick={() => onDuplicate(item.id)} title="Duplicar">
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive" onClick={() => onDelete(item)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ──

export function CatalogoCoberturasBeneficios() {
  const { data: coberturas = [], isLoading: loadingCob } = useCoberturas();
  const { data: benefits = [], isLoading: loadingBen } = useBenefits();
  const toggleCob = useToggleCobertura();
  const toggleBen = useToggleBenefit();
  const deleteCob = useDeleteCobertura();
  const deleteBen = useDeleteBenefit();
  const duplicateCob = useDuplicateCobertura();
  const duplicateBen = useDuplicateBenefit();

  const [cobSheet, setCobSheet] = useState<{ open: boolean; item?: any }>({ open: false });
  const [benSheet, setBenSheet] = useState<{ open: boolean; item?: any }>({ open: false });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item?: any; type?: 'cobertura' | 'beneficio' }>({ open: false });
  const [cobSearch, setCobSearch] = useState('');
  const [benSearch, setBenSearch] = useState('');
  const [cobSort, setCobSort] = useState<'default' | 'az' | 'za'>('default');
  const [benSort, setBenSort] = useState<'default' | 'az' | 'za'>('default');

  const filterAndSort = (items: any[], search: string, sort: 'default' | 'az' | 'za', type: 'cobertura' | 'beneficio') => {
    let filtered = items;
    if (search.trim()) {
      const term = search.toLowerCase();
      filtered = items.filter(item => {
        const nome = (type === 'cobertura' ? item.nome : item.name) || '';
        const desc = (type === 'cobertura' ? item.descricao : item.description) || '';
        return nome.toLowerCase().includes(term) || desc.toLowerCase().includes(term);
      });
    }
    if (sort !== 'default') {
      const getName = (item: any) => (type === 'cobertura' ? item.nome : item.name) || '';
      filtered = [...filtered].sort((a, b) => {
        const cmp = getName(a).localeCompare(getName(b), 'pt-BR');
        return sort === 'az' ? cmp : -cmp;
      });
    }
    return filtered;
  };

  const handleDelete = (justificativa: string) => {
    if (!deleteDialog.item || !deleteDialog.type) return;
    const id = deleteDialog.item.id;
    if (deleteDialog.type === 'cobertura') {
      deleteCob.mutate({ id }, { onSettled: () => setDeleteDialog({ open: false }) });
    } else {
      deleteBen.mutate({ id }, { onSettled: () => setDeleteDialog({ open: false }) });
    }
  };

  const getDeleteItemName = () => {
    if (!deleteDialog.item) return '';
    return deleteDialog.type === 'cobertura' ? deleteDialog.item.nome : deleteDialog.item.name;
  };

  const isLoading = loadingCob || loadingBen;
  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <>
      <Tabs defaultValue="coberturas" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="coberturas">Coberturas ({coberturas.length})</TabsTrigger>
            <TabsTrigger value="beneficios">Benefícios ({benefits.length})</TabsTrigger>
            <TabsTrigger value="atribuicao">Atribuição</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="coberturas">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => setCobSheet({ open: true })}><Plus className="h-4 w-4 mr-1" />Nova Cobertura</Button>
          </div>
          <ItemList
            items={coberturas}
            type="cobertura"
            onEdit={(item) => setCobSheet({ open: true, item })}
            onToggle={(id, ativo) => toggleCob.mutate({ id, ativo })}
            onDelete={(item) => setDeleteDialog({ open: true, item, type: 'cobertura' })}
            onDuplicate={(id) => duplicateCob.mutate(id)}
          />
        </TabsContent>

        <TabsContent value="beneficios">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => setBenSheet({ open: true })}><Plus className="h-4 w-4 mr-1" />Novo Benefício</Button>
          </div>
          <ItemList
            items={benefits}
            type="beneficio"
            onEdit={(item) => setBenSheet({ open: true, item })}
            onToggle={(id, is_active) => toggleBen.mutate({ id, is_active })}
            onDelete={(item) => setDeleteDialog({ open: true, item, type: 'beneficio' })}
            onDuplicate={(id) => duplicateBen.mutate(id)}
          />
        </TabsContent>

        <TabsContent value="atribuicao">
          <AtribuicaoPlanoTab />
        </TabsContent>
      </Tabs>

      {cobSheet.open && <CoberturaSheet open item={cobSheet.item} onClose={() => setCobSheet({ open: false })} />}
      {benSheet.open && <BeneficioSheet open item={benSheet.item} onClose={() => setBenSheet({ open: false })} />}

      <DeleteConfirmDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false })}
        onConfirm={handleDelete}
        itemName={getDeleteItemName()}
        isPending={deleteCob.isPending || deleteBen.isPending}
      />
    </>
  );
}
