import { useState, useEffect, lazy, Suspense } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Radio, Server, Package, Clock, Plus, Upload, MapPin } from 'lucide-react';
import { Loader2 } from 'lucide-react';

const MapaRastreadores = lazy(() => import('./Mapa'));
import { supabase } from '@/integrations/supabase/client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AtribuirPortadorDialog } from '@/components/monitoramento/estoque/AtribuirPortadorDialog';
import { AtribuirPortadorLoteDialog } from '@/components/monitoramento/estoque/AtribuirPortadorLoteDialog';
import { AbrirRetiradaModal } from '@/components/monitoramento/retirada/AbrirRetiradaModal';
import { AgendarManutencaoUnificadoModal } from '@/components/monitoramento/rastreadores/AgendarManutencaoUnificadoModal';
import { MapaRastreador } from '@/components/rastreadores/MapaRastreador';
import {
  useRastreadores,
  useRastreadoresMetricas,
  type RastreadorFilters as Filters,
  type RastreadorWithRelations,
} from '@/hooks/useRastreadores';
import { usePlataformasLabels } from '@/hooks/usePlataformasCRUD';
import { usePermissions } from '@/hooks/usePermissions';
import {
  RastreadorFormDialog,
  RastreadorDetailDrawer,
  RastreadorFiltersV2,
  RastreadorMetrics,
  RastreadorGridView,
  RastreadorTableView,
  RastreadorListHeader,
  RastreadorBatchActions,
  type ViewMode,
} from '@/components/rastreadores';
import { PlataformasConfigPanel } from '@/components/rastreadores/PlataformasConfigPanel';
import { EntradaEstoqueDialog } from '@/components/monitoramento/estoque/EntradaEstoqueDialog';
import { ImportarRastreadoresDialog } from '@/components/monitoramento/estoque/ImportarRastreadoresDialog';
import { ConsultaRastreador } from '@/components/monitoramento/estoque/ConsultaRastreador';
import { HistoricoMovimentacoes } from '@/components/monitoramento/estoque/HistoricoMovimentacoes';
import { ListaRastreadores } from '@/components/monitoramento/estoque/ListaRastreadores';
import { EstoqueMetricas } from '@/components/monitoramento/estoque/EstoqueMetricas';

