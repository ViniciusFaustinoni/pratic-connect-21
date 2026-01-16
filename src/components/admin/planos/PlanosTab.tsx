import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Car, Bike } from 'lucide-react';
import { useProductLines, usePlans } from '@/hooks/usePlans';
import { PlanCard } from './PlanCard';
import { PlanFormModal } from './PlanFormModal';
import { useDeletePlan, useDuplicatePlan, useReorderPlans } from '@/hooks/usePlansAdmin';
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
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { PlanWithDetails } from '@/types/plans';

const LINE_COLORS: Record<string, string> = {
  green: 'border-green-500 text-green-700 hover:bg-green-50',
  orange: 'border-orange-500 text-orange-700 hover:bg-orange-50',
  purple: 'border-purple-500 text-purple-700 hover:bg-purple-50',
  red: 'border-red-500 text-red-700 hover:bg-red-50',
  blue: 'border-blue-500 text-blue-700 hover:bg-blue-50',
};

const LINE_ICONS: Record<string, React.ReactNode> = {
  car: <Car className="h-4 w-4" />,
  motorcycle: <Bike className="h-4 w-4" />,
};

export function PlanosTab() {
  const { data: productLines, isLoading: loadingLines } = useProductLines();
  const { data: plans, isLoading: loadingPlans } = usePlans();
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<PlanWithDetails | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deletePlan = useDeletePlan();
  const duplicatePlan = useDuplicatePlan();
  const reorderPlans = useReorderPlans();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Set first line as default when loaded
  if (!selectedLineId && productLines && productLines.length > 0) {
    setSelectedLineId(productLines[0].id);
  }

  const selectedLine = productLines?.find((l) => l.id === selectedLineId);
  const filteredPlans = plans?.filter((p) => p.product_line_id === selectedLineId) || [];

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = filteredPlans.findIndex((p) => p.id === active.id);
    const newIndex = filteredPlans.findIndex((p) => p.id === over.id);
    const newOrder = arrayMove(filteredPlans, oldIndex, newIndex);

    await reorderPlans.mutateAsync(
      newOrder.map((plan, index) => ({
        id: plan.id,
        display_order: index,
      }))
    );
  };

  const handleNewPlan = () => {
    setEditingPlan(null);
    setIsModalOpen(true);
  };

  const handleEdit = (plan: PlanWithDetails) => {
    setEditingPlan(plan);
    setIsModalOpen(true);
  };

  const handleDuplicate = async (id: string) => {
    await duplicatePlan.mutateAsync(id);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deletePlan.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  if (loadingLines || loadingPlans) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-32" />
          ))}
        </div>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Line Selector */}
      <div className="flex flex-wrap gap-2">
        {productLines?.map((line) => (
          <Button
            key={line.id}
            variant={selectedLineId === line.id ? 'default' : 'outline'}
            className={selectedLineId !== line.id ? LINE_COLORS[line.color || 'blue'] : ''}
            onClick={() => setSelectedLineId(line.id)}
          >
            {LINE_ICONS[line.vehicle_type || 'car']}
            <span className="ml-2">{line.icon}</span>
            {line.name}
          </Button>
        ))}
      </div>

      {/* Action Bar */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">
          {selectedLine?.name || 'Selecione uma linha'}
        </h3>
        <Button onClick={handleNewPlan} disabled={!selectedLineId}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Plano
        </Button>
      </div>

      {/* Plans List */}
      {filteredPlans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum plano nesta linha. Clique em "Novo Plano" para criar.
          </CardContent>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredPlans.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {filteredPlans
                .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                .map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    onEdit={() => handleEdit(plan)}
                    onDuplicate={() => handleDuplicate(plan.id)}
                    onDelete={() => setDeleteId(plan.id)}
                  />
                ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Plan Form Modal */}
      <PlanFormModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        plan={editingPlan}
        defaultProductLineId={selectedLineId || undefined}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O plano será permanentemente removido.
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
