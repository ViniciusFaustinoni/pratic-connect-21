import { useState } from 'react';
import { useCategoriasVeiculoPlano, useSaveCategoriasVeiculoPlano } from '@/hooks/useConteudosSistema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Loader2, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

function slugify(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
}

export function CategoriasVeiculoTab() {
  const { data: categorias = [], isLoading } = useCategoriasVeiculoPlano();
  const saveMutation = useSaveCategoriasVeiculoPlano();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [label, setLabel] = useState('');
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  const openNew = () => { setEditIndex(null); setLabel(''); setSheetOpen(true); };
  const openEdit = (idx: number) => { setEditIndex(idx); setLabel(categorias[idx].label); setSheetOpen(true); };

  const handleSave = () => {
    const newItem = { value: editIndex !== null ? categorias[editIndex].value : slugify(label), label } as any;
    const updated = [...categorias] as any[];
    if (editIndex !== null) updated[editIndex] = { ...updated[editIndex], label };
    else updated.push(newItem);
    saveMutation.mutate(updated, { onSuccess: () => setSheetOpen(false) });
  };

  const handleToggle = (idx: number) => {
    const updated = [...categorias] as any[];
    updated[idx] = { ...updated[idx], ativo: (updated[idx] as any).ativo === false ? true : false };
    saveMutation.mutate(updated);
  };

  const handleDelete = () => {
    if (deleteIndex === null) return;
    const updated = [...categorias] as any[];
    updated.splice(deleteIndex, 1);
    saveMutation.mutate(updated);
    setDeleteIndex(null);
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">Tipos de Veículo</h3>
          <p className="text-xs text-muted-foreground">Tipos de veículo aceitos em planos e cotações</p>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
      </div>

      <div className="space-y-1">
        {categorias.map((cat, idx) => (
          <div key={cat.value} className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted/50 transition-colors group">
            <span className="text-sm flex-1">{cat.label}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => openEdit(idx)}><Pencil className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive" onClick={() => setDeleteIndex(idx)}><Trash2 className="h-3.5 w-3.5" /></Button>
            <Switch checked={(cat as any).ativo !== false} onCheckedChange={() => handleToggle(idx)} />
          </div>
        ))}
      </div>

      <Sheet open={sheetOpen} onOpenChange={(v) => !v && setSheetOpen(false)}>
        <SheetContent className="sm:max-w-sm">
          <SheetHeader><SheetTitle>{editIndex !== null ? 'Editar' : 'Novo'} Tipo de Veículo</SheetTitle></SheetHeader>
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

      <AlertDialog open={deleteIndex !== null} onOpenChange={(open) => !open && setDeleteIndex(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tipo de veículo</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir "{deleteIndex !== null ? categorias[deleteIndex]?.label : ''}"? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
