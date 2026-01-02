import { useState } from 'react';
import { Plus, Search, Users, Phone, Mail, MapPin } from 'lucide-react';
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
import { STATUS_ASSOCIADO_LABELS, type StatusAssociado } from '@/types/database';

const mockAssociados = [
  {
    id: '1',
    nome: 'João Silva',
    cpf: '123.456.789-00',
    telefone: '(11) 99999-1234',
    email: 'joao@email.com',
    cidade: 'São Paulo',
    uf: 'SP',
    plano_nome: 'Proteção Total',
    status: 'ativo' as StatusAssociado,
    veiculos_count: 1,
    created_at: '2024-01-15',
  },
  {
    id: '2',
    nome: 'Maria Santos',
    cpf: '987.654.321-00',
    telefone: '(11) 98888-5678',
    email: 'maria@email.com',
    cidade: 'Campinas',
    uf: 'SP',
    plano_nome: 'Proteção Básica',
    status: 'ativo' as StatusAssociado,
    veiculos_count: 2,
    created_at: '2024-01-14',
  },
  {
    id: '3',
    nome: 'Pedro Oliveira',
    cpf: '456.789.123-00',
    telefone: '(11) 97777-9012',
    email: 'pedro@email.com',
    cidade: 'Santos',
    uf: 'SP',
    plano_nome: 'Proteção Total',
    status: 'documentacao_pendente' as StatusAssociado,
    veiculos_count: 1,
    created_at: '2024-01-13',
  },
  {
    id: '4',
    nome: 'Ana Costa',
    cpf: '789.123.456-00',
    telefone: '(11) 96666-3456',
    email: 'ana@email.com',
    cidade: 'Guarulhos',
    uf: 'SP',
    plano_nome: 'Proteção Premium',
    status: 'aguardando_instalacao' as StatusAssociado,
    veiculos_count: 1,
    created_at: '2024-01-12',
  },
  {
    id: '5',
    nome: 'Carlos Lima',
    cpf: '321.654.987-00',
    telefone: '(11) 95555-7890',
    email: 'carlos@email.com',
    cidade: 'São Bernardo',
    uf: 'SP',
    plano_nome: 'Proteção Total',
    status: 'inadimplente' as StatusAssociado,
    veiculos_count: 1,
    created_at: '2024-01-10',
  },
];

const statusColors: Record<StatusAssociado, string> = {
  em_analise: 'bg-blue-500 text-white',
  documentacao_pendente: 'bg-yellow-500 text-white',
  aguardando_instalacao: 'bg-purple-500 text-white',
  ativo: 'bg-green-500 text-white',
  inadimplente: 'bg-orange-500 text-white',
  suspenso: 'bg-gray-500 text-white',
  cancelado: 'bg-destructive text-destructive-foreground',
};

export default function Associados() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredAssociados = mockAssociados.filter((associado) => {
    const matchesSearch =
      associado.nome.toLowerCase().includes(search.toLowerCase()) ||
      associado.cpf.includes(search) ||
      associado.telefone.includes(search);
    const matchesStatus = statusFilter === 'all' || associado.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  // Stats
  const stats = {
    total: mockAssociados.length,
    ativos: mockAssociados.filter((a) => a.status === 'ativo').length,
    pendentes: mockAssociados.filter((a) => 
      ['em_analise', 'documentacao_pendente', 'aguardando_instalacao'].includes(a.status)
    ).length,
    inadimplentes: mockAssociados.filter((a) => a.status === 'inadimplente').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Associados</h1>
          <p className="text-muted-foreground">
            Gerencie os associados e suas informações
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Associado
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Users className="h-5 w-5 text-primary" />
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
                <Users className="h-5 w-5 text-green-500" />
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
                <Users className="h-5 w-5 text-yellow-500" />
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
              <div className="rounded-lg bg-orange-500/10 p-2">
                <Users className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.inadimplentes}</p>
                <p className="text-xs text-muted-foreground">Inadimplentes</p>
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
            placeholder="Buscar por nome, CPF ou telefone..."
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
            {Object.entries(STATUS_ASSOCIADO_LABELS).map(([key, label]) => (
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Associado</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Veículos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Desde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssociados.map((associado) => (
                <TableRow key={associado.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                        {associado.nome.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{associado.nome}</p>
                        <p className="text-xs text-muted-foreground">{associado.cpf}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {associado.telefone}
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {associado.email}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {associado.cidade}/{associado.uf}
                    </div>
                  </TableCell>
                  <TableCell>{associado.plano_nome}</TableCell>
                  <TableCell className="text-center">{associado.veiculos_count}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[associado.status]}>
                      {STATUS_ASSOCIADO_LABELS[associado.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(associado.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
