import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Radio, Plus, Wifi, WifiOff, AlertTriangle, Loader2, MoreHorizontal, Eye, Pencil, Package, Server, UserPlus, X } from 'lucide-react';
import { AtribuirPortadorDialog } from '@/components/monitoramento/estoque/AtribuirPortadorDialog';
import { AtribuirPortadorLoteDialog } from '@/components/monitoramento/estoque/AtribuirPortadorLoteDialog';
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

  const handleOpenPortadorDialog = (rastreador: NonNullable<typeof rastreadores>[number]) => {
    setRastreadorParaPortador({
      id: rastreador.id,
      codigo: rastreador.codigo,
      portador_id: rastreador.portador_id,
      portador_nome: rastreador.portador?.nome || null,
    });
    setPortadorDialogOpen(true);
  };
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
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={rastreadoresEstoque.length > 0 && selectedIds.size === rastreadoresEstoque.length}
                      onCheckedChange={(checked) => handleSelectAll(!!checked)}
                      aria-label="Selecionar todos"
                      disabled={rastreadoresEstoque.length === 0}
                    />
                  </TableHead>
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
                  const isEstoque = rastreador.status === 'estoque';

                  return (
                    <TableRow key={rastreador.id} className={selectedIds.has(rastreador.id) ? 'bg-muted/50' : ''}>
                      <TableCell>
                        {isEstoque ? (
                          <Checkbox
                            checked={selectedIds.has(rastreador.id)}
                            onCheckedChange={(checked) => handleSelectOne(rastreador.id, !!checked)}
                            aria-label={`Selecionar ${rastreador.codigo}`}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <div className="w-4" />
                        )}
                      </TableCell>
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
                        <div className="flex items-center gap-1">
                          {rastreador.portador?.nome ? (
                            <>
                              <span className="text-sm font-medium">{rastreador.portador.nome}</span>
                              {rastreador.status === 'estoque' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenPortadorDialog(rastreador);
                                  }}
                                  title="Alterar portador"
                                >
                                  <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              )}
                            </>
                          ) : rastreador.status === 'estoque' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-muted-foreground hover:text-foreground -ml-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenPortadorDialog(rastreador);
                              }}
                            >
                              <UserPlus className="h-3.5 w-3.5 mr-1" />
                              Atribuir
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
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

      {/* Barra de ações em lote */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <Card className="shadow-lg border-primary/20 bg-background">
            <CardContent className="flex items-center gap-4 py-3 px-4">
              <Badge variant="secondary" className="text-sm">
                {selectedIds.size} selecionado(s)
              </Badge>
              <Button
                size="sm"
                onClick={() => setLoteDialogOpen(true)}
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Atribuir Portador
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
              >
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

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
    </>
  );
}
