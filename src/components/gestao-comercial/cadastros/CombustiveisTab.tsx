import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Loader2, Upload, Trash2 } from 'lucide-react';
import { useCombustiveis, useSaveConfigJson } from '@/hooks/useConteudosSistema';
import { toast } from 'sonner';

export function CombustiveisTab() {
  const { data: combustiveis = [], isLoading } = useCombustiveis();
  const saveMut = useSaveConfigJson('combustiveis');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetType, setSheetType] = useState<'new' | 'import'>('new');
  const [nome, setNome] = useState('');
  const [importText, setImportText] = useState('');
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  const handleAdd = () => {
    const slug = nome.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    saveMut.mutate([...combustiveis, { value: slug, label: nome }], { onSuccess: () => setSheetOpen(false) });
  };

  const handleImport = () => {
    const lines = importText.split('\n').map(l => l.trim()).filter(Boolean);
    const newItems = lines.map(l => ({ value: l.toLowerCase().replace(/[^a-z0-9]+/g, '_'), label: l }));
    const existing = new Set(combustiveis.map(c => c.value));
    const toAdd = newItems.filter(n => !existing.has(n.value));
    saveMut.mutate([...combustiveis, ...toAdd], { onSuccess: () => { setSheetOpen(false); toast.success(`${toAdd.length} adicionados`); } });
  };

  const handleDelete = () => {
    if (deleteIndex === null) return;
    const updated = combustiveis.filter((_, i) => i !== deleteIndex);
    saveMut.mutate(updated);
    setDeleteIndex(null);
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">Combustíveis</h3>
          <p className="text-xs text-muted-foreground">{combustiveis.length} tipos cadastrados</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { setSheetType('import'); setImportText(''); setSheetOpen(true); }}><Upload className="h-4 w-4 mr-1" />Importar</Button>
          <Button size="sm" onClick={() => { setSheetType('new'); setNome(''); setSheetOpen(true); }}><Plus className="h-4 w-4 mr-1" />Novo</Button>
        </div>
      </div>

      <div className="space-y-1">
        {combustiveis.map((c, idx) => (
          <div key={c.value} className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted/50 transition-colors group">
            <span className="text-sm flex-1">{c.label}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive" onClick={() => setDeleteIndex(idx)}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        ))}
      </div>

      <Sheet open={sheetOpen} onOpenChange={(v) => !v && setSheetOpen(false)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader><SheetTitle>{sheetType === 'import' ? 'Importar Combustíveis' : 'Novo Combustível'}</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-6">
            {sheetType === 'import' ? (
              <>
                <div><Label>Cole os nomes (um por linha)</Label><Textarea rows={6} value={importText} onChange={e => setImportText(e.target.value)} placeholder="Flex&#10;Diesel&#10;Elétrico" /></div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setSheetOpen(false)}>Cancelar</Button>
                  <Button className="flex-1" onClick={handleImport} disabled={!importText.trim() || saveMut.isPending}>
                    {saveMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Importar
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div><Label>Nome</Label><Input value={nome} onChange={e => setNome(e.target.value)} autoFocus /></div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setSheetOpen(false)}>Cancelar</Button>
                  <Button className="flex-1" onClick={handleAdd} disabled={!nome.trim() || saveMut.isPending}>
                    {saveMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvar
                  </Button>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteIndex !== null} onOpenChange={(open) => !open && setDeleteIndex(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir combustível</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir "{deleteIndex !== null ? combustiveis[deleteIndex]?.label : ''}"? Esta ação não pode ser desfeita.</AlertDialogDescription>
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
