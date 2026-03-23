import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Route, MapPin, Users, Calendar, Loader2, ListOrdered, ArrowRightLeft, AlertTriangle, Radio, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useEquipeHoje } from '@/hooks/useDashboardCoordenador';
import { useMovimentacoes } from '@/hooks/useMovimentacoes';
import { 
  RotaFormDialog, 
  RotaDetailDrawer, 
  RotaCalendario, 
  RotaCard,
  RotaFilters,
  AddInstalacaoDialog,
  InstalacaoMiniCard,
} from '@/components/rotas';
import { ConfiguracoesEncaixe } from '@/components/rotas/ConfiguracoesEncaixe';
import { ConfiguracoesFilaAtribuicao } from '@/components/rotas/ConfiguracoesFilaAtribuicao';
import GestaoRotas from './GestaoRotas';
import { 
  useRotas, 
  useRotasMetricas, 
  useInstalacoesDisponiveis,
  type RotaFilters as RotaFiltersType,
  type Rota 
} from '@/hooks/useRotas';
import { useRotasRealtime } from '@/hooks/useRotasRealtime';
import { usePermissions } from '@/hooks/usePermissions';
import { useFilaServicos } from '@/hooks/useFilaServicos';

export default function Rotas() {
  const { canEditRotas } = usePermissions();
  useRotasRealtime();
  const [drawerRotaId, setDrawerRotaId] = useState<string | null>(null);
  const [editRota, setEditRota] = useState<Rota | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [addInstalacaoOpen, setAddInstalacaoOpen] = useState(false);
  const [filters, setFilters] = useState<RotaFiltersType>({});
  const [dataSelecionada, setDataSelecionada] = useState<Date | null>(null);
  
  const { data: metricas, isLoading: loadingMetricas } = useRotasMetricas();
  const { data: rotas, isLoading: loadingRotas } = useRotas(filters);
  const { data: instalacoesPendentes, isLoading: loadingPendentes } = useInstalacoesDisponiveis();
  const { data: filaServicos, isLoading: loadingFila } = useFilaServicos();
  const { data: equipeHoje, isLoading: loadingEquipe } = useEquipeHoje();
  const { data: movimentacoes, isLoading: loadingMovimentacoes } = useMovimentacoes();

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vistorias e Instalações</h1>
          <p className="text-muted-foreground">
            Acompanhe vistorias, instalações e movimentações em tempo real
          </p>
        </div>
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
      <Tabs defaultValue="tempo-real" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="tempo-real">
            <Radio className="mr-1 h-4 w-4" />
            Tempo Real
          </TabsTrigger>
          <TabsTrigger value="movimentacoes">
            <Activity className="mr-1 h-4 w-4" />
            Movimentações
          </TabsTrigger>
          <TabsTrigger value="calendario">Calendário</TabsTrigger>
          <TabsTrigger value="lista">Lista</TabsTrigger>
          {canEditRotas && (
            <TabsTrigger value="pendentes">
              Instalações Pendentes
              {instalacoesPendentes?.length ? (
                <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                  {instalacoesPendentes.length}
                </span>
              ) : null}
            </TabsTrigger>
          )}
          {canEditRotas && (
            <TabsTrigger value="fila">
              <ListOrdered className="mr-1 h-4 w-4" />
              Fila
              {filaServicos?.length ? (
                <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">
                  {filaServicos.length}
                </span>
              ) : null}
            </TabsTrigger>
          )}
          {canEditRotas && (
            <TabsTrigger value="configuracoes">Configurações</TabsTrigger>
          )}
          {canEditRotas && (
            <TabsTrigger value="gestao-rotas">
              <Route className="mr-1 h-4 w-4" />
              Gestão de Rotas
            </TabsTrigger>
          )}
        </TabsList>

        {/* Aba Tempo Real */}
        <TabsContent value="tempo-real">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="h-5 w-5 text-green-500" />
                Equipe em Campo — Hoje
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingEquipe ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : equipeHoje?.length ? (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {equipeHoje.map((membro) => (
                    <div key={membro.id} className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-1">
                        <p className="font-medium">{membro.nome}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge
                            variant={
                              membro.status === 'em_rota' ? 'default' :
                              membro.status === 'online' ? 'secondary' : 'outline'
                            }
                            className="text-xs"
                          >
                            {membro.status === 'em_rota' ? '🚗 Em rota' :
                             membro.status === 'online' ? '🟢 Online' : '⚫ Offline'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {membro.tarefasConcluidas}/{membro.tarefasTotal} tarefas concluídas
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">
                          {membro.tarefasTotal > 0 
                            ? Math.round((membro.tarefasConcluidas / membro.tarefasTotal) * 100) 
                            : 0}%
                        </div>
                        <p className="text-xs text-muted-foreground">progresso</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-32 flex-col items-center justify-center text-center">
                  <Users className="h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-2 text-muted-foreground">
                    Nenhum profissional em campo hoje
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Movimentações */}
        <TabsContent value="movimentacoes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Movimentações Recentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingMovimentacoes ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : movimentacoes?.length ? (
                <div className="space-y-3">
                  {movimentacoes.map((mov) => (
                    <div key={mov.id} className="flex items-start gap-3 rounded-lg border p-3">
                      <div className={`mt-1 h-2 w-2 rounded-full ${
                        mov.status === 'concluida' ? 'bg-green-500' :
                        mov.status === 'cancelada' ? 'bg-red-500' :
                        mov.status === 'reagendada' ? 'bg-amber-500' :
                        'bg-blue-500'
                      }`} />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{mov.associado_nome || 'Cliente'}</span>
                          <Badge variant="outline" className="text-xs">
                            {mov.tipo === 'instalacao' ? 'Instalação' : 'Vistoria'}
                          </Badge>
                          <Badge variant={
                            mov.status === 'concluida' ? 'default' :
                            mov.status === 'cancelada' ? 'destructive' :
                            'secondary'
                          } className="text-xs">
                            {mov.status === 'concluida' ? 'Concluída' :
                             mov.status === 'cancelada' ? 'Cancelada' :
                             mov.status === 'reagendada' ? 'Reagendada' :
                             mov.status === 'em_andamento' ? 'Em andamento' :
                             mov.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {mov.profissional_nome && `${mov.profissional_nome} · `}
                          {mov.bairro && `${mov.bairro} · `}
                          {formatDistanceToNow(new Date(mov.updated_at), { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-32 flex-col items-center justify-center text-center">
                  <Activity className="h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-2 text-muted-foreground">
                    Nenhuma movimentação registrada hoje
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Calendário */}
        <TabsContent value="calendario">
          <RotaCalendario 
            onRotaClick={handleOpenRota}
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
                    : 'As rotas são criadas automaticamente quando os profissionais iniciam o serviço'}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Aba Instalações Pendentes - apenas para quem pode editar */}
        {canEditRotas && (
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
        )}

        {/* Aba Fila - apenas para coordenador */}
        {canEditRotas && (
          <TabsContent value="fila">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListOrdered className="h-5 w-5" />
                  Serviços na Fila de Proximidade
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingFila ? (
                  <div className="flex h-32 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filaServicos?.length ? (
                  <div className="space-y-3">
                    {filaServicos.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-lg border p-4"
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {(item.servico as any)?.associado?.nome || 'Cliente'}
                            </span>
                            <Badge variant={item.prioridade >= 1 ? 'destructive' : 'secondary'}>
                              {item.prioridade >= 1 ? (
                                <><AlertTriangle className="mr-1 h-3 w-3" />Urgente</>
                              ) : 'Normal'}
                            </Badge>
                            {item.motivo && (
                              <Badge variant="outline" className="text-xs">
                                {item.motivo === 'redistribuicao_imprevisto' ? 'Redistribuição' : 'Proximidade'}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {[(item.servico as any)?.bairro, (item.servico as any)?.cidade].filter(Boolean).join(', ') || 'Endereço não informado'}
                            </span>
                            <span>{item.distancia_km?.toFixed(1)} km</span>
                            <span>
                              Na fila há {formatDistanceToNow(new Date(item.created_at), { locale: ptBR })}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              Aguardando: {(item.profissional as any)?.nome || 'Profissional'}
                            </span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => {
                            // TODO: abrir modal de seleção de profissional
                            toast.info('Funcionalidade de reatribuição manual em breve');
                          }}
                        >
                          <ArrowRightLeft className="h-3 w-3" />
                          Reatribuir
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-32 flex-col items-center justify-center text-center">
                    <ListOrdered className="h-8 w-8 text-muted-foreground/50" />
                    <p className="mt-2 text-muted-foreground">
                      Nenhum serviço na fila de proximidade no momento
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Aba Configurações - apenas para quem pode editar */}
        {canEditRotas && (
          <TabsContent value="configuracoes" className="space-y-6">
            <ConfiguracoesEncaixe />
            <ConfiguracoesFilaAtribuicao />
          </TabsContent>
        )}
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
