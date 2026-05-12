import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Car, User, Smartphone, Loader2, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { VeiculoDetalhesModal } from '@/components/cadastro/VeiculoDetalhesModal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useVeiculos, useVeiculosPaginados, useDeleteVeiculo } from '@/hooks/useVeiculos';
import { useDebounce } from '@/hooks/useDebounce';
import { STATUS_VEICULO_LABELS, type StatusVeiculo } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface VehicleResult {
  placa: string;
  chassi: string;
  renavam: string;
  marca: string;
  modelo: string;
  marca_modelo: string;
  ano: string;
  cor: string;
  combustivel: string;
  municipio: string;
  uf: string;
  motor: string;
  potencia: string;
  cilindradas: string;
  tipo_veiculo: string;
  categoria: string;
  procedencia: string;
  numero_portas: string;
  cambio: string;
}

interface FipeResult {
  codigo: string;
  valor: number;
  mesReferencia: string;
}

interface LookupResult {
  success: boolean;
  vehicleData?: VehicleResult;
  fipeData?: FipeResult | null;
  error?: string;
}

function InfoItem({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium text-sm">{value}</p>
    </div>
  );
}

const statusColors: Record<StatusVeiculo, string> = {
  em_analise: 'bg-blue-100 text-blue-800',
  aprovado: 'bg-green-100 text-green-800',
  instalacao_pendente: 'bg-yellow-100 text-yellow-800',
  ativo: 'bg-green-500 text-white',
  suspenso: 'bg-orange-100 text-orange-800',
  cancelado: 'bg-red-100 text-red-800',
  sinistrado: 'bg-purple-100 text-purple-800',
};

interface VeiculoRowProps {
  veiculo: any;
  canDelete: boolean;
  onSelect: (id: string) => void;
  onDelete: (v: { id: string; placa: string }) => void;
  formatCurrency: (v: number | null) => string;
}

const VeiculoRow = React.memo(function VeiculoRow({ veiculo, canDelete, onSelect, onDelete, formatCurrency }: VeiculoRowProps) {
  const veiculoStatus = (veiculo.status as StatusVeiculo) || (veiculo.ativo ? 'ativo' : 'cancelado');
  // Derivação: se está 'instalacao_pendente' mas NÃO há nenhuma instalação criada/agendada,
  // o veículo na verdade aguarda vistoria/aprovação manual (fluxo sem rastreador) — mostrar label honesto.
  const instalacoes = (veiculo.instalacoes as Array<{ status: string }> | undefined) || [];
  const temInstalacaoAtiva = instalacoes.some((i) =>
    ['pendente', 'agendada', 'em_execucao', 'concluida'].includes(i.status)
  );
  // Prioridade: cobertura suspensa > instalação sem agendamento > status cru.
  const isSuspenso = veiculo.cobertura_suspensa === true;
  const labelOverride = isSuspenso
    ? 'Suspenso'
    : (veiculoStatus === 'instalacao_pendente' && !temInstalacaoAtiva ? 'Aguardando Vistoria/Aprovação' : null);
  const badgeColor = isSuspenso ? statusColors.suspenso : statusColors[veiculoStatus];
  const tooltipContent = isSuspenso
    ? `${veiculo.cobertura_suspensa_motivo || 'Cobertura suspensa'}${
        veiculo.cobertura_suspensa_em
          ? ` — desde ${new Date(veiculo.cobertura_suspensa_em).toLocaleString('pt-BR')}`
          : ''
      }`
    : null;
  const badge = (
    <Badge className={badgeColor}>{labelOverride ?? STATUS_VEICULO_LABELS[veiculoStatus]}</Badge>
  );
  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => onSelect(veiculo.id)}
    >
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Car className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-medium">{veiculo.marca}</p>
            <p className="text-sm text-muted-foreground">{veiculo.modelo}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="font-mono">{veiculo.placa}</TableCell>
      <TableCell>{veiculo.ano_fabricacao}/{veiculo.ano_modelo}</TableCell>
      <TableCell>{veiculo.cor || '-'}</TableCell>
      <TableCell>{formatCurrency(veiculo.valor_fipe)}</TableCell>
      <TableCell>
        {veiculo.uso_aplicativo ? (
          <div className="flex items-center gap-1">
            <Smartphone className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline" className="text-xs">{veiculo.plataforma_app || 'Sim'}</Badge>
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <User className="h-3 w-3 text-muted-foreground" />
          {veiculo.associado?.nome || 'Sem associado'}
        </div>
      </TableCell>
      <TableCell>
        {tooltipContent ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild><span>{badge}</span></TooltipTrigger>
              <TooltipContent className="max-w-xs">{tooltipContent}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          badge
        )}
      </TableCell>
      {canDelete && (
        <TableCell>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => {
              e.stopPropagation();
              onDelete({ id: veiculo.id, placa: veiculo.placa });
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </TableCell>
      )}
    </TableRow>
  );
});

