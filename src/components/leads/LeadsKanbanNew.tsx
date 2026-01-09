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
import { Plus, Inbox, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LeadCard } from './LeadCard';
import { LeadsEmptyState } from './LeadsEmptyState';
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
  novo: 'border-t-blue-500 bg-blue-500/5',
  contato: 'border-t-yellow-500 bg-yellow-500/5',
  qualificado: 'border-t-purple-500 bg-purple-500/5',
  cotacao_enviada: 'border-t-orange-500 bg-orange-500/5',
  negociacao: 'border-t-pink-500 bg-pink-500/5',
  ganho: 'border-t-green-500 bg-green-500/5',
  perdido: 'border-t-red-500 bg-red-500/5',
};

const ETAPA_HEADER_COLORS: Record<string, string> = {
  novo: 'text-blue-400',
  contato: 'text-yellow-400',
  qualificado: 'text-purple-400',
  cotacao_enviada: 'text-orange-400',
  negociacao: 'text-pink-400',
  ganho: 'text-green-400',
  perdido: 'text-red-400',
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
  onLeadDelete?: (id: string) => void;
  onAddLead?: (etapa: EtapaLead) => void;
}

function DroppableColumn({
  etapa,
  leads,
  onLeadClick,
  onLeadDelete,
  onAddLead,
}: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa });

  return (
    <Card
      className={cn(
        'flex flex-col min-w-[300px] max-w-[300px] flex-shrink-0 border-t-4',
        'bg-card/50 backdrop-blur-sm',
        ETAPA_COLORS[etapa],
        isOver && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
      )}
    >
      {/* Column Header */}
      <div className="flex flex-col gap-1 p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className={cn('h-4 w-4', ETAPA_HEADER_COLORS[etapa])} />
            <span className="font-semibold text-sm">{ETAPA_LABELS[etapa]}</span>
          </div>
          <Badge
            variant="secondary"
            className={cn('text-xs font-medium', ETAPA_BADGE_COLORS[etapa])}
          >
            {leads.length}
          </Badge>
        </div>
      </div>

      {/* Column Body with Cards */}
      <ScrollArea className="flex-1 max-h-[45vh]">
        <div ref={setNodeRef} className="p-3 space-y-3 min-h-[120px]">
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
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum lead</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Column Footer */}
      {onAddLead && (
        <div className="p-3 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="w-full gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => onAddLead(etapa)}
          >
            <Plus className="h-4 w-4" />
            Adicionar lead
          </Button>
        </div>
      )}
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
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Update scroll button visibility
  const updateScrollButtons = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    
    updateScrollButtons();
    el.addEventListener('scroll', updateScrollButtons);
    window.addEventListener('resize', updateScrollButtons);
    
    return () => {
      el.removeEventListener('scroll', updateScrollButtons);
      window.removeEventListener('resize', updateScrollButtons);
    };
  }, [updateScrollButtons, leads]);

  // Scroll board programmatically
  const scrollBoard = useCallback((direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = 320; // column width
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  }, []);

  // Smart wheel handler - convert vertical to horizontal when appropriate
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!scrollRef.current) return;
    
    // If Shift is pressed, let native horizontal scroll work
    if (e.shiftKey) return;
    
    // Check if pointer is over an element that can scroll vertically
    let target = e.target as HTMLElement | null;
    while (target && target !== scrollRef.current) {
      const style = window.getComputedStyle(target);
      const isScrollable = 
        (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
        target.scrollHeight > target.clientHeight;
      
      if (isScrollable) {
        // Check if we're at scroll boundaries
        const atTop = target.scrollTop <= 0;
        const atBottom = target.scrollTop >= target.scrollHeight - target.clientHeight - 1;
        
        // If scrolling up and not at top, or scrolling down and not at bottom, let it scroll
        if ((e.deltaY < 0 && !atTop) || (e.deltaY > 0 && !atBottom)) {
          return; // Let vertical scroll happen naturally
        }
      }
      target = target.parentElement;
    }
    
    // Convert vertical wheel to horizontal scroll
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      scrollRef.current.scrollLeft += e.deltaY;
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
      {/* Kanban Container */}
      <div className="relative h-full">
        {/* Left scroll button */}
        {canScrollLeft && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full shadow-lg bg-background/90 backdrop-blur-sm hover:bg-background"
            onClick={() => scrollBoard('left')}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}

        {/* Right scroll button */}
        {canScrollRight && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full shadow-lg bg-background/90 backdrop-blur-sm hover:bg-background"
            onClick={() => scrollBoard('right')}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        )}

        {/* Scrollable board */}
        <div
          ref={scrollRef}
          onWheel={handleWheel}
          className="flex gap-4 overflow-x-scroll overflow-y-hidden pb-6 px-6 h-full kanban-scroll"
          style={{ scrollbarGutter: 'stable' }}
        >
          {ETAPAS_KANBAN.map((etapa) => (
            <DroppableColumn
              key={etapa}
              etapa={etapa}
              leads={leadsByEtapa[etapa] || []}
              onLeadClick={onLeadClick}
              onLeadDelete={onLeadDelete}
              onAddLead={onAddLead}
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
