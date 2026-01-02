import { useState } from 'react';
import { Plus, Search, FileText, Calculator, Send, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import type { StatusCotacao } from '@/types/database';

const mockCotacoes = [
  {
    id: '1',
    numero: 'COT-20240115-0001',
    lead_nome: 'João Silva',
    plano_nome: 'Proteção Total',
    valor_fipe: 95000,
    valor_cota: 285,
    taxa_administrativa: 45,
    valor_rastreamento: 35,
    valor_adesao: 350,
    valor_total_mensal: 365,
    status: 'enviada' as StatusCotacao,
    created_at: '2024-01-15T10:00:00',
  },
  {
    id: '2',
    numero: 'COT-20240114-0001',
    lead_nome: 'Maria Santos',
    plano_nome: 'Proteção Básica',
    valor_fipe: 105000,
    valor_cota: 315,
    taxa_administrativa: 45,
    valor_rastreamento: 35,
    valor_adesao: 350,
    valor_total_mensal: 395,
    status: 'aceita' as StatusCotacao,
    created_at: '2024-01-14T14:30:00',
  },
  {
    id: '3',
    numero: 'COT-20240113-0001',
    lead_nome: 'Pedro Oliveira',
    plano_nome: 'Proteção Total',
    valor_fipe: 75000,
    valor_cota: 225,
    taxa_administrativa: 45,
    valor_rastreamento: 35,
    valor_adesao: 350,
    valor_total_mensal: 305,
    status: 'rascunho' as StatusCotacao,
    created_at: '2024-01-13T08:00:00',
  },
  {
    id: '4',
    numero: 'COT-20240112-0001',
    lead_nome: 'Ana Costa',
    plano_nome: 'Proteção Premium',
    valor_fipe: 68000,
    valor_cota: 340,
    taxa_administrativa: 50,
    valor_rastreamento: 40,
    valor_adesao: 400,
    valor_total_mensal: 430,
    status: 'recusada' as StatusCotacao,
    created_at: '2024-01-12T16:00:00',
  },
];

const statusConfig: Record<StatusCotacao, { label: string; color: string; icon: typeof FileText }> = {
  rascunho: { label: 'Rascunho', color: 'bg-muted text-muted-foreground', icon: FileText },
  enviada: { label: 'Enviada', color: 'bg-primary text-primary-foreground', icon: Send },
  aceita: { label: 'Aceita', color: 'bg-green-500 text-white', icon: Check },
  recusada: { label: 'Recusada', color: 'bg-destructive text-destructive-foreground', icon: X },
  expirada: { label: 'Expirada', color: 'bg-muted text-muted-foreground', icon: FileText },
};

export default function Cotacoes() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredCotacoes = mockCotacoes.filter((cotacao) => {
    const matchesSearch =
      cotacao.numero.toLowerCase().includes(search.toLowerCase()) ||
      cotacao.lead_nome.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || cotacao.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Stats
  const stats = {
    total: mockCotacoes.length,
    enviadas: mockCotacoes.filter((c) => c.status === 'enviada').length,
    aceitas: mockCotacoes.filter((c) => c.status === 'aceita').length,
    taxa: Math.round(
      (mockCotacoes.filter((c) => c.status === 'aceita').length /
        mockCotacoes.filter((c) => c.status !== 'rascunho').length) *
        100
    ),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cotações</h1>
          <p className="text-muted-foreground">
            Gerencie cotações e acompanhe propostas enviadas
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Cotação
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Calculator className="h-5 w-5 text-primary" />
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
              <div className="rounded-lg bg-blue-500/10 p-2">
                <Send className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.enviadas}</p>
                <p className="text-xs text-muted-foreground">Enviadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/10 p-2">
                <Check className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.aceitas}</p>
                <p className="text-xs text-muted-foreground">Aceitas</p>
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
                <p className="text-2xl font-bold">{stats.taxa}%</p>
                <p className="text-xs text-muted-foreground">Taxa Conversão</p>
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
            placeholder="Buscar por número ou cliente..."
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
                <TableHead>Cliente</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Valor FIPE</TableHead>
                <TableHead>Mensal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCotacoes.map((cotacao) => {
                const status = statusConfig[cotacao.status];
                return (
                  <TableRow key={cotacao.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-mono text-sm">{cotacao.numero}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                          {cotacao.lead_nome.charAt(0)}
                        </div>
                        <span>{cotacao.lead_nome}</span>
                      </div>
                    </TableCell>
                    <TableCell>{cotacao.plano_nome}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatCurrency(cotacao.valor_fipe)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(cotacao.valor_total_mensal)}
                    </TableCell>
                    <TableCell>
                      <Badge className={status.color}>
                        <status.icon className="mr-1 h-3 w-3" />
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(cotacao.created_at)}
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