export default function Veiculos() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const debouncedSearch = useDebounce(search, 300);
  const [selectedVeiculoId, setSelectedVeiculoId] = useState<string | null>(null);
  const { data: paginated, isLoading, isFetching } = useVeiculosPaginados({
    page,
    pageSize,
    search: debouncedSearch,
    status: statusFilter === 'all' ? undefined : statusFilter,
  });
  const veiculos = paginated?.veiculos ?? [];
  const totalPages = paginated?.pagination.totalPages ?? 1;
  const totalRows = paginated?.pagination.total ?? 0;
  const deleteVeiculo = useDeleteVeiculo();
  const { isDiretor, isAdminMaster, isDesenvolvedor, hasPerm } = usePermissions();
  const { toast } = useToast();
  const [veiculoToDelete, setVeiculoToDelete] = useState<{ id: string; placa: string } | null>(null);

  const canDeleteVeiculo = isDiretor || isAdminMaster || isDesenvolvedor;

  // Consulta de placa
  const [placaInput, setPlacaInput] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupError, setLookupError] = useState('');

  const handlePlacaChange = (value: string) => {
    const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 7);
    if (cleaned.length >= 4 && /^[A-Z]{3}[0-9]/.test(cleaned) && !/[A-Z]/.test(cleaned[4] || '')) {
      setPlacaInput(`${cleaned.slice(0, 3)}-${cleaned.slice(3)}`);
    } else {
      setPlacaInput(cleaned);
    }
    setLookupError('');
    setLookupResult(null);
  };

  const handleLookup = async () => {
    const raw = placaInput.replace(/[^A-Za-z0-9]/g, '');
    if (raw.length < 7) return;
    setLookupLoading(true);
    setLookupError('');
    setLookupResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('plate-lookup', {
        body: { placa: raw },
      });
      if (error) throw new Error(error.message);
      if (data?.success) {
        setLookupResult(data);
      } else {
        setLookupError(data?.error || 'Veículo não encontrado');
      }
    } catch (err: any) {
      setLookupError(err.message || 'Erro ao consultar placa');
    } finally {
      setLookupLoading(false);
    }
  };

  const formatFipeCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const lv = lookupResult?.vehicleData;
  const lf = lookupResult?.fipeData;

  // Filtragem é server-side; aqui apenas exibimos o que veio.
  const filteredVeiculos = veiculos as any[];

  // Reset de página quando muda busca/status (evita página vazia)
  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter]);

  const formatCurrency = useCallback((value: number | null) => {
    if (!value) return 'N/A';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }, []);

  // Stats com filtros (RPC única — antes eram 2 HEADs + paginação completa de valor_fipe)
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['veiculos-stats', debouncedSearch, statusFilter],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('veiculos_stats_filtrados', {
        p_search: debouncedSearch || null,
        p_status: statusFilter && statusFilter !== 'all' ? statusFilter : null,
      });
      if (error) throw error;
      const v = (data || {}) as { total?: number; ativos?: number; valor_fipe_total?: number };
      return {
        total: v.total ?? 0,
        ativos: v.ativos ?? 0,
        valorTotal: Number(v.valor_fipe_total ?? 0),
      };
    },
    staleTime: 30_000,
  });

  const stats = statsData || { total: 0, ativos: 0, valorTotal: 0 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Veículos</h1>
        <p className="text-muted-foreground">
          Visualize todos os veículos protegidos
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Car className="h-5 w-5 text-primary" />
              </div>
              <div>
                {statsLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  <p className="text-2xl font-bold">{stats.total}</p>
                )}
                <p className="text-xs text-muted-foreground">Total de Veículos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/10 p-2">
                <Car className="h-5 w-5 text-green-500" />
              </div>
              <div>
                {statsLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  <p className="text-2xl font-bold">{stats.ativos}</p>
                )}
                <p className="text-xs text-muted-foreground">Veículos Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent/10 p-2">
                <Car className="h-5 w-5 text-accent" />
              </div>
              <div>
                {statsLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <p className="text-2xl font-bold">{formatCurrency(stats.valorTotal)}</p>
                )}
                <p className="text-xs text-muted-foreground">Valor FIPE Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por placa, marca, modelo ou associado..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_VEICULO_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table — desktop/tablet */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredVeiculos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Car className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 font-semibold text-foreground">Nenhum veículo encontrado</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {search || statusFilter !== 'all' ? 'Tente ajustar os filtros' : 'Nenhum veículo cadastrado ainda'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Placa</TableHead>
                  <TableHead>Ano</TableHead>
                  <TableHead>Cor</TableHead>
                  <TableHead>Valor FIPE</TableHead>
                  <TableHead>Uso App</TableHead>
                  <TableHead>Associado</TableHead>
                  <TableHead>Status</TableHead>
                  {canDeleteVeiculo && <TableHead className="w-12"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVeiculos.map((veiculo) => (
                  <VeiculoRow
                    key={veiculo.id}
                    veiculo={veiculo}
                    canDelete={canDeleteVeiculo}
                    onSelect={setSelectedVeiculoId}
                    onDelete={setVeiculoToDelete}
                    formatCurrency={formatCurrency}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {isLoading ? (
          [1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : filteredVeiculos.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Car className="h-10 w-10 text-muted-foreground/50" />
              <h3 className="mt-3 font-semibold text-foreground">Nenhum veículo encontrado</h3>
              <p className="mt-1 text-xs text-muted-foreground text-center">
                {search || statusFilter !== 'all' ? 'Tente ajustar os filtros' : 'Nenhum veículo cadastrado ainda'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredVeiculos.map((veiculo: any) => {
            const veiculoStatus = (veiculo.status as StatusVeiculo) || (veiculo.ativo ? 'ativo' : 'cancelado');
            const instalacoes = (veiculo.instalacoes as Array<{ status: string }> | undefined) || [];
            const temInstalacaoAtiva = instalacoes.some((i) =>
              ['pendente', 'agendada', 'em_execucao', 'concluida'].includes(i.status)
            );
            const labelOverride =
              veiculoStatus === 'instalacao_pendente' && !temInstalacaoAtiva ? 'Aguardando Vistoria/Aprovação' : null;
            return (
              <Card
                key={veiculo.id}
                className="cursor-pointer active:scale-[0.99] transition-transform"
                onClick={() => setSelectedVeiculoId(veiculo.id)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-2.5">
                    <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                      <Car className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{veiculo.marca}</p>
                          <p className="text-xs text-muted-foreground truncate">{veiculo.modelo}</p>
                        </div>
                        {canDeleteVeiculo && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 -mt-1 -mr-1 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setVeiculoToDelete({ id: veiculo.id, placa: veiculo.placa });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded border border-border">
                          {veiculo.placa}
                        </span>
                        <Badge className={`${statusColors[veiculoStatus]} text-[10px] px-1.5 py-0.5`}>
                          {labelOverride ?? STATUS_VEICULO_LABELS[veiculoStatus]}
                        </Badge>
                        {veiculo.uso_aplicativo && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 gap-1">
                            <Smartphone className="h-2.5 w-2.5" />
                            {veiculo.plataforma_app || 'App'}
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-[11px]">
                        <div>
                          <span className="text-muted-foreground">Ano: </span>
                          <span className="text-foreground">{veiculo.ano_fabricacao}/{veiculo.ano_modelo}</span>
                        </div>
                        <div className="truncate">
                          <span className="text-muted-foreground">Cor: </span>
                          <span className="text-foreground">{veiculo.cor || '-'}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground">FIPE: </span>
                          <span className="text-foreground font-medium">{formatCurrency(veiculo.valor_fipe)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 mt-2 text-[11px] text-muted-foreground truncate">
                        <User className="h-3 w-3 shrink-0" />
                        <span className="truncate">{veiculo.associado?.nome || 'Sem associado'}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Paginação server-side */}
      {totalRows > pageSize && (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">
            Página {page} de {totalPages} · {totalRows} veículos {isFetching && '(atualizando…)'}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages || isFetching} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Próxima
            </Button>
          </div>
        </div>
      )}
      <VeiculoDetalhesModal
        open={!!selectedVeiculoId}
        onClose={() => setSelectedVeiculoId(null)}
        veiculoId={selectedVeiculoId}
      />

      <AlertDialog open={!!veiculoToDelete} onOpenChange={(open) => !open && setVeiculoToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir veículo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o veículo <strong>{veiculoToDelete?.placa}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (veiculoToDelete) {
                  deleteVeiculo.mutate(veiculoToDelete.id, {
                    onSuccess: () => {
                      toast({ title: 'Veículo excluído com sucesso' });
                      setVeiculoToDelete(null);
                    },
                    onError: (err: any) => {
                      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' });
                    },
                  });
                }
              }}
            >
              {deleteVeiculo.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
