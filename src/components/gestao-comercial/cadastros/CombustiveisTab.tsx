import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Plus, Loader2, Upload } from 'lucide-react';
import { useCombustiveis, useSaveConfigJson } from '@/hooks/useConteudosSistema';
import { toast } from 'sonner';

export function CombustiveisTab() {
  const { data: combustiveis = [], isLoading } = useCombustiveis();
  const saveMut = useSaveConfigJson('combustiveis');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetType, setSheetType] = useState<'new' | 'import'>('new');
  const [nome, setNome] = useState('');
  const [importText, setImportText] = useState('');

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

  const handleToggle = (idx: number) => {
    const updated = combustiveis.filter((_, i) => i !== idx);
    saveMut.mutate(updated);
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
          <div key={c.value} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors">
            <span className="text-sm flex-1">{c.label}</span>
            <Button variant="ghost" size="sm" className="text-xs text-destructive h-7" onClick={() => handleToggle(idx)}>Remover</Button>
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
    </>
  );
}
