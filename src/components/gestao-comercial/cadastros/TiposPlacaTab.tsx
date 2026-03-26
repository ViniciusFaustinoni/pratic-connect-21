import { useState } from 'react';
import { useConfiguracaoJson, useSaveConfigJson } from '@/hooks/useConteudosSistema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Plus, Pencil, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface TipoPlacaItem {
  value: string;
  label: string;
  ativo?: boolean;
}

function slugify(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
}

const FALLBACK: TipoPlacaItem[] = [
  { value: 'mercosul', label: 'Mercosul' },
  { value: 'antiga', label: 'Antiga' },
  { value: 'especial', label: 'Especial' },
];

export function TiposPlacaTab() {
  const { data: tipos = [], isLoading } = useConfiguracaoJson<TipoPlacaItem[]>('tipos_placa', FALLBACK);
  const saveMutation = useSaveConfigJson('tipos_placa');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [label, setLabel] = useState('');

  const openNew = () => { setEditIndex(null); setLabel(''); setSheetOpen(true); };
  const openEdit = (idx: number) => { setEditIndex(idx); setLabel(tipos[idx].label); setSheetOpen(true); };

  const handleSave = () => {
    const newItem: TipoPlacaItem = { value: editIndex !== null ? tipos[editIndex].value : slugify(label), label };
    const updated = [...tipos];
    if (editIndex !== null) updated[editIndex] = { ...updated[editIndex], label };
    else updated.push(newItem);
    saveMutation.mutate(updated, { onSuccess: () => setSheetOpen(false) });
  };

  const handleToggle = (idx: number) => {
    const updated = [...tipos];
    updated[idx] = { ...updated[idx], ativo: updated[idx].ativo === false ? true : false };
    saveMutation.mutate(updated);
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">Tipos de Placa</h3>
          <p className="text-xs text-muted-foreground">Tipos de placa disponíveis em regras de elegibilidade</p>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
      </div>

      <div className="space-y-1">
        {tipos.map((t, idx) => (
          <div key={t.value} className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted/50 transition-colors group">
            <span className="text-sm flex-1">{t.label}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => openEdit(idx)}><Pencil className="h-3.5 w-3.5" /></Button>
            <Switch checked={t.ativo !== false} onCheckedChange={() => handleToggle(idx)} />
          </div>
        ))}
      </div>

      <Sheet open={sheetOpen} onOpenChange={(v) => !v && setSheetOpen(false)}>
        <SheetContent className="sm:max-w-sm">
          <SheetHeader><SheetTitle>{editIndex !== null ? 'Editar' : 'Novo'} Tipo de Placa</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-6">
            <div><Label>Nome</Label><Input value={label} onChange={e => setLabel(e.target.value)} autoFocus /></div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setSheetOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleSave} disabled={!label.trim() || saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
