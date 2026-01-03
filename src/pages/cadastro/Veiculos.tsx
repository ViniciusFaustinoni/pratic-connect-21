import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Car, User, Smartphone } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useVeiculos } from '@/hooks/useVeiculos';
import { useAssociados } from '@/hooks/useAssociados';
import { STATUS_VEICULO_LABELS, type StatusVeiculo } from '@/types/database';

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
  const { data: veiculos, isLoading } = useVeiculos();
  const { data: associados } = useAssociados();

  // Create a map of associado_id to nome for quick lookup
  const associadoMap = new Map(
    associados?.map((a) => [a.id, a.nome]) || []
  );

  const filteredVeiculos = veiculos?.filter((veiculo) => {
    const associadoNome = associadoMap.get(veiculo.associado_id) || '';
    const matchesSearch =
      veiculo.placa.toLowerCase().includes(search.toLowerCase()) ||
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

  // Stats
  const stats = {
    total: veiculos?.length || 0,
    ativos: veiculos?.filter((v) => (v.status as StatusVeiculo) === 'ativo' || (!v.status && v.ativo)).length || 0,
    valorTotal: veiculos?.filter((v) => (v.status as StatusVeiculo) === 'ativo' || (!v.status && v.ativo)).reduce((acc, v) => acc + (v.valor_fipe || 0), 0) || 0,
  };

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
                {isLoading ? (
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
                {isLoading ? (
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
                {isLoading ? (
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVeiculos.map((veiculo) => {
                  const veiculoStatus = (veiculo.status as StatusVeiculo) || (veiculo.ativo ? 'ativo' : 'cancelado');
                  return (
                    <TableRow 
                      key={veiculo.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        const associado = associados?.find(a => a.id === veiculo.associado_id);
                        if (associado) {
                          navigate(`/cadastro/associados/${associado.id}`);
                        }
                      }}
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
                          {associadoMap.get(veiculo.associado_id) || 'Desconhecido'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[veiculoStatus]}>
                          {STATUS_VEICULO_LABELS[veiculoStatus]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
