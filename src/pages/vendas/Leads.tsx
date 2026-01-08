import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, MoreHorizontal, Loader2, ChevronLeft, ChevronRight, Edit, ArrowRight, XCircle, MessageCircle, Eye, Search, Filter, Trash2, X, RotateCcw, GripVertical } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollIndicator } from '@/components/ui/scroll-indicator';
import { ETAPA_LABELS, ORIGEM_LABELS, type EtapaLead, type OrigemLead } from '@/types/database';
import { etapaColors, etapaDotColors, origemColors, ETAPAS_KANBAN_VENDAS, canTransition, getNextStages } from '@/lib/lead-transitions';
import { useLeads, useAllLeads, type LeadFilters as LeadFiltersType, type LeadWithVendedor } from '@/hooks/useLeads';
import { useChangeLeadEtapa } from '@/hooks/useLeadHistorico';
import { useLeadActions } from '@/hooks/useLeadActions';
import { useVendedores } from '@/hooks/useVendedores';
import { usePermissions } from '@/hooks/usePermissions';
import { useKanbanColumnOrder } from '@/hooks/useKanbanColumnOrder';
import { LeadFormDialog } from '@/components/leads/LeadFormDialog';
import { LeadEditDialog } from '@/components/leads/LeadEditDialog';
import { LeadKanbanCard } from '@/components/leads/LeadKanbanCard';
import { LeadLossDialog } from '@/components/leads/LeadLossDialog';
import { LeadMetricsBar } from '@/components/leads/LeadMetricsBar';
import { LeadDetailDrawer } from '@/components/leads/LeadDetailDrawer';
import { CotacaoFormDialog } from '@/components/cotacoes/CotacaoFormDialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
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
import { SortableContext, verticalListSortingStrategy, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Tables } from '@/integrations/supabase/types';

type Lead = Tables<'leads'>;

// Definição de etapas e origens para o filtro
const ETAPAS_TODAS: EtapaLead[] = [
  'novo', 'contato', 'qualificado', 'cotacao_enviada', 'negociacao',
  'vistoria_agendada', 'contrato_enviado', 'contrato_assinado', 'instalacao_agendada', 'ganho', 'perdido'
];

const ORIGENS_TODAS: OrigemLead[] = [
  'site', 'indicacao', 'telefone', 'whatsapp', 'facebook', 'instagram', 'google', 'outro'
];

// Componente de coluna sortável do Kanban
interface KanbanColumnProps {
  etapa: EtapaLead;
  leadsCount: number;
  children: React.ReactNode;
}

function KanbanColumn({ etapa, leadsCount, children }: KanbanColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: etapa });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className="flex-shrink-0 w-64 flex flex-col rounded-xl bg-muted/50 h-full"
    >
      {/* Header da coluna - arrastável */}
      <div 
        {...attributes}
        {...listeners}
        className="flex-shrink-0 bg-muted/50 px-3 py-2.5 border-b border-border/50 rounded-t-xl cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
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
      {/* Cards */}
      {children}
    </div>
  );
}

