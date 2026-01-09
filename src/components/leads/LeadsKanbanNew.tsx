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
import { useState, useRef, useCallback, useEffect } from 'react';
import { Inbox, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { LeadCard } from './LeadCard';
import { LeadsEmptyState } from './LeadsEmptyState';
import { ETAPA_LABELS, type EtapaLead } from '@/types/database';
import { cn } from '@/lib/utils';

// All stages for pre-sale kanban (11 stages)
const ETAPAS_KANBAN: EtapaLead[] = [
  'novo',
  'contato',
  'qualificado',
  'cotacao_enviada',
  'negociacao',
  'vistoria_agendada',
  'contrato_enviado',
  'contrato_assinado',
  'instalacao_agendada',
  'ganho',
  'perdido',
];

const ETAPA_COLORS: Record<string, string> = {
  novo: 'border-t-blue-500 bg-blue-500/5',
  contato: 'border-t-yellow-500 bg-yellow-500/5',
  qualificado: 'border-t-purple-500 bg-purple-500/5',
  cotacao_enviada: 'border-t-orange-500 bg-orange-500/5',
  negociacao: 'border-t-pink-500 bg-pink-500/5',
  vistoria_agendada: 'border-t-teal-500 bg-teal-500/5',
  contrato_enviado: 'border-t-indigo-500 bg-indigo-500/5',
  contrato_assinado: 'border-t-emerald-500 bg-emerald-500/5',
  instalacao_agendada: 'border-t-cyan-500 bg-cyan-500/5',
  ganho: 'border-t-green-500 bg-green-500/5',
  perdido: 'border-t-red-500 bg-red-500/5',
};

const ETAPA_HEADER_COLORS: Record<string, string> = {
  novo: 'text-blue-400',
  contato: 'text-yellow-400',
  qualificado: 'text-purple-400',
  cotacao_enviada: 'text-orange-400',
  negociacao: 'text-pink-400',
  vistoria_agendada: 'text-teal-400',
  contrato_enviado: 'text-indigo-400',
  contrato_assinado: 'text-emerald-400',
  instalacao_agendada: 'text-cyan-400',
  ganho: 'text-green-400',
  perdido: 'text-red-400',
};

const ETAPA_BADGE_COLORS: Record<string, string> = {
  novo: 'bg-blue-500/20 text-blue-400',
  contato: 'bg-yellow-500/20 text-yellow-400',
  qualificado: 'bg-purple-500/20 text-purple-400',
  cotacao_enviada: 'bg-orange-500/20 text-orange-400',
  negociacao: 'bg-pink-500/20 text-pink-400',
  vistoria_agendada: 'bg-teal-500/20 text-teal-400',
  contrato_enviado: 'bg-indigo-500/20 text-indigo-400',
  contrato_assinado: 'bg-emerald-500/20 text-emerald-400',
  instalacao_agendada: 'bg-cyan-500/20 text-cyan-400',
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
  onLeadDelete?: (id: string) => void;
}

function DroppableColumn({
  etapa,
  leads,
  onLeadClick,
  onLeadDelete,
}: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa });

  return (
    <Card
      className={cn(
        'flex flex-col w-72 min-w-[288px] max-w-[288px] h-full border-t-4',
        'bg-card/50 backdrop-blur-sm',
        ETAPA_COLORS[etapa],
        isOver && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
      )}
    >
      {/* Column Header */}
      <div className="flex flex-col gap-1 p-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className={cn('h-4 w-4', ETAPA_HEADER_COLORS[etapa])} />
            <span className="font-semibold text-xs truncate max-w-[180px]">
              {ETAPA_LABELS[etapa]}
            </span>
          </div>
          <Badge
            variant="secondary"
            className={cn('text-xs font-medium shrink-0', ETAPA_BADGE_COLORS[etapa])}
          >
            {leads.length}
          </Badge>
        </div>
      </div>

      {/* Column Body - NATIVE SCROLL instead of ScrollArea */}
      <div
        ref={setNodeRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2 space-y-2"
        data-scroll-vertical="true"
      >
        <SortableContext
          items={leads.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onClick={() => onLeadClick(lead)}
              onDelete={onLeadDelete}
            />
          ))}
        </SortableContext>
        {leads.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Inbox className="h-6 w-6 text-muted-foreground/50 mb-2" />
            <p className="text-xs text-muted-foreground">Nenhum lead</p>
          </div>
        )}
      </div>
    </Card>
  );
}

interface LeadsKanbanNewProps {
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
  onLeadMove: (leadId: string, newEtapa: EtapaLead) => void;
  onLeadDelete?: (id: string) => void;
  onAddLead?: (etapa?: EtapaLead) => void;
  isLoading?: boolean;
}

export function LeadsKanbanNew({
  leads,
  onLeadClick,
  onLeadMove,
  onLeadDelete,
  onAddLead,
  isLoading,
}: LeadsKanbanNewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Smart wheel handler - convert vertical to horizontal when appropriate
  const handleWheel = useCallback((e: React.WheelEvent) => {
    const container = scrollRef.current;
    if (!container) return;
    
    // If Shift is pressed, let native horizontal scroll work
    if (e.shiftKey) return;
    
    // Check if pointer is over an element that can scroll vertically
    const target = e.target as HTMLElement;
    const scrollableParent = target.closest('[data-scroll-vertical="true"]') as HTMLElement | null;
    
    if (scrollableParent) {
      const { scrollTop, scrollHeight, clientHeight } = scrollableParent;
      const canScrollUp = scrollTop > 0;
      const canScrollDown = scrollTop < scrollHeight - clientHeight - 1;
      
      // If element can scroll in wheel direction, let it scroll vertically
      if ((e.deltaY < 0 && canScrollUp) || (e.deltaY > 0 && canScrollDown)) {
        return;
      }
    }
    
    // Check if horizontal scroll is available
    const { scrollWidth, clientWidth } = container;
    if (scrollWidth <= clientWidth) return;
    
    // Convert vertical wheel to horizontal scroll
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      container.scrollLeft += e.deltaY;
    }
  }, []);

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

  if (leads.length === 0) {
    return <LeadsEmptyState onNewLead={onAddLead ? () => onAddLead() : undefined} />;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Scrollable board container */}
      <div
        ref={scrollRef}
        onWheel={handleWheel}
        className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden kanban-scroll"
        style={{ touchAction: 'pan-x' }}
      >
        {/* Inner container - FORCES min-width to enable horizontal scroll */}
        <div className="inline-flex gap-3 h-full min-w-max py-1 px-1">
          {ETAPAS_KANBAN.map((etapa) => (
            <DroppableColumn
              key={etapa}
              etapa={etapa}
              leads={leadsByEtapa[etapa] || []}
              onLeadClick={onLeadClick}
              onLeadDelete={onLeadDelete}
            />
          ))}
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeLead && (
          <div className="opacity-90 rotate-3 shadow-2xl scale-105">
            <LeadCard lead={activeLead} onClick={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
