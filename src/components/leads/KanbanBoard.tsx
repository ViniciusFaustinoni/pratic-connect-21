import { useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ETAPA_LABELS, type EtapaLead } from '@/types/database';
import { etapaDotColors, ETAPAS_KANBAN_VENDAS } from '@/lib/lead-transitions';
import { LeadKanbanCard } from '@/components/leads/LeadKanbanCard';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragMoveEvent,
  closestCenter,
  useDroppable,
  type SensorDescriptor,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { LeadWithVendedor } from '@/hooks/useLeads';

interface KanbanBoardProps {
  allLeads: LeadWithVendedor[] | undefined;
  sensors: SensorDescriptor<any>[];
  handleDragStart: (event: DragStartEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  activeLead: LeadWithVendedor | null;
  setDrawerLeadId: (id: string) => void;
  showVendedor?: boolean;
}

// Droppable column component
function DroppableColumn({
  etapa,
  children,
  leadsCount,
}: {
  etapa: EtapaLead;
  children: React.ReactNode;
  leadsCount: number;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: etapa,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-[280px] min-w-[280px] flex flex-col rounded-xl bg-muted/50 h-full transition-colors ${
        isOver ? 'ring-2 ring-primary/50 bg-primary/5' : ''
      }`}
    >
      {/* Header da coluna com dot colorido */}
      <div className="flex-shrink-0 bg-muted/50 px-3 py-2.5 border-b border-border/50 rounded-t-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${etapaDotColors[etapa]}`} />
            <span className="font-semibold text-sm text-foreground">
              {ETAPA_LABELS[etapa]}
            </span>
          </div>
          <span className="w-6 h-6 rounded-full bg-muted text-xs font-medium flex items-center justify-center">
            {leadsCount}
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}

export function KanbanBoard({
  allLeads,
  sensors,
  handleDragStart,
  handleDragEnd,
  activeLead,
  setDrawerLeadId,
  showVendedor,
}: KanbanBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);

  // Trello-like: convert vertical wheel to horizontal scroll
  // BUT: do not hijack wheel when the pointer is over a vertically scrollable column.
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!boardRef.current) return;

    const target = e.target as HTMLElement | null;
    if (!target) return;

    // If the user is scrolling over an element that can scroll vertically,
    // let the default vertical scrolling happen (prevents the "scroll travado" feeling).
    let el: HTMLElement | null = target;
    while (el && el !== boardRef.current) {
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;
      const canScrollY =
        (overflowY === 'auto' || overflowY === 'scroll') &&
        el.scrollHeight > el.clientHeight;

      if (canScrollY) return;
      el = el.parentElement;
    }

    // If user is scrolling vertically (normal mouse wheel) and not holding shift,
    // convert it into horizontal scroll on the kanban board.
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && !e.shiftKey) {
      e.preventDefault();
      boardRef.current.scrollLeft += e.deltaY;
    }
  }, []);

  const scrollBoard = useCallback((direction: 'left' | 'right') => {
    if (!boardRef.current) return;
    const scrollAmount = 250;
    boardRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  }, []);

  // Auto-scroll during drag when near edges (Trello-like)
  const handleDragMove = useCallback((event: DragMoveEvent) => {
    if (!boardRef.current) return;
    
    const { activatorEvent } = event;
    if (!activatorEvent || !('clientX' in activatorEvent)) return;
    
    const clientX = (activatorEvent as MouseEvent).clientX;
    const rect = boardRef.current.getBoundingClientRect();
    
    const triggerZone = 80; // px from edge
    const speed = 16; // scroll speed
    
    // Near right edge
    if (clientX > rect.right - triggerZone) {
      const intensity = 1 - (rect.right - clientX) / triggerZone;
      boardRef.current.scrollLeft += speed * intensity;
    }
    // Near left edge
    else if (clientX < rect.left + triggerZone) {
      const intensity = 1 - (clientX - rect.left) / triggerZone;
      boardRef.current.scrollLeft -= speed * intensity;
    }
  }, []);

  return (
    <div className="flex-1 min-h-0 relative w-full overflow-hidden">
      {/* Scroll buttons */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm shadow-md hover:bg-background border"
        onClick={() => scrollBoard('left')}
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm shadow-md hover:bg-background border"
        onClick={() => scrollBoard('right')}
      >
        <ChevronRight className="h-5 w-5" />
      </Button>

      {/* Edge fade indicators */}
      <div className="absolute left-10 top-0 bottom-0 w-6 bg-gradient-to-r from-background to-transparent pointer-events-none z-[5]" />
      <div className="absolute right-10 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent pointer-events-none z-[5]" />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragMove={handleDragMove}
        autoScroll={{
          threshold: { x: 0.1, y: 0.1 },
          acceleration: 10,
        }}
      >
        <div
          ref={boardRef}
          onWheel={handleWheel}
          className="h-full overflow-x-scroll overflow-y-hidden pb-6 kanban-scroll overscroll-x-contain touch-pan-x"
          style={{ scrollbarGutter: 'stable' }}
        >
          <div 
            className="flex gap-3 px-12 h-full"
            style={{ minWidth: `${ETAPAS_KANBAN_VENDAS.length * 295}px` }}
          >
          {ETAPAS_KANBAN_VENDAS.map((etapa) => {
            const leadsInEtapa = (allLeads || []).filter((l) => l.etapa === etapa);
            return (
              <DroppableColumn key={etapa} etapa={etapa} leadsCount={leadsInEtapa.length}>
                {/* Cards com scroll vertical */}
                <SortableContext
                  items={leadsInEtapa.map((l) => l.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div
                    className="flex flex-col gap-2 flex-1 p-2 overflow-y-auto scrollbar-thin"
                    data-etapa={etapa}
                  >
                    {leadsInEtapa.map((lead) => (
                      <LeadKanbanCard
                        key={lead.id}
                        lead={lead as any}
                        onClick={() => setDrawerLeadId(lead.id)}
                        showVendedor={showVendedor}
                      />
                    ))}
                    {leadsInEtapa.length === 0 && (
                      <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground py-8">
                        Nenhum lead
                      </div>
                    )}
                  </div>
                </SortableContext>
              </DroppableColumn>
            );
          })}
          </div>
        </div>
        <DragOverlay>
          {activeLead ? (
            <Card className="shadow-lg w-[280px]">
              <CardContent className="p-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                    {activeLead.nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{activeLead.nome}</p>
                    <p className="text-xs text-muted-foreground">{activeLead.telefone}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
