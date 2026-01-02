import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MoreHorizontal, Phone, Car, Loader2, ChevronLeft, ChevronRight, Edit, ArrowRight, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ETAPA_LABELS, ORIGEM_LABELS, type EtapaLead } from '@/types/database';
import { useLeads, useAllLeads, useUpdateLead, type LeadFilters as LeadFiltersType } from '@/hooks/useLeads';
import { LeadFormDialog } from '@/components/leads/LeadFormDialog';
import { LeadEditDialog } from '@/components/leads/LeadEditDialog';
import { LeadFilters } from '@/components/leads/LeadFilters';
import { LeadKanbanCard } from '@/components/leads/LeadKanbanCard';
import { LeadApiTab } from '@/components/leads/LeadApiTab';
import { CotacaoFormDialog } from '@/components/cotacoes/CotacaoFormDialog';
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
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Tables } from '@/integrations/supabase/types';

type Lead = Tables<'leads'>;

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

export default function Leads() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<LeadFiltersType>({});
  const [page, setPage] = useState(1);
  const [view, setView] = useState<'table' | 'kanban' | 'api'>('table');
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [showCotacaoForm, setShowCotacaoForm] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | undefined>();
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Para tabela com paginação
  const { data: leadsData, isLoading } = useLeads({ filters, page, perPage: 20 });
  
  // Para kanban (todos os leads)
  const { data: allLeads } = useAllLeads({ vendedor_id: filters.vendedor_id, search: filters.search });
  
  const updateLead = useUpdateLead();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleCreateCotacao = (leadId: string) => {
    setSelectedLeadId(leadId);
    setShowCotacaoForm(true);
  };

  const handleMarkAsLost = async (leadId: string) => {
    try {
      await updateLead.mutateAsync({ id: leadId, etapa: 'perdido' });
      toast.success('Lead marcado como perdido');
    } catch (error) {
      toast.error('Erro ao atualizar lead');
    }
  };

  const handleAdvanceStage = async (leadId: string, newEtapa: EtapaLead) => {
    try {
      await updateLead.mutateAsync({ id: leadId, etapa: newEtapa });
      toast.success(`Lead movido para ${ETAPA_LABELS[newEtapa]}`);
    } catch (error) {
      toast.error('Erro ao atualizar lead');
    }
  };

  // Drag and drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const leadId = active.id as string;
    const targetEtapa = over.id as EtapaLead;

    const lead = allLeads?.find((l) => l.id === leadId);
    if (!lead || lead.etapa === targetEtapa) return;

    try {
      await updateLead.mutateAsync({ id: leadId, etapa: targetEtapa });
      toast.success(`Lead movido para ${ETAPA_LABELS[targetEtapa]}`);
    } catch (error) {
      toast.error('Erro ao mover lead');
    }
  };

  const activeLead = activeId ? allLeads?.find((l) => l.id === activeId) : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const leads = leadsData?.leads || [];
  const totalPages = leadsData?.totalPages || 1;
  const total = leadsData?.total || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-muted-foreground">
            {total} leads encontrados
          </p>
        </div>
        <div className="flex gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as 'table' | 'kanban' | 'api')}>
            <TabsList>
              <TabsTrigger value="table">Lista</TabsTrigger>
              <TabsTrigger value="kanban">Kanban</TabsTrigger>
              <TabsTrigger value="api">API</TabsTrigger>
            </TabsList>
          </Tabs>
          {view !== 'api' && (
            <Button className="gap-2" onClick={() => setShowLeadForm(true)}>
              <Plus className="h-4 w-4" />
              Novo Lead
            </Button>
          )}
        </div>
      </div>

      {/* Filters - hidden for API view */}
      {view !== 'api' && (
        <LeadFilters filters={filters} onFiltersChange={(f) => { setFilters(f); setPage(1); }} />
      )}

      {/* API Tab */}
      {view === 'api' && <LeadApiTab />}

      {/* Table View */}
      {view === 'table' && (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Veículo</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum lead encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    leads.map((lead) => (
                      <TableRow 
                        key={lead.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/vendas/leads/${lead.id}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                              {lead.nome.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium">{lead.nome}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {lead.telefone}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {lead.veiculo_marca ? (
                            <div className="flex items-center gap-2">
                              <Car className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm">
                                  {lead.veiculo_marca} {lead.veiculo_modelo}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {lead.veiculo_ano} • {formatCurrency(lead.veiculo_fipe)}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{ORIGEM_LABELS[lead.origem]}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={etapaColors[lead.etapa]}>
                            {ETAPA_LABELS[lead.etapa]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(lead.created_at)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Ações</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/vendas/leads/${lead.id}`);
                              }}>
                                Ver detalhes
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setEditingLead(lead);
                              }}>
                                <Edit className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                handleCreateCotacao(lead.id);
                              }}>
                                Criar cotação
                              </DropdownMenuItem>
                              
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger onClick={(e) => e.stopPropagation()}>
                                  <ArrowRight className="mr-2 h-4 w-4" />
                                  Avançar etapa
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                  {etapas.filter(e => e !== lead.etapa).map((etapa) => (
                                    <DropdownMenuItem
                                      key={etapa}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAdvanceStage(lead.id, etapa);
                                      }}
                                    >
                                      {ETAPA_LABELS[etapa]}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>

                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkAsLost(lead.id);
                                }}
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                Marcar como perdido
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando {((page - 1) * 20) + 1} - {Math.min(page * 20, total)} de {total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Página {page} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Kanban View */}
      {view === 'kanban' && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid auto-cols-[280px] grid-flow-col gap-4 overflow-x-auto pb-4">
            {etapas.map((etapa) => {
              const leadsInEtapa = (allLeads || []).filter((l) => l.etapa === etapa);
              return (
                <div 
                  key={etapa} 
                  id={etapa}
                  className="flex flex-col rounded-lg bg-muted/50 p-3 min-h-[400px]"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={etapaColors[etapa]}>{ETAPA_LABELS[etapa]}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {leadsInEtapa.length}
                      </span>
                    </div>
                  </div>
                  <SortableContext
                    items={leadsInEtapa.map((l) => l.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div 
                      className="flex flex-col gap-2 flex-1"
                      data-etapa={etapa}
                    >
                      {leadsInEtapa.map((lead) => (
                        <LeadKanbanCard
                          key={lead.id}
                          lead={lead}
                          onClick={() => navigate(`/vendas/leads/${lead.id}`)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </div>
              );
            })}
          </div>
          <DragOverlay>
            {activeLead ? (
              <Card className="shadow-lg">
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
      )}

      {/* Dialogs */}
      <LeadFormDialog open={showLeadForm} onOpenChange={setShowLeadForm} />
      <LeadEditDialog 
        open={!!editingLead} 
        onOpenChange={(open) => !open && setEditingLead(null)} 
        lead={editingLead}
      />
      <CotacaoFormDialog 
        open={showCotacaoForm} 
        onOpenChange={setShowCotacaoForm} 
        leadId={selectedLeadId}
      />
    </div>
  );
}
