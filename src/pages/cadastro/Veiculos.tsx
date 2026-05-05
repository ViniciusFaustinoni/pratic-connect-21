import { useState, useMemo } from 'react';
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

  const filteredVeiculos = veiculos?.filter((veiculo: any) => {
    const associadoNome = veiculo.associado?.nome || '';
    const matchesSearch =
      veiculo.placa.toLowerCase().includes(search.toLowerCase()) ||
      veiculo.chassi?.toLowerCase().includes(search.toLowerCase()) ||
      veiculo.marca.toLowerCase().includes(search.toLowerCase()) ||
      veiculo.modelo.toLowerCase().includes(search.toLowerCase()) ||
      associadoNome.toLowerCase().includes(search.toLowerCase());
    
    const veiculoStatus = (veiculo.status as StatusVeiculo) || (veiculo.ativo ? 'ativo' : 'cancelado');
    const matchesStatus = statusFilter === 'all' || veiculoStatus === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

  const formatCurrency = (value: number | null) => {
    if (!value) return 'N/A';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Stats with exact counts (bypass 1000 row limit)
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['veiculos-stats'],
    queryFn: async () => {
      const [totalRes, ativosRes] = await Promise.all([
        supabase.from('veiculos').select('id', { count: 'exact', head: true }),
        supabase.from('veiculos').select('id', { count: 'exact', head: true }).eq('status', 'ativo'),
      ]);

      if (totalRes.error) throw totalRes.error;
      if (ativosRes.error) throw ativosRes.error;

      // Sum valor_fipe with pagination to bypass 1000 limit
      let valorTotal = 0;
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data: page, error } = await supabase
          .from('veiculos')
          .select('valor_fipe')
          .eq('status', 'ativo')
          .range(from, from + pageSize - 1);
        if (error) throw error;
        valorTotal += (page || []).reduce((acc, v) => acc + (Number(v.valor_fipe) || 0), 0);
        if (!page || page.length < pageSize) break;
        from += pageSize;
      }

      return {
        total: totalRes.count || 0,
        ativos: ativosRes.count || 0,
        valorTotal,
      };
    },
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
      <div className="grid gap-4 sm:grid-cols-3">
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

      {/* Consulta de Placa - apenas analista de cadastro */}
      {hasPerm('canManageCadastro') && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Car className="h-5 w-5" />
              Consulta de Veículo por Placa
            </CardTitle>
            <CardDescription>Consulte informações completas de um veículo pela placa</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1 max-w-xs">
                <Car className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ABC1234 ou ABC1D23"
                  value={placaInput}
                  onChange={(e) => handlePlacaChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                  className="pl-10 uppercase font-mono text-lg tracking-wider"
                  maxLength={8}
                  disabled={lookupLoading}
                />
              </div>
              <Button onClick={handleLookup} disabled={lookupLoading || placaInput.replace(/[^A-Za-z0-9]/g, '').length < 7}>
                {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                Consultar
              </Button>
            </div>

            {lookupError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{lookupError}</AlertDescription>
              </Alert>
            )}

            {lv && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="font-semibold">Veículo Encontrado</span>
                  <Badge variant="outline" className="font-mono text-base ml-auto">{lv.placa}</Badge>
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Identificação</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <InfoItem label="Placa" value={lv.placa} />
                    <InfoItem label="Chassi" value={lv.chassi} />
                    <InfoItem label="Renavam" value={lv.renavam} />
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Veículo</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <InfoItem label="Marca" value={lv.marca} />
                    <InfoItem label="Modelo" value={lv.modelo} />
                    <InfoItem label="Ano" value={lv.ano} />
                    <InfoItem label="Cor" value={lv.cor} />
                    <InfoItem label="Tipo" value={lv.tipo_veiculo} />
                    <InfoItem label="Nº Portas" value={lv.numero_portas} />
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Mecânica</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <InfoItem label="Motor" value={lv.motor} />
                    <InfoItem label="Potência" value={lv.potencia} />
                    <InfoItem label="Cilindradas" value={lv.cilindradas} />
                    <InfoItem label="Combustível" value={lv.combustivel} />
                    <InfoItem label="Câmbio" value={lv.cambio} />
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Registro</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <InfoItem label="Município" value={lv.municipio} />
                    <InfoItem label="UF" value={lv.uf} />
                    <InfoItem label="Categoria" value={lv.categoria} />
                    <InfoItem label="Procedência" value={lv.procedencia} />
                  </div>
                </div>

                {lf && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">FIPE</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <InfoItem label="Código FIPE" value={lf.codigo} />
                      <div>
                        <p className="text-xs text-muted-foreground">Valor FIPE</p>
                        <p className="font-bold text-primary text-lg">{formatFipeCurrency(lf.valor)}</p>
                      </div>
                      <InfoItem label="Referência" value={lf.mesReferencia} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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

      {/* Table */}
      <Card>
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
                {filteredVeiculos.map((veiculo) => {
                  const veiculoStatus = (veiculo.status as StatusVeiculo) || (veiculo.ativo ? 'ativo' : 'cancelado');
                  return (
                    <TableRow 
                      key={veiculo.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedVeiculoId(veiculo.id)}
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
                      <TableCell>
                        {veiculo.ano_fabricacao}/{veiculo.ano_modelo}
                      </TableCell>
                      <TableCell>{veiculo.cor || '-'}</TableCell>
                      <TableCell>{formatCurrency(veiculo.valor_fipe)}</TableCell>
                      <TableCell>
                        {veiculo.uso_aplicativo ? (
                          <div className="flex items-center gap-1">
                            <Smartphone className="h-3 w-3 text-muted-foreground" />
                            <Badge variant="outline" className="text-xs">
                              {veiculo.plataforma_app || 'Sim'}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3 text-muted-foreground" />
                          {(veiculo as any).associado?.nome || 'Sem associado'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[veiculoStatus]}>
                          {STATUS_VEICULO_LABELS[veiculoStatus]}
                        </Badge>
                      </TableCell>
                      {canDeleteVeiculo && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setVeiculoToDelete({ id: veiculo.id, placa: veiculo.placa });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
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
