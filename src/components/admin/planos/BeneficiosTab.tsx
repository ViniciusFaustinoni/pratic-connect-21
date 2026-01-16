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
import { useBenefits } from '@/hooks/usePlans';
import { useDeleteBenefit, useUpdateBenefit } from '@/hooks/usePlansAdmin';
import { BeneficioFormModal } from './BeneficioFormModal';
import type { Benefit } from '@/types/plans';

export function BeneficiosTab() {
  const { data: benefits, isLoading } = useBenefits();
  const [editingBenefit, setEditingBenefit] = useState<Benefit | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteBenefit = useDeleteBenefit();
  const updateBenefit = useUpdateBenefit();

  const handleNewBenefit = () => {
    setEditingBenefit(null);
    setIsModalOpen(true);
  };

  const handleEdit = (benefit: Benefit) => {
    setEditingBenefit(benefit);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteBenefit.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const handleToggleActive = async (benefit: Benefit) => {
    await updateBenefit.mutateAsync({
      id: benefit.id,
      name: benefit.name,
      slug: benefit.slug,
      is_active: !benefit.is_active,
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
          Benefícios Cadastrados ({benefits?.length || 0})
        </h3>
        <Button onClick={handleNewBenefit}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Benefício
        </Button>
      </div>

      {!benefits || benefits.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum benefício cadastrado. Clique em "Novo Benefício" para criar.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Ícone</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden md:table-cell">Slug</TableHead>
                <TableHead className="hidden md:table-cell">Categoria</TableHead>
                <TableHead className="w-20 text-center">Ordem</TableHead>
                <TableHead className="w-20 text-center">Status</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {benefits
                .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                .map((benefit) => (
                  <TableRow key={benefit.id}>
                    <TableCell className="text-xl">{benefit.icon}</TableCell>
                    <TableCell className="font-medium">{benefit.name}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        {benefit.slug}
                      </code>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {benefit.category || '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {benefit.display_order || 0}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={benefit.is_active ?? true}
                        onCheckedChange={() => handleToggleActive(benefit)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(benefit)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleteId(benefit.id)}
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

      {/* Benefit Form Modal */}
      <BeneficioFormModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        benefit={editingBenefit}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O benefício será permanentemente
              removido e desvinculado de todos os planos.
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
