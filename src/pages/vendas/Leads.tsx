import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MoreHorizontal, Loader2, ChevronLeft, ChevronRight, Edit, ArrowRight, XCircle, MessageCircle, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ETAPA_LABELS, ORIGEM_LABELS, type EtapaLead } from '@/types/database';
import { etapaColors, origemColors, ETAPAS_FUNIL, canTransition, getNextStages } from '@/lib/lead-transitions';
import { useLeads, useAllLeads, type LeadFilters as LeadFiltersType, type LeadWithVendedor } from '@/hooks/useLeads';
import { useChangeLeadEtapa } from '@/hooks/useLeadHistorico';
import { LeadFormDialog } from '@/components/leads/LeadFormDialog';
import { LeadEditDialog } from '@/components/leads/LeadEditDialog';
import { LeadFilters } from '@/components/leads/LeadFilters';
import { LeadKanbanCard } from '@/components/leads/LeadKanbanCard';
import { LeadLossDialog } from '@/components/leads/LeadLossDialog';
import { LeadMetricsCards } from '@/components/leads/LeadMetricsCards';
import { LeadDetailDrawer } from '@/components/leads/LeadDetailDrawer';
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

export default function Leads() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<LeadFiltersType>({});
  const [page, setPage] = useState(1);
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [showCotacaoForm, setShowCotacaoForm] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | undefined>();
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [lossDialogLead, setLossDialogLead] = useState<Lead | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);

  // Para tabela com paginação
  const { data: leadsData, isLoading } = useLeads({ filters, page, perPage: 20 });
  
  // Para kanban (todos os leads)
  const { data: allLeads } = useAllLeads({ vendedor_id: filters.vendedor_id, search: filters.search });
  
  const changeEtapa = useChangeLeadEtapa();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const formatCurrency = (value: number | null) => {
    if (!value) return '—';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleCreateCotacao = (leadId: string) => {
    setSelectedLeadId(leadId);
    setShowCotacaoForm(true);
  };

  const handleMarkAsLost = (lead: Lead) => {
    setLossDialogLead(lead);
  };

  const handleAdvanceStage = async (lead: Lead, newEtapa: EtapaLead) => {
    if (newEtapa === 'perdido') {
      setLossDialogLead(lead);
      return;
    }

    try {
      await changeEtapa.mutateAsync({
        leadId: lead.id,
        etapaAnterior: lead.etapa as EtapaLead,
        etapaNova: newEtapa,
      });
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

    if (!canTransition(lead.etapa as EtapaLead, targetEtapa)) {
      toast.error('Transição não permitida');
      return;
    }

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
          <Tabs value={view} onValueChange={(v) => setView(v as 'table' | 'kanban')}>
            <TabsList>
              <TabsTrigger value="table">Lista</TabsTrigger>
              <TabsTrigger value="kanban">Kanban</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button className="gap-2" onClick={() => setShowLeadForm(true)}>
            <Plus className="h-4 w-4" />
            Novo Lead
          </Button>
        </div>
      </div>

      {/* Metrics */}
      {view === 'kanban' && <LeadMetricsCards leads={allLeads || []} />}

      {/* Filters */}
      <LeadFilters filters={filters} onFiltersChange={(f) => { setFilters(f); setPage(1); }} />

      {/* Table View */}
      {view === 'table' && (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Veículo</TableHead>
                    <TableHead>FIPE</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Criado</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        Nenhum lead encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    leads.map((lead) => {
                      const nextStages = getNextStages(lead.etapa as EtapaLead);
                      const vendedorNome = (lead as LeadWithVendedor).vendedor?.nome;
                      return (
                        <TableRow 
                          key={lead.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/vendas/leads/${lead.id}`)}
                        >
                          {/* Nome - link clicável para drawer */}
                          <TableCell>
                            <button 
                              className="text-primary hover:underline font-medium text-left"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDrawerLeadId(lead.id);
                              }}
                            >
                              {lead.nome}
                            </button>
                          </TableCell>

                          {/* Telefone com WhatsApp */}
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{lead.telefone}</span>
                              <a
                                href={`https://wa.me/55${lead.telefone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-green-600 hover:text-green-700"
                                title="Abrir WhatsApp"
                              >
                                <MessageCircle className="h-4 w-4" />
                              </a>
                            </div>
                          </TableCell>

                          {/* Veículo */}
                          <TableCell>
                            {lead.veiculo_marca 
                              ? `${lead.veiculo_marca} ${lead.veiculo_modelo || ''} ${lead.veiculo_ano || ''}`.trim()
                              : '—'}
                          </TableCell>

                          {/* FIPE */}
                          <TableCell className="text-sm">
                            {formatCurrency(lead.veiculo_fipe)}
                          </TableCell>

                          {/* Origem */}
                          <TableCell>
                            <Badge className={origemColors[lead.origem] || 'bg-gray-100 text-gray-800'}>
                              {ORIGEM_LABELS[lead.origem]}
                            </Badge>
                          </TableCell>

                          {/* Etapa */}
                          <TableCell>
                            <Badge className={etapaColors[lead.etapa as EtapaLead]}>
                              {ETAPA_LABELS[lead.etapa as EtapaLead]}
                            </Badge>
                          </TableCell>

                          {/* Vendedor */}
                          <TableCell className="text-sm">
                            {vendedorNome || '—'}
                          </TableCell>

                          {/* Criado - tempo relativo */}
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(lead.created_at), { 
                              addSuffix: true, 
                              locale: ptBR 
                            })}
                          </TableCell>

                          {/* Ações */}
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
                                  <Eye className="mr-2 h-4 w-4" />
                                  Ver
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
                                  Cotação
                                </DropdownMenuItem>
                                
                                {nextStages.length > 0 && (
                                  <DropdownMenuSub>
                                    <DropdownMenuSubTrigger onClick={(e) => e.stopPropagation()}>
                                      <ArrowRight className="mr-2 h-4 w-4" />
                                      Avançar etapa
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                      {nextStages.filter(e => e !== 'perdido').map((etapa) => (
                                        <DropdownMenuItem
                                          key={etapa}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleAdvanceStage(lead, etapa);
                                          }}
                                        >
                                          {ETAPA_LABELS[etapa]}
                                        </DropdownMenuItem>
                                      ))}
                                    </DropdownMenuSubContent>
                                  </DropdownMenuSub>
                                )}

                                {nextStages.includes('perdido') && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      className="text-destructive"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMarkAsLost(lead);
                                      }}
                                    >
                                      <XCircle className="mr-2 h-4 w-4" />
                                      Perdido
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Exibindo {((page - 1) * 20) + 1}-{Math.min(page * 20, total)} de {total} leads
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
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
                  Próximo
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
          <div className="grid auto-cols-[260px] grid-flow-col gap-3 overflow-x-auto pb-4">
            {ETAPAS_FUNIL.map((etapa) => {
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
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                      {activeLead.nome.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{activeLead.nome}</p>
                      <p className="text-xs text-muted-foreground">{activeLead.telefone}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Dialogs */}
      <LeadFormDialog open={showLeadForm} onOpenChange={setShowLeadForm} />
      
      {editingLead && (
        <LeadEditDialog
          lead={editingLead}
          open={!!editingLead}
          onOpenChange={(open) => !open && setEditingLead(null)}
        />
      )}

      {lossDialogLead && (
        <LeadLossDialog
          leadId={lossDialogLead.id}
          leadNome={lossDialogLead.nome}
          etapaAtual={lossDialogLead.etapa as EtapaLead}
          open={!!lossDialogLead}
          onOpenChange={(open) => !open && setLossDialogLead(null)}
        />
      )}

      <CotacaoFormDialog
        open={showCotacaoForm}
        onOpenChange={setShowCotacaoForm}
        leadId={selectedLeadId}
      />

      {/* Lead Detail Drawer */}
      <LeadDetailDrawer
        leadId={drawerLeadId}
        open={!!drawerLeadId}
        onClose={() => setDrawerLeadId(null)}
      />
    </div>
  );
}
