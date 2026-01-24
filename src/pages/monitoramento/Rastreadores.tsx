import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Radio, Plus, Wifi, WifiOff, AlertTriangle, Loader2, MoreHorizontal, Eye, Pencil, Package, Server } from 'lucide-react';
import {
  useRastreadores,
  useRastreadoresMetricas,
  isRastreadorOnline,
  type RastreadorFilters as Filters,
} from '@/hooks/useRastreadores';
import { usePlataformasLabels } from '@/hooks/usePlataformasCRUD';
import { usePermissions } from '@/hooks/usePermissions';
import {
  RastreadorFormDialog,
  RastreadorDetailDrawer,
  RastreadorFilters,
} from '@/components/rastreadores';
import { PlataformasConfigPanel } from '@/components/rastreadores/PlataformasConfigPanel';
import {
  STATUS_RASTREADOR_LABELS,
  STATUS_RASTREADOR_COLORS,
} from '@/types/database';

export default function Rastreadores() {
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({});
  const [activeTab, setActiveTab] = useState('rastreadores');

  const { data: rastreadores, isLoading } = useRastreadores(filters);
  const { data: metricas } = useRastreadoresMetricas();
  const { data: plataformasLabels } = usePlataformasLabels();
  const { isDiretor, isDesenvolvedor } = usePermissions();

  const canManagePlataformas = isDiretor || isDesenvolvedor;

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rastreadores</h1>
          <p className="text-muted-foreground">
            Monitore a comunicação e status dos rastreadores
          </p>
        </div>
        {activeTab === 'rastreadores' && (
          <Button onClick={handleNewRastreador}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Rastreador
          </Button>
        )}
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
              filters={filters}
              onFiltersChange={setFilters}
              onOpenDetails={handleOpenDetails}
              onEdit={handleEdit}
              onNewRastreador={handleNewRastreador}
              getPlataformaLabel={getPlataformaLabel}
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
          filters={filters}
          onFiltersChange={setFilters}
          onOpenDetails={handleOpenDetails}
          onEdit={handleEdit}
          onNewRastreador={handleNewRastreador}
          getPlataformaLabel={getPlataformaLabel}
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
    </div>
  );
}

// Componente separado para o conteúdo de rastreadores
interface RastreadoresContentProps {
  rastreadores: ReturnType<typeof useRastreadores>['data'];
  metricas: ReturnType<typeof useRastreadoresMetricas>['data'];
  isLoading: boolean;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  onOpenDetails: (id: string) => void;
  onEdit: (id: string) => void;
  onNewRastreador: () => void;
  getPlataformaLabel: (codigo: string) => string;
}

function RastreadoresContent({
  rastreadores,
  metricas,
  isLoading,
  filters,
  onFiltersChange,
  onOpenDetails,
  onEdit,
  onNewRastreador,
  getPlataformaLabel,
}: RastreadoresContentProps) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metricas?.total || 0}</div>
            <p className="text-xs text-muted-foreground">Rastreadores cadastrados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Online</CardTitle>
            <Wifi className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{metricas?.online || 0}</div>
            <p className="text-xs text-muted-foreground">Comunicando normalmente</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offline</CardTitle>
            <WifiOff className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{metricas?.offline || 0}</div>
            <p className="text-xs text-muted-foreground">Sem comunicação</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{metricas?.alertas || 0}</div>
            <p className="text-xs text-muted-foreground">Requerem atenção</p>
          </CardContent>
        </Card>
      </div>

      <RastreadorFilters filters={filters} onFiltersChange={onFiltersChange} />

      <Card>
        <CardHeader>
          <CardTitle>Lista de Rastreadores</CardTitle>
          <CardDescription>
            Todos os rastreadores e seu status de comunicação
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-[300px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !rastreadores || rastreadores.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed">
              <div className="text-center">
                <Radio className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">Nenhum rastreador</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Cadastre rastreadores para monitorar
                </p>
                <Button className="mt-4" onClick={onNewRastreador}>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Rastreador
                </Button>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nº Série</TableHead>
                  <TableHead>IMEI</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Portador</TableHead>
                  <TableHead>Comunicação</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Email Associado</TableHead>
                  <TableHead className="w-[70px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rastreadores.map((rastreador) => {
                  const isInstalled = rastreador.status === 'instalado';
                  const online = isRastreadorOnline(rastreador.ultima_comunicacao);

                  return (
                    <TableRow key={rastreador.id}>
                      <TableCell className="font-medium">{rastreador.codigo}</TableCell>
                      <TableCell>
                        {rastreador.numero_serie || '-'}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">
                          {rastreador.imei || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {getPlataformaLabel(rastreador.plataforma)}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_RASTREADOR_COLORS[rastreador.status]}>
                          {STATUS_RASTREADOR_LABELS[rastreador.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {rastreador.portador?.nome ? (
                          <span className="text-sm font-medium">{rastreador.portador.nome}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isInstalled ? (
                          <Badge
                            variant="outline"
                            className={
                              online
                                ? 'border-green-500 text-green-600'
                                : 'border-destructive text-destructive'
                            }
                          >
                            {online ? (
                              <>
                                <Wifi className="mr-1 h-3 w-3" /> Online
                              </>
                            ) : (
                              <>
                                <WifiOff className="mr-1 h-3 w-3" /> Offline
                              </>
                            )}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {rastreador.veiculos ? (
                          <div>
                            <span className="font-medium">{rastreador.veiculos.placa}</span>
                            {rastreador.veiculos.associados && (
                              <span className="block text-xs text-muted-foreground">
                                {rastreador.veiculos.associados.nome}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {rastreador.veiculos?.associados?.email ? (
                          <span className="text-sm text-muted-foreground">
                            {rastreador.veiculos.associados.email}
                          </span>
                        ) : (rastreador as any).associado_email ? (
                          <span className="text-sm text-muted-foreground">
                            {(rastreador as any).associado_email}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onOpenDetails(rastreador.id)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Ver Detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEdit(rastreador.id)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            {rastreador.status === 'estoque' && (
                              <DropdownMenuItem onClick={() => onOpenDetails(rastreador.id)}>
                                <Package className="mr-2 h-4 w-4" />
                                Ver Estoque
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
