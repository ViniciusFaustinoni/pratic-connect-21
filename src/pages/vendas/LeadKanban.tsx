import { useState } from 'react';
import { Plus, Loader2, Calendar, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { ETAPA_LABELS, ORIGEM_LABELS, type EtapaLead, type OrigemLead } from '@/types/database';
import { etapaColors, ETAPAS_FUNIL, canTransition } from '@/lib/lead-transitions';
import { useAllLeads, type LeadFilters } from '@/hooks/useLeads';
import { useChangeLeadEtapa } from '@/hooks/useLeadHistorico';
import { useVendedores } from '@/hooks/useVendedores';
import { LeadFormDialog } from '@/components/leads/LeadFormDialog';
import { LeadLossDialog } from '@/components/leads/LeadLossDialog';
import { LeadKanbanCard } from '@/components/leads/LeadKanbanCard';
import { LeadMetricsCards } from '@/components/leads/LeadMetricsCards';
import { LeadDetailDrawer } from '@/components/leads/LeadDetailDrawer';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ORIGENS: OrigemLead[] = [
  'site', 'indicacao', 'facebook', 'instagram', 'google', 'telefone', 'presencial', 'parceiro', 'outro', 'api'
];
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
import type { Tables } from '@/integrations/supabase/types';

type Lead = Tables<'leads'>;

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
      className={`flex flex-col rounded-lg bg-muted/50 p-3 min-h-[calc(100vh-320px)] transition-colors ${
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
  const [filters, setFilters] = useState<LeadFilters>({});
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [lossDialogLead, setLossDialogLead] = useState<Lead | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});

  const { data: leads, isLoading } = useAllLeads(filters);
  const { data: vendedores } = useVendedores();
  const changeEtapa = useChangeLeadEtapa();

  const handleDateRangeChange = (range: { from?: Date; to?: Date }) => {
    setDateRange(range);
    setFilters((f) => ({
      ...f,
      data_de: range.from ? format(range.from, 'yyyy-MM-dd') : undefined,
      data_ate: range.to ? format(range.to, 'yyyy-MM-dd') : undefined,
    }));
  };

  const clearFilters = () => {
    setFilters({});
    setDateRange({});
  };

  const hasActiveFilters = !!(
    filters.search ||
    (filters.vendedor_id && filters.vendedor_id !== 'all') ||
    (filters.origem && filters.origem !== 'all') ||
    filters.data_de ||
    filters.data_ate
  );

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
    if (!ETAPAS_FUNIL.includes(targetEtapa)) return;

    const lead = leads?.find((l) => l.id === leadId);
    if (!lead || lead.etapa === targetEtapa) return;

    // Verificar se transição é permitida
    if (!canTransition(lead.etapa as EtapaLead, targetEtapa)) {
      toast.error('Transição não permitida');
      return;
    }

    // Se for perdido, abrir modal de motivo
    if (targetEtapa === 'perdido') {
      setLossDialogLead(lead);
      return;
    }

    try {
      await changeEtapa.mutateAsync({
        leadId,
        etapaAnterior: lead.etapa as EtapaLead,
        etapaNova: targetEtapa,
      });
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
          <h1 className="text-2xl font-bold">Pipeline de Vendas</h1>
          <p className="text-muted-foreground">
            Acompanhe o funil de conversão
          </p>
        </div>
        <Button className="gap-2" onClick={() => setShowLeadForm(true)}>
          <Plus className="h-4 w-4" />
          Novo Lead
        </Button>
      </div>

      {/* Metrics */}
      <LeadMetricsCards leads={leads || []} />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder="Buscar leads..."
          className="w-full sm:w-56"
          value={filters.search || ''}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
        />
        <Select
          value={filters.vendedor_id || 'all'}
          onValueChange={(value) => setFilters((f) => ({ ...f, vendedor_id: value }))}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Vendedor" />
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

        <Select
          value={filters.origem || 'all'}
          onValueChange={(value) => setFilters((f) => ({ ...f, origem: value as OrigemLead | 'all' }))}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas origens</SelectItem>
            {ORIGENS.map((origem) => (
              <SelectItem key={origem} value={origem}>
                {ORIGEM_LABELS[origem]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn(
              "w-full sm:w-auto gap-2",
              dateRange.from && "text-foreground"
            )}>
              <Calendar className="h-4 w-4" />
              {dateRange.from ? (
                dateRange.to ? (
                  `${format(dateRange.from, 'dd/MM', { locale: ptBR })} - ${format(dateRange.to, 'dd/MM', { locale: ptBR })}`
                ) : (
                  format(dateRange.from, 'dd/MM/yyyy', { locale: ptBR })
                )
              ) : (
                "Período"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              initialFocus
              mode="range"
              defaultMonth={dateRange.from}
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={(range) => handleDateRangeChange(range || {})}
              numberOfMonths={2}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
            <X className="h-4 w-4" />
            Limpar
          </Button>
        )}
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid auto-cols-[260px] grid-flow-col gap-3 overflow-x-auto pb-4">
          {ETAPAS_FUNIL.map((etapa) => {
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
                        onClick={() => setSelectedLeadId(lead.id)}
                      />
                    ))}
                    {leadsInEtapa.length === 0 && (
                      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm min-h-[100px]">
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
      
      {lossDialogLead && (
        <LeadLossDialog
          open={!!lossDialogLead}
          onOpenChange={(open) => !open && setLossDialogLead(null)}
          leadId={lossDialogLead.id}
          leadNome={lossDialogLead.nome}
          etapaAtual={lossDialogLead.etapa as EtapaLead}
        />
      )}

      <LeadDetailDrawer
        leadId={selectedLeadId}
        open={!!selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
      />
    </div>
  );
}
