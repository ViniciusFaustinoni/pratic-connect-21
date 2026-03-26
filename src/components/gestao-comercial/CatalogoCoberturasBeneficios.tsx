import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Plus, Pencil, Loader2 } from 'lucide-react';
import { useCoberturas, useBenefits } from '@/hooks/usePlans';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ── Cobertura Sheet ──

function CoberturaSheet({ open, onClose, item }: { open: boolean; onClose: () => void; item?: any }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('0');

  useEffect(() => {
    setNome(item?.nome || '');
    setDescricao(item?.descricao || '');
    setValor(item?.valor?.toString() || '0');
  }, [item, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = { nome, descricao, valor: parseFloat(valor) || 0 };
      if (item?.id) {
        const { error } = await supabase.from('coberturas').update(payload).eq('id', item.id);
        if (error) throw error;
      } else {
        const slug = nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const codigo = `${slug}-${crypto.randomUUID().slice(0, 4)}`;
        const { error } = await supabase.from('coberturas').insert({
          ...payload,
          codigo,
          tipo: 'cobertura',
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coberturas'] }); toast.success('Cobertura salva'); onClose(); },
    onError: () => toast.error('Erro ao salvar'),
  });

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader><SheetTitle>{item ? 'Editar' : 'Nova'} Cobertura</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-6">
          <div><Label>Nome</Label><Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Roubo e Furto" /></div>
          <div><Label>Descrição</Label><Textarea rows={3} value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição da cobertura" /></div>
          <div><Label>Valor (R$)</Label><Input type="number" step="0.01" min="0" value={valor} onChange={e => setValor(e.target.value)} /></div>
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
  const [name, setName] = useState(item?.name || '');
  const [description, setDescription] = useState(item?.description || '');
  const [valor, setValor] = useState(item?.preco_sugerido?.toString() || '0');

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = { name, description, preco_sugerido: parseFloat(valor) || 0 };
      if (item?.id) {
        const { error } = await supabase.from('benefits').update(payload).eq('id', item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('benefits').insert({
          ...payload,
          slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30),
          category: 'geral',
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['benefits'] }); toast.success('Benefício salvo'); onClose(); },
    onError: () => toast.error('Erro ao salvar'),
  });

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader><SheetTitle>{item ? 'Editar' : 'Novo'} Benefício</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-6">
          <div><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Assistência 24h" /></div>
          <div><Label>Descrição</Label><Textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição do benefício" /></div>
          <div><Label>Valor (R$)</Label><Input type="number" step="0.01" min="0" value={valor} onChange={e => setValor(e.target.value)} /></div>
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

// ── Item List ──

function ItemList({ items, onEdit, onToggle, type }: {
  items: any[];
  onEdit: (item: any) => void;
  onToggle: (id: string, active: boolean) => void;
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
            <p className="text-sm font-medium truncate">{getNome(item)}</p>
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

  const [cobSheet, setCobSheet] = useState<{ open: boolean; item?: any }>({ open: false });
  const [benSheet, setBenSheet] = useState<{ open: boolean; item?: any }>({ open: false });

  const isLoading = loadingCob || loadingBen;
  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <>
      <Tabs defaultValue="coberturas" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="coberturas">Coberturas ({coberturas.length})</TabsTrigger>
            <TabsTrigger value="beneficios">Benefícios ({benefits.length})</TabsTrigger>
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
          />
        </TabsContent>
      </Tabs>

      {cobSheet.open && <CoberturaSheet open item={cobSheet.item} onClose={() => setCobSheet({ open: false })} />}
      {benSheet.open && <BeneficioSheet open item={benSheet.item} onClose={() => setBenSheet({ open: false })} />}
    </>
  );
}
