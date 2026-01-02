import { useState } from 'react';
import { Search, FileText, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
import type { StatusContrato } from '@/types/database';

const mockContratos = [
  {
    id: '1',
    numero: 'CTR-20240115-0001',
    associado_nome: 'João Silva',
    associado_cpf: '123.456.789-00',
    plano_nome: 'Proteção Total',
    valor_adesao: 350,
    valor_mensal: 365,
    data_inicio: '2024-01-15',
    status: 'ativo' as StatusContrato,
  },
  {
    id: '2',
    numero: 'CTR-20240114-0001',
    associado_nome: 'Maria Santos',
    associado_cpf: '987.654.321-00',
    plano_nome: 'Proteção Básica',
    valor_adesao: 350,
    valor_mensal: 395,
    data_inicio: '2024-01-14',
    status: 'ativo' as StatusContrato,
  },
  {
    id: '3',
    numero: 'CTR-20240110-0001',
    associado_nome: 'Pedro Oliveira',
    associado_cpf: '456.789.123-00',
    plano_nome: 'Proteção Total',
    valor_adesao: 350,
    valor_mensal: 305,
    data_inicio: '2024-01-10',
    status: 'pendente' as StatusContrato,
  },
  {
    id: '4',
    numero: 'CTR-20240105-0001',
    associado_nome: 'Ana Costa',
    associado_cpf: '789.123.456-00',
    plano_nome: 'Proteção Premium',
    valor_adesao: 400,
    valor_mensal: 430,
    data_inicio: '2024-01-05',
    status: 'cancelado' as StatusContrato,
  },
];

const statusConfig: Record<StatusContrato, { label: string; color: string; icon: typeof FileText }> = {
  pendente: { label: 'Pendente', color: 'bg-yellow-500 text-white', icon: Clock },
  ativo: { label: 'Ativo', color: 'bg-green-500 text-white', icon: CheckCircle },
  suspenso: { label: 'Suspenso', color: 'bg-orange-500 text-white', icon: Clock },
  cancelado: { label: 'Cancelado', color: 'bg-destructive text-destructive-foreground', icon: XCircle },
};

export default function Contratos() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredContratos = mockContratos.filter((contrato) => {
    const matchesSearch =
      contrato.numero.toLowerCase().includes(search.toLowerCase()) ||
      contrato.associado_nome.toLowerCase().includes(search.toLowerCase()) ||
      contrato.associado_cpf.includes(search);
    const matchesStatus = statusFilter === 'all' || contrato.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Stats
  const stats = {
    total: mockContratos.length,
    ativos: mockContratos.filter((c) => c.status === 'ativo').length,
    pendentes: mockContratos.filter((c) => c.status === 'pendente').length,
    valorTotal: mockContratos
      .filter((c) => c.status === 'ativo')
      .reduce((acc, c) => acc + c.valor_mensal, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contratos</h1>
          <p className="text-muted-foreground">
            Visualize e gerencie contratos de adesão
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/10 p-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.ativos}</p>
                <p className="text-xs text-muted-foreground">Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-yellow-500/10 p-2">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pendentes}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent/10 p-2">
                <FileText className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(stats.valorTotal)}</p>
                <p className="text-xs text-muted-foreground">Receita Mensal</p>
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
            placeholder="Buscar por número, nome ou CPF..."
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
            {Object.entries(statusConfig).map(([key, value]) => (
              <SelectItem key={key} value={key}>
                {value.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Associado</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Adesão</TableHead>
                <TableHead>Mensal</TableHead>
                <TableHead>Data Início</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContratos.map((contrato) => {
                const status = statusConfig[contrato.status];
                return (
                  <TableRow key={contrato.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-mono text-sm">{contrato.numero}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{contrato.associado_nome}</p>
                        <p className="text-xs text-muted-foreground">{contrato.associado_cpf}</p>
                      </div>
                    </TableCell>
                    <TableCell>{contrato.plano_nome}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatCurrency(contrato.valor_adesao)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(contrato.valor_mensal)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(contrato.data_inicio)}
                    </TableCell>
                    <TableCell>
                      <Badge className={status.color}>
                        <status.icon className="mr-1 h-3 w-3" />
                        {status.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
