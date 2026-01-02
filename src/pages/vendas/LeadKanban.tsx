import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ETAPA_LABELS, type EtapaLead } from '@/types/database';
import { useAllLeads, useUpdateLead, type LeadFilters } from '@/hooks/useLeads';
import { useVendedores } from '@/hooks/useVendedores';
import { LeadFormDialog } from '@/components/leads/LeadFormDialog';
import { LeadKanbanCard } from '@/components/leads/LeadKanbanCard';
import { toast } from 'sonner';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

const etapaColors: Record<EtapaLead, string> = {
  novo: 'bg-[hsl(var(--etapa-novo))] text-white',
  contato_inicial: 'bg-[hsl(var(--etapa-contato))] text-white',
  apresentacao: 'bg-[hsl(var(--etapa-apresentacao))] text-white',
  cotacao_enviada: 'bg-[hsl(var(--etapa-cotacao))] text-white',
  negociacao: 'bg-[hsl(var(--etapa-negociacao))] text-white',
  ganho: 'bg-[hsl(var(--etapa-ganho))] text-white',
  perdido: 'bg-[hsl(var(--etapa-perdido))] text-white',
};

const etapas: EtapaLead[] = [
  'novo',
  'contato_inicial',
  'apresentacao',
  'cotacao_enviada',
  'negociacao',
  'ganho',
  'perdido',
];

interface DroppableColumnProps {
  etapa: EtapaLead;
  children: React.ReactNode;
  count: number;
}

function DroppableColumn({ etapa, children, count }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-lg bg-muted/50 p-3 min-h-[calc(100vh-220px)] transition-colors ${
        isOver ? 'bg-primary/10 ring-2 ring-primary/50' : ''
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className={etapaColors[etapa]}>{ETAPA_LABELS[etapa]}</Badge>
          <span className="text-sm text-muted-foreground font-medium">{count}</span>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function LeadKanban() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<LeadFilters>({});
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: leads, isLoading } = useAllLeads(filters);
  const { data: vendedores } = useVendedores();
  const updateLead = useUpdateLead();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const leadId = active.id as string;
    const targetEtapa = over.id as EtapaLead;

    // Verifica se é uma etapa válida
    if (!etapas.includes(targetEtapa)) return;

    const lead = leads?.find((l) => l.id === leadId);
    if (!lead || lead.etapa === targetEtapa) return;

    try {
      await updateLead.mutateAsync({ id: leadId, etapa: targetEtapa });
      toast.success(`Lead movido para ${ETAPA_LABELS[targetEtapa]}`);
    } catch (error) {
      toast.error('Erro ao mover lead');
    }
  };

  const activeLead = activeId ? leads?.find((l) => l.id === activeId) : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kanban de Leads</h1>
          <p className="text-muted-foreground">
            Arraste os cards para mover leads entre as etapas
          </p>
        </div>
        <Button className="gap-2" onClick={() => setShowLeadForm(true)}>
          <Plus className="h-4 w-4" />
          Novo Lead
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <Input
          placeholder="Buscar leads..."
          className="w-full sm:w-64"
          value={filters.search || ''}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
        />
        <Select
          value={filters.vendedor_id || 'all'}
          onValueChange={(value) => setFilters((f) => ({ ...f, vendedor_id: value }))}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Todos vendedores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos vendedores</SelectItem>
            {vendedores?.map((v) => (
              <SelectItem key={v.user_id} value={v.user_id}>
                {v.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid auto-cols-[280px] grid-flow-col gap-4 overflow-x-auto pb-4">
          {etapas.map((etapa) => {
            const leadsInEtapa = (leads || []).filter((l) => l.etapa === etapa);
            return (
              <DroppableColumn key={etapa} etapa={etapa} count={leadsInEtapa.length}>
                <SortableContext
                  items={leadsInEtapa.map((l) => l.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex flex-col gap-2 flex-1">
                    {leadsInEtapa.map((lead) => (
                      <LeadKanbanCard
                        key={lead.id}
                        lead={lead}
                        onClick={() => navigate(`/vendas/leads/${lead.id}`)}
                      />
                    ))}
                    {leadsInEtapa.length === 0 && (
                      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                        Arraste leads para cá
                      </div>
                    )}
                  </div>
                </SortableContext>
              </DroppableColumn>
            );
          })}
        </div>

        <DragOverlay>
          {activeLead ? (
            <Card className="shadow-lg rotate-3">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    {activeLead.nome.charAt(0)}
                  </div>
                  <span className="font-medium">{activeLead.nome}</span>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>

      <LeadFormDialog open={showLeadForm} onOpenChange={setShowLeadForm} />
    </div>
  );
}
