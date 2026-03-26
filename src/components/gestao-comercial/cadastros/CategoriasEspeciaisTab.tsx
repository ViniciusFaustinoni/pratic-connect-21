import { useState } from 'react';
import { useCategoriasVeiculo } from '@/hooks/useConteudosSistema';
import { useSaveConfigJson } from '@/hooks/useConteudosSistema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

function slugify(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
}

export function CategoriasEspeciaisTab() {
  const { data: categorias = [], isLoading } = useCategoriasVeiculo();
  const saveMutation = useSaveConfigJson('categorias_veiculo');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');

  const openNew = () => { setEditIndex(null); setLabel(''); setValue(''); setDialogOpen(true); };
  const openEdit = (idx: number) => { setEditIndex(idx); setLabel(categorias[idx].label); setValue(categorias[idx].value); setDialogOpen(true); };

  const handleSave = () => {
    const newItem = { value: value || slugify(label), label };
    const updated = [...categorias];
    if (editIndex !== null) updated[editIndex] = newItem;
    else updated.push(newItem);
    saveMutation.mutate(updated, { onSuccess: () => setDialogOpen(false) });
  };

  const handleDelete = (idx: number) => {
    const updated = categorias.filter((_, i) => i !== idx);
    saveMutation.mutate(updated);
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Categorias Especiais / Situação do Veículo</h3>
          <p className="text-xs text-muted-foreground">Situações especiais usadas na cotação para aplicar depreciação</p>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Slug</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead className="w-24">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categorias.map((cat, idx) => (
            <TableRow key={cat.value}>
              <TableCell><Badge variant="outline" className="font-mono text-xs">{cat.value}</Badge></TableCell>
              <TableCell>{cat.label}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(idx)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(idx)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editIndex !== null ? 'Editar' : 'Nova'} Categoria Especial</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={label} onChange={e => { setLabel(e.target.value); if (editIndex === null) setValue(slugify(e.target.value)); }} /></div>
            <div><Label>Slug (identificador)</Label><Input value={value} onChange={e => setValue(e.target.value)} className="font-mono text-xs" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!label.trim() || saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
