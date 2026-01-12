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
import { useState, useRef, useCallback, useMemo } from 'react';
import { Inbox, Users, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { LeadCardEnhanced } from './LeadCardEnhanced';
import { LeadsEmptyState } from './LeadsEmptyState';
import { ETAPA_LABELS, type EtapaLead } from '@/types/database';
import { cn } from '@/lib/utils';
import { useLeadsInteressePlanosBulk } from '@/hooks/useLeadInteressePlanos';

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

// Updated colors matching the visual flow
const ETAPA_COLORS: Record<string, string> = {
  novo: 'border-t-blue-500',           // 🔵 Azul - Novo
  contato: 'border-t-yellow-500',      // 🟡 Amarelo - Em Contato
  qualificado: 'border-t-purple-500',  // 🟣 Roxo - Qualificado
  cotacao_enviada: 'border-t-violet-500', // 🟣 Violeta - Cotação
  negociacao: 'border-t-pink-500',
  vistoria_agendada: 'border-t-teal-500',
  contrato_enviado: 'border-t-amber-500',  // 🟡 Amarelo - Proposta Pendente
  contrato_assinado: 'border-t-green-500', // 🟢 Verde - Proposta Assinada
  instalacao_agendada: 'border-t-cyan-500',
  ganho: 'border-t-emerald-500',
  perdido: 'border-t-red-500',
};

const ETAPA_HEADER_COLORS: Record<string, string> = {
  novo: 'text-blue-500',
  contato: 'text-yellow-500',
  qualificado: 'text-purple-500',
  cotacao_enviada: 'text-violet-500',
  negociacao: 'text-pink-500',
  vistoria_agendada: 'text-teal-500',
  contrato_enviado: 'text-amber-500',
  contrato_assinado: 'text-green-500',
  instalacao_agendada: 'text-cyan-500',
  ganho: 'text-emerald-500',
  perdido: 'text-red-500',
};

const ETAPA_BADGE_BG: Record<string, string> = {
  novo: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  contato: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
  qualificado: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  cotacao_enviada: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  negociacao: 'bg-pink-500/15 text-pink-600 dark:text-pink-400',
  vistoria_agendada: 'bg-teal-500/15 text-teal-600 dark:text-teal-400',
  contrato_enviado: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  contrato_assinado: 'bg-green-500/15 text-green-600 dark:text-green-400',
  instalacao_agendada: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
  ganho: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  perdido: 'bg-red-500/15 text-red-600 dark:text-red-400',
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
  plano_escolhido_id?: string | null;
  plano_escolhido_nome?: string | null;
  plano_escolhido_valor?: number | null;
  proposta_enviada_em?: string | null;
  proposta_assinada_em?: string | null;
}

interface PlanoInteresse {
  id: string;
  nome: string;
}

interface DroppableColumnProps {
  etapa: EtapaLead;
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
  onLeadDelete?: (id: string) => void;
  onLeadQuote?: (lead: Lead) => void;
  onLeadSendProposal?: (lead: Lead) => void;
  onLeadMarkLost?: (lead: Lead) => void;
  planosInteresseMap: Record<string, PlanoInteresse[]>;
}

function DroppableColumn({
  etapa,
  leads,
  onLeadClick,
  onLeadDelete,
  onLeadQuote,
  onLeadSendProposal,
  onLeadMarkLost,
  planosInteresseMap,
}: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa });

  return (
    <Card
      className={cn(
        'flex flex-col w-[280px] min-w-[280px] max-w-[280px] h-full',
        'rounded-xl border-t-[3px] border-border/50',
        'bg-card/80 backdrop-blur-sm shadow-sm',
        'transition-all duration-200',
        'hover:shadow-md',
        ETAPA_COLORS[etapa],
        isOver && 'ring-2 ring-primary/50 ring-offset-2 ring-offset-background shadow-lg scale-[1.01]'
      )}
    >
      {/* Column Header */}
      <div className="flex flex-col gap-1 px-3 py-3 border-b border-border/30 shrink-0 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className={cn('h-4 w-4', ETAPA_HEADER_COLORS[etapa])} />
            <span className="font-semibold text-sm truncate max-w-[160px]">
              {ETAPA_LABELS[etapa]}
            </span>
          </div>
          <Badge
            variant="secondary"
            className={cn(
              'text-xs font-semibold shrink-0 border-0',
              ETAPA_BADGE_BG[etapa]
            )}
          >
            {leads.length}
          </Badge>
        </div>
      </div>

      {/* Column Body - NATIVE SCROLL instead of ScrollArea */}
      <div
        ref={setNodeRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2 space-y-2 scrollbar-thin"
        data-scroll-vertical="true"
      >
        <SortableContext
          items={leads.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          {leads.map((lead) => (
            <LeadCardEnhanced
              key={lead.id}
              lead={lead}
              onClick={() => onLeadClick(lead)}
              onDelete={onLeadDelete}
              onQuote={onLeadQuote}
              onSendProposal={onLeadSendProposal}
              onMarkLost={onLeadMarkLost}
              planosInteresse={planosInteresseMap[lead.id] || []}
            />
          ))}
        </SortableContext>
        {leads.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
              <Inbox className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <p className="text-xs text-muted-foreground font-medium">Nenhum lead</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">Arraste leads para cá</p>
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
  onLeadQuote?: (lead: Lead) => void;
  onLeadSendProposal?: (lead: Lead) => void;
  onLeadMarkLost?: (lead: Lead) => void;
  onAddLead?: (etapa?: EtapaLead) => void;
  isLoading?: boolean;
}

export function LeadsKanbanNew({
  leads,
  onLeadClick,
  onLeadMove,
  onLeadDelete,
  onLeadQuote,
  onLeadSendProposal,
  onLeadMarkLost,
  onAddLead,
  isLoading,
}: LeadsKanbanNewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Get IDs of leads in "novo" stage for interesse planos query
  const novoLeadIds = useMemo(() => 
    leads.filter(l => l.etapa === 'novo').map(l => l.id),
    [leads]
  );
  
  // Fetch interesse planos for novo leads
  const { data: planosInteresseMap = {} } = useLeadsInteressePlanosBulk(novoLeadIds);

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
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <p className="text-muted-foreground text-sm">Carregando leads...</p>
        </div>
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
        className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden kanban-scroll rounded-lg"
        style={{ touchAction: 'pan-x' }}
      >
        {/* Inner container - FORCES min-width to enable horizontal scroll */}
        <div className="inline-flex gap-4 h-full min-w-max py-2 px-1">
          {ETAPAS_KANBAN.map((etapa) => (
            <DroppableColumn
              key={etapa}
              etapa={etapa}
              leads={leadsByEtapa[etapa] || []}
              onLeadClick={onLeadClick}
              onLeadDelete={onLeadDelete}
              onLeadQuote={onLeadQuote}
              onLeadSendProposal={onLeadSendProposal}
              onLeadMarkLost={onLeadMarkLost}
              planosInteresseMap={planosInteresseMap}
            />
          ))}
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeLead && (
          <div className="opacity-95 rotate-2 shadow-2xl scale-105">
            <LeadCardEnhanced 
              lead={activeLead} 
              onClick={() => {}} 
              planosInteresse={planosInteresseMap[activeLead.id] || []}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
