import { useState } from 'react';
import { useRegioes, useCreateRegiao, useUpdateRegiao, useToggleRegiaoStatus, useDeleteRegiao, type Regiao } from '@/hooks/useRegioes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Loader2, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

export function RegioesTab() {
  const { data: regioes = [], isLoading } = useRegioes();
  const createMutation = useCreateRegiao();
  const updateMutation = useUpdateRegiao();
  const toggleMutation = useToggleRegiaoStatus();
  const deleteMutation = useDeleteRegiao();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editRegiao, setEditRegiao] = useState<Regiao | null>(null);
  const [nome, setNome] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Regiao | null>(null);

  const openNew = () => { setEditRegiao(null); setNome(''); setSheetOpen(true); };
  const openEdit = (r: Regiao) => { setEditRegiao(r); setNome(r.nome); setSheetOpen(true); };

  const handleSave = () => {
    if (editRegiao) {
      updateMutation.mutate(
        { id: editRegiao.id, codigo: editRegiao.codigo, nome, descricao: editRegiao.descricao || '', cidades: editRegiao.cidades, multiplicador_preco: editRegiao.multiplicador_preco, ativa: editRegiao.ativa, ordem: editRegiao.ordem },
        { onSuccess: () => setSheetOpen(false) }
      );
    } else {
      const codigo = nome.substring(0, 3).toUpperCase();
      createMutation.mutate(
        { codigo, nome, descricao: '', cidades: [], multiplicador_preco: 1, ativa: true, ordem: regioes.length + 1 },
        { onSuccess: () => setSheetOpen(false) }
      );
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">Regiões</h3>
          <p className="text-xs text-muted-foreground">Regiões de atendimento disponíveis em planos e cotações</p>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Nova Região</Button>
      </div>

      <div className="space-y-1">
        {regioes.map(r => (
          <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted/50 transition-colors group">
            <span className="text-sm flex-1">{r.nome}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(r)}><Trash2 className="h-3.5 w-3.5" /></Button>
            <Switch checked={r.ativa} onCheckedChange={(checked) => toggleMutation.mutate({ id: r.id, ativa: checked })} />
          </div>
        ))}
      </div>

      <Sheet open={sheetOpen} onOpenChange={(v) => !v && setSheetOpen(false)}>
        <SheetContent className="sm:max-w-sm">
          <SheetHeader><SheetTitle>{editRegiao ? 'Editar' : 'Nova'} Região</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-6">
            <div><Label>Nome</Label><Input value={nome} onChange={e => setNome(e.target.value)} autoFocus /></div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setSheetOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleSave} disabled={!nome.trim() || isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir região</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir "{deleteTarget?.nome}"? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null); }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
