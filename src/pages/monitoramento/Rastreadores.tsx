import { useState, useEffect } from 'react';
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
import { Radio, Server } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AtribuirPortadorDialog } from '@/components/monitoramento/estoque/AtribuirPortadorDialog';
import { AtribuirPortadorLoteDialog } from '@/components/monitoramento/estoque/AtribuirPortadorLoteDialog';
import { EnviarRetiradaModal } from '@/components/monitoramento/estoque/EnviarRetiradaModal';
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

export default function Rastreadores() {
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({});
  const [activeTab, setActiveTab] = useState('rastreadores');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // Recuperar preferência do localStorage
    const saved = localStorage.getItem('rastreadores-view-mode');
    return (saved as ViewMode) || 'cards';
  });
  
  // Estado do modal de mapa
  const [mapaModalOpen, setMapaModalOpen] = useState(false);
  const [rastreadorMapaId, setRastreadorMapaId] = useState<string | null>(null);

  const { data: rastreadores, isLoading } = useRastreadores(filters);
  const { data: metricas, isLoading: isLoadingMetricas } = useRastreadoresMetricas();
  const { data: plataformasLabels } = usePlataformasLabels();
  const { isDiretor, isDesenvolvedor } = usePermissions();

  const canManagePlataformas = isDiretor || isDesenvolvedor;

  // Salvar preferência de visualização
  useEffect(() => {
    localStorage.setItem('rastreadores-view-mode', viewMode);
  }, [viewMode]);

  const handleOpenDetails = (id: string) => {
    setSelectedId(id);
  };

  const handleEdit = (id: string) => {
    setEditingId(id);
    setShowForm(true);
  };

  const handleNewRastreador = () => {
    setEditingId(null);
    setShowForm(true);
  };

  const handleFormClose = (open: boolean) => {
    if (!open) {
      setEditingId(null);
    }
    setShowForm(open);
  };

  const getPlataformaLabel = (codigo: string) => {
    return plataformasLabels?.[codigo] || codigo;
  };
  
  const handleViewMap = (rastreadorId: string) => {
    setRastreadorMapaId(rastreadorId);
    setMapaModalOpen(true);
  };
  
  const handleCloseMapModal = (open: boolean) => {
    setMapaModalOpen(open);
    if (!open) {
      setRastreadorMapaId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header da página */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Rastreadores</h1>
        <p className="text-muted-foreground">
          Monitore a comunicação e status dos rastreadores
        </p>
      </div>

      {canManagePlataformas ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="rastreadores" className="gap-2">
              <Radio className="h-4 w-4" />
              Rastreadores
            </TabsTrigger>
            <TabsTrigger value="plataformas" className="gap-2">
              <Server className="h-4 w-4" />
              Plataformas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rastreadores" className="space-y-6 mt-6">
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

          <TabsContent value="plataformas" className="mt-6">
            <PlataformasConfigPanel />
          </TabsContent>
        </Tabs>
      ) : (
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
      )}

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

      {/* Modal de Mapa */}
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
    imei: string | null;
    status: 'estoque' | 'instalado' | 'manutencao' | 'baixado';
    veiculo: { placa: string; modelo: string | null } | null;
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

  // Rastreadores elegíveis para seleção (apenas status = 'estoque')
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
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
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
    setDialogManutencao({
      id: rastreador.id,
      codigo: rastreador.codigo,
    });
  };

  const handleWithdraw = (rastreador: RastreadorWithRelations) => {
    setDialogRetirada({
      id: rastreador.id,
      codigo: rastreador.codigo,
      imei: rastreador.imei,
      status: rastreador.status as 'estoque' | 'instalado' | 'manutencao' | 'baixado',
      veiculo: rastreador.veiculos ? {
        placa: rastreador.veiculos.placa,
        modelo: rastreador.veiculos.modelo
      } : null,
    });
  };

  const handleDelete = (rastreador: RastreadorWithRelations) => {
    setRastreadorParaExcluir({ id: rastreador.id, codigo: rastreador.codigo });
    setDialogExcluirAberto(true);
  };

  return (
    <>
      {/* Métricas */}
      <RastreadorMetrics metricas={metricas} isLoading={isLoadingMetricas} />

      {/* Filtros */}
      <RastreadorFiltersV2 filters={filters} onFiltersChange={onFiltersChange} />

      {/* Header da lista com toggle de visualização */}
      <RastreadorListHeader
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        totalCount={rastreadores?.length || 0}
        onNewRastreador={onNewRastreador}
      />

      {/* Lista de rastreadores */}
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

      {/* Barra de ações em lote */}
      <RastreadorBatchActions
        selectedCount={selectedIds.size}
        onAssignPortador={() => setLoteDialogOpen(true)}
        onClear={() => setSelectedIds(new Set())}
      />

      {/* Modais */}
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

      <EnviarRetiradaModal
        open={!!dialogRetirada}
        onOpenChange={() => setDialogRetirada(null)}
        rastreador={dialogRetirada}
      />
    </>
  );
}
