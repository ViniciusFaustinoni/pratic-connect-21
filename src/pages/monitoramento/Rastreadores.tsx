import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { Radio, Plus, Wifi, WifiOff, AlertTriangle, Loader2, MoreHorizontal, Eye, Pencil, Package } from 'lucide-react';
import {
  useRastreadores,
  useRastreadoresMetricas,
  isRastreadorOnline,
  type RastreadorFilters as Filters,
} from '@/hooks/useRastreadores';
import {
  RastreadorFormDialog,
  RastreadorDetailDrawer,
  RastreadorFilters,
} from '@/components/rastreadores';
import {
  STATUS_RASTREADOR_LABELS,
  STATUS_RASTREADOR_COLORS,
  PLATAFORMA_RASTREADOR_LABELS,
} from '@/types/database';

export default function Rastreadores() {
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({});

  const { data: rastreadores, isLoading } = useRastreadores(filters);
  const { data: metricas } = useRastreadoresMetricas();

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rastreadores</h1>
          <p className="text-muted-foreground">
            Monitore a comunicação e status dos rastreadores
          </p>
        </div>
        <Button onClick={handleNewRastreador}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Rastreador
        </Button>
      </div>

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

      <RastreadorFilters filters={filters} onFiltersChange={setFilters} />

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
                <Button className="mt-4" onClick={handleNewRastreador}>
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
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Comunicação</TableHead>
                  <TableHead>Veículo</TableHead>
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
                      <TableCell>{rastreador.numero_serie || '-'}</TableCell>
                      <TableCell>
                        {PLATAFORMA_RASTREADOR_LABELS[rastreador.plataforma] || rastreador.plataforma}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_RASTREADOR_COLORS[rastreador.status]}>
                          {STATUS_RASTREADOR_LABELS[rastreador.status]}
                        </Badge>
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenDetails(rastreador.id)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Ver Detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(rastreador.id)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            {rastreador.status === 'estoque' && (
                              <DropdownMenuItem onClick={() => handleOpenDetails(rastreador.id)}>
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
