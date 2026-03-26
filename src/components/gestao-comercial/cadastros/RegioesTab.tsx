import { useState } from 'react';
import { useRegioes, useCreateRegiao, useUpdateRegiao, useDeleteRegiao, useToggleRegiaoStatus, type Regiao, type RegiaoInput } from '@/hooks/useRegioes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Loader2, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

export function RegioesTab() {
  const { data: regioes = [], isLoading } = useRegioes();
  const createMutation = useCreateRegiao();
  const updateMutation = useUpdateRegiao();
  const deleteMutation = useDeleteRegiao();
  const toggleMutation = useToggleRegiaoStatus();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRegiao, setEditRegiao] = useState<Regiao | null>(null);
  const [form, setForm] = useState<RegiaoInput>({ codigo: '', nome: '', descricao: '', cidades: [], multiplicador_preco: 1, ativa: true, ordem: 0 });

  const openNew = () => {
    setEditRegiao(null);
    setForm({ codigo: '', nome: '', descricao: '', cidades: [], multiplicador_preco: 1, ativa: true, ordem: regioes.length + 1 });
    setDialogOpen(true);
  };

  const openEdit = (r: Regiao) => {
    setEditRegiao(r);
    setForm({ codigo: r.codigo, nome: r.nome, descricao: r.descricao || '', cidades: r.cidades, multiplicador_preco: r.multiplicador_preco, ativa: r.ativa, ordem: r.ordem });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (editRegiao) {
      updateMutation.mutate({ id: editRegiao.id, ...form }, { onSuccess: () => setDialogOpen(false) });
    } else {
      createMutation.mutate(form, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Regiões de Atendimento</h3>
          <p className="text-xs text-muted-foreground">Regiões com multiplicadores de preço e cidades vinculadas</p>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Nova Região</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Cidades</TableHead>
            <TableHead>Multiplicador</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {regioes.map(r => (
            <TableRow key={r.id}>
              <TableCell><Badge variant="outline" className="font-mono">{r.codigo}</Badge></TableCell>
              <TableCell className="font-medium">{r.nome}</TableCell>
              <TableCell><span className="text-xs text-muted-foreground">{r.cidades.length} cidades</span></TableCell>
              <TableCell>{(r.multiplicador_preco * 100).toFixed(0)}%</TableCell>
              <TableCell>
                <Switch checked={r.ativa} onCheckedChange={(checked) => toggleMutation.mutate({ id: r.id, ativa: checked })} />
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir região?</AlertDialogTitle>
                        <AlertDialogDescription>Essa ação não pode ser desfeita. Planos vinculados a esta região podem ser afetados.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(r.id)}>Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editRegiao ? 'Editar' : 'Nova'} Região</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Código</Label><Input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))} placeholder="RJ" /></div>
              <div><Label>Multiplicador (%)</Label><Input type="number" step="0.01" value={form.multiplicador_preco} onChange={e => setForm(f => ({ ...f, multiplicador_preco: parseFloat(e.target.value) || 1 }))} /></div>
            </div>
            <div><Label>Nome</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Rio de Janeiro - Capital" /></div>
            <div><Label>Descrição</Label><Input value={form.descricao || ''} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} /></div>
            <div>
              <Label>Cidades (uma por linha)</Label>
              <Textarea
                rows={5}
                value={(form.cidades || []).join('\n')}
                onChange={e => setForm(f => ({ ...f, cidades: e.target.value.split('\n').map(c => c.trim()).filter(Boolean) }))}
                placeholder="Rio de Janeiro&#10;Niterói&#10;São Gonçalo"
              />
            </div>
            <div><Label>Ordem</Label><Input type="number" value={form.ordem} onChange={e => setForm(f => ({ ...f, ordem: parseInt(e.target.value) || 0 }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.codigo.trim() || !form.nome.trim() || isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
