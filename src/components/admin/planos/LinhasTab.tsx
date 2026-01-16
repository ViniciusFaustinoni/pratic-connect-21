import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Plus, Edit, Trash2, Car, Bike } from 'lucide-react';
import { useProductLines, usePlans } from '@/hooks/usePlans';
import { useDeleteProductLine, useUpdateProductLine } from '@/hooks/usePlansAdmin';
import { LinhaFormModal } from './LinhaFormModal';
import type { ProductLine } from '@/types/plans';

const LINE_COLORS: Record<string, string> = {
  green: 'bg-green-100 border-green-500 text-green-800',
  orange: 'bg-orange-100 border-orange-500 text-orange-800',
  purple: 'bg-purple-100 border-purple-500 text-purple-800',
  red: 'bg-red-100 border-red-500 text-red-800',
  blue: 'bg-blue-100 border-blue-500 text-blue-800',
};

export function LinhasTab() {
  const { data: productLines, isLoading: loadingLines } = useProductLines();
  const { data: plans } = usePlans();
  const [editingLine, setEditingLine] = useState<ProductLine | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteLine = useDeleteProductLine();
  const updateLine = useUpdateProductLine();

  const handleNewLine = () => {
    setEditingLine(null);
    setIsModalOpen(true);
  };

  const handleEdit = (line: ProductLine) => {
    setEditingLine(line);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteLine.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const handleToggleActive = async (line: ProductLine) => {
    await updateLine.mutateAsync({
      id: line.id,
      name: line.name,
      slug: line.slug,
      is_active: !line.is_active,
    });
  };

  const getPlansCount = (lineId: string) => {
    return plans?.filter((p) => p.product_line_id === lineId).length || 0;
  };

  if (loadingLines) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">
          Linhas de Produtos ({productLines?.length || 0})
        </h3>
        <Button onClick={handleNewLine}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Linha
        </Button>
      </div>

      {!productLines || productLines.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma linha de produto cadastrada. Clique em "Nova Linha" para criar.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {productLines
            .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
            .map((line) => (
              <Card
                key={line.id}
                className={`relative ${
                  !line.is_active ? 'opacity-60' : ''
                } border-l-4 ${
                  LINE_COLORS[line.color || 'blue']?.split(' ')[1] || 'border-blue-500'
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{line.icon}</span>
                      <div>
                        <CardTitle className="text-base">{line.name}</CardTitle>
                        <code className="text-xs text-muted-foreground">
                          {line.slug}
                        </code>
                      </div>
                    </div>
                    <Switch
                      checked={line.is_active ?? true}
                      onCheckedChange={() => handleToggleActive(line)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    {line.vehicle_type === 'car' ? (
                      <Car className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Bike className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm capitalize">
                      {line.vehicle_type === 'car' ? 'Carros' : 'Motos'}
                    </span>
                    <Badge
                      variant="secondary"
                      className={LINE_COLORS[line.color || 'blue']}
                    >
                      {line.color}
                    </Badge>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    {getPlansCount(line.id)} plano(s) cadastrado(s)
                  </div>

                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(line)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteId(line.id)}
                      disabled={getPlansCount(line.id) > 0}
                    >
                      <Trash2 className="h-4 w-4 mr-1 text-destructive" />
                      Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* Line Form Modal */}
      <LinhaFormModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        productLine={editingLine}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A linha de produto será permanentemente
              removida. Certifique-se de que não há planos vinculados a esta linha.
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
