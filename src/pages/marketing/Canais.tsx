import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Search, Radio, MoreVertical, Edit, Trash2, Eye } from 'lucide-react';
import { useCanais, useDeleteCanal, CanalMarketing } from '@/hooks/useMarketing';
import { CanalFormDialog } from '@/components/marketing/CanalFormDialog';

const tipoLabel: Record<string, string> = {
  organico: 'Orgânico',
  pago: 'Pago',
  social: 'Social',
  email: 'E-mail',
  indicacao: 'Indicação',
  parceria: 'Parceria',
  outro: 'Outro',
};

export default function Canais() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<CanalMarketing | null>(null);
  const [deleting, setDeleting] = useState<CanalMarketing | null>(null);

  const { data: canais, isLoading } = useCanais();
  const deleteMutation = useDeleteCanal();

  const filtered = useMemo(() => {
    if (!canais) return [];
    const q = search.trim().toLowerCase();
    if (!q) return canais;
    return canais.filter(c =>
      c.nome.toLowerCase().includes(q) || c.tipo.toLowerCase().includes(q)
    );
  }, [canais, search]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Canais de Marketing</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie os canais de aquisição da sua operação
            </p>
          </div>
        </div>
        <Button onClick={() => { setEditing(null); setOpenForm(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Canal
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar canal..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Custo/Lead</TableHead>
                <TableHead className="text-right">Meta/Mês</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum canal cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(c => (
                  <TableRow key={c.id} className="cursor-pointer">
                    <TableCell
                      className="font-medium"
                      onClick={() => navigate(`/marketing/canais/${c.id}`)}
                    >
                      {c.nome}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{tipoLabel[c.tipo] || c.tipo}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {c.custo_por_lead != null ? `R$ ${Number(c.custo_por_lead).toFixed(2)}` : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.meta_leads_mes ?? '—'}
                    </TableCell>
                    <TableCell>
                      {c.ativo
                        ? <Badge className="bg-green-100 text-green-800">Ativo</Badge>
                        : <Badge variant="outline">Inativo</Badge>}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/marketing/canais/${c.id}`)}>
                            <Eye className="h-4 w-4 mr-2" /> Ver detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setEditing(c); setOpenForm(true); }}>
                            <Edit className="h-4 w-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleting(c)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CanalFormDialog
        open={openForm}
        onClose={() => { setOpenForm(false); setEditing(null); }}
        canal={editing}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir canal?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Campanhas vinculadas a este canal ficarão sem canal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleting) {
                  deleteMutation.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