export default function Rastreadores() {
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({});
  const [activeTab, setActiveTab] = useState('visao-geral');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('rastreadores-view-mode');
    return (saved as ViewMode) || 'cards';
  });
  
  // Modais de estoque
  const [modalEntradaAberto, setModalEntradaAberto] = useState(false);
  const [modalImportarAberto, setModalImportarAberto] = useState(false);
  
  // Estado do modal de mapa
  const [mapaModalOpen, setMapaModalOpen] = useState(false);
  const [rastreadorMapaId, setRastreadorMapaId] = useState<string | null>(null);

  const { data: rastreadores, isLoading } = useRastreadores(filters);
  const { data: metricas, isLoading: isLoadingMetricas } = useRastreadoresMetricas();
  const { data: plataformasLabels } = usePlataformasLabels();
  const { isDiretor, isDesenvolvedor } = usePermissions();

  const canManagePlataformas = isDiretor || isDesenvolvedor;

  useEffect(() => {
    localStorage.setItem('rastreadores-view-mode', viewMode);
  }, [viewMode]);

  const handleOpenDetails = (id: string) => setSelectedId(id);

  const handleEdit = (id: string) => {
    setEditingId(id);
    setShowForm(true);
  };

  const handleNewRastreador = () => {
    setEditingId(null);
    setShowForm(true);
  };

  const handleFormClose = (open: boolean) => {
    if (!open) setEditingId(null);
    setShowForm(open);
  };

  const getPlataformaLabel = (codigo: string) => plataformasLabels?.[codigo] || codigo;
  
  const handleViewMap = (rastreadorId: string) => {
    setRastreadorMapaId(rastreadorId);
    setMapaModalOpen(true);
  };
  
  const handleCloseMapModal = (open: boolean) => {
    setMapaModalOpen(open);
    if (!open) setRastreadorMapaId(null);
  };

  // Montar lista de abas dinamicamente
  const tabs = [
    { value: 'visao-geral', label: 'Visão Geral', icon: Radio },
    { value: 'mapa', label: 'Mapa', icon: MapPin },
    { value: 'estoque', label: 'Estoque', icon: Package },
    { value: 'historico', label: 'Histórico', icon: Clock },
    ...(canManagePlataformas ? [{ value: 'plataformas', label: 'Plataformas', icon: Server }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Header da página */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rastreadores</h1>
          <p className="text-muted-foreground">
            Gerencie rastreadores, estoque, comunicação e movimentações
          </p>
        </div>
        {activeTab === 'estoque' && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setModalImportarAberto(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Importar Lote
            </Button>
            <Button onClick={() => setModalEntradaAberto(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Entrada Manual
            </Button>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full lg:w-auto lg:inline-grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Aba Visão Geral */}
        <TabsContent value="visao-geral" className="space-y-6 mt-6">
          <RastreadoresContent
            rastreadores={rastreadores}
            metricas={metricas}
            isLoading={isLoading}
            isLoadingMetricas={isLoadingMetricas}
            filters={filters}
            onFiltersChange={setFilters}
            onOpenDetails={handleOpenDetails}
            onEdit={handleEdit}
            onNewRastreador={handleNewRastreador}
            getPlataformaLabel={getPlataformaLabel}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            isDiretor={isDiretor}
            onViewMap={handleViewMap}
          />
        </TabsContent>

        {/* Aba Estoque */}
        <TabsContent value="estoque" className="space-y-6 mt-6">
          <EstoqueMetricas />
          <ListaRastreadores />
          <ConsultaRastreador />
        </TabsContent>

        {/* Aba Histórico */}
        <TabsContent value="historico" className="mt-6">
          <HistoricoMovimentacoes />
        </TabsContent>

        {/* Aba Plataformas (condicional) */}
        {canManagePlataformas && (
          <TabsContent value="plataformas" className="mt-6">
            <PlataformasConfigPanel />
          </TabsContent>
        )}
      </Tabs>

      {/* Modais globais */}
      <RastreadorFormDialog
        open={showForm}
        onOpenChange={handleFormClose}
        rastreadorId={editingId}
      />

      <RastreadorDetailDrawer
        rastreadorId={selectedId}
        open={!!selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onEdit={() => {
          if (selectedId) {
            handleEdit(selectedId);
            setSelectedId(null);
          }
        }}
      />

      <EntradaEstoqueDialog
        open={modalEntradaAberto}
        onOpenChange={setModalEntradaAberto}
      />

      <ImportarRastreadoresDialog
        open={modalImportarAberto}
        onOpenChange={setModalImportarAberto}
      />

      <Dialog open={mapaModalOpen} onOpenChange={handleCloseMapModal}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Mapa do Rastreador</DialogTitle>
            <DialogDescription>
              Visualização em tempo real da posição do rastreador
            </DialogDescription>
          </DialogHeader>
          {rastreadorMapaId && (
            <MapaRastreador
              rastreadorId={rastreadorMapaId}
              altura="450px"
              mostrarControles={true}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Componente separado para o conteúdo de rastreadores
interface RastreadoresContentProps {
  rastreadores: ReturnType<typeof useRastreadores>['data'];
  metricas: ReturnType<typeof useRastreadoresMetricas>['data'];
  isLoading: boolean;
  isLoadingMetricas: boolean;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  onOpenDetails: (id: string) => void;
  onEdit: (id: string) => void;
  onNewRastreador: () => void;
  getPlataformaLabel: (codigo: string) => string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  isDiretor: boolean;
  onViewMap: (rastreadorId: string) => void;
}

function RastreadoresContent({
  rastreadores,
  metricas,
  isLoading,
  isLoadingMetricas,
  filters,
  onFiltersChange,
  onOpenDetails,
  onEdit,
  onNewRastreador,
  getPlataformaLabel,
  viewMode,
  onViewModeChange,
  isDiretor,
  onViewMap,
}: RastreadoresContentProps) {
  const queryClient = useQueryClient();
  const [portadorDialogOpen, setPortadorDialogOpen] = useState(false);
  const [loteDialogOpen, setLoteDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rastreadorParaPortador, setRastreadorParaPortador] = useState<{
    id: string;
    codigo: string;
    portador_id: string | null;
    portador_nome: string | null;
  } | null>(null);
  const [dialogExcluirAberto, setDialogExcluirAberto] = useState(false);
  const [rastreadorParaExcluir, setRastreadorParaExcluir] = useState<{ id: string; codigo: string } | null>(null);
  const [dialogManutencao, setDialogManutencao] = useState<{
    id: string;
    codigo: string;
  } | null>(null);
  const [dialogRetirada, setDialogRetirada] = useState<{
    id: string;
    codigo: string;
  } | null>(null);

  const deleteRastreadorMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('rastreadores').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Rastreador excluído com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['rastreadores'] });
      queryClient.invalidateQueries({ queryKey: ['lista-rastreadores'] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores-metricas'] });
      setDialogExcluirAberto(false);
      setRastreadorParaExcluir(null);
    },
    onError: (error: any) => {
      console.error('Erro ao excluir rastreador:', error);
      toast.error(error.message || 'Erro ao excluir rastreador');
    },
  });

  const rastreadoresEstoque = rastreadores?.filter(r => r.status === 'estoque') || [];

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(rastreadoresEstoque.map(r => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) newSet.add(id);
    else newSet.delete(id);
    setSelectedIds(newSet);
  };

  const handleLoteSuccess = () => {
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ['lista-rastreadores'] });
  };

  const handleOpenPortadorDialog = (rastreador: RastreadorWithRelations) => {
    setRastreadorParaPortador({
      id: rastreador.id,
      codigo: rastreador.codigo,
      portador_id: rastreador.portador_id,
      portador_nome: rastreador.portador?.nome || null,
    });
    setPortadorDialogOpen(true);
  };

  const handleMaintenance = (rastreador: RastreadorWithRelations) => {
    setDialogManutencao({ id: rastreador.id, codigo: rastreador.codigo });
  };

  const handleWithdraw = (rastreador: RastreadorWithRelations) => {
    setDialogRetirada({ id: rastreador.id, codigo: rastreador.codigo });
  };

  const handleDelete = (rastreador: RastreadorWithRelations) => {
    setRastreadorParaExcluir({ id: rastreador.id, codigo: rastreador.codigo });
    setDialogExcluirAberto(true);
  };

  return (
    <>
      <RastreadorMetrics metricas={metricas} isLoading={isLoadingMetricas} />
      <RastreadorFiltersV2 filters={filters} onFiltersChange={onFiltersChange} />
      <RastreadorListHeader
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        totalCount={rastreadores?.length || 0}
        onNewRastreador={onNewRastreador}
      />

      {viewMode === 'cards' ? (
        <RastreadorGridView
          rastreadores={rastreadores}
          isLoading={isLoading}
          selectedIds={selectedIds}
          onSelectOne={handleSelectOne}
          onOpenDetails={onOpenDetails}
          onMaintenance={handleMaintenance}
          onWithdraw={handleWithdraw}
          onNewRastreador={onNewRastreador}
          getPlataformaLabel={getPlataformaLabel}
          onViewMap={onViewMap}
        />
      ) : (
        <RastreadorTableView
          rastreadores={rastreadores}
          isLoading={isLoading}
          selectedIds={selectedIds}
          onSelectAll={handleSelectAll}
          onSelectOne={handleSelectOne}
          onOpenDetails={onOpenDetails}
          onEdit={onEdit}
          onMaintenance={handleMaintenance}
          onWithdraw={handleWithdraw}
          onAssignPortador={handleOpenPortadorDialog}
          onDelete={handleDelete}
          onNewRastreador={onNewRastreador}
          getPlataformaLabel={getPlataformaLabel}
          isDiretor={isDiretor}
          onViewMap={onViewMap}
        />
      )}

      <RastreadorBatchActions
        selectedCount={selectedIds.size}
        onAssignPortador={() => setLoteDialogOpen(true)}
        onClear={() => setSelectedIds(new Set())}
      />

      <AtribuirPortadorDialog
        open={portadorDialogOpen}
        onOpenChange={setPortadorDialogOpen}
        rastreador={rastreadorParaPortador}
      />

      <AtribuirPortadorLoteDialog
        open={loteDialogOpen}
        onOpenChange={setLoteDialogOpen}
        rastreadorIds={Array.from(selectedIds)}
        onSuccess={handleLoteSuccess}
      />

      <AlertDialog open={dialogExcluirAberto} onOpenChange={setDialogExcluirAberto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o rastreador <strong>{rastreadorParaExcluir?.codigo}</strong>?
              Esta ação é irreversível e removerá todos os dados relacionados a este rastreador.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => rastreadorParaExcluir && deleteRastreadorMutation.mutate(rastreadorParaExcluir.id)}
              disabled={deleteRastreadorMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRastreadorMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AgendarManutencaoUnificadoModal
        open={!!dialogManutencao}
        onOpenChange={(open) => !open && setDialogManutencao(null)}
        rastreador={dialogManutencao}
      />

      <AbrirRetiradaModal
        open={!!dialogRetirada}
        onOpenChange={(open) => !open && setDialogRetirada(null)}
        rastreador={dialogRetirada}
      />
    </>
  );
}
