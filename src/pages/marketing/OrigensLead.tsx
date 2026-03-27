import { useState } from 'react';
import { Plus, Search, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useLeadOrigens, useUpdateLeadOrigem, useDeleteLeadOrigem, type LeadOrigem } from '@/hooks/useLeadOrigens';
import { OrigemLeadFormDialog } from '@/components/marketing/OrigemLeadFormDialog';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const CATEGORIA_COLORS: Record<string, string> = {
  instagram: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  facebook: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  google: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  whatsapp: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  indicacao: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  site: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  telefone: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  presencial: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  parceiro: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  outro: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

const CATEGORIA_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  google: 'Google',
  whatsapp: 'WhatsApp',
  indicacao: 'Indicação',
  site: 'Site',
  telefone: 'Telefone',
  presencial: 'Presencial',
  parceiro: 'Parceiro',
  outro: 'Outro',
};

export default function OrigensLead() {
  const { data: origens = [], isLoading } = useLeadOrigens();
  const updateOrigem = useUpdateLeadOrigem();
  const deleteOrigem = useDeleteLeadOrigem();

  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [formOpen, setFormOpen] = useState(false);
  const [editingOrigem, setEditingOrigem] = useState<LeadOrigem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const categorias = [...new Set(origens.map((o) => o.categoria))].sort();

  const filtered = origens.filter((o) => {
    const matchBusca = o.nome.toLowerCase().includes(busca.toLowerCase());
    const matchCat = filtroCategoria === 'todas' || o.categoria === filtroCategoria;
    return matchBusca && matchCat;
  });

  const handleToggleAtivo = async (origem: LeadOrigem) => {
    try {
      await updateOrigem.mutateAsync({ id: origem.id, ativo: !origem.ativo });
      toast.success(origem.ativo ? 'Origem desativada' : 'Origem ativada');
    } catch {
      toast.error('Erro ao alterar status');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteOrigem.mutateAsync(deleteId);
      toast.success('Origem excluída com sucesso');
      setDeleteId(null);
    } catch {
      toast.error('Erro ao excluir. Verifique se há leads vinculados.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Origens de Lead</h1>
          <p className="text-muted-foreground">Gerencie os canais de captação de leads</p>
        </div>
        <Button onClick={() => { setEditingOrigem(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Origem
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar origem..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {categorias.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {CATEGORIA_LABELS[cat] || cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhuma origem encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((origem) => (
                  <TableRow key={origem.id} className={!origem.ativo ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">{origem.nome}</TableCell>
                    <TableCell>
                      <Badge className={CATEGORIA_COLORS[origem.categoria] || CATEGORIA_COLORS.outro} variant="secondary">
                        {CATEGORIA_LABELS[origem.categoria] || origem.categoria}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                      {origem.descricao || '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleAtivo(origem)}
                        title={origem.ativo ? 'Desativar' : 'Ativar'}
                      >
                        {origem.ativo ? (
                          <ToggleRight className="h-5 w-5 text-green-600" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setEditingOrigem(origem); setFormOpen(true); }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(origem.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Form Dialog */}
      <OrigemLeadFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        origem={editingOrigem}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Origem</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta origem? Esta ação não pode ser desfeita.
              Leads já vinculados perderão a referência.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