export default function Leads() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const [filters, setFilters] = useState<LeadFiltersType>({});
  const [page, setPage] = useState(1);
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [showCotacaoForm, setShowCotacaoForm] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | undefined>();
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [lossDialogLead, setLossDialogLead] = useState<Lead | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragType, setDragType] = useState<'card' | 'column' | null>(null);
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);

  // Estados do Sheet de filtros
  const [showFilters, setShowFilters] = useState(false);
  const [tempFilters, setTempFilters] = useState<LeadFiltersType>({});

  // Estado do dialog de exclusão
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    leadId: string | null;
    leadNome: string;
  }>({ open: false, leadId: null, leadNome: '' });

  // Para tabela com paginação
  const { data: leadsData, isLoading } = useLeads({ filters, page, perPage: 20 });
  
  // Para kanban (todos os leads)
  const { data: allLeads } = useAllLeads({ vendedor_id: filters.vendedor_id, search: filters.search });
  
  const changeEtapa = useChangeLeadEtapa();
  const { excluirLead, isDeleting } = useLeadActions();
  const { data: vendedores } = useVendedores();
  const { columnOrder, reorderColumns, resetOrder } = useKanbanColumnOrder();

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

  // Handlers de filtros
  const handleApplyFilters = () => {
    setFilters(tempFilters);
    setPage(1);
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    setTempFilters({});
    setFilters({});
    setPage(1);
  };

  const handleOpenFilters = () => {
    setTempFilters(filters);
    setShowFilters(true);
  };

  // Handler de exclusão
  const handleDelete = async () => {
    if (deleteDialog.leadId) {
      try {
        await excluirLead(deleteDialog.leadId);
        toast.success('Lead excluído com sucesso');
      } catch (error) {
        toast.error('Erro ao excluir lead');
      }
      setDeleteDialog({ open: false, leadId: null, leadNome: '' });
    }
  };

  // Verificar se há filtros ativos
  const hasActiveFilters = !!(
    filters.etapa ||
    filters.origem ||
    filters.vendedor_id ||
    filters.data_de ||
    filters.data_ate ||
    filters.search
  );

  // Drag and drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    
    // Verificar se é uma coluna ou um card
    if (columnOrder.includes(id as EtapaLead)) {
      setDragType('column');
      setActiveId(id);
    } else {
      setDragType('card');
      setActiveId(id);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      setDragType(null);
      return;
    }

    // Se for drag de coluna
    if (dragType === 'column') {
      if (active.id !== over.id && columnOrder.includes(over.id as EtapaLead)) {
        reorderColumns(active.id as string, over.id as string);
        toast.success('Ordem das colunas atualizada');
      }
      setActiveId(null);
      setDragType(null);
      return;
    }

    // Se for drag de card
    setActiveId(null);
    setDragType(null);

    const leadId = active.id as string;
    
    // Determinar a etapa de destino
    let targetEtapa: EtapaLead | null = null;
    
    // Se o over é uma coluna (etapa)
    if (columnOrder.includes(over.id as EtapaLead)) {
      targetEtapa = over.id as EtapaLead;
    } else {
      // Se o over é um card, encontrar a etapa do card
      const overLead = allLeads?.find((l) => l.id === over.id);
      if (overLead) {
        targetEtapa = overLead.etapa as EtapaLead;
      }
    }
    
    if (!targetEtapa) return;

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
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header Fixo */}
      <div className="flex-shrink-0 space-y-4 pb-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold">Leads</h1>
            <p className="text-sm text-muted-foreground">
              {total} leads encontrados
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {view === 'kanban' && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={resetOrder}
                className="gap-1.5 h-9 text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="hidden sm:inline">Resetar</span>
              </Button>
            )}
            <Tabs value={view} onValueChange={(v) => setView(v as 'table' | 'kanban')}>
              <TabsList className="h-9">
                <TabsTrigger value="table" className="text-xs sm:text-sm px-2 sm:px-3">Lista</TabsTrigger>
                <TabsTrigger value="kanban" className="text-xs sm:text-sm px-2 sm:px-3">Kanban</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button size="sm" className="gap-1.5 h-9" onClick={() => setShowLeadForm(true)}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Novo Lead</span>
              <span className="sm:hidden">Novo</span>
            </Button>
          </div>
        </div>

        {/* Metrics - Barra compacta para Kanban */}
        {view === 'kanban' && <LeadMetricsBar leads={allLeads || []} />}

        {/* Barra de busca e filtros */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone, placa..."
              value={filters.search || ''}
              onChange={(e) => {
                setFilters({ ...filters, search: e.target.value });
                setPage(1);
              }}
              className="pl-10"
            />
          </div>
          <Button 
            variant="outline" 
            onClick={handleOpenFilters}
            className={cn(hasActiveFilters && 'border-primary text-primary')}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                Ativos
              </Badge>
            )}
          </Button>
        </div>

        {/* Filtros ativos */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Filtros:</span>
            {filters.etapa && (
              <Badge variant="secondary" className="gap-1">
                Etapa: {ETAPA_LABELS[filters.etapa]}
                <button onClick={() => setFilters({ ...filters, etapa: undefined })} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.origem && (
              <Badge variant="secondary" className="gap-1">
                Origem: {ORIGEM_LABELS[filters.origem]}
                <button onClick={() => setFilters({ ...filters, origem: undefined })} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.vendedor_id && (
              <Badge variant="secondary" className="gap-1">
                Vendedor: {vendedores?.find(v => v.id === filters.vendedor_id)?.nome || 'Selecionado'}
                <button onClick={() => setFilters({ ...filters, vendedor_id: undefined })} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.data_de && (
              <Badge variant="secondary" className="gap-1">
                De: {filters.data_de}
                <button onClick={() => setFilters({ ...filters, data_de: undefined })} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.data_ate && (
              <Badge variant="secondary" className="gap-1">
                Até: {filters.data_ate}
                <button onClick={() => setFilters({ ...filters, data_ate: undefined })} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            <button 
              className="text-sm text-primary hover:underline"
              onClick={handleClearFilters}
            >
              Limpar todos
            </button>
          </div>
        )}
      </div>

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

                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-destructive focus:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteDialog({
                                      open: true,
                                      leadId: lead.id,
                                      leadNome: lead.nome,
                                    });
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Excluir
                                </DropdownMenuItem>
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
        <div className="flex-1 min-h-0">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <ScrollIndicator className="h-full">
              <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                <div className="flex gap-3 h-full min-w-max pb-2 px-1">
                  {columnOrder.map((etapa) => {
                    const leadsInEtapa = (allLeads || []).filter((l) => l.etapa === etapa);
                    return (
                      <KanbanColumn key={etapa} etapa={etapa} leadsCount={leadsInEtapa.length}>
                        <SortableContext
                          items={leadsInEtapa.map((l) => l.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div 
                            className="flex flex-col gap-2 flex-1 p-2 overflow-y-auto"
                            data-etapa={etapa}
                          >
                            {leadsInEtapa.map((lead) => (
                              <LeadKanbanCard
                                key={lead.id}
                                lead={lead}
                                onClick={() => setDrawerLeadId(lead.id)}
                              />
                            ))}
                            {leadsInEtapa.length === 0 && (
                              <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground py-8">
                                Nenhum lead
                              </div>
                            )}
                          </div>
                        </SortableContext>
                      </KanbanColumn>
                    );
                  })}
                </div>
              </SortableContext>
            </ScrollIndicator>
            <DragOverlay>
              {activeId && dragType === 'card' && activeLead ? (
                <Card className="shadow-lg w-[220px]">
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
              ) : activeId && dragType === 'column' ? (
                <div className="w-64 h-20 bg-muted/80 rounded-xl border-2 border-dashed border-primary/50 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">
                    {ETAPA_LABELS[activeId as EtapaLead]}
                  </span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}

      {/* Sheet de Filtros */}
      <Sheet open={showFilters} onOpenChange={setShowFilters}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Filtros</SheetTitle>
            <SheetDescription>
              Refine a lista de leads
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 py-6">
            {/* Filtro: Etapa */}
            <div className="space-y-2">
              <Label>Etapa</Label>
              <Select
                value={tempFilters.etapa || 'todas'}
                onValueChange={(value) => 
                  setTempFilters({ ...tempFilters, etapa: value === 'todas' ? undefined : value as EtapaLead })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas as etapas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as etapas</SelectItem>
                  {ETAPAS_TODAS.map((etapa) => (
                    <SelectItem key={etapa} value={etapa}>
                      {ETAPA_LABELS[etapa]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro: Origem */}
            <div className="space-y-2">
              <Label>Origem</Label>
              <Select
                value={tempFilters.origem || 'todas'}
                onValueChange={(value) => 
                  setTempFilters({ ...tempFilters, origem: value === 'todas' ? undefined : value as OrigemLead })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas as origens" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as origens</SelectItem>
                  {ORIGENS_TODAS.map((origem) => (
                    <SelectItem key={origem} value={origem}>
                      {ORIGEM_LABELS[origem]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro: Vendedor (apenas para gerência/supervisor) */}
            {(hasPermission('isGerenciaOrSupervisor') || hasPermission('isDiretor')) && vendedores && (
              <div className="space-y-2">
                <Label>Vendedor</Label>
                <Select
                  value={tempFilters.vendedor_id || 'todos'}
                  onValueChange={(value) => 
                    setTempFilters({ ...tempFilters, vendedor_id: value === 'todos' ? undefined : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os vendedores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os vendedores</SelectItem>
                    {vendedores.map((vendedor) => (
                      <SelectItem key={vendedor.id} value={vendedor.id}>
                        {vendedor.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Filtro: Período */}
            <div className="space-y-2">
              <Label>Período</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">De</Label>
                  <Input
                    type="date"
                    value={tempFilters.data_de || ''}
                    onChange={(e) => setTempFilters({ ...tempFilters, data_de: e.target.value || undefined })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Até</Label>
                  <Input
                    type="date"
                    value={tempFilters.data_ate || ''}
                    onChange={(e) => setTempFilters({ ...tempFilters, data_ate: e.target.value || undefined })}
                  />
                </div>
              </div>
            </div>
          </div>

          <SheetFooter>
            <Button variant="outline" onClick={() => setTempFilters({})}>
              Limpar
            </Button>
            <Button onClick={handleApplyFilters}>
              Aplicar Filtros
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Dialog de Exclusão */}
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, leadId: null, leadNome: '' })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lead</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o lead <strong>{deleteDialog.leadNome}</strong>?
              <br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
