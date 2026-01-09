import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import type { DateRange } from 'react-day-picker';
import { differenceInDays } from 'date-fns';

import { LeadsHeader } from '@/components/leads/LeadsHeader';
import { LeadMetricsCards } from '@/components/leads/LeadMetricsCards';
import { LeadsFiltersBar, type QuickFilter } from '@/components/leads/LeadsFiltersBar';
import { LeadsTable } from '@/components/leads/LeadsTable';
import { LeadsKanbanNew } from '@/components/leads/LeadsKanbanNew';
import { LeadsFiltersPanel } from '@/components/leads/LeadsFiltersPanel';
import { LeadFormDialog } from '@/components/leads/LeadFormDialog';
import { LeadDetailDrawer } from '@/components/leads/LeadDetailDrawer';
import { LeadLossDialog } from '@/components/leads/LeadLossDialog';

import { useAllLeads } from '@/hooks/useLeads';
import { useVendedores } from '@/hooks/useVendedores';
import { useLeadActions } from '@/hooks/useLeadActions';
import type { EtapaLead } from '@/types/database';
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

interface Lead {
  id: string;
  nome: string;
  telefone: string;
  origem: string;
  etapa: string;
  created_at: string;
  updated_at: string;
  vendedor?: {
    id: string;
    nome: string;
  } | null;
}

export default function LeadsUnificado() {
  // View state
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showNewLeadDialog, setShowNewLeadDialog] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [showLeadDrawer, setShowLeadDrawer] = useState(false);
  const [showLossDialog, setShowLossDialog] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<string | null>(null);
  const [lossDialogData, setLossDialogData] = useState<{
    id: string;
    nome: string;
    etapa: EtapaLead;
  } | null>(null);

  // Filters state
  const [filters, setFilters] = useState({
    search: '',
    etapa: '',
    origem: '',
    vendedor: '',
    dateRange: undefined as DateRange | undefined,
  });

  // Data hooks
  const { data: vendedores = [] } = useVendedores();
  const { data: allLeads = [], isLoading } = useAllLeads({
    vendedor_id: filters.vendedor || undefined,
    origem: filters.origem || undefined,
    data_de: filters.dateRange?.from?.toISOString(),
    data_ate: filters.dateRange?.to?.toISOString(),
    search: filters.search || undefined,
  });

  const { atualizarLead, excluirLead } = useLeadActions();

  // Filter leads based on quick filter and advanced filters
  const filteredLeads = useMemo(() => {
    let result = allLeads as Lead[];

    // Apply etapa filter
    if (filters.etapa) {
      result = result.filter((lead) => lead.etapa === filters.etapa);
    }

    // Apply quick filters
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (quickFilter === 'today') {
      result = result.filter((lead) => {
        const createdAt = new Date(lead.created_at);
        createdAt.setHours(0, 0, 0, 0);
        return createdAt.getTime() === today.getTime();
      });
    } else if (quickFilter === 'overdue') {
      result = result.filter((lead) => {
        const daysWithoutUpdate = differenceInDays(new Date(), new Date(lead.updated_at));
        return (
          daysWithoutUpdate > 3 &&
          lead.etapa !== 'ganho' &&
          lead.etapa !== 'perdido'
        );
      });
    }

    return result;
  }, [allLeads, filters.etapa, quickFilter]);

  // Calculate overdue count for badge
  const overdueCount = useMemo(() => {
    return (allLeads as Lead[]).filter((lead) => {
      const daysWithoutUpdate = differenceInDays(new Date(), new Date(lead.updated_at));
      return (
        daysWithoutUpdate > 3 &&
        lead.etapa !== 'ganho' &&
        lead.etapa !== 'perdido'
      );
    }).length;
  }, [allLeads]);

  const hasActiveFilters = !!(
    filters.etapa ||
    filters.origem ||
    filters.vendedor ||
    filters.dateRange
  );

  // Handlers
  const handleSelectLead = (lead: Lead) => {
    setSelectedLeadId(lead.id);
    setShowLeadDrawer(true);
  };

  const handleDeleteLead = (id: string) => {
    setLeadToDelete(id);
  };

  const confirmDeleteLead = async () => {
    if (!leadToDelete) return;
    try {
      await excluirLead(leadToDelete);
      setLeadToDelete(null);
    } catch (error) {
      console.error('Erro ao excluir lead:', error);
    }
  };

  const handleLeadMove = async (leadId: string, newEtapa: EtapaLead) => {
    const lead = (allLeads as Lead[]).find((l) => l.id === leadId);
    if (!lead) return;

    // If moving to "perdido", show loss dialog
    if (newEtapa === 'perdido') {
      setLossDialogData({
        id: leadId,
        nome: lead.nome,
        etapa: lead.etapa as EtapaLead,
      });
      setShowLossDialog(true);
      return;
    }

    try {
      await atualizarLead({ id: leadId, data: { etapa: newEtapa } });
      toast.success('Lead movido com sucesso!');
    } catch (error) {
      toast.error('Erro ao mover lead');
      console.error(error);
    }
  };

  const handleSearchChange = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value }));
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Fixed Header Section */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-6 py-5 space-y-5">
        {/* Title & Actions */}
        <LeadsHeader
          onNovoLead={() => setShowNewLeadDialog(true)}
          onImport={() => {
            toast.info('Funcionalidade de importação em desenvolvimento');
          }}
        />

        {/* Metrics Cards */}
        <LeadMetricsCards leads={allLeads} />

        {/* Filters Bar */}
        <LeadsFiltersBar
          search={filters.search}
          onSearchChange={handleSearchChange}
          quickFilter={quickFilter}
          onQuickFilterChange={setQuickFilter}
          overdueCount={overdueCount}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onOpenFilters={() => setShowFilters(true)}
          filtersActive={hasActiveFilters}
        />
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'list' ? (
          <div className="px-6 py-4">
            <LeadsTable
              leads={filteredLeads}
              isLoading={isLoading}
              onSelectLead={handleSelectLead}
              onDeleteLead={handleDeleteLead}
              onNewLead={() => setShowNewLeadDialog(true)}
            />
          </div>
        ) : (
          <div className="pt-4">
            <LeadsKanbanNew
              leads={filteredLeads}
              isLoading={isLoading}
              onLeadClick={handleSelectLead}
              onLeadMove={handleLeadMove}
              onLeadDelete={handleDeleteLead}
              onAddLead={() => setShowNewLeadDialog(true)}
            />
          </div>
        )}
      </div>

      {/* Filters Panel */}
      <LeadsFiltersPanel
        open={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onFiltersChange={setFilters}
        vendedores={vendedores}
      />

      {/* New Lead Dialog */}
      <LeadFormDialog
        open={showNewLeadDialog}
        onOpenChange={setShowNewLeadDialog}
      />

      {/* Lead Detail Drawer */}
      <LeadDetailDrawer
        leadId={selectedLeadId}
        open={showLeadDrawer}
        onClose={() => {
          setShowLeadDrawer(false);
          setSelectedLeadId(null);
        }}
      />

      {/* Loss Dialog */}
      {lossDialogData && (
        <LeadLossDialog
          open={showLossDialog}
          onOpenChange={setShowLossDialog}
          leadId={lossDialogData.id}
          leadNome={lossDialogData.nome}
          etapaAtual={lossDialogData.etapa}
          onSuccess={() => {
            setShowLossDialog(false);
            setLossDialogData(null);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!leadToDelete} onOpenChange={() => setLeadToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este lead? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteLead}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
