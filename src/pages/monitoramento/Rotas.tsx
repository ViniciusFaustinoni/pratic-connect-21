import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Route, MapPin, Users, Calendar, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  RotaFormDialog, 
  RotaDetailDrawer, 
  RotaCalendario, 
  RotaCard,
  RotaFilters,
  AddInstalacaoDialog,
  InstalacaoMiniCard,
} from '@/components/rotas';
import { 
  useRotas, 
  useRotasMetricas, 
  useInstalacoesDisponiveis,
  type RotaFilters as RotaFiltersType,
  type Rota 
} from '@/hooks/useRotas';
import { useRotasRealtime } from '@/hooks/useRotasRealtime';

export default function Rotas() {
  // Ativar atualizações em tempo real
  useRotasRealtime();
  const [formOpen, setFormOpen] = useState(false);
  const [drawerRotaId, setDrawerRotaId] = useState<string | null>(null);
  const [editRota, setEditRota] = useState<Rota | null>(null);
  const [addInstalacaoOpen, setAddInstalacaoOpen] = useState(false);
  const [filters, setFilters] = useState<RotaFiltersType>({});
  const [dataSelecionada, setDataSelecionada] = useState<Date | null>(null);
  
  const { data: metricas, isLoading: loadingMetricas } = useRotasMetricas();
  const { data: rotas, isLoading: loadingRotas } = useRotas(filters);
  const { data: instalacoesPendentes, isLoading: loadingPendentes } = useInstalacoesDisponiveis();

  const handleOpenRota = (rotaId: string) => {
    setDrawerRotaId(rotaId);
  };

  const handleEditRota = () => {
    const rota = rotas?.find(r => r.id === drawerRotaId);
    if (rota) {
      setEditRota(rota);
      setFormOpen(true);
    }
  };

  const handleAddInstalacoes = () => {
    if (drawerRotaId) {
      setAddInstalacaoOpen(true);
    }
  };

  const handleNewRota = () => {
    setDataSelecionada(null);
    setEditRota(null);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rotas</h1>
          <p className="text-muted-foreground">
            Organize as rotas de instalação por região e data
          </p>
        </div>
        <Button onClick={handleNewRota}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Rota
        </Button>
      </div>

      {/* Métricas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rotas Hoje</CardTitle>
            <Route className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingMetricas ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">{metricas?.rotasHoje || 0}</div>
                <p className="text-xs text-muted-foreground">Programadas para hoje</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingMetricas ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">{metricas?.emAndamento || 0}</div>
                <p className="text-xs text-muted-foreground">Instaladores em campo</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Instaladores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingMetricas ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">{metricas?.instaladoresAtivos || 0}</div>
                <p className="text-xs text-muted-foreground">Ativos hoje</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídas Semana</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingMetricas ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">{metricas?.concluidasSemana || 0}</div>
                <p className="text-xs text-muted-foreground">Últimos 7 dias</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="calendario" className="space-y-4">
        <TabsList>
          <TabsTrigger value="calendario">Calendário</TabsTrigger>
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="pendentes">
            Instalações Pendentes
            {instalacoesPendentes?.length ? (
              <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                {instalacoesPendentes.length}
              </span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        {/* Aba Calendário */}
        <TabsContent value="calendario">
          <RotaCalendario 
            onRotaClick={handleOpenRota}
            onDayClick={(data) => {
              setDataSelecionada(data);
              setEditRota(null);
              setFormOpen(true);
            }}
          />
        </TabsContent>

        {/* Aba Lista */}
        <TabsContent value="lista" className="space-y-4">
          <RotaFilters filters={filters} onFiltersChange={setFilters} />
          
          {loadingRotas ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : rotas?.length ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {rotas.map((rota) => (
                <RotaCard 
                  key={rota.id} 
                  rota={rota} 
                  onClick={() => handleOpenRota(rota.id)}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex h-64 flex-col items-center justify-center">
                <Route className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">Nenhuma rota encontrada</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {Object.keys(filters).length > 0 
                    ? 'Tente ajustar os filtros' 
                    : 'Crie rotas para organizar as instalações'}
                </p>
                <Button className="mt-4" onClick={handleNewRota}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Rota
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Aba Instalações Pendentes */}
        <TabsContent value="pendentes">
          <Card>
            <CardHeader>
              <CardTitle>Instalações sem Rota</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingPendentes ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : instalacoesPendentes?.length ? (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {instalacoesPendentes.map((instalacao) => (
                    <div key={instalacao.id} className="relative">
                      <InstalacaoMiniCard 
                        instalacao={instalacao as any}
                      />
                      <div className="absolute right-2 top-2 text-xs text-muted-foreground">
                        {format(new Date(instalacao.data_agendada), "dd/MM", { locale: ptBR })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-32 flex-col items-center justify-center text-center">
                  <Route className="h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-2 text-muted-foreground">
                    Todas as instalações estão atribuídas a rotas
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <RotaFormDialog 
        open={formOpen} 
        onOpenChange={setFormOpen} 
        rota={editRota}
        dataInicial={dataSelecionada}
      />

      <RotaDetailDrawer
        rotaId={drawerRotaId}
        open={!!drawerRotaId}
        onOpenChange={(open) => !open && setDrawerRotaId(null)}
        onEdit={handleEditRota}
        onAddServicos={handleAddInstalacoes}
      />

      {drawerRotaId && (
        <AddInstalacaoDialog
          open={addInstalacaoOpen}
          onOpenChange={setAddInstalacaoOpen}
          rotaId={drawerRotaId}
          rotaData={rotas?.find(r => r.id === drawerRotaId)?.data_rota}
        />
      )}
    </div>
  );
}
