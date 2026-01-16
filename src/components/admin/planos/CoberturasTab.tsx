import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useMainCoverages } from '@/hooks/usePlans';
import { useDeleteMainCoverage, useUpdateMainCoverage } from '@/hooks/usePlansAdmin';
import { CoberturaFormModal } from './CoberturaFormModal';
import type { MainCoverage } from '@/types/plans';

export function CoberturasTab() {
  const { data: coverages, isLoading } = useMainCoverages();
  const [editingCoverage, setEditingCoverage] = useState<MainCoverage | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteCoverage = useDeleteMainCoverage();
  const updateCoverage = useUpdateMainCoverage();

  const handleNewCoverage = () => {
    setEditingCoverage(null);
    setIsModalOpen(true);
  };

  const handleEdit = (coverage: MainCoverage) => {
    setEditingCoverage(coverage);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteCoverage.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const handleToggleActive = async (coverage: MainCoverage) => {
    await updateCoverage.mutateAsync({
      id: coverage.id,
      name: coverage.name,
      is_active: !coverage.is_active,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">
          Coberturas Principais ({coverages?.length || 0})
        </h3>
        <Button onClick={handleNewCoverage}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Cobertura
        </Button>
      </div>

      {!coverages || coverages.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma cobertura cadastrada. Clique em "Nova Cobertura" para criar.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Ícone</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden md:table-cell">Subtítulo</TableHead>
                <TableHead className="w-20 text-center">Ordem</TableHead>
                <TableHead className="w-20 text-center">Status</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coverages
                .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                .map((coverage) => (
                  <TableRow key={coverage.id}>
                    <TableCell className="text-xl">{coverage.icon}</TableCell>
                    <TableCell className="font-medium">{coverage.name}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {coverage.subtitle || '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {coverage.display_order || 0}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={coverage.is_active ?? true}
                        onCheckedChange={() => handleToggleActive(coverage)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(coverage)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleteId(coverage.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Coverage Form Modal */}
      <CoberturaFormModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        coverage={editingCoverage}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A cobertura será permanentemente
              removida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
