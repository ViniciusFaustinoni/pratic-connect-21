import { useDroppable } from '@dnd-kit/core';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LeadCardSimple } from './LeadCardSimple';
import { ETAPA_LABELS, type EtapaLead } from '@/types/database';
import { cn } from '@/lib/utils';

// Simplified stages for pre-sale kanban
const ETAPAS_KANBAN: EtapaLead[] = [
  'novo',
  'contato',
  'qualificado',
  'cotacao_enviada',
  'negociacao',
  'ganho',
  'perdido',
];

const ETAPA_COLORS: Record<string, string> = {
  novo: 'border-t-blue-500',
  contato: 'border-t-yellow-500',
  qualificado: 'border-t-purple-500',
  cotacao_enviada: 'border-t-orange-500',
  negociacao: 'border-t-pink-500',
  ganho: 'border-t-green-500',
  perdido: 'border-t-red-500',
};

const ETAPA_BADGE_COLORS: Record<string, string> = {
  novo: 'bg-blue-500/20 text-blue-400',
  contato: 'bg-yellow-500/20 text-yellow-400',
  qualificado: 'bg-purple-500/20 text-purple-400',
  cotacao_enviada: 'bg-orange-500/20 text-orange-400',
  negociacao: 'bg-pink-500/20 text-pink-400',
  ganho: 'bg-green-500/20 text-green-400',
  perdido: 'bg-red-500/20 text-red-400',
};

interface Lead {
  id: string;
  nome: string;
  telefone: string;
  origem: string;
  etapa: string;
  created_at: string;
  updated_at: string;
  vendedor?: {
    nome: string;
  } | null;
}

interface DroppableColumnProps {
  etapa: EtapaLead;
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
}

function DroppableColumn({ etapa, leads, onLeadClick }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa });

  return (
    <Card
      className={cn(
        'flex flex-col min-w-[280px] max-w-[280px] flex-shrink-0 border-t-4 bg-card',
        ETAPA_COLORS[etapa],
        isOver && 'ring-2 ring-primary ring-offset-2'
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <span className="font-medium text-sm">{ETAPA_LABELS[etapa]}</span>
        <Badge variant="secondary" className={cn('text-xs', ETAPA_BADGE_COLORS[etapa])}>
          {leads.length}
        </Badge>
      </div>

      {/* Column Body with Cards */}
      <ScrollArea className="flex-1 max-h-[calc(100vh-360px)]">
        <div ref={setNodeRef} className="p-2 space-y-2 min-h-[100px]">
          <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
            {leads.map((lead) => (
              <LeadCardSimple
                key={lead.id}
                lead={lead}
                onClick={() => onLeadClick(lead)}
              />
            ))}
          </SortableContext>
          {leads.length === 0 && (
            <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
              Nenhum lead
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}

interface LeadsKanbanNewProps {
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
  onLeadMove: (leadId: string, newEtapa: EtapaLead) => void;
  isLoading?: boolean;
}

export function LeadsKanbanNew({
  leads,
  onLeadClick,
  onLeadMove,
  isLoading,
}: LeadsKanbanNewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;

    if (!over) return;

    const leadId = active.id as string;
    const newEtapa = over.id as EtapaLead;

    // Check if dropped over a column (not another card)
    if (ETAPAS_KANBAN.includes(newEtapa)) {
      const lead = leads.find((l) => l.id === leadId);
      if (lead && lead.etapa !== newEtapa) {
        onLeadMove(leadId, newEtapa);
      }
    }
  };

  // Group leads by stage
  const leadsByEtapa = ETAPAS_KANBAN.reduce((acc, etapa) => {
    acc[etapa] = leads.filter((lead) => lead.etapa === etapa);
    return acc;
  }, {} as Record<EtapaLead, Lead[]>);

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Carregando leads...</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Kanban Container with horizontal scroll */}
      <div className="flex gap-4 overflow-x-auto overflow-y-hidden pb-4 px-6 h-[calc(100vh-260px)]">
        {ETAPAS_KANBAN.map((etapa) => (
          <DroppableColumn
            key={etapa}
            etapa={etapa}
            leads={leadsByEtapa[etapa] || []}
            onLeadClick={onLeadClick}
          />
        ))}
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeLead && (
          <div className="opacity-80 rotate-3 shadow-2xl">
            <LeadCardSimple lead={activeLead} onClick={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
