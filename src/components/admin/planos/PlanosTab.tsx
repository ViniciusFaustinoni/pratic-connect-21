import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Car, Bike } from 'lucide-react';
import { useProductLines, usePlans, PlanWithDetails } from '@/hooks/usePlans';
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

const LINE_COLORS: Record<string, { active: string; inactive: string }> = {
  green: { 
    active: 'border-2 border-green-500 bg-green-500/20 text-green-400', 
    inactive: 'border border-slate-600 text-slate-300 hover:border-green-500/50 hover:bg-green-500/10' 
  },
  orange: { 
    active: 'border-2 border-orange-500 bg-orange-500/20 text-orange-400', 
    inactive: 'border border-slate-600 text-slate-300 hover:border-orange-500/50 hover:bg-orange-500/10' 
  },
  purple: { 
    active: 'border-2 border-purple-500 bg-purple-500/20 text-purple-400', 
    inactive: 'border border-slate-600 text-slate-300 hover:border-purple-500/50 hover:bg-purple-500/10' 
  },
  red: { 
    active: 'border-2 border-red-500 bg-red-500/20 text-red-400', 
    inactive: 'border border-slate-600 text-slate-300 hover:border-red-500/50 hover:bg-red-500/10' 
  },
  blue: { 
    active: 'border-2 border-blue-500 bg-blue-500/20 text-blue-400', 
    inactive: 'border border-slate-600 text-slate-300 hover:border-blue-500/50 hover:bg-blue-500/10' 
  },
  emerald: { 
    active: 'border-2 border-emerald-500 bg-emerald-500/20 text-emerald-400', 
    inactive: 'border border-slate-600 text-slate-300 hover:border-emerald-500/50 hover:bg-emerald-500/10' 
  },
  teal: { 
    active: 'border-2 border-teal-500 bg-teal-500/20 text-teal-400', 
    inactive: 'border border-slate-600 text-slate-300 hover:border-teal-500/50 hover:bg-teal-500/10' 
  },
  cyan: { 
    active: 'border-2 border-cyan-500 bg-cyan-500/20 text-cyan-400', 
    inactive: 'border border-slate-600 text-slate-300 hover:border-cyan-500/50 hover:bg-cyan-500/10' 
  },
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
      {/* Header with New Plan Button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">
          Planos por Linha de Produto
        </h3>
        <Button onClick={handleNewPlan} disabled={!selectedLineId}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Plano
        </Button>
      </div>

      {/* Line Selector */}
      <div className="flex flex-wrap gap-2">
        {productLines?.map((line) => {
          const isSelected = selectedLineId === line.id;
          const colorConfig = LINE_COLORS[line.color || 'blue'] || LINE_COLORS['blue'];
          return (
            <button
              key={line.id}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium ${
                isSelected ? colorConfig.active : colorConfig.inactive
              }`}
              onClick={() => setSelectedLineId(line.id)}
            >
              {LINE_ICONS[line.vehicle_type || 'car']}
              <span>{line.icon}</span>
              {line.name}
            </button>
          );
        })}
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
                    lineColor={selectedLine?.color}
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
