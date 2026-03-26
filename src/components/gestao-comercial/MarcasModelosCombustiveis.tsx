import { useState, useMemo, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, ChevronRight, Loader2, Upload } from 'lucide-react';
import { useMarcasModelos, useCreateMarcaModelo, useToggleMarcaModelo, useBulkInsertMarcasModelos } from '@/hooks/useMarcasModelos';
import { useCombustiveis, useSaveConfigJson } from '@/hooks/useConteudosSistema';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Marcas e Modelos ──

function MarcasModelosTab() {
  const { data: items = [], isLoading } = useMarcasModelos();
  const createMut = useCreateMarcaModelo();
  const toggleMut = useToggleMarcaModelo();
  const bulkMut = useBulkInsertMarcasModelos();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetType, setSheetType] = useState<'marca' | 'modelo' | 'import'>('marca');
  const [parentMarca, setParentMarca] = useState('');
  const [nome, setNome] = useState('');
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState<{ marca: string; modelo?: string }[]>([]);
  const [openBrands, setOpenBrands] = useState<Set<string>>(new Set());

  // Group by brand
  const grouped = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const item of items) {
      const key = item.marca;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  const toggleBrand = (brand: string) => {
    setOpenBrands(prev => {
      const next = new Set(prev);
      next.has(brand) ? next.delete(brand) : next.add(brand);
      return next;
    });
  };

  const openNewMarca = () => { setSheetType('marca'); setNome(''); setSheetOpen(true); };
  const openNewModelo = (marca: string) => { setSheetType('modelo'); setParentMarca(marca); setNome(''); setSheetOpen(true); };
  const openImport = () => { setSheetType('import'); setImportText(''); setImportPreview([]); setSheetOpen(true); };

  const handleSave = () => {
    if (sheetType === 'marca') {
      createMut.mutate({ marca: nome }, { onSuccess: () => setSheetOpen(false) });
    } else if (sheetType === 'modelo') {
      createMut.mutate({ marca: parentMarca, modelo: nome }, { onSuccess: () => setSheetOpen(false) });
    }
  };

  const parseImport = useCallback((text: string) => {
    setImportText(text);
    const lines = text.split('\n').filter(l => l.trim());
    const parsed = lines.map(line => {
      const parts = line.split(/[,;\t]/).map(s => s.trim()).filter(Boolean);
      return { marca: parts[0] || '', modelo: parts[1] || undefined };
    }).filter(p => p.marca);
    setImportPreview(parsed);
  }, []);

  const confirmImport = () => {
    if (importPreview.length === 0) return;
    bulkMut.mutate(importPreview, { onSuccess: () => setSheetOpen(false) });
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">Marcas e Modelos</h3>
          <p className="text-xs text-muted-foreground">{grouped.length} marcas cadastradas</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={openImport}><Upload className="h-4 w-4 mr-1" />Importar</Button>
          <Button size="sm" onClick={openNewMarca}><Plus className="h-4 w-4 mr-1" />Nova Marca</Button>
        </div>
      </div>

      <div className="space-y-1">
        {grouped.map(([brand, models]) => (
          <Collapsible key={brand} open={openBrands.has(brand)} onOpenChange={() => toggleBrand(brand)}>
            <CollapsibleTrigger className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors text-left">
              <ChevronRight className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', openBrands.has(brand) && 'rotate-90')} />
              <span className="text-sm font-medium flex-1">{brand}</span>
              <span className="text-xs text-muted-foreground">{models.filter(m => m.modelo).length} modelos</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="ml-6 pl-3 border-l space-y-0.5 py-1">
                {models.filter(m => m.modelo).map(m => (
                  <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded text-sm">
                    <span className="flex-1">{m.modelo}</span>
                    <Switch checked={m.ativo} onCheckedChange={(checked) => toggleMut.mutate({ id: m.id, ativo: checked })} />
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => openNewModelo(brand)}>
                  <Plus className="h-3 w-3 mr-1" />Novo Modelo
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>

      <Sheet open={sheetOpen} onOpenChange={(v) => !v && setSheetOpen(false)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {sheetType === 'import' ? 'Importar em Lote' : sheetType === 'modelo' ? `Novo Modelo (${parentMarca})` : 'Nova Marca'}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            {sheetType === 'import' ? (
              <>
                <div>
                  <Label>Cole os dados (Marca, Modelo — separados por vírgula ou tab)</Label>
                  <Textarea rows={8} value={importText} onChange={e => parseImport(e.target.value)} placeholder="Toyota, Corolla&#10;Toyota, Hilux&#10;Honda, Civic" />
                </div>
                {importPreview.length > 0 && (
                  <div className="bg-muted/50 rounded-lg p-3 max-h-40 overflow-y-auto">
                    <p className="text-xs font-medium mb-1">{importPreview.length} registros encontrados</p>
                    {importPreview.slice(0, 10).map((p, i) => (
                      <p key={i} className="text-xs text-muted-foreground">{p.marca}{p.modelo ? ` → ${p.modelo}` : ''}</p>
                    ))}
                    {importPreview.length > 10 && <p className="text-xs text-muted-foreground">... e mais {importPreview.length - 10}</p>}
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setSheetOpen(false)}>Cancelar</Button>
                  <Button className="flex-1" onClick={confirmImport} disabled={importPreview.length === 0 || bulkMut.isPending}>
                    {bulkMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Confirmar ({importPreview.length})
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div><Label>Nome</Label><Input value={nome} onChange={e => setNome(e.target.value)} autoFocus /></div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setSheetOpen(false)}>Cancelar</Button>
                  <Button className="flex-1" onClick={handleSave} disabled={!nome.trim() || createMut.isPending}>
                    {createMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvar
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

// ── Main ──

export function MarcasModelosCombustiveis() {
  return <MarcasModelosTab />;
}
