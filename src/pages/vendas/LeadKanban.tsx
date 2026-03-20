import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, Calendar, X, ChevronLeft, ChevronRight, CheckCircle, Phone, Car } from 'lucide-react';
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
import { useLeadsRealtime } from '@/hooks/useNotificacoesVendas';
import { LeadFormDialog } from '@/components/leads/LeadFormDialog';
import { LeadLossDialog } from '@/components/leads/LeadLossDialog';
import { LeadKanbanCard } from '@/components/leads/LeadKanbanCard';
import { LeadMetricsCards } from '@/components/leads/LeadMetricsCards';
import { LeadDetailDrawer } from '@/components/leads/LeadDetailDrawer';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

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
  TouchSensor,
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
  const { setNodeRef, isOver, active } = useDroppable({ id: etapa });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "w-[280px] min-w-[280px] flex-shrink-0 flex flex-col rounded-lg bg-muted/50 min-h-[calc(100dvh-320px)] transition-all duration-300 relative",
        isOver && [
          "bg-primary/10 ring-2 ring-primary ring-offset-2 ring-offset-background",
          "shadow-lg shadow-primary/20 scale-[1.02]"
        ]
      )}
    >
      {/* Indicador "Solte aqui!" */}
      {isOver && active && (
        <div className="absolute inset-x-3 top-14 py-6 border-2 border-dashed border-primary rounded-lg bg-primary/10 flex items-center justify-center animate-pulse z-10">
          <span className="text-primary font-semibold text-sm">Solte aqui!</span>
        </div>
      )}
      
      <div className="p-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <Badge className={etapaColors[etapa]}>{ETAPA_LABELS[etapa]}</Badge>
          <span className={cn(
            "w-6 h-6 rounded-full text-xs font-medium flex items-center justify-center transition-all",
            isOver ? "bg-primary text-primary-foreground scale-110" : "bg-muted"
          )}>
            {count}
          </span>
        </div>
      </div>
      <div className="flex-1 p-2 overflow-y-auto scrollbar-thin">
        {children}
      </div>
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
  const boardRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: leads, isLoading } = useAllLeads(filters);
  const { data: vendedores } = useVendedores();
  const changeEtapa = useChangeLeadEtapa();

  // Habilitar Realtime para atualização automática
  useLeadsRealtime();

  const scrollBoard = (direction: 'left' | 'right') => {
    const container = boardRef.current;
    if (!container) return;
    const scrollAmount = 280;
    const newLeft = container.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount);
    container.scrollTo({ left: newLeft, behavior: 'smooth' });
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const container = boardRef.current;
    if (!container) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      container.scrollLeft += e.deltaY;
    }
  };

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
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
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

    // Bloquear volta para "novo" se o lead já passou dessa fase
    if (targetEtapa === 'novo' && lead.etapa !== 'perdido') {
      toast.error('Lead já foi contatado e não pode voltar para Novo Lead');
      return;
    }

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
      toast.success(
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span>
            <strong>{lead.nome}</strong> movido para <Badge variant="outline" className="ml-1">{ETAPA_LABELS[targetEtapa]}</Badge>
          </span>
        </div>
      );
    } catch (error) {
      toast.error('Erro ao mover lead');
    }
  };

  const handleQuote = (leadId: string) => {
    navigate(`/vendas/cotacoes?lead=${leadId}`);
  };

  // Handler para ações do menu do card
  const handleCardAction = (action: string, lead: Lead) => {
    switch (action) {
      case 'ver':
        setSelectedLeadId(lead.id);
        break;
      case 'editar':
        navigate(`/vendas/leads/${lead.id}/editar`);
        break;
      case 'contato':
        handleWhatsAppClick(lead.id, lead.etapa);
        break;
      case 'cotacao':
        navigate(`/vendas/cotacoes?lead=${lead.id}`);
        break;
      case 'contrato':
        navigate(`/vendas/contratos?lead=${lead.id}`);
        break;
      case 'transferir':
        toast.info('Função de transferência em desenvolvimento');
        break;
      case 'perdido':
        setLossDialogLead(lead);
        break;
      default:
        break;
    }
  };

  const handleWhatsAppClick = async (leadId: string, currentEtapa: string) => {
    try {
      // Registrar contato via WhatsApp no histórico (sempre)
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('leads_historico').insert({
        lead_id: leadId,
        usuario_id: user?.id,
        acao: 'contato_whatsapp',
        descricao: 'Contato iniciado via WhatsApp',
      });

      // Se o lead está em "novo", mover automaticamente para "contato"
      if (currentEtapa === 'novo') {
        await changeEtapa.mutateAsync({
          leadId,
          etapaAnterior: 'novo' as EtapaLead,
          etapaNova: 'contato' as EtapaLead,
        });
        toast.success('Lead movido para Contato');
      }
      
      // Invalidar cache do histórico
      queryClient.invalidateQueries({ queryKey: ['leads', leadId, 'historico'] });
    } catch (error) {
      console.error('Erro ao registrar contato:', error);
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
            Gerencie seus leads pelo funil de vendas
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
      <div className="relative">
        {/* Scroll buttons - outside DndContext */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm shadow-md hover:bg-background border"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => scrollBoard('left')}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm shadow-md hover:bg-background border"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => scrollBoard('right')}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* Scroll container - flex layout for reliable horizontal scroll */}
          <div
            ref={boardRef}
            className="flex gap-3 overflow-x-auto overflow-y-hidden pb-4 px-12 overscroll-x-contain touch-pan-y"
            onWheelCapture={handleWheel}
            style={{ scrollbarGutter: 'stable' }}
          >
            {ETAPAS_FUNIL.map((etapa) => {
              const leadsInEtapa = (leads || []).filter((l) => l.etapa === etapa);
              return (
                <DroppableColumn key={etapa} etapa={etapa} count={leadsInEtapa.length}>
                  <SortableContext
                    items={leadsInEtapa.map((l) => l.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="flex flex-col gap-2">
                      {leadsInEtapa.map((lead) => (
                        <LeadKanbanCard
                          key={lead.id}
                          lead={lead}
                          onClick={() => setSelectedLeadId(lead.id)}
                          onQuote={handleQuote}
                          onWhatsAppClick={handleWhatsAppClick}
                          onAction={handleCardAction}
                        />
                      ))}
                      {leadsInEtapa.length === 0 && (
                        <div className="flex items-center justify-center text-muted-foreground text-sm min-h-[100px]">
                          Arraste leads para cá
                        </div>
                      )}
                    </div>
                  </SortableContext>
                </DroppableColumn>
              );
            })}
          </div>

          <DragOverlay dropAnimation={{
            duration: 300,
            easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
          }}>
            {activeLead ? (
              <Card className="shadow-2xl rotate-3 scale-105 ring-2 ring-primary animate-in fade-in-0 zoom-in-95 duration-200 w-[260px]">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-sm font-bold text-primary-foreground shadow-md">
                      {activeLead.nome.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{activeLead.nome}</p>
                      {activeLead.telefone && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {activeLead.telefone}
                        </p>
                      )}
                      {activeLead.veiculo_marca && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Car className="h-3 w-3" />
                          {activeLead.veiculo_marca} {activeLead.veiculo_modelo}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <LeadFormDialog 
        open={showLeadForm} 
        onOpenChange={setShowLeadForm}
      />
      
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
